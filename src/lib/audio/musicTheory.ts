/**
 * musicTheory.ts — Teoria musical PORTADA do MusicUtil.js do Theta Music Trainer
 *
 * Dados extraídos do código real (trainer.thetamusic.com/ssi/tachikawa/game/js/MusicUtil.js)
 */

const A4_FREQ = 440.0;
const A4_MIDI = 69;

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const SOLFEGE_NAMES = ["Do", "Di", "Re", "Ra", "Mi", "Fa", "Fi", "Sol", "Si", "La", "Li", "Ti"];

/** Converte MIDI → frequência */
export function midiToFreq(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/** Converte frequência → MIDI (float) */
export function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / A4_FREQ) + A4_MIDI;
}

/**
 * Padrões de escala — extraídos do MusicUtil.js do Theta
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
 * Scale degrees — extraídos do MusicUtil.js
 * majorScaleDegrees = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7", "8"]
 * scaleDegrees (extended) vai até "b13", "13"
 */
export const MAJOR_SCALE_DEGREES = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7", "8"];
export const EXTENDED_SCALE_DEGREES = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7", "8", "b9", "9", "b10", "10", "11", "b12", "12", "b13", "13"];

/**
 * Semitone indices — extraídos do MusicUtil.js
 * majorSemitoneIndices = [0, 2, 4, 5, 7, 9, 11]
 * minorSemitoneIndices = [0, 2, 3, 5, 7, 8, 10]
 */
export const MAJOR_SEMITONE_INDICES = [0, 2, 4, 5, 7, 9, 11];
export const MINOR_SEMITONE_INDICES = [0, 2, 3, 5, 7, 8, 10];

/**
 * Intervalos — extraídos do MusicUtil.js
 * basicIntervals e displayIntervals (displayIntervals usa só "tritone", sem aug_4th/dim_5th separados)
 */
export const BASIC_INTERVALS = [
  "unison", "minor_2nd", "major_2nd", "minor_3rd", "major_3rd",
  "perfect_4th", "aug_4th", "dim_5th", "tritone", "perfect_5th",
  "minor_6th", "major_6th", "minor_7th", "major_7th", "octave",
];

export const DISPLAY_INTERVALS = [
  "unison", "minor_2nd", "major_2nd", "minor_3rd", "major_3rd",
  "perfect_4th", "tritone", "perfect_5th",
  "minor_6th", "major_6th", "minor_7th", "major_7th", "octave",
];

/** Intervalos com semitons e nomes em pt-BR */
export const INTERVALS = [
  { semitones: 0, name: "Uníssono", short: "P1", thetaName: "unison" },
  { semitones: 1, name: "Segunda menor", short: "m2", thetaName: "minor_2nd" },
  { semitones: 2, name: "Segunda maior", short: "M2", thetaName: "major_2nd" },
  { semitones: 3, name: "Terça menor", short: "m3", thetaName: "minor_3rd" },
  { semitones: 4, name: "Terça maior", short: "M3", thetaName: "major_3rd" },
  { semitones: 5, name: "Quarta justa", short: "P4", thetaName: "perfect_4th" },
  { semitones: 6, name: "Trítono", short: "A4", thetaName: "tritone" },
  { semitones: 7, name: "Quinta justa", short: "P5", thetaName: "perfect_5th" },
  { semitones: 8, name: "Sexta menor", short: "m6", thetaName: "minor_6th" },
  { semitones: 9, name: "Sexta maior", short: "M6", thetaName: "major_6th" },
  { semitones: 10, name: "Sétima menor", short: "m7", thetaName: "minor_7th" },
  { semitones: 11, name: "Sétima maior", short: "M7", thetaName: "major_7th" },
  { semitones: 12, name: "Oitava", short: "P8", thetaName: "octave" },
];

/**
 * Chord degrees — extraídos do MusicUtil.js
 * chordDegrees = ["I", "bII", "II", "bIII", "III", "IV", "bV", "V", "bVI", "VI", "bVII", "VII"]
 */
export const CHORD_DEGREES = ["I", "bII", "II", "bIII", "III", "IV", "bV", "V", "bVI", "VI", "bVII", "VII"];

/**
 * Acordes comuns
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
  halfDiminished: { intervals: [0, 3, 6, 10], name: "Meio diminuto", short: "m7b5" },
  diminished7: { intervals: [0, 3, 6, 9], name: "Diminuto 7", short: "dim7" },
  minorMajor7: { intervals: [0, 3, 7, 11], name: "Menor-Maior 7", short: "mMaj7" },
} as const;

export type ChordType = keyof typeof CHORDS;

/**
 * Gera uma escala
 */
export function generateScale(rootMidi: number, scaleType: ScaleType = "major", octaveOffset = 0): number[] {
  const pattern = SCALE_PATTERNS[scaleType];
  return pattern.map((interval) => rootMidi + interval + octaveOffset * 12);
}

/**
 * Gera um acorde
 */
export function generateChord(rootMidi: number, chordType: ChordType = "major"): number[] {
  return CHORDS[chordType].intervals.map((interval) => rootMidi + interval);
}

/**
 * Nomes dos scale degrees (em pt-BR)
 */
export const SCALE_DEGREE_NAMES = {
  major: ["1 (Tônica)", "2 (Supertônica)", "3 (Mediante)", "4 (Subdominante)", "5 (Dominante)", "6 (Superdominante)", "7 (Sensível)"],
  naturalMinor: ["1 (Tônica)", "2", "b3", "4", "5", "b6", "b7"],
} as const;

/**
 * Tons comuns pra prática
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
 * VocalMatch level data — extraído do código real do Theta
 *
 * keysPerLevel: alterna entre C major e C minor
 * scaleDegreesPerLevel: cada nível tem 6 scale degrees pra cantar
 */
export const VOCAL_MATCH_LEVELS = {
  // Levels 1-20: alterna entre C (major) e C Minor
  keysPerLevel: [
    null, // level 0 (não usado)
    "C", "C Minor", "C", "C Minor", "C",       // 1-5
    "C Minor", "C", "C Minor", "C", "C Minor",  // 6-10
    "C", "C Minor", "C", "C Minor", "C",        // 11-15
    "C Minor", "C", "C Minor", "C", "C Minor",  // 16-20
  ],
  // Scale degrees per level (cada nível tem sequência de 6 graus)
  scaleDegreesPerLevel: [
    null,
    ["1", "2", "3", "2", "3", "1"],
    ["1", "2", "b3", "2", "b3", "1"],
    ["1", "3", "5", "3", "5", "1"],
    ["1", "b3", "5", "b3", "5", "1"],
    ["1", "2", "3", "4", "3", "1"],
    ["1", "2", "b3", "4", "b3", "1"],
    ["1", "3", "5", "6", "5", "1"],
    ["1", "b3", "5", "b6", "5", "1"],
    ["1", "2", "3", "4", "5", "1"],
    ["1", "2", "b3", "4", "5", "1"],
    ["1", "3", "5", "6", "7", "1"],
    ["1", "b3", "5", "b6", "b7", "1"],
    ["1", "2", "3", "4", "5", "6"],
    ["1", "2", "b3", "4", "5", "b6"],
    ["1", "3", "5", "8", "5", "1"],
    ["1", "b3", "5", "8", "5", "1"],
    ["1", "2", "3", "5", "3", "1"],
    ["1", "2", "b3", "5", "b3", "1"],
    ["1", "3", "5", "7", "5", "1"],
    ["1", "b3", "5", "b7", "5", "1"],
  ],
};

/**
 * Gera uma frase melódica aleatória
 */
export function generateMelodicPhrase(rootMidi: number, numNotes: number, scaleType: ScaleType = "major", maxInterval = 4): number[] {
  const scale = generateScale(rootMidi, scaleType, 0);
  const phrase: number[] = [scale[0]];
  let lastIdx = 0;
  for (let i = 1; i < numNotes; i++) {
    let nextIdx: number;
    do {
      const step = Math.floor(Math.random() * (maxInterval * 2 + 1)) - maxInterval;
      nextIdx = lastIdx + step;
    } while (nextIdx < 0 || nextIdx >= scale.length);
    phrase.push(scale[nextIdx]);
    lastIdx = nextIdx;
  }
  return phrase;
}
