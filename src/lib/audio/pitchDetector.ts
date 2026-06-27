/**
 * pitchDetector.ts — Detecção de pitch vocal via algoritmo YIN
 *
 * YIN é o algoritmo padrão da indústria pra detecção de pitch em voz humana.
 * Precisão sub-cent (bem melhor que FFT simples). Funciona bem pra:
 *  - Voz cantada (incluindo vibrato)
 *  - Notas sustentadas
 *  - Pitch tracking em tempo real
 *
 * Referência: "YIN, a fundamental frequency estimator for speech and music"
 * (de Cheveigné & Kawahara, 2002)
 */

export interface PitchDetection {
  /** Frequência detectada em Hz (0 se silêncio) */
  frequency: number;
  /** MIDI note number (float, com cents fracionados) */
  midi: number;
  /** MIDI note arredondado */
  midiRounded: number;
  /** Nome da nota (ex: "C", "C#", "D") */
  noteName: string;
  /** Oitava (ex: 4 pra A4 = 440Hz) */
  octave: number;
  /** Nome completo (ex: "A4") */
  fullName: string;
  /** Desvio em cents da nota mais próxima (-50 a +50) */
  centsOff: number;
  /** Confiança 0-1 (probabilidade de ser voz vs ruído) */
  confidence: number;
  /** Estava silencioso? */
  isSilent: boolean;
}

const A4_FREQ = 440.0;
const A4_MIDI = 69;
export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function freqToMidi(freq: number): { midiFloat: number; midi: number; noteName: string; octave: number; fullName: string; centsOff: number } {
  if (freq <= 0) {
    return { midiFloat: 0, midi: 0, noteName: "", octave: 0, fullName: "", centsOff: 0 };
  }
  const midiFloat = 12 * Math.log2(freq / A4_FREQ) + A4_MIDI;
  const midi = Math.round(midiFloat);
  const centsOff = Math.round((midiFloat - midi) * 100);
  const noteIdx = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const noteName = NOTE_NAMES[noteIdx];
  return { midiFloat, midi, noteName, octave, fullName: `${noteName}${octave}`, centsOff };
}

/**
 * Algoritmo YIN pra detecção de pitch.
 *
 * Passos:
 *  1. Calcula a diferença function (squared difference)
 *  2. Calcula a cumulative mean normalized difference (CMND)
 *  3. Acha o primeiro vale abaixo do threshold (0.1-0.15)
 *  4. Refina com interpolação parabólica
 *
 * @param buffer Float32Array com amostras de áudio (mono)
 * @param sampleRate taxa de amostragem
 * @param threshold YIN threshold (default 0.12) — menor = mais restritivo
 * @returns PitchDetection ou null
 */
export function detectPitchYIN(
  buffer: Float32Array,
  sampleRate: number,
  threshold = 0.12
): PitchDetection | null {
  const bufferSize = buffer.length;
  if (bufferSize < 512) return null;

  // Range de pitches pra voz humana: 70Hz (F2) a 1000Hz (B5)
  // Pra violão: 82Hz (E2) a 660Hz (E5)
  const minFreq = 70;
  const maxFreq = 1000;
  const minTau = Math.floor(sampleRate / maxFreq);
  const maxTau = Math.min(Math.floor(sampleRate / minFreq), bufferSize / 2);

  // Step 1: Diff function
  const diff = new Float32Array(maxTau);
  for (let tau = minTau; tau < maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < maxTau; i++) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // Step 2: Cumulative mean normalized difference
  const cmnd = new Float32Array(maxTau);
  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < maxTau; tau++) {
    runningSum += diff[tau];
    cmnd[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
  }

  // Step 3: Acha o primeiro vale abaixo do threshold
  let tauEstimate = -1;
  for (let tau = minTau; tau < maxTau - 1; tau++) {
    if (cmnd[tau] < threshold) {
      // Desce até o mínimo local
      while (tau + 1 < maxTau && cmnd[tau + 1] < cmnd[tau]) {
        tau++;
      }
      tauEstimate = tau;
      break;
    }
  }

  if (tauEstimate === -1) {
    // Sem pitch detectado — provavelmente silêncio ou ruído
    // Verifica RMS pra confirmar silêncio
    let sumSq = 0;
    for (let i = 0; i < bufferSize; i++) sumSq += buffer[i] * buffer[i];
    const rms = Math.sqrt(sumSq / bufferSize);
    return {
      frequency: 0,
      midi: 0,
      midiRounded: 0,
      noteName: "",
      octave: 0,
      fullName: "",
      centsOff: 0,
      confidence: 0,
      isSilent: rms < 0.01,
    };
  }

  // Step 4: Interpolação parabólica pra refinar
  let betterTau = tauEstimate;
  if (tauEstimate > 0 && tauEstimate < maxTau - 1) {
    const x0 = tauEstimate - 1;
    const x1 = tauEstimate;
    const x2 = tauEstimate + 1;
    const y0 = cmnd[x0];
    const y1 = cmnd[x1];
    const y2 = cmnd[x2];
    const denom = 2 * (2 * y1 - y2 - y0);
    if (denom !== 0) {
      betterTau = tauEstimate + (y2 - y0) / denom;
    }
  }

  const frequency = sampleRate / betterTau;

  // Confiança: 1 - valor da CMND no ponto detectado
  const confidence = Math.max(0, Math.min(1, 1 - cmnd[tauEstimate]));

  // Verifica silêncio por RMS
  let sumSq = 0;
  for (let i = 0; i < bufferSize; i++) sumSq += buffer[i] * buffer[i];
  const rms = Math.sqrt(sumSq / bufferSize);
  const isSilent = rms < 0.005;

  if (isSilent) {
    return {
      frequency: 0, midi: 0, midiRounded: 0, noteName: "", octave: 0,
      fullName: "", centsOff: 0, confidence: 0, isSilent: true,
    };
  }

  const note = freqToMidi(frequency);
  return {
    frequency,
    midi: note.midiFloat,
    midiRounded: note.midi,
    noteName: note.noteName,
    octave: note.octave,
    fullName: note.fullName,
    centsOff: note.centsOff,
    confidence,
    isSilent: false,
  };
}

/**
 * Microphone input manager.
 */
export class MicManager {
  private audioCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private buffer: Float32Array | null = null;

  async start(bufferSize = 2048): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      } as MediaTrackConstraints,
    });

    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new Ctx();
    if (this.audioCtx.state === "suspended") await this.audioCtx.resume();

    this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = bufferSize;
    this.analyser.smoothingTimeConstant = 0;
    this.sourceNode.connect(this.analyser);
    this.buffer = new Float32Array(this.analyser.fftSize);
  }

  /** Pega um frame do microfone e roda YIN */
  detectPitch(threshold = 0.12): PitchDetection | null {
    if (!this.analyser || !this.buffer) return null;
    this.analyser.getFloatTimeDomainData(this.buffer);
    return detectPitchYIN(this.buffer, this.audioCtx!.sampleRate, threshold);
  }

  stop(): void {
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch { /* */ }
      this.sourceNode = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.analyser = null;
    this.buffer = null;
  }

  isActive(): boolean {
    return this.audioCtx !== null && this.audioCtx.state === "running";
  }

  getSampleRate(): number {
    return this.audioCtx?.sampleRate ?? 44100;
  }
}

/**
 * Toca um tom de referência (sine wave) por X ms.
 */
export function playTone(frequency: number, durationMs: number, audioCtx?: AudioContext): void {
  const ctx = audioCtx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + durationMs / 1000 + 0.05);
}

/**
 * Toca uma sequência de tons (melodia).
 */
export function playMelody(frequencies: number[], noteDurationMs: number, audioCtx?: AudioContext): void {
  const ctx = audioCtx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  frequencies.forEach((freq, i) => {
    const startTime = ctx.currentTime + (i * noteDurationMs) / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDurationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + noteDurationMs / 1000 + 0.05);
  });
}

/**
 * Toca um acorde (várias notas simultâneas).
 */
export function playChord(frequencies: number[], durationMs: number, audioCtx?: AudioContext): void {
  const ctx = audioCtx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const startTime = ctx.currentTime;
  frequencies.forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.08, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + durationMs / 1000 + 0.05);
  });
}
