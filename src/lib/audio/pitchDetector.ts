/**
 * pitchDetector.ts — Detecção de pitch via Autocorrelação
 *
 * Engine de pitch detection inspirado no Theta Music Trainer.
 * Algoritmo: autocorrelação com bucket system + mic gain boost.
 *
 * Correções aplicadas:
 *  - 12 buckets exatos (off-by-one corrigido)
 *  - Bounds check na interpolação (evita crash)
 *  - Mic gain de 2.0x pra melhor captação
 *  - minSamples = 20 pra pular ruído de baixa frequência
 *  - Thresholds de detecção mais responsivos
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

export function freqToMidi(freq: number): { midiFloat: number; midi: number; noteName: string; octave: number; fullName: string; centsOff: number } {
  if (freq <= 0) return { midiFloat: 0, midi: 0, noteName: "", octave: 0, fullName: "", centsOff: 0 };
  const midiFloat = 12 * Math.log2(freq / A4_FREQ) + A4_MIDI;
  const midi = Math.round(midiFloat);
  const centsOff = Math.round((midiFloat - midi) * 100);
  const noteIdx = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return { midiFloat, midi, noteName: NOTE_NAMES[noteIdx], octave, fullName: `${NOTE_NAMES[noteIdx]}${octave}`, centsOff };
}

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
  private micGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private buffer: Float32Array | null = null;
  private buflen = 1024;

  private buckets: PitchBucket[] = [];
  private lastDetectedPitch = -1;
  private lastFrequency = -1;
  private minSamples = 20;

  constructor() {
    this.initBuckets();
  }

  private initBuckets(): void {
    this.buckets = [];
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    for (let i = 0; i < 12; i++) {
      const f1 = 329.63 * Math.pow(2, i / 12);
      const f2 = 329.63 * Math.pow(2, (i + 1) / 12);
      this.buckets.push({ index: i, freqFrom: f1, freqTo: f2, note: notes[i], count: 0 });
    }
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

    // Mic gain boost — dobra o sinal pra melhor detecção
    this.micGain = this.audioCtx.createGain();
    this.micGain.gain.value = 2.0;

    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;

    this.sourceNode.connect(this.micGain);
    this.micGain.connect(this.analyser);
    this.buffer = new Float32Array(this.buflen);
  }

  private autoCorrelate(buf: Float32Array, sampleRate: number): number {
    const SIZE = buf.length;
    const MAX_SAMPLES = Math.floor(SIZE / 2);
    let best_offset = -1;
    let best_correlation = 0;
    let rms = 0;
    let foundGoodCorrelation = false;
    const correlations = new Array(MAX_SAMPLES);

    for (let i = 0; i < SIZE; i++) {
      const val = buf[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1;

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
      } else if (foundGoodCorrelation && best_offset > 0 && best_offset < MAX_SAMPLES - 1) {
        // Bounds check: garante que best_offset-1 e best_offset+1 existem
        const prev = correlations[best_offset - 1];
        const curr = correlations[best_offset];
        const next = correlations[best_offset + 1];
        if (prev !== undefined && curr !== undefined && next !== undefined) {
          const shift = (next - prev) / curr;
          return sampleRate / (best_offset + 8 * shift);
        }
        return sampleRate / best_offset;
      }
      lastCorrelation = correlation;
    }

    if (best_correlation > 0.01 && best_offset > 0) {
      return sampleRate / best_offset;
    }
    return -1;
  }

  private fadeBuckets(): void {
    for (const bucket of this.buckets) {
      bucket.count *= 0.905;
    }
  }

  private findBucket(freq: number): void {
    for (const bucket of this.buckets) {
      if (freq >= bucket.freqFrom && freq < bucket.freqTo) {
        bucket.count += 1;
        break;
      }
    }
  }

  detectPitch(_threshold = 0.12): PitchDetection | null {
    if (!this.analyser || !this.buffer || !this.audioCtx) return null;

    this.analyser.getFloatTimeDomainData(this.buffer);
    const ac = this.autoCorrelate(this.buffer, this.audioCtx.sampleRate);
    this.lastFrequency = ac;

    this.fadeBuckets();

    if (ac !== -1) {
      this.findBucket(ac);
    }

    let numBucketsOverHalfway = 0;
    let highestIndex = -1;
    let highestCount = -1;

    for (let i = 0; i < this.buckets.length; i++) {
      const bucket = this.buckets[i];
      if (bucket.count > 50) numBucketsOverHalfway++;
      if (bucket.count > highestCount) {
        highestCount = bucket.count;
        highestIndex = i;
      }
    }

    this.lastDetectedPitch = -1;

    if (numBucketsOverHalfway === 1 && highestCount > 30) {
      this.lastDetectedPitch = highestIndex;
    }

    if (ac === -1 || this.lastDetectedPitch === -1) {
      let sumSq = 0;
      for (let i = 0; i < this.buffer.length; i++) sumSq += this.buffer[i] * this.buffer[i];
      const rms = Math.sqrt(sumSq / this.buffer.length);
      return {
        frequency: 0, midi: 0, midiRounded: 0, noteName: "", octave: 0,
        fullName: "", centsOff: 0, confidence: 0, isSilent: rms < 0.01,
      };
    }

    const note = freqToMidi(ac);
    const confidence = Math.min(1, highestCount / 100);

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
    if (this.micGain) { try { this.micGain.disconnect(); } catch { /* */ } this.micGain = null; }
    if (this.sourceNode) { try { this.sourceNode.disconnect(); } catch { /* */ } this.sourceNode = null; }
    if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
    if (this.audioCtx) { this.audioCtx.close().catch(() => {}); this.audioCtx = null; }
    this.analyser = null;
    this.buffer = null;
    this.initBuckets();
  }

  isActive(): boolean { return this.audioCtx !== null && this.audioCtx.state === "running"; }
  getSampleRate(): number { return this.audioCtx?.sampleRate ?? 44100; }
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