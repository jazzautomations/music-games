/**
 * musicTheory.ts — Teoria musical pra jogos de canto
 *
 * Gera escalas, intervalos, acordes e converte tudo em frequências.
 */

const A4_FREQ = 440.0;
const A4_MIDI = 69;

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const SOLFEGE_NAMES = ["Do", "Di", "Re", "Ra", "Mi", "Fa", "Fi", "Sol", "Si", "La", "Li", "Ti"];

/** Converte MIDI → frequência (Hz) */
export function midiToFreq(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/** Converte frequência → MIDI (float) */
export function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / A4_FREQ) + A4_MIDI;
}

/**
 * Padrões de intervalos (semitons a partir da tônica).
 */
export const SCALE_PATTERNS = {
  major: [0, 2, 4, 5, 7, 9, 11, 12],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10, 12],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11, 12],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11, 12],
  pentatonicMajor: [0, 2, 4, 7, 9, 12],
  pentatonicMinor: [0, 3, 5, 7, 10, 12],
  blues: [0, 3, 5, 6, 7, 10, 12],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
} as const;

export type ScaleType = keyof typeof SCALE_PATTERNS;

/**
 * Gera uma escala a partir de uma tônica e um padrão.
 *
 * @param rootMidi MIDI da tônica (ex: 60 = C4)
 * @param scaleType tipo de escala
 * @param octaveOffset oitava adicional (0 = mesma oitava da tônica)
 * @returns Array de MIDI notes
 */
export function generateScale(rootMidi: number, scaleType: ScaleType = "major", octaveOffset = 0): number[] {
  const pattern = SCALE_PATTERNS[scaleType];
  return pattern.map((interval) => rootMidi + interval + octaveOffset * 12);
}

/**
 * Nomes dos scale degrees (em notação de graus: 1, 2, 3, 4, 5, 6, 7).
 */
export const SCALE_DEGREE_NAMES = {
  major: ["1 (Tônica)", "2 (Supertônica)", "3 (Mediante)", "4 (Subdominante)", "5 (Dominante)", "6 (Superdominante)", "7 (Sensível)"],
  naturalMinor: ["1 (Tônica)", "2", "b3", "4", "5", "b6", "b7"],
} as const;

/**
 * Intervalos comuns (em semitons) e seus nomes.
 */
export const INTERVALS = [
  { semitones: 0, name: "Uníssono", short: "P1" },
  { semitones: 1, name: "Segunda menor", short: "m2" },
  { semitones: 2, name: "Segunda maior", short: "M2" },
  { semitones: 3, name: "Terça menor", short: "m3" },
  { semitones: 4, name: "Terça maior", short: "M3" },
  { semitones: 5, name: "Quarta justa", short: "P4" },
  { semitones: 6, name: "Trítono", short: "A4" },
  { semitones: 7, name: "Quinta justa", short: "P5" },
  { semitones: 8, name: "Sexta menor", short: "m6" },
  { semitones: 9, name: "Sexta maior", short: "M6" },
  { semitones: 10, name: "Sétima menor", short: "m7" },
  { semitones: 11, name: "Sétima maior", short: "M7" },
  { semitones: 12, name: "Oitava", short: "P8" },
];

/**
 * Acordes comuns (intervals from root).
 */
export const CHORDS = {
  major: { intervals: [0, 4, 7], name: "Maior", short: "" },
  minor: { intervals: [0, 3, 7], name: "Menor", short: "m" },
  diminished: { intervals: [0, 3, 6], name: "Diminuto", short: "dim" },
  augmented: { intervals: [0, 4, 8], name: "Aumentado", short: "aug" },
  sus4: { intervals: [0, 5, 7], name: "Sus4", short: "sus4" },
  sus2: { intervals: [0, 2, 7], name: "Sus2", short: "sus2" },
  major7: { intervals: [0, 4, 7, 11], name: "Maior 7", short: "maj7" },
  dominant7: { intervals: [0, 4, 7, 10], name: "Dominante 7", short: "7" },
  minor7: { intervals: [0, 3, 7, 10], name: "Menor 7", short: "m7" },
} as const;

export type ChordType = keyof typeof CHORDS;

/**
 * Gera um acorde a partir de uma root MIDI.
 */
export function generateChord(rootMidi: number, chordType: ChordType = "major"): number[] {
  return CHORDS[chordType].intervals.map((interval) => rootMidi + interval);
}

/**
 * Tons comuns pra prática (em MIDI).
 * C4 = 60, e vamos até C5 = 72.
 */
export const PRACTICE_KEYS = [
  { midi: 60, name: "C", label: "Dó Maior" },
  { midi: 62, name: "D", label: "Ré Maior" },
  { midi: 64, name: "E", label: "Mi Maior" },
  { midi: 65, name: "F", label: "Fá Maior" },
  { midi: 67, name: "G", label: "Sol Maior" },
  { midi: 69, name: "A", label: "Lá Maior" },
  { midi: 71, name: "B", label: "Si Maior" },
];

/**
 * Gera uma frase melódica aleatória de N notas numa tonalidade.
 */
export function generateMelodicPhrase(
  rootMidi: number,
  numNotes: number,
  scaleType: ScaleType = "major",
  maxInterval = 4
): number[] {
  const scale = generateScale(rootMidi, scaleType, 0);
  const phrase: number[] = [scale[0]];
  let lastIdx = 0;

  for (let i = 1; i < numNotes; i++) {
    let nextIdx: number;
    do {
      // Movimento preferencial por steps (±1 ou ±2 índices na escala)
      const step = Math.floor(Math.random() * (maxInterval * 2 + 1)) - maxInterval;
      nextIdx = lastIdx + step;
    } while (nextIdx < 0 || nextIdx >= scale.length);
    phrase.push(scale[nextIdx]);
    lastIdx = nextIdx;
  }
  return phrase;
}
