/**
 * pitchDetector.ts — Detecção de pitch via Autocorrelação
 *
 * Engine de pitch detection PORTADA do Theta Music Trainer.
 * Algoritmo: autocorrelação com bucket system (NÃO YIN).
 *
 * Referência: código extraído do JS real do Theta Music Trainer
 * (trainer.thetamusic.com/ssi/tachikawa/game/js/)
 *
 * Como funciona:
 *  1. Pega 1024 samples do microfone via AnalyserNode
 *  2. Calcula RMS → se < 0.01, retorna silêncio
 *  3. Para cada offset (0 a SIZE/2), calcula correlação:
 *     correlation = 1 - (sum(|buf[i] - buf[i+offset]|) / MAX_SAMPLES)
 *  4. Se correlation > 0.9 e > que a anterior, guarda como best_offset
 *  5. Interpola: frequency = sampleRate / (best_offset + 8 * shift)
 *  6. Mapeia frequência pra 12 buckets (pitch classes) com fade 0.905/frame
 *  7. Se um bucket tem count > 70 e os outros < 70, pitch detectado
 */

export interface PitchDetection {
  frequency: number;
  midi: number;
  midiRounded: number;
  noteName: string;
  octave: number;
  fullName: string;
  centsOff: number;
  confidence: number;
  isSilent: boolean;
}

const A4_FREQ = 440.0;
const A4_MIDI = 69;
export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Theta usa esta ordem de notas (começando em Bb)
const THETA_NOTES = ["Bb", "B", "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A"];

export function freqToMidi(freq: number): { midiFloat: number; midi: number; noteName: string; octave: number; fullName: string; centsOff: number } {
  if (freq <= 0) return { midiFloat: 0, midi: 0, noteName: "", octave: 0, fullName: "", centsOff: 0 };
  const midiFloat = 12 * Math.log2(freq / A4_FREQ) + A4_MIDI;
  const midi = Math.round(midiFloat);
  const centsOff = Math.round((midiFloat - midi) * 100);
  const noteIdx = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return { midiFloat, midi, noteName: NOTE_NAMES[noteIdx], octave, fullName: `${NOTE_NAMES[noteIdx]}${octave}`, centsOff };
}

/**
 * PitchBucket — Bucket de pitch class (igual ao Theta)
 * Cada bucket acumula "count" quando a frequência detectada cai nele.
 * Fade de 0.905 por frame (decaimento exponencial).
 */
interface PitchBucket {
  index: number;
  freqFrom: number;
  freqTo: number;
  note: string;
  count: number;
}

export class MicManager {
  private audioCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private buffer: Float32Array | null = null;
  private buflen = 1024;

  // Bucket system (igual ao Theta)
  private buckets: PitchBucket[] = [];
  private lastDetectedPitch = -1;
  private lastFrequency = -1;
  private minSamples = 0;

  constructor() {
    this.initBuckets();
  }

  /**
   * Inicializa os 12 buckets de pitch class.
   * Usa a mesma fórmula do Theta: 3520 * Math.pow(1.02930223664, n)
   */
  private initBuckets(): void {
    this.buckets = [];
    let noteIndex = 0;
    let lastFreq = 0;
    let count = 0;

    for (let n = 0; n < 26; n++) {
      const f = 3520 * Math.pow(1.02930223664, n);
      if (count % 2 === 1) {
        if (lastFreq !== 0) {
          this.buckets.push({
            index: noteIndex,
            freqFrom: lastFreq,
            freqTo: f,
            note: THETA_NOTES[noteIndex],
            count: 0.0,
          });
          noteIndex = (noteIndex + 1) % 12;
        }
        lastFreq = f;
      }
      count++;
    }

    // Theta reordena pra começar em C
    this.buckets.push(this.buckets.shift()!);
    this.buckets.push(this.buckets.shift()!);
  }

  async start(_bufferSize = 2048): Promise<void> {
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
    this.analyser.fftSize = 2048; // igual ao Theta
    this.sourceNode.connect(this.analyser);
    this.buffer = new Float32Array(this.buflen);
  }

  /**
   * Autocorrelação — algoritmo extraído do Theta Music Trainer.
   *
   * Para cada offset, calcula:
   *   correlation = 1 - (sum(|buf[i] - buf[i+offset]|) / MAX_SAMPLES)
   *
   * Se correlation > 0.9 e > que a anterior, guarda como best_offset.
   * Interpola com shift dos vizinhos.
   */
  private autoCorrelate(buf: Float32Array, sampleRate: number): number {
    const SIZE = buf.length;
    const MAX_SAMPLES = Math.floor(SIZE / 2);
    let best_offset = -1;
    let best_correlation = 0;
    let rms = 0;
    let foundGoodCorrelation = false;
    const correlations = new Array(MAX_SAMPLES);

    // Calcula RMS
    for (let i = 0; i < SIZE; i++) {
      const val = buf[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1; // not enough signal

    let lastCorrelation = 1;
    for (let offset = this.minSamples; offset < MAX_SAMPLES; offset++) {
      let correlation = 0;
      for (let i = 0; i < MAX_SAMPLES; i++) {
        correlation += Math.abs(buf[i] - buf[i + offset]);
      }
      correlation = 1 - correlation / MAX_SAMPLES;
      correlations[offset] = correlation;

      if (correlation > 0.9 && correlation > lastCorrelation) {
        foundGoodCorrelation = true;
        if (correlation > best_correlation) {
          best_correlation = correlation;
          best_offset = offset;
        }
      } else if (foundGoodCorrelation) {
        // Interpolação (igual ao Theta)
        const shift = (correlations[best_offset + 1] - correlations[best_offset - 1]) / correlations[best_offset];
        return sampleRate / (best_offset + 8 * shift);
      }
      lastCorrelation = correlation;
    }

    if (best_correlation > 0.01) {
      return sampleRate / best_offset;
    }
    return -1;
  }

  /**
   * Fade buckets — decaimento exponencial 0.905 por frame (igual ao Theta).
   */
  private fadeBuckets(): void {
    for (const bucket of this.buckets) {
      bucket.count *= 0.905;
    }
  }

  /**
   * Encontra qual bucket a frequência pertence e incrementa o count.
   */
  private findBucket(freq: number): void {
    for (const bucket of this.buckets) {
      if (freq >= bucket.freqFrom && freq < bucket.freqTo) {
        bucket.count += 1;
        break;
      }
    }
  }

  /**
   * Detecta pitch — método principal (igual ao Theta).
   * Retorna PitchDetection com frequência, nota, cents, confiança.
   */
  detectPitch(_threshold = 0.12): PitchDetection | null {
    if (!this.analyser || !this.buffer || !this.audioCtx) return null;

    this.analyser.getFloatTimeDomainData(this.buffer);
    const ac = this.autoCorrelate(this.buffer, this.audioCtx.sampleRate);
    this.lastFrequency = ac;

    this.fadeBuckets();

    if (ac !== -1) {
      this.findBucket(ac);
    }

    // Verifica qual bucket tem o count mais alto
    let numBucketsOverHalfway = 0;
    let highestIndex = -1;
    let highestCount = -1;

    for (let i = 0; i < this.buckets.length; i++) {
      const bucket = this.buckets[i];
      if (bucket.count > 70) numBucketsOverHalfway++;
      if (bucket.count > highestCount) {
        highestCount = bucket.count;
        highestIndex = i;
      }
    }

    this.lastDetectedPitch = -1;

    // Só detecta se exatamente 1 bucket está "over halfway" e count > 40
    if (numBucketsOverHalfway === 1 && highestCount > 40) {
      this.lastDetectedPitch = highestIndex;
    }

    // Se não detectou pitch estável
    if (ac === -1 || this.lastDetectedPitch === -1) {
      // Verifica silêncio
      let sumSq = 0;
      for (let i = 0; i < this.buffer.length; i++) sumSq += this.buffer[i] * this.buffer[i];
      const rms = Math.sqrt(sumSq / this.buffer.length);
      return {
        frequency: 0, midi: 0, midiRounded: 0, noteName: "", octave: 0,
        fullName: "", centsOff: 0, confidence: 0, isSilent: rms < 0.01,
      };
    }

    const note = freqToMidi(ac);
    const confidence = Math.min(1, best_correlation_value(this.buckets, highestIndex));

    return {
      frequency: ac,
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

  stop(): void {
    if (this.sourceNode) { try { this.sourceNode.disconnect(); } catch { /* */ } this.sourceNode = null; }
    if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
    if (this.audioCtx) { this.audioCtx.close().catch(() => {}); this.audioCtx = null; }
    this.analyser = null;
    this.buffer = null;
    // Reset buckets
    this.initBuckets();
  }

  isActive(): boolean { return this.audioCtx !== null && this.audioCtx.state === "running"; }
  getSampleRate(): number { return this.audioCtx?.sampleRate ?? 44100; }
}

function best_correlation_value(buckets: PitchBucket[], idx: number): number {
  if (idx < 0 || idx >= buckets.length) return 0;
  return Math.min(1, buckets[idx].count / 100);
}

/**
 * Toca um tom de referência (sine wave).
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
