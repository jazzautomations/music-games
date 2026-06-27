/**
 * roundGenerators.ts — Geradores de round pra cada jogo
 *
 * Cada função retorna um MCRound (Multiple Choice Round) baseado no nível.
 * Usa playTone, playMelody, playChord do pitchDetector + musicTheory.
 */

import { playTone, playMelody, playChord } from "@/lib/audio/pitchDetector";
import { midiToFreq, generateScale, generateChord, PRACTICE_KEYS, INTERVALS, CHORDS, type ChordType, type ScaleType } from "@/lib/audio/musicTheory";
import type { MCRound } from "@/components/games/MultipleChoiceGame";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiToName(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ═══════════════════════════════════════════════════════
// SOUND GAMES
// ═══════════════════════════════════════════════════════

export function genBandMatch(level: number): MCRound {
  const instruments = [
    { name: "Guitarra", emoji: "🎸", freq: 330 },
    { name: "Piano", emoji: "🎹", freq: 440 },
    { name: "Baixo", emoji: "🎸", freq: 110 },
    { name: "Bateria", emoji: "🥁", freq: 80 },
    { name: "Saxofone", emoji: "🎷", freq: 233 },
    { name: "Violino", emoji: "🎻", freq: 660 },
    { name: "Flauta", emoji: "🪈", freq: 880 },
    { name: "Trompete", emoji: "🎺", freq: 392 },
  ];
  const numInstruments = Math.min(2 + Math.floor(level / 4), 5);
  const selected = shuffle(instruments).slice(0, numInstruments);
  const correctNames = selected.map((i) => i.name);

  // Gera opções (4): a correta + 3 erradas
  const wrong = shuffle(instruments.filter((i) => !correctNames.includes(i.name))).slice(0, 3);
  const correctOption = correctNames.join(", ");
  const wrongOptions = wrong.map((w) => {
    // Mistura um instrumento errado
    const mixed = shuffle([...correctNames.slice(0, -1), w.name]).join(", ");
    return mixed;
  });

  const options = shuffle([
    { label: correctOption, correct: true },
    ...wrongOptions.map((label) => ({ label, correct: false })),
  ]).slice(0, 4);

  return {
    play: () => selected.forEach((inst, i) => setTimeout(() => playTone(inst.freq, 600), i * 200)),
    options,
    prompt: `Quantos instrumentos você ouve? Identifique os ${numInstruments} instrumentos.`,
  };
}

export function genFlashEffects(level: number): MCRound {
  const effects = [
    { name: "Dry (sem efeito)", emoji: "🔇" },
    { name: "Reverb", emoji: "halle" },
    { name: "Delay", emoji: "🔁" },
    { name: "Chorus", emoji: "🌊" },
    { name: "Distortion", emoji: "🔥" },
  ];
  const selected = pickRandom(effects);
  // Simula efeitos com variações de tom
  return {
    play: () => {
      const baseFreq = 440;
      if (selected.name.includes("Delay")) {
        playTone(baseFreq, 200);
        setTimeout(() => playTone(baseFreq, 150), 300);
        setTimeout(() => playTone(baseFreq, 100), 600);
      } else if (selected.name.includes("Chorus")) {
        playTone(baseFreq, 400);
        setTimeout(() => playTone(baseFreq * 1.01, 400), 50);
      } else if (selected.name.includes("Reverb")) {
        playTone(baseFreq, 200);
        setTimeout(() => playTone(baseFreq, 100), 250);
        setTimeout(() => playTone(baseFreq, 80), 450);
      } else if (selected.name.includes("Distortion")) {
        playTone(baseFreq * 1.5, 400);
      } else {
        playTone(baseFreq, 400);
      }
    },
    options: shuffle(effects.map((e) => ({ label: e.name, correct: e.name === selected.name, emoji: e.emoji }))).slice(0, 4),
    prompt: "Qual efeito foi aplicado ao som?",
  };
}

export function genFlashTerms(level: number): MCRound {
  const terms = [
    { name: "Crescendo", def: "Aumentar volume gradualmente" },
    { name: "Decrescendo", def: "Diminuir volume gradualmente" },
    { name: "Staccato", def: "Notas curtas e destacadas" },
    { name: "Legato", def: "Notas ligadas e suaves" },
    { name: "Ritardando", def: "Diminuir tempo gradualmente" },
    { name: "Accelerando", def: "Aumentar tempo gradualmente" },
    { name: "Forte", def: "Tocar forte (alto)" },
    { name: "Piano", def: "Tocar suave (baixo)" },
  ];
  const selected = pickRandom(terms);
  const wrong = shuffle(terms.filter((t) => t.name !== selected.name)).slice(0, 3);
  return {
    play: () => playTone(440, 300),
    options: shuffle([
      { label: selected.def, correct: true },
      ...wrong.map((t) => ({ label: t.def, correct: false })),
    ]),
    prompt: `Qual é a definição de "${selected.name}"?`,
  };
}

export function genEQMatch(level: number): MCRound {
  const freqs = [250, 500, 1000, 2000, 4000, 8000];
  const selectedFreq = pickRandom(freqs);
  const wrong = shuffle(freqs.filter((f) => f !== selectedFreq)).slice(0, 3);
  return {
    play: () => playTone(selectedFreq, 500),
    options: shuffle([
      { label: `${selectedFreq} Hz`, correct: true },
      ...wrong.map((f) => ({ label: `${f} Hz`, correct: false })),
    ]),
    prompt: "Qual frequência está mais destacada?",
  };
}

export function genChannelScramble(level: number): MCRound {
  const channels = ["Bateria", "Baixo", "Guitarra", "Vocal", "Teclado"];
  const numChannels = Math.min(2 + Math.floor(level / 4), 5);
  const target = shuffle(channels).slice(0, numChannels);
  const wrong = shuffle(channels.filter((c) => !target.includes(c))).slice(0, 3);
  return {
    play: () => target.forEach((_, i) => playTone(220 + i * 110, 400)),
    options: shuffle([
      { label: target.join(", "), correct: true },
      ...wrong.map((w) => ({ label: shuffle([...target.slice(0, -1), w]).join(", "), correct: false })),
    ]),
    prompt: "Quais canais estão mais altos no mix?",
  };
}

// ═══════════════════════════════════════════════════════
// PITCH GAMES
// ═══════════════════════════════════════════════════════

export function genPitchCompare(level: number): MCRound {
  const baseFreq = 220;
  const diff = Math.max(5, 200 - (level - 1) * 10);
  const direction = Math.random();
  let freq2: number;
  let answer: string;
  if (direction < 0.4) { freq2 = baseFreq * Math.pow(2, diff / 1200); answer = "Mais alto"; }
  else if (direction < 0.8) { freq2 = baseFreq * Math.pow(2, -diff / 1200); answer = "Mais baixo"; }
  else { freq2 = baseFreq; answer = "Igual"; }
  return {
    play: () => { playTone(baseFreq, 600); setTimeout(() => playTone(freq2, 600), 800); },
    options: shuffle([
      { label: "Mais alto", correct: answer === "Mais alto" },
      { label: "Mais baixo", correct: answer === "Mais baixo" },
      { label: "Igual", correct: answer === "Igual" },
    ]),
    prompt: "O segundo tom está mais alto, mais baixo ou igual ao primeiro?",
  };
}

export function genSpeedPitch(level: number): MCRound {
  return genPitchCompare(level); // mesma lógica, mas cronometrado
}

export function genDangoBrothers(level: number): MCRound {
  return genPitchCompare(level); // mesma mecânica
}

// ═══════════════════════════════════════════════════════
// TONALITY GAMES
// ═══════════════════════════════════════════════════════

export function genTonicFinder(level: number): MCRound {
  const key = pickRandom(PRACTICE_KEYS);
  const scale = generateScale(key.midi + 12, "major", 0);
  const tonic = scale[0];
  // Toca uma frase curta que termina na tônica
  const phrase = [scale[2], scale[4], scale[5], tonic];
  const wrong = shuffle(scale.filter((m) => m !== tonic)).slice(0, 3);
  return {
    play: () => playMelody(phrase.map((m) => midiToFreq(m)), 400),
    options: shuffle([
      { label: midiToName(tonic), correct: true },
      ...wrong.map((m) => ({ label: midiToName(m), correct: false })),
    ]),
    prompt: `Qual é a tônica desta melodia em ${key.name} maior?`,
  };
}

export function genFlashNotationNotes(level: number): MCRound {
  const midi = 60 + Math.floor(Math.random() * 24); // C4 a B5
  const noteName = NOTE_NAMES[((midi % 12) + 12) % 12];
  const wrong = shuffle(NOTE_NAMES.filter((n) => n !== noteName)).slice(0, 3);
  return {
    play: () => playTone(midiToFreq(midi), 400),
    options: shuffle([
      { label: noteName, correct: true },
      ...wrong.map((n) => ({ label: n, correct: false })),
    ]),
    prompt: `Qual nota está sendo tocada? (MIDI ${midi})`,
  };
}

export function genKeyPuzzles(level: number): MCRound {
  const keys = [
    { name: "C Maior", sharps: 0 }, { name: "G Maior", sharps: 1 },
    { name: "D Maior", sharps: 2 }, { name: "A Maior", sharps: 3 },
    { name: "F Maior", sharps: -1 }, { name: "Bb Maior", sharps: -2 },
  ];
  const selected = pickRandom(keys);
  const wrong = shuffle(keys.filter((k) => k.name !== selected.name)).slice(0, 3);
  return {
    play: () => playTone(midiToFreq(pickRandom(PRACTICE_KEYS).midi + 12), 400),
    options: shuffle([
      { label: selected.name, correct: true },
      ...wrong.map((k) => ({ label: k.name, correct: false })),
    ]),
    prompt: `Quantos sustenidos tem a escala de ${selected.name}?`,
  };
}

export function genNumberBlaster(level: number): MCRound {
  const key = pickRandom(PRACTICE_KEYS);
  const scale = generateScale(key.midi + 12, "major", 0);
  const degreeIdx = Math.floor(Math.random() * 7);
  const target = scale[degreeIdx];
  return {
    play: () => playTone(midiToFreq(target), 500),
    options: ["1", "2", "3", "4", "5", "6", "7"].map((d, i) => ({
      label: d, correct: i === degreeIdx,
    })),
    prompt: `Qual scale degree desta nota em ${key.name} maior?`,
  };
}

export function genPaddleTones(level: number): MCRound {
  return genNumberBlaster(level);
}

export function genToneDrops(level: number): MCRound {
  return genNumberBlaster(level);
}

export function genTonalRecall(level: number): MCRound {
  const numNotes = Math.min(3 + Math.floor(level / 3), 8);
  const key = pickRandom(PRACTICE_KEYS);
  const scale = generateScale(key.midi + 12, "major", 0);
  const sequence: number[] = [];
  for (let i = 0; i < numNotes; i++) {
    sequence.push(pickRandom(scale));
  }
  const correctLabel = sequence.map((m) => midiToName(m)).join(" → ");
  // Gera 3 erradas (permutações)
  const wrongs: string[] = [];
  for (let w = 0; w < 3; w++) {
    const shuffled = shuffle(sequence);
    wrongs.push(shuffled.map((m) => midiToName(m)).join(" → "));
  }
  return {
    play: () => playMelody(sequence.map((m) => midiToFreq(m)), 400),
    options: shuffle([
      { label: correctLabel, correct: true },
      ...wrongs.map((label) => ({ label, correct: false })),
    ]),
    prompt: `Qual foi a sequência de ${numNotes} notas?`,
  };
}

export function genFlashTones(level: number): MCRound {
  return genNumberBlaster(level);
}

// ═══════════════════════════════════════════════════════
// MELODY GAMES (intervalos)
// ═══════════════════════════════════════════════════════

export function genMelodicDrops(level: number): MCRound {
  const root = 60 + Math.floor(Math.random() * 12);
  const maxInterval = Math.min(12, 2 + Math.floor(level / 2));
  const interval = Math.floor(Math.random() * (maxInterval + 1));
  const second = root + interval;
  const correctInterval = INTERVALS.find((i) => i.semitones === interval);
  const wrong = shuffle(INTERVALS.filter((i) => i.semitones !== interval)).slice(0, 3);
  return {
    play: () => { playTone(midiToFreq(root), 400); setTimeout(() => playTone(midiToFreq(second), 400), 500); },
    options: shuffle([
      { label: correctInterval!.name, correct: true },
      ...wrong.map((i) => ({ label: i.name, correct: false })),
    ]).slice(0, 4),
    prompt: "Qual é o intervalo melódico entre as duas notas?",
  };
}

export function genHarmonicDrops(level: number): MCRound {
  const root = 60 + Math.floor(Math.random() * 12);
  const maxInterval = Math.min(12, 2 + Math.floor(level / 2));
  const interval = Math.floor(Math.random() * (maxInterval + 1));
  const second = root + interval;
  const correctInterval = INTERVALS.find((i) => i.semitones === interval);
  const wrong = shuffle(INTERVALS.filter((i) => i.semitones !== interval)).slice(0, 3);
  return {
    play: () => playChord([midiToFreq(root), midiToFreq(second)], 600),
    options: shuffle([
      { label: correctInterval!.name, correct: true },
      ...wrong.map((i) => ({ label: i.name, correct: false })),
    ]).slice(0, 4),
    prompt: "Qual é o intervalo harmônico entre as duas notas simultâneas?",
  };
}

export function genFlashIntervalsMelodic(level: number): MCRound {
  return genMelodicDrops(level);
}

export function genFlashIntervalsHarmonic(level: number): MCRound {
  return genHarmonicDrops(level);
}

export function genFlashNotationIntervals(level: number): MCRound {
  return genMelodicDrops(level);
}

// ═══════════════════════════════════════════════════════
// HARMONY GAMES (acordes)
// ═══════════════════════════════════════════════════════

export function genChordDrops(level: number): MCRound {
  const chordTypes: ChordType[] = ["major", "minor", "diminished", "augmented", "sus4", "major7", "dominant7", "minor7"];
  const maxTypes = Math.min(4, 2 + Math.floor(level / 5));
  const availableTypes = chordTypes.slice(0, maxTypes);
  const selected = pickRandom(availableTypes);
  const root = 60 + Math.floor(Math.random() * 12);
  const chord = generateChord(root, selected);
  const wrong = shuffle(availableTypes.filter((t) => t !== selected)).slice(0, 3);
  return {
    play: () => playChord(chord.map((m) => midiToFreq(m)), 800),
    options: shuffle([
      { label: CHORDS[selected].name, correct: true },
      ...wrong.map((t) => ({ label: CHORDS[t].name, correct: false })),
    ]),
    prompt: "Qual é o tipo deste acorde?",
  };
}

export function genFlashChords(level: number): MCRound {
  return genChordDrops(level);
}

export function genToneTrees(level: number): MCRound {
  const chordTypes: ChordType[] = ["major", "minor", "diminished", "augmented"];
  const selected = pickRandom(chordTypes);
  const root = 60 + Math.floor(Math.random() * 12);
  const chord = generateChord(root, selected);
  const correctNotes = chord.map((m) => midiToName(m)).join(" - ");
  // Gera erradas com uma nota trocada
  const wrongs: string[] = [];
  for (let w = 0; w < 3; w++) {
    const modified = [...chord];
    modified[w % modified.length] += 1; // troca 1 semitom
    wrongs.push(modified.map((m) => midiToName(m)).join(" - "));
  }
  return {
    play: () => playChord(chord.map((m) => midiToFreq(m)), 800),
    options: shuffle([
      { label: correctNotes, correct: true },
      ...wrongs.map((label) => ({ label, correct: false })),
    ]),
    prompt: `Quais notas formam este acorde de ${CHORDS[selected].name}?`,
  };
}

export function genPhraseFitter(level: number): MCRound {
  return genToneTrees(level);
}

export function genSpeedChords(level: number): MCRound {
  return genChordDrops(level);
}

export function genFlashChordsQuality(level: number): MCRound {
  const chordTypes: ChordType[] = ["major", "minor", "diminished", "augmented"];
  const selected = pickRandom(chordTypes);
  const root = 60 + Math.floor(Math.random() * 12);
  const chord = generateChord(root, selected);
  return {
    play: () => playChord(chord.map((m) => midiToFreq(m)), 600),
    options: chordTypes.map((t) => ({
      label: CHORDS[t].name, correct: t === selected,
    })),
    prompt: "Qual é a qualidade deste acorde?",
  };
}

export function genFlashNotationChords(level: number): MCRound {
  return genChordDrops(level);
}

export function genChordSpells(level: number): MCRound {
  const chordTypes: ChordType[] = ["major", "minor", "major7", "dominant7", "minor7"];
  const selected = pickRandom(chordTypes);
  const root = pickRandom(PRACTICE_KEYS);
  const chord = generateChord(root.midi, selected);
  const correctNotes = chord.map((m) => NOTE_NAMES[((m % 12) + 12) % 12]).join(" - ");
  const wrongs: string[] = [];
  for (let w = 0; w < 3; w++) {
    const modified = [...chord];
    modified[w % modified.length] += 2;
    wrongs.push(modified.map((m) => NOTE_NAMES[((m % 12) + 12) % 12]).join(" - "));
  }
  return {
    play: () => playChord(chord.map((m) => midiToFreq(m)), 600),
    options: shuffle([
      { label: correctNotes, correct: true },
      ...wrongs.map((label) => ({ label, correct: false })),
    ]),
    prompt: `Quais notas formam o acorde ${root.name}${CHORDS[selected].short}?`,
  };
}

export function genChordLocks(level: number): MCRound {
  const functions = ["I (Tônica)", "IV (Subdominante)", "V (Dominante)", "vi (Relativa)"];
  const selected = pickRandom(functions);
  const root = pickRandom(PRACTICE_KEYS);
  const scale = generateScale(root.midi, "major", 0);
  const chordRoots: Record<string, number> = {
    "I (Tônica)": scale[0], "IV (Subdominante)": scale[3],
    "V (Dominante)": scale[4], "vi (Relativa)": scale[5],
  };
  const chord = generateChord(chordRoots[selected], "major");
  return {
    play: () => playChord(chord.map((m) => midiToFreq(m)), 600),
    options: functions.map((f) => ({ label: f, correct: f === selected })),
    prompt: `Qual é a função harmônica deste acorde em ${root.name} maior?`,
  };
}

export function genSpeakerChords(level: number): MCRound {
  const progressions = [
    { name: "I - V - vi - IV", degrees: [0, 4, 5, 3] },
    { name: "I - IV - V - I", degrees: [0, 3, 4, 0] },
    { name: "vi - IV - I - V", degrees: [5, 3, 0, 4] },
    { name: "I - vi - IV - V", degrees: [0, 5, 3, 4] },
  ];
  const selected = pickRandom(progressions);
  const root = pickRandom(PRACTICE_KEYS);
  const scale = generateScale(root.midi, "major", 0);
  const chords = selected.degrees.map((d) => generateChord(scale[d], "major"));
  const wrong = shuffle(progressions.filter((p) => p.name !== selected.name)).slice(0, 3);
  return {
    play: () => chords.forEach((c, i) => setTimeout(() => playChord(c.map((m) => midiToFreq(m)), 500), i * 600)),
    options: shuffle([
      { label: selected.name, correct: true },
      ...wrong.map((p) => ({ label: p.name, correct: false })),
    ]),
    prompt: "Qual progressão de acordes você ouviu?",
  };
}

export function genFlashProgressionsMajor(level: number): MCRound {
  return genSpeakerChords(level);
}

export function genFlashProgressionsMinor(level: number): MCRound {
  return genSpeakerChords(level);
}

export function genFlashCadences(level: number): MCRound {
  const cadences = [
    { name: "Cadência Perfeita (V-I)", from: "dominant7", to: "major" },
    { name: "Cadência Plagal (IV-I)", from: "major", to: "major" },
    { name: "Cadência Decepcionante (V-vi)", from: "dominant7", to: "minor" },
    { name: "Semicadência (termina em V)", from: "major", to: "dominant7" },
  ];
  const selected = pickRandom(cadences);
  const root = pickRandom(PRACTICE_KEYS);
  const scale = generateScale(root.midi, "major", 0);
  const firstChord = generateChord(scale[4], "dominant7");
  const secondChord = generateChord(scale[0], "major");
  return {
    play: () => {
      playChord(firstChord.map((m) => midiToFreq(m)), 600);
      setTimeout(() => playChord(secondChord.map((m) => midiToFreq(m)), 800), 700);
    },
    options: cadences.map((c) => ({ label: c.name, correct: c.name === selected.name })),
    prompt: "Qual é o tipo de cadência?",
  };
}

export function genTriads(level: number): MCRound {
  return genFlashChordsQuality(level);
}

export function genSeventhChords(level: number): MCRound {
  const chordTypes: ChordType[] = ["major7", "dominant7", "minor7", "diminished"];
  const selected = pickRandom(chordTypes);
  const root = 60 + Math.floor(Math.random() * 12);
  const chord = generateChord(root, selected);
  return {
    play: () => playChord(chord.map((m) => midiToFreq(m)), 600),
    options: chordTypes.map((t) => ({ label: CHORDS[t].name, correct: t === selected })),
    prompt: "Qual é o tipo de acorde de sétima?",
  };
}

export function genInversions(level: number): MCRound {
  const inversions = ["Fundamental", "1ª Inversão", "2ª Inversão"];
  const selected = pickRandom(inversions);
  const root = 60 + Math.floor(Math.random() * 12);
  const chord = generateChord(root, "major");
  let reordered: number[];
  if (selected === "1ª Inversão") reordered = [chord[1], chord[2], chord[0] + 12];
  else if (selected === "2ª Inversão") reordered = [chord[2], chord[0] + 12, chord[1] + 12];
  else reordered = chord;
  return {
    play: () => playChord(reordered.map((m) => midiToFreq(m)), 600),
    options: inversions.map((inv) => ({ label: inv, correct: inv === selected })),
    prompt: "Em qual inversão está este acorde?",
  };
}

export function genArpeggios(level: number): MCRound {
  const chordTypes: ChordType[] = ["major", "minor", "diminished", "augmented"];
  const selected = pickRandom(chordTypes);
  const root = 60 + Math.floor(Math.random() * 12);
  const chord = generateChord(root, selected);
  return {
    play: () => playMelody(chord.map((m) => midiToFreq(m)), 300),
    options: chordTypes.map((t) => ({ label: CHORDS[t].name, correct: t === selected })),
    prompt: "Este arpejo (acorde quebrado) é de qual tipo de acorde?",
  };
}

// ═══════════════════════════════════════════════════════
// RHYTHM GAMES (simplificado — usa tons em padrões)
// ═══════════════════════════════════════════════════════

export function genRhythmPuzzles(level: number): MCRound {
  const patterns = [
    { name: "4 colcheias", beats: [1, 1, 1, 1] },
    { name: "2 semínimas", beats: [2, 2] },
    { name: "1 semínima + 2 colcheias", beats: [2, 1, 1] },
    { name: "Síncope", beats: [1, 2, 1] },
  ];
  const selected = pickRandom(patterns);
  const beatDuration = 300;
  return {
    play: () => {
      let time = 0;
      selected.beats.forEach((beat) => {
        setTimeout(() => playTone(440, 100), time);
        time += beat * beatDuration;
      });
    },
    options: shuffle(patterns.map((p) => ({ label: p.name, correct: p.name === selected.name }))).slice(0, 4),
    prompt: "Qual padrão rítmico você ouviu?",
  };
}

export function genFlashRhythms(level: number): MCRound {
  return genRhythmPuzzles(level);
}

export function genRhythmRepeat(level: number): MCRound {
  return genRhythmPuzzles(level);
}

export function genRhythmReader(level: number): MCRound {
  return genRhythmPuzzles(level);
}

export function genFlashStylesDrums(level: number): MCRound {
  const styles = [
    { name: "Rock", emoji: "🤘" },
    { name: "Jazz/Swing", emoji: "🎷" },
    { name: "Funk", emoji: "🕺" },
    { name: "Balada", emoji: "💔" },
  ];
  const selected = pickRandom(styles);
  return {
    play: () => {
      // Simula estilos com padrões diferentes
      const beatDuration = selected.name === "Jazz/Swing" ? 200 : 300;
      for (let i = 0; i < 4; i++) {
        setTimeout(() => playTone(80, 100), i * beatDuration);
      }
    },
    options: styles.map((s) => ({ label: s.name, correct: s.name === selected.name, emoji: s.emoji })),
    prompt: "Qual estilo de bateria você ouviu?",
  };
}
