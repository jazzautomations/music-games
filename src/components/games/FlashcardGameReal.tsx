/**
 * FlashcardGameReal.tsx — Jogo de flashcard (ouça X, escolha entre N opções)
 *
 * Cobre: FlashChords, FlashTones, FlashRhythms, FlashCadences, FlashEffects,
 * FlashProgressions, FlashIntervals, PitchCompare, SpeedPitch, SpeedChords,
 * TonicFinder, KeyPuzzles, ChordSpells, ChordLocks, etc.
 *
 * Mecânica real: ouça o áudio, escolha entre 2-8 opções, resposta cronometrada.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, RotateCcw, Clock } from "lucide-react";
import { GameShell } from "./GameShell";
import { type GameDef } from "@/lib/games/gamesCatalog";
import { useProgress } from "@/hooks/useProgress";
import { initAudio, playNote, playChord, playMelody, midiToFreq, type RealInstrument } from "@/lib/audio/soundfontEngine";
import { generateScale, generateChord, PRACTICE_KEYS, INTERVALS, CHORDS, type ChordType, type ScaleType } from "@/lib/audio/musicTheory";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function midiToName(midi: number): string { return `${NOTE_NAMES[((midi % 12) + 12) % 12]}`; }

export interface FlashcardRound {
  play: () => void;
  prompt: string;
  options: { label: string; correct: boolean }[];
}

interface FlashcardConfig {
  generateRound: (level: number) => FlashcardRound;
  timed?: boolean;
  getTimeLimit?: (level: number) => number;
  numOptions?: number;
}

interface Props {
  game: GameDef;
  config: FlashcardConfig;
  onExit: () => void;
}

export function FlashcardGameReal({ game, config, onExit }: Props) {
  const [level, setLevel] = useState(1);
  const [round, setRound] = useState<FlashcardRound | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [selected, setSelected] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(config.getTimeLimit?.(1) ?? 5);
  const [audioReady, setAudioReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { recordPlay, unlockAchievement } = useProgress();
  const timeLimit = config.getTimeLimit?.(level) ?? 5;
  const numOptions = config.numOptions ?? 4;

  const handleStart = useCallback(async () => { await initAudio(); setAudioReady(true); }, []);

  useEffect(() => {
    if (!audioReady) return;
    const r = config.generateRound(level);
    setRound(r);
    setSelected(null);
    setFeedback("idle");
    setTimeLeft(timeLimit);
    setTimeout(() => r.play(), 300);
  }, [level, config, audioReady, timeLimit]);

  useEffect(() => {
    if (!config.timed || !round || selected !== null || !audioReady) return;
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const left = Math.max(0, timeLimit - elapsed);
      setTimeLeft(left);
      if (left <= 0) { if (timerRef.current) clearInterval(timerRef.current); handleAnswer(-1); }
    }, 50);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [round, config.timed, timeLimit, selected, audioReady]);

  const handleAnswer = useCallback((idx: number) => {
    if (selected !== null || !round) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelected(idx);
    const correct = idx >= 0 && round.options[idx]?.correct;
    if (correct) {
      setFeedback("correct");
      const timeBonus = config.timed ? Math.floor(timeLeft * 20) : 0;
      setScore(s => s + 100 + timeBonus + level * 5);
      setStreak(s => s + 1);
      unlockAchievement("first_play");
      if (level >= 5) unlockAchievement("level_5");
      if (level >= 10) unlockAchievement("level_10");
      if (level >= 20) unlockAchievement("level_20");
      recordPlay(game.id, level, score + 100 + timeBonus);
      setTimeout(() => { setFeedback("idle"); setSelected(null); setLevel(l => Math.min(20, l + 1)); }, 1000);
    } else {
      setFeedback("wrong");
      setStreak(0);
      setTimeout(() => { setFeedback("idle"); setSelected(null); setRound(config.generateRound(level)); setTimeLeft(timeLimit); setTimeout(() => round?.play(), 100); }, 1500);
    }
  }, [selected, round, config, level, score, game.id, recordPlay, unlockAchievement, timeLeft, timeLimit]);

  const restart = () => { setLevel(1); setScore(0); setStreak(0); setSelected(null); setFeedback("idle"); };

  if (!round) return (
    <GameShell game={game} level={level} score={score} streak={streak} onExit={onExit} onRestart={restart}>
      {!audioReady ? (
        <Card className="bg-white/5 border-white/10 p-8 text-center"><div className="text-5xl mb-3">{game.emoji}</div><h2 className="text-2xl font-bold mb-2">Clique pra começar</h2><p className="text-white/70 text-sm mb-6">{game.shortDescription}</p><Button onClick={handleStart} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5"><Play className="w-5 h-5 mr-2" /> Iniciar</Button></Card>
      ) : <div className="text-center text-white/60">Carregando...</div>}
    </GameShell>
  );

  return (
    <GameShell game={game} level={level} score={score} streak={streak} onExit={onExit} onRestart={restart}>
      {config.timed && (
        <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-4 border border-white/10">
          <div className="h-full transition-all duration-75" style={{width: `${(timeLeft / timeLimit) * 100}%`, background: timeLeft > timeLimit*0.5 ? "linear-gradient(90deg,#10b981,#34d399)" : timeLeft > timeLimit*0.2 ? "linear-gradient(90deg,#f59e0b,#fb923c)" : "linear-gradient(90deg,#ef4444,#dc2626)"}} />
        </div>
      )}
      <Card className={`bg-gradient-to-br ${game.accent} bg-opacity-10 border-white/20 p-6 mb-4 text-center`}>
        <div className="text-sm text-white/70 mb-3">{round.prompt}</div>
        <Button onClick={() => round.play()} variant="outline" className="border-white/30 bg-white/10"><Play className="w-4 h-4 mr-1" /> Ouvir de novo</Button>
      </Card>
      <div className={`grid gap-3 ${numOptions === 2 ? "grid-cols-2" : numOptions === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
        {round.options.map((opt, i) => {
          const isSelected = selected === i;
          const showCorrect = feedback !== "idle" && opt.correct;
          const showWrong = isSelected && !opt.correct;
          return (
            <Button key={i} onClick={() => handleAnswer(i)} disabled={selected !== null} variant={showCorrect ? "default" : showWrong ? "destructive" : "outline"} className={`py-8 text-base font-bold ${showCorrect ? "bg-emerald-600 hover:bg-emerald-600" : showWrong ? "bg-red-600 hover:bg-red-600" : "border-white/20 hover:bg-white/5"}`}>{opt.label}</Button>
          );
        })}
      </div>
      {feedback !== "idle" && (
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-50">
          <div className={`text-6xl font-black ${feedback === "correct" ? "text-emerald-400" : "text-red-400"}`} style={{textShadow: "0 0 20px currentColor"}}>{feedback === "correct" ? "✓ CORRETO!" : "✗ ERRADO"}</div>
        </div>
      )}
    </GameShell>
  );
}

// ═══ Geração de rounds por jogo ═══

/** PitchCompare / SpeedPitch */
export function makePitchCompareRound(level: number): FlashcardRound {
  const baseFreq = 220;
  const diff = Math.max(5, 200 - (level - 1) * 10);
  const r = Math.random();
  let freq2: number, answer: string;
  if (r < 0.4) { freq2 = baseFreq * Math.pow(2, diff / 1200); answer = "Mais alto"; }
  else if (r < 0.8) { freq2 = baseFreq * Math.pow(2, -diff / 1200); answer = "Mais baixo"; }
  else { freq2 = baseFreq; answer = "Igual"; }
  return {
    play: () => { playNoteReal(baseFreq, 0.6, "acoustic_grand_piano"); setTimeout(() => playNoteReal(freq2, 0.6, "acoustic_grand_piano"), 800); },
    prompt: "O segundo tom está mais alto, mais baixo ou igual?",
    options: [{label: "Mais alto", correct: answer === "Mais alto"}, {label: "Mais baixo", correct: answer === "Mais baixo"}, {label: "Igual", correct: answer === "Igual"}],
  };
}

/** FlashChords / Triads / SeventhChords */
export function makeChordRound(level: number, chordTypes?: ChordType[]): FlashcardRound {
  const types: ChordType[] = chordTypes ?? (level <= 3 ? ["major", "minor"] : level <= 7 ? ["major", "minor", "diminished", "augmented"] : ["major", "minor", "diminished", "augmented", "sus4", "dominant7", "major7", "minor7"]);
  const selected = types[Math.floor(Math.random() * types.length)];
  const root = 60 + Math.floor(Math.random() * 12);
  const chord = generateChord(root, selected);
  const wrong = types.filter(t => t !== selected).sort(() => Math.random() - 0.5).slice(0, 3);
  return {
    play: () => playChordReal(chord.map(midiToFreq), 0.8, "acoustic_grand_piano"),
    prompt: "Qual é o tipo deste acorde?",
    options: [{label: CHORDS[selected].name, correct: true}, ...wrong.map(t => ({label: CHORDS[t].name, correct: false}))].sort(() => Math.random() - 0.5),
  };
}

/** FlashTones / NumberBlaster / PaddleTones — identifica scale degree */
export function makeScaleDegreeRound(level: number): FlashcardRound {
  const key = PRACTICE_KEYS[Math.floor(Math.random() * PRACTICE_KEYS.length)];
  const scale = generateScale(key.midi + 12, "major", 0);
  const maxDegree = Math.min(7, 2 + Math.floor(level / 3));
  const degreeIdx = Math.floor(Math.random() * maxDegree);
  const target = scale[degreeIdx];
  const labels = ["1 (Tônica)", "2", "3", "4", "5", "6", "7"];
  const wrongIdxs = [0,1,2,3,4,5,6].filter(i => i !== degreeIdx && i < maxDegree).sort(() => Math.random() - 0.5).slice(0, 3);
  return {
    play: () => playNoteReal(midiToFreq(target), 0.5, "acoustic_grand_piano"),
    prompt: `Qual scale degree desta nota em ${key.name} Maior?`,
    options: [{label: labels[degreeIdx], correct: true}, ...wrongIdxs.map(i => ({label: labels[i], correct: false}))].sort(() => Math.random() - 0.5),
  };
}

/** FlashIntervals (Melodic) */
export function makeIntervalRound(level: number, harmonic = false): FlashcardRound {
  const root = 60 + Math.floor(Math.random() * 12);
  const maxInterval = Math.min(12, 2 + Math.floor(level / 2));
  const interval = Math.floor(Math.random() * (maxInterval + 1));
  const second = root + interval;
  const correctInterval = INTERVALS.find(i => i.semitones === interval);
  const wrong = INTERVALS.filter(i => i.semitones !== interval).sort(() => Math.random() - 0.5).slice(0, 3);
  return {
    play: harmonic ? () => playChordReal([midiToFreq(root), midiToFreq(second)], 0.8, "acoustic_grand_piano") : () => { playNoteReal(midiToFreq(root), 0.4, "acoustic_grand_piano"); setTimeout(() => playNoteReal(midiToFreq(second), 0.4, "acoustic_grand_piano"), 500); },
    prompt: harmonic ? "Qual é o intervalo harmônico?" : "Qual é o intervalo melódico?",
    options: [{label: correctInterval!.name, correct: true}, ...wrong.map(i => ({label: i.name, correct: false}))].sort(() => Math.random() - 0.5),
  };
}

/** TonicFinder */
export function makeTonicFinderRound(level: number): FlashcardRound {
  const key = PRACTICE_KEYS[Math.floor(Math.random() * PRACTICE_KEYS.length)];
  const scale = generateScale(key.midi + 12, "major", 0);
  const phrase = [scale[2], scale[4], scale[5], scale[0]];
  const wrong = scale.filter(m => m !== scale[0]).sort(() => Math.random() - 0.5).slice(0, 3);
  return {
    play: () => playMelodyReal(phrase.map(midiToFreq), 0.4, "acoustic_grand_piano"),
    prompt: `Qual é a tônica desta melodia?`,
    options: [{label: midiToName(scale[0]), correct: true}, ...wrong.map(m => ({label: midiToName(m), correct: false}))].sort(() => Math.random() - 0.5),
  };
}

/** FlashCadences */
export function makeCadenceRound(level: number): FlashcardRound {
  const cadences = [
    {name: "Perfeita (V-I)", from: "dom7", to: "major"},
    {name: "Plagal (IV-I)", from: "major", to: "major"},
    {name: "Decepcionante (V-vi)", from: "dom7", to: "minor"},
    {name: "Semicadência (→V)", from: "major", to: "dom7"},
  ];
  const selected = cadences[Math.floor(Math.random() * cadences.length)];
  const root = PRACTICE_KEYS[Math.floor(Math.random() * PRACTICE_KEYS.length)];
  const scale = generateScale(root.midi, "major", 0);
  const firstChord = generateChord(scale[4], "dominant7");
  const secondChord = generateChord(scale[0], "major");
  return {
    play: () => { playChordReal(firstChord.map(midiToFreq), 0.6, "acoustic_grand_piano"); setTimeout(() => playChordReal(secondChord.map(midiToFreq), 0.8, "acoustic_grand_piano"), 700); },
    prompt: "Qual é o tipo de cadência?",
    options: cadences.map(c => ({label: c.name, correct: c.name === selected.name})),
  };
}

/** BandMatch — quais instrumentos estão tocando */
export function makeBandMatchRound(level: number): FlashcardRound {
  const instruments = [
    {name: "Guitarra", freq: 330}, {name: "Piano", freq: 440},
    {name: "Baixo", freq: 110}, {name: "Bateria", freq: 80},
    {name: "Sax", freq: 233}, {name: "Violino", freq: 660},
    {name: "Flauta", freq: 880}, {name: "Trompete", freq: 392},
  ];
  const num = Math.min(2 + Math.floor(level / 4), 5);
  const selected = instruments.sort(() => Math.random() - 0.5).slice(0, num);
  const correctLabel = selected.map(s => s.name).join(", ");
  const wrong = instruments.filter(i => !selected.includes(i)).sort(() => Math.random() - 0.5).slice(0, 3);
  return {
    play: () => selected.forEach((inst, i) => setTimeout(() => playNoteReal(inst.freq, 0.5, "acoustic_grand_piano"), i * 200)),
    prompt: `Quantos instrumentos você ouve? (${num})`,
    options: [{label: correctLabel, correct: true}, ...wrong.map(w => ({label: selected.slice(0,-1).map(s=>s.name).concat(w.name).join(", "), correct: false}))].sort(() => Math.random() - 0.5),
  };
}

/** FlashEffects */
export function makeFlashEffectsRound(level: number): FlashcardRound {
  const effects = [{name: "Dry"}, {name: "Reverb"}, {name: "Delay"}, {name: "Chorus"}];
  const selected = effects[Math.floor(Math.random() * effects.length)];
  const baseFreq = 440;
  return {
    play: () => {
      if (selected.name === "Delay") { playNoteReal(baseFreq, 0.2, "acoustic_grand_piano"); setTimeout(() => playNoteReal(baseFreq, 0.15, "acoustic_grand_piano"), 300); setTimeout(() => playNoteReal(baseFreq, 0.1, "acoustic_grand_piano"), 600); }
      else if (selected.name === "Chorus") { playNoteReal(baseFreq, 0.4, "acoustic_grand_piano"); setTimeout(() => playNoteReal(baseFreq * 1.01, 0.4, "acoustic_grand_piano"), 50); }
      else if (selected.name === "Reverb") { playNoteReal(baseFreq, 0.2, "acoustic_grand_piano"); setTimeout(() => playNoteReal(baseFreq, 0.1, "acoustic_grand_piano"), 250); setTimeout(() => playNoteReal(baseFreq, 0.08, "acoustic_grand_piano"), 450); }
      else playNoteReal(baseFreq, 0.4, "acoustic_grand_piano");
    },
    prompt: "Qual efeito foi aplicado?",
    options: effects.map(e => ({label: e.name, correct: e.name === selected.name})),
  };
}

/** ChordSpells — quais notas formam o acorde */
export function makeChordSpellsRound(level: number): FlashcardRound {
  const types: ChordType[] = ["major", "minor", "major7", "dominant7", "minor7"];
  const selected = types[Math.floor(Math.random() * types.length)];
  const root = PRACTICE_KEYS[Math.floor(Math.random() * PRACTICE_KEYS.length)];
  const chord = generateChord(root.midi, selected);
  const correctNotes = chord.map(m => midiToName(m)).join(" - ");
  const wrongs: string[] = [];
  for (let w = 0; w < 3; w++) {
    const mod = [...chord]; mod[w % mod.length] += 2;
    wrongs.push(mod.map(m => midiToName(m)).join(" - "));
  }
  return {
    play: () => playChordReal(chord.map(midiToFreq), 0.6, "acoustic_grand_piano"),
    prompt: `Quais notas formam ${root.name}${CHORDS[selected].short}?`,
    options: [{label: correctNotes, correct: true}, ...wrongs.map(l => ({label: l, correct: false}))].sort(() => Math.random() - 0.5),
  };
}

/** SpeakerChords — qual progressão */
export function makeSpeakerChordsRound(level: number): FlashcardRound {
  const progressions = [
    {name: "I - V - vi - IV", degrees: [0, 4, 5, 3]},
    {name: "I - IV - V - I", degrees: [0, 3, 4, 0]},
    {name: "vi - IV - I - V", degrees: [5, 3, 0, 4]},
    {name: "I - vi - IV - V", degrees: [0, 5, 3, 4]},
  ];
  const selected = progressions[Math.floor(Math.random() * progressions.length)];
  const root = PRACTICE_KEYS[Math.floor(Math.random() * PRACTICE_KEYS.length)];
  const scale = generateScale(root.midi, "major", 0);
  const chords = selected.degrees.map(d => generateChord(scale[d], "major"));
  return {
    play: () => chords.forEach((c, i) => setTimeout(() => playChordReal(c.map(midiToFreq), 0.5, "acoustic_grand_piano"), i * 600)),
    prompt: "Qual progressão você ouviu?",
    options: progressions.map(p => ({label: p.name, correct: p.name === selected.name})),
  };
}

/** Inversions */
export function makeInversionsRound(level: number): FlashcardRound {
  const inversions = ["Fundamental", "1ª Inversão", "2ª Inversão"];
  const selected = inversions[Math.floor(Math.random() * 3)];
  const root = 60 + Math.floor(Math.random() * 12);
  const chord = generateChord(root, "major");
  let reordered: number[];
  if (selected === "1ª Inversão") reordered = [chord[1], chord[2], chord[0] + 12];
  else if (selected === "2ª Inversão") reordered = [chord[2], chord[0] + 12, chord[1] + 12];
  else reordered = chord;
  return {
    play: () => playChordReal(reordered.map(midiToFreq), 0.6, "acoustic_grand_piano"),
    prompt: "Em qual inversão está este acorde?",
    options: inversions.map(inv => ({label: inv, correct: inv === selected})),
  };
}

/** Arpeggios */
export function makeArpeggioRound(level: number): FlashcardRound {
  const types: ChordType[] = ["major", "minor", "diminished", "augmented"];
  const selected = types[Math.floor(Math.random() * 4)];
  const root = 60 + Math.floor(Math.random() * 12);
  const chord = generateChord(root, selected);
  return {
    play: () => playMelodyReal(chord.map(midiToFreq), 0.3, "acoustic_grand_piano"),
    prompt: "Este arpejo é de qual tipo de acorde?",
    options: types.map(t => ({label: CHORDS[t].name, correct: t === selected})),
  };
}

/** EQ Match */
export function makeEQMatchRound(level: number): FlashcardRound {
  const freqs = [250, 500, 1000, 2000, 4000, 8000];
  const selected = freqs[Math.floor(Math.random() * freqs.length)];
  const wrong = freqs.filter(f => f !== selected).sort(() => Math.random() - 0.5).slice(0, 3);
  return {
    play: () => playNoteReal(selected, 0.5, "acoustic_grand_piano"),
    prompt: "Qual frequência está mais destacada?",
    options: [{label: `${selected} Hz`, correct: true}, ...wrong.map(f => ({label: `${f} Hz`, correct: false}))].sort(() => Math.random() - 0.5),
  };
}

/** Flash Styles Drums */
export function makeFlashStylesRound(level: number): FlashcardRound {
  const styles = [{name: "Rock"}, {name: "Jazz/Swing"}, {name: "Funk"}, {name: "Balada"}];
  const selected = styles[Math.floor(Math.random() * 4)];
  return {
    play: () => { for (let i = 0; i < 4; i++) setTimeout(() => playNoteReal(80, 0.1, "acoustic_grand_piano"), i * 300); },
    prompt: "Qual estilo de bateria você ouviu?",
    options: styles.map(s => ({label: s.name, correct: s.name === selected.name})),
  };
}

/** Rhythm Puzzles */
export function makeRhythmRound(level: number): FlashcardRound {
  const patterns = [
    {name: "4 colcheias", beats: [1,1,1,1]},
    {name: "2 semínimas", beats: [2,2]},
    {name: "Semínima + 2 colcheias", beats: [2,1,1]},
    {name: "Síncope", beats: [1,2,1]},
  ];
  const selected = patterns[Math.floor(Math.random() * patterns.length)];
  return {
    play: () => { let t = 0; selected.beats.forEach(b => { setTimeout(() => playNoteReal(440, 0.1, "acoustic_grand_piano"), t); t += b * 300; }); },
    prompt: "Qual padrão rítmico você ouviu?",
    options: patterns.map(p => ({label: p.name, correct: p.name === selected.name})).sort(() => Math.random() - 0.5).slice(0, 4),
  };
}

/** Key Puzzles */
export function makeKeyPuzzlesRound(level: number): FlashcardRound {
  const keys = [{name: "C Maior", sharps: 0}, {name: "G Maior", sharps: 1}, {name: "D Maior", sharps: 2}, {name: "F Maior", sharps: -1}];
  const selected = keys[Math.floor(Math.random() * 4)];
  const wrong = keys.filter(k => k.name !== selected.name).sort(() => Math.random() - 0.5).slice(0, 3);
  return {
    play: () => playNoteReal(midiToFreq(60), 0.4, "acoustic_grand_piano"),
    prompt: `Quantos sustenidos tem ${selected.name}?`,
    options: [{label: `${selected.sharps > 0 ? selected.sharps + " sustenidos" : selected.sharps === 0 ? "Sem sustenidos" : Math.abs(selected.sharps) + " bemóis"}`, correct: true}, ...wrong.map(k => ({label: `${k.sharps > 0 ? k.sharps + " sustenidos" : k.sharps === 0 ? "Sem sustenidos" : Math.abs(k.sharps) + " bemóis"}`, correct: false}))].sort(() => Math.random() - 0.5),
  };
}

/** Flash Terms Performance */
export function makeFlashTermsRound(level: number): FlashcardRound {
  const terms = [
    {name: "Crescendo", def: "Aumentar volume gradualmente"},
    {name: "Staccato", def: "Notas curtas e destacadas"},
    {name: "Legato", def: "Notas ligadas e suaves"},
    {name: "Ritardando", def: "Diminuir tempo gradualmente"},
  ];
  const selected = terms[Math.floor(Math.random() * 4)];
  const wrong = terms.filter(t => t.name !== selected.name).sort(() => Math.random() - 0.5).slice(0, 3);
  return {
    play: () => playNoteReal(440, 0.3, "acoustic_grand_piano"),
    prompt: `Qual é a definição de "${selected.name}"?`,
    options: [{label: selected.def, correct: true}, ...wrong.map(t => ({label: t.def, correct: false}))].sort(() => Math.random() - 0.5),
  };
}

/** Flash Notation Notes */
export function makeFlashNotationNotesRound(level: number): FlashcardRound {
  const midi = 60 + Math.floor(Math.random() * 24);
  const noteName = NOTE_NAMES[((midi % 12) + 12) % 12];
  const wrong = NOTE_NAMES.filter(n => n !== noteName).sort(() => Math.random() - 0.5).slice(0, 3);
  return {
    play: () => playNoteReal(midiToFreq(midi), 0.4, "acoustic_grand_piano"),
    prompt: `Qual nota está sendo tocada?`,
    options: [{label: noteName, correct: true}, ...wrong.map(n => ({label: n, correct: false}))].sort(() => Math.random() - 0.5),
  };
}
