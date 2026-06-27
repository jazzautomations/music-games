/**
 * soundfontEngine.ts — Engine de áudio com instrumentos REAIS gravados
 *
 * Usa os SoundFonts do FluidR3_GM (General MIDI) hospedados no GitHub.
 * Cada instrumento é carregado sob demanda com samples REAIS de áudio:
 * - Piano acústico gravado de um piano real
 * - Guitarra acústica gravada
 * - Flauta gravada
 * - Saxofone gravado
 * - etc
 *
 * Fonte: https://gleitz.github.io/midi-js-soundfonts/ (free, open source)
 */

import * as Tone from "tone";

const SOUNDFONT_BASE = "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM";

export type RealInstrument =
  | "acoustic_grand_piano"
  | "acoustic_guitar_nylon"
  | "acoustic_guitar_steel"
  | "electric_guitar_jazz"
  | "electric_bass_finger"
  | "violin"
  | "flute"
  | "soprano_sax"
  | "trumpet"
  | "vibraphone"
  | "harpsichord"
  | "church_organ"
  | "marimba"
  | "cello"
  | "clarinet"
  | "trombone";

const INSTRUMENT_LABELS: Record<RealInstrument, string> = {
  acoustic_grand_piano: "Piano",
  acoustic_guitar_nylon: "Violão Nylon",
  acoustic_guitar_steel: "Violão Aço",
  electric_guitar_jazz: "Guitarra Jazz",
  electric_bass_finger: "Baixo",
  violin: "Violino",
  flute: "Flauta",
  soprano_sax: "Sax Soprano",
  trumpet: "Trompete",
  vibraphone: "Vibrafone",
  harpsichord: "Cravo",
  church_organ: "Órgão",
  marimba: "Marimba",
  cello: "Violoncelo",
  clarinet: "Clarinete",
  trombone: "Trombone",
};

const samplers: Partial<Record<RealInstrument, Tone.Sampler>> = {};
const loadingPromises: Partial<Record<RealInstrument, Promise<Tone.Sampler>>> = {};
let initialized = false;

export async function initAudio(): Promise<void> {
  if (initialized) return;
  await Tone.start();
  Tone.Destination.volume.value = -6;
  initialized = true;
}

/**
 * Carrega um instrumento real sob demanda.
 * Cada sample é um áudio MP3 gravado de um instrumento real.
 */
export async function loadInstrument(instrument: RealInstrument): Promise<Tone.Sampler> {
  if (samplers[instrument]) return samplers[instrument]!;
  if (loadingPromises[instrument]) return loadingPromises[instrument]!;

  const promise = new Promise<Tone.Sampler>(async (resolve, reject) => {
    try {
      // Notas base para o sampler (1 oitava = 12 notas)
      // O Tone.Sampler faz pitch-shifting entre as notas carregadas
      const baseNotes: Record<string, string> = {};
      const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
      // Carrega samples de C em cada oitava (suficiente pra pitch-shift)
      for (const octave of ["2", "3", "4", "5", "6"]) {
        const note = `C${octave}`;
        baseNotes[note] = `${SOUNDFONT_BASE}/${instrument}-mp3/${note}.mp3`;
      }

      const sampler = new Tone.Sampler({
        urls: baseNotes,
        onload: () => {
          samplers[instrument] = sampler;
          resolve(sampler);
        },
        onerror: (err) => {
          console.error(`[soundfontEngine] Erro ao carregar ${instrument}:`, err);
          reject(err);
        },
      }).toDestination();

      // Timeout de 15s
      setTimeout(() => {
        if (!samplers[instrument]) {
          // Se ainda não carregou, resolve anyway (vai usar pitch-shift do que tiver)
          samplers[instrument] = sampler;
          resolve(sampler);
        }
      }, 15000);
    } catch (err) {
      reject(err);
    }
  });

  loadingPromises[instrument] = promise;
  return promise;
}

/**
 * Toca uma nota com instrumento real.
 *
 * @param freq Frequência em Hz
 * @param duration Duração em segundos
 * @param instrument Instrumento real (carrega sob demanda se ainda não carregou)
 * @param time Quando tocar (opcional)
 */
export async function playNoteReal(
  freq: number,
  duration: number = 0.5,
  instrument: RealInstrument = "acoustic_grand_piano",
  time?: number
): Promise<void> {
  if (!initialized) return;

  let sampler = samplers[instrument];
  if (!sampler) {
    sampler = await loadInstrument(instrument);
  }

  const noteName = freqToNoteName(freq);
  const startTime = time ?? Tone.now();
  sampler.triggerAttackRelease(noteName, duration, startTime);
}

/**
 * Toca uma melodia com instrumento real.
 */
export async function playMelodyReal(
  freqs: number[],
  noteDuration: number = 0.4,
  instrument: RealInstrument = "acoustic_grand_piano"
): Promise<void> {
  if (!initialized) return;

  let sampler = samplers[instrument];
  if (!sampler) {
    sampler = await loadInstrument(instrument);
  }

  freqs.forEach((freq, i) => {
    const noteName = freqToNoteName(freq);
    const startTime = Tone.now() + i * noteDuration;
    sampler!.triggerAttackRelease(noteName, noteDuration * 0.9, startTime);
  });
}

/**
 * Toca um acorde com instrumento real.
 */
export async function playChordReal(
  freqs: number[],
  duration: number = 1.0,
  instrument: RealInstrument = "acoustic_grand_piano"
): Promise<void> {
  if (!initialized) return;

  let sampler = samplers[instrument];
  if (!sampler) {
    sampler = await loadInstrument(instrument);
  }

  const noteNames = freqs.map(freqToNoteName);
  sampler.triggerAttackRelease(noteNames, duration);
}

/**
 * Toca uma progressão de acordes.
 */
export async function playProgressionReal(
  chords: number[][],
  chordDuration: number = 1.0,
  instrument: RealInstrument = "acoustic_grand_piano"
): Promise<void> {
  if (!initialized) return;

  let sampler = samplers[instrument];
  if (!sampler) {
    sampler = await loadInstrument(instrument);
  }

  chords.forEach((chord, i) => {
    const startTime = Tone.now() + i * chordDuration;
    const noteNames = chord.map(freqToNoteName);
    sampler!.triggerAttackRelease(noteNames, chordDuration * 0.9, startTime);
  });
}

/**
 * Pré-carrega instrumentos (mostra loading enquanto baixa).
 */
export async function preloadInstruments(instruments: RealInstrument[]): Promise<void> {
  await Promise.all(instruments.map(loadInstrument));
}

/**
 * Converte frequência → nome de nota Tone.js (ex: 440 → "A4")
 */
function freqToNoteName(freq: number): string {
  const A4 = 440;
  const midi = Math.round(12 * Math.log2(freq / A4) + 69);
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  const noteIdx = ((midi % 12) + 12) % 12;
  return `${NOTE_NAMES[noteIdx]}${octave}`;
}

/**
 * Converte MIDI → frequência
 */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Lista de instrumentos disponíveis
 */
export function getAvailableInstruments(): { id: RealInstrument; label: string }[] {
  return (Object.keys(INSTRUMENT_LABELS) as RealInstrument[]).map(id => ({
    id,
    label: INSTRUMENT_LABELS[id],
  }));
}

/**
 * Para todos os sons
 */
export function stopAll(): void {
  if (!initialized) return;
  Object.values(samplers).forEach(s => s?.releaseAll?.());
}
