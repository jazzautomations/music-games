/**
 * audioEngine.ts — Engine de áudio com Tone.js
 *
 * Substitui os oscillators simples por instrumentos sintetizados de qualidade.
 * Usa Tone.js (PolySynth, AMSynth, FMSynth) pra simular piano, guitarra, baixo, etc.
 *
 * Inspirado no TonePlayer.js do Theta Music Trainer que usa SoundJS.
 */

import * as Tone from "tone";

export type InstrumentType = "piano" | "guitar" | "bass" | "organ" | "synth" | "marimba" | "flute";

let initialized = false;
let masterVolume = -6; // dB

// Instrumentos
const instruments: Partial<Record<InstrumentType, Tone.PolySynth>> = {};

/**
 * Inicializa o Tone.js (deve ser chamado após user gesture).
 */
export async function initAudio(): Promise<void> {
  if (initialized) return;
  await Tone.start();
  Tone.Destination.volume.value = masterVolume;
  initialized = true;
}

/**
 * Cria um instrumento sintetizado.
 */
function createInstrument(type: InstrumentType): Tone.PolySynth {
  switch (type) {
    case "piano":
      // Piano: AMSynth com envelope rápido
      return new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 2,
        modulationIndex: 10,
        oscillator: { type: "triangle" },
        envelope: { attack: 0.005, decay: 0.3, sustain: 0.3, release: 0.8 },
        modulation: { type: "square" },
        modulationEnvelope: { attack: 0.02, decay: 0.2, sustain: 0, release: 0.2 },
      }).toDestination();

    case "guitar":
      // Guitarra: FMSynth com ataque pluck
      return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3,
        modulationIndex: 12,
        oscillator: { type: "sine" },
        envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 1.2 },
        modulation: { type: "triangle" },
        modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0, release: 0.5 },
      }).toDestination();

    case "bass":
      // Baixo: oscilador grave com filtro
      return new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: "sawtooth" },
        filter: { Q: 2, type: "lowpass", rolloff: -24 },
        envelope: { attack: 0.01, decay: 0.4, sustain: 0.3, release: 0.8 },
        filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.5, baseFrequency: 80, octaves: 3 },
      }).toDestination();

    case "organ":
      // Órgão: osciladores múltiplos sustentados
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatsine", count: 3, spread: 10 },
        envelope: { attack: 0.02, decay: 0, sustain: 1, release: 0.3 },
      }).toDestination();

    case "synth":
      // Synth lead
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatsawtooth", count: 2, spread: 20 },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.6 },
      }).toDestination();

    case "marimba":
      // Marimba: sine com ataque percussivo
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.4 },
      }).toDestination();

    case "flute":
      // Flauta: triangle sustentado
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.1, decay: 0, sustain: 0.8, release: 0.4 },
      }).toDestination();

    default:
      return new Tone.PolySynth(Tone.Synth).toDestination();
  }
}

/**
 * Toca uma nota com o instrumento especificado.
 *
 * @param freq Frequência em Hz
 * @param duration Duração em segundos
 * @param instrument Tipo de instrumento (default: piano)
 * @param time Tempo de início (opcional, default = agora)
 */
export function playNote(
  freq: number,
  duration: number = 0.5,
  instrument: InstrumentType = "piano",
  time?: number
): void {
  if (!initialized) return;
  if (!instruments[instrument]) {
    instruments[instrument] = createInstrument(instrument);
  }
  const startTime = time ?? Tone.now();
  instruments[instrument]!.triggerAttackRelease(freq, duration, startTime);
}

/**
 * Toca uma melodia (sequência de notas).
 */
export function playMelody(
  freqs: number[],
  noteDuration: number = 0.4,
  instrument: InstrumentType = "piano"
): void {
  if (!initialized) return;
  freqs.forEach((freq, i) => {
    playNote(freq, noteDuration * 0.9, instrument, Tone.now() + i * noteDuration);
  });
}

/**
 * Toca um acorde (notas simultâneas).
 */
export function playChord(
  freqs: number[],
  duration: number = 1.0,
  instrument: InstrumentType = "piano"
): void {
  if (!initialized) return;
  if (!instruments[instrument]) {
    instruments[instrument] = createInstrument(instrument);
  }
  instruments[instrument]!.triggerAttackRelease(freqs, duration);
}

/**
 * Toca uma progressão de acordes.
 */
export function playProgression(
  chords: number[][],
  chordDuration: number = 1.0,
  instrument: InstrumentType = "piano"
): void {
  if (!initialized) return;
  chords.forEach((chord, i) => {
    const startTime = Tone.now() + i * chordDuration;
    if (!instruments[instrument]) {
      instruments[instrument] = createInstrument(instrument);
    }
    instruments[instrument]!.triggerAttackRelease(chord, chordDuration * 0.9, startTime);
  });
}

/**
 * Toca um ritmo (padrão de beats).
 *
 * @param pattern Array de booleans (true = beat, false = silêncio)
 * @param beatDuration Duração de cada beat em segundos
 */
export function playRhythm(
  pattern: boolean[],
  beatDuration: number = 0.3
): void {
  if (!initialized) return;
  // Usa um drum synth
  if (!instruments["marimba"]) {
    instruments["marimba"] = createInstrument("marimba");
  }
  pattern.forEach((beat, i) => {
    if (beat) {
      playNote(200, 0.1, "marimba", Tone.now() + i * beatDuration);
    }
  });
}

/**
 * Define o volume master (em dB).
 */
export function setVolume(db: number): void {
  masterVolume = db;
  if (initialized) {
    Tone.Destination.volume.value = db;
  }
}

/**
 * Para todos os sons.
 */
export function stopAll(): void {
  if (!initialized) return;
  Object.values(instruments).forEach((inst) => {
    inst?.releaseAll();
  });
}

/**
 * Converte MIDI note para nome de nota no formato Tone.js (ex: "C4").
 */
export function midiToNoteName(midi: number): string {
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  const noteName = NOTE_NAMES[((midi % 12) + 12) % 12];
  return `${noteName}${octave}`;
}

/**
 * Converte MIDI para frequência.
 */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
