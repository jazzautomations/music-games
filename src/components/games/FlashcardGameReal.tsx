"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, RotateCcw, Volume2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GameShell } from "./GameShell";
import { MusicStaff, midisToVexFlow } from "./MusicStaff";
import { type GameDef, CATEGORY_EMOJIS, CATEGORY_LABELS } from "@/lib/games/gamesCatalog";
import { useProgress } from "@/hooks/useProgress";
import {
  initAudio, loadInstrument, preloadInstruments,
  playNoteReal, playChordReal, playMelodyReal,
  midiToFreq, type RealInstrument,
} from "@/lib/audio/soundfontEngine";
import {
  generateScale, generateChord, PRACTICE_KEYS, INTERVALS, CHORDS,
  type ChordType,
} from "@/lib/audio/musicTheory";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function midiToName(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

// ─── Tipos ───────────────────────────────────────────

export interface FlashcardRound {
  play: () => void;
  prompt: string;
  context?: string;
  options: { label: string; correct: boolean; sub?: string; emoji?: string }[];
  instrument?: RealInstrument;
  /** Notas MIDI pra mostrar na pauta (VexFlow) — opcional */
  staffNotes?: number[];
  /** Tipo de clef pra pauta */
  staffClef?: "treble" | "bass";
}

export interface FlashcardConfig {
  generateRound: (level: number) => FlashcardRound;
  timed?: boolean;
  getTimeLimit?: (level: number) => number;
  numOptions?: number;
  /** Instrumento padrão */
  defaultInstrument?: RealInstrument;
}

interface Props {
  game: GameDef;
  config: FlashcardConfig;
  onExit: () => void;
}

// ─── Componente ──────────────────────────────────────

export function FlashcardGameReal({ game, config, onExit }: Props) {
  const [level, setLevel] = useState(1);
  const [round, setRound] = useState<FlashcardRound | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [selected, setSelected] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(config.getTimeLimit?.(1) ?? 5);
  const [audioReady, setAudioReady] = useState(false);
  const [instrumentLoading, setInstrumentLoading] = useState(false);
  const [questionNum, setQuestionNum] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { recordPlay, unlockAchievement } = useProgress();

  const timeLimit = config.getTimeLimit?.(level) ?? 5;
  const numOptions = config.numOptions ?? 4;
  const defaultInstrument = config.defaultInstrument ?? "acoustic_grand_piano";
  const questionsPerLevel = 8;

  // ─── Init áudio ────────────────────────────────────

  const handleStart = useCallback(async () => {
    setInstrumentLoading(true);
    await initAudio();
    // Pré-carrega o instrumento padrão
    await loadInstrument(defaultInstrument);
    setInstrumentLoading(false);
    setAudioReady(true);
  }, [defaultInstrument]);

  // ─── Gerar round (sempre que questionNum ou level muda) ───

  useEffect(() => {
    if (!audioReady) return;
    const r = config.generateRound(level);
    setRound(r);
    setSelected(null);
    setFeedback("idle");
    setTimeLeft(timeLimit);

    // Pré-carrega instrumento e toca quando carregado
    const inst = r.instrument ?? defaultInstrument;
    loadInstrument(inst).then(() => {
      setTimeout(() => { void r.play(); }, 200);
    }).catch(err => console.error("[FlashcardGame] Erro ao carregar instrumento:", err));
  }, [level, questionNum, config, audioReady, timeLimit, defaultInstrument]);

  // ─── Timer ─────────────────────────────────────────

  useEffect(() => {
    if (!config.timed || !round || selected !== null || !audioReady) return;
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const left = Math.max(0, timeLimit - elapsed);
      setTimeLeft(left);
      if (left <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        handleAnswer(-1);
      }
    }, 50);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [round, config.timed, timeLimit, selected, audioReady]);

  // ─── Responder ─────────────────────────────────────

  const handleAnswer = useCallback((idx: number) => {
    if (selected !== null || !round) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelected(idx);
    const correct = idx >= 0 && round.options[idx]?.correct;

    if (correct) {
      setFeedback("correct");
      const timeBonus = config.timed ? Math.floor(timeLeft * 20) : 0;
      const streakBonus = Math.min(streak, 10) * 10;
      const points = 100 + timeBonus + streakBonus + level * 5;
      setScore(s => s + points);
      setStreak(s => {
        const ns = s + 1;
        setBestStreak(b => Math.max(b, ns));
        return ns;
      });
      unlockAchievement("first_play");
      if (level >= 5) unlockAchievement("level_5");
      if (level >= 10) unlockAchievement("level_10");
      if (level >= 20) unlockAchievement("level_20");
      recordPlay(game.id, level, score + points);

      // Próxima pergunta: incrementa questionNum → useEffect gera novo round
      setTimeout(() => {
        if (questionNum + 1 >= questionsPerLevel) {
          // Nível completo → sobe de nível
          setScore(s => s + 50);
          setLevel(l => Math.min(20, l + 1));
          setQuestionNum(0);
        } else {
          setQuestionNum(q => q + 1);
        }
      }, 1200);
    } else {
      setFeedback("wrong");
      setStreak(0);
      setTimeout(() => {
        // Próxima pergunta (mesmo errando)
        if (questionNum + 1 >= questionsPerLevel) {
          setLevel(l => Math.min(20, l + 1));
          setQuestionNum(0);
        } else {
          setQuestionNum(q => q + 1);
        }
      }, 1500);
    }
  }, [selected, round, config, level, score, game.id, recordPlay, unlockAchievement, timeLeft, timeLimit, defaultInstrument, streak, questionNum, questionsPerLevel]);

  const replay = useCallback(() => {
    if (round) { void round.play(); }
  }, [round]);

  const restart = () => { setLevel(1); setScore(0); setStreak(0); setBestStreak(0); setSelected(null); setFeedback("idle"); setQuestionNum(0); };

  // ─── Loading ───────────────────────────────────────

  if (!audioReady) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a14] via-[#14142a] to-[#0a0a14] text-white flex items-center justify-center">
        <Card className="bg-white/5 border-white/10 p-8 text-center max-w-md">
          <div className="text-5xl mb-4">{game.emoji}</div>
          <h2 className="text-2xl font-bold mb-2">{game.name}</h2>
          <p className="text-white/60 text-sm mb-6">{game.shortDescription}</p>
          {instrumentLoading ? (
            <div className="flex items-center justify-center gap-2 text-white/60">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Carregando instrumentos reais...</span>
            </div>
          ) : (
            <Button onClick={handleStart} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5 text-base font-bold">
              <Volume2 className="w-5 h-5 mr-2" /> Começar
            </Button>
          )}
          <p className="text-white/30 text-xs mt-4">
            {CATEGORY_EMOJIS[game.category]} {CATEGORY_LABELS[game.category]} · Som de instrumento real
          </p>
        </Card>
      </div>
    );
  }

  if (!round) return null;

  const inst = round.instrument ?? defaultInstrument;
  const instLabel = inst.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  // ─── Render ────────────────────────────────────────

  return (
    <GameShell game={game} level={level} score={score} streak={streak} onExit={onExit} onRestart={restart}>
      {/* Streak + question counter */}
      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="text-white/50">Pergunta {questionNum + 1}/{questionsPerLevel}</span>
        {streak >= 2 && (
          <motion.span
            key={streak}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-orange-400 font-bold"
          >
            🔥 ×{streak} ({(1 + Math.min(streak, 10) * 0.1).toFixed(1)}x)
          </motion.span>
        )}
        <span className="text-white/50">Instrumento: {instLabel}</span>
      </div>

      {/* Timer bar */}
      {config.timed && (
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-4 border border-white/10">
          <motion.div
            className="h-full"
            animate={{ width: `${(timeLeft / timeLimit) * 100}%` }}
            transition={{ duration: 0.05 }}
            style={{
              background: timeLeft > timeLimit * 0.5
                ? "linear-gradient(90deg, #10b981, #34d399)"
                : timeLeft > timeLimit * 0.2
                ? "linear-gradient(90deg, #f59e0b, #fb923c)"
                : "linear-gradient(90deg, #ef4444, #dc2626)",
            }}
          />
        </div>
      )}

      {/* Card da pergunta */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`round-${questionNum}-${level}`}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
        >
          <Card className={`bg-gradient-to-br ${game.accent} bg-opacity-5 border-white/20 p-6 mb-4 text-center`}>
            {round.context && (
              <div className="text-xs text-white/40 uppercase tracking-wider mb-2">{round.context}</div>
            )}
            <div className="text-base text-white/80 mb-4">{round.prompt}</div>
            {/* Notação musical na pauta (VexFlow) — se o round tiver staffNotes */}
            {round.staffNotes && round.staffNotes.length > 0 && (
              <div className="flex justify-center mb-4 opacity-90">
                <MusicStaff
                  notes={midisToVexFlow(round.staffNotes)}
                  clef={round.staffClef ?? "treble"}
                  color="rgba(255,255,255,0.8)"
                  width={Math.min(500, round.staffNotes.length * 60 + 100)}
                  height={140}
                />
              </div>
            )}
            <Button onClick={replay} variant="outline" className="border-white/30 bg-white/10 hover:bg-white/20">
              <Play className="w-4 h-4 mr-2" /> Ouvir novamente
            </Button>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Opções de resposta */}
      <div className={`grid gap-3 ${
        numOptions <= 2 ? "grid-cols-2" :
        numOptions <= 3 ? "grid-cols-3" :
        numOptions <= 4 ? "grid-cols-2 sm:grid-cols-4" :
        "grid-cols-2 sm:grid-cols-4"
      }`}>
        {round.options.map((opt, i) => {
          const isSelected = selected === i;
          const showCorrect = feedback !== "idle" && opt.correct;
          const showWrong = isSelected && !opt.correct;
          return (
            <motion.button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={selected !== null}
              whileHover={{ scale: selected === null ? 1.03 : 1 }}
              whileTap={{ scale: 0.97 }}
              className={`py-6 rounded-xl border text-base font-bold transition-colors ${
                showCorrect ? "bg-emerald-600 border-emerald-400 text-white"
                : showWrong ? "bg-red-600 border-red-400 text-white"
                : "bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/40"
              }`}
            >
              {opt.emoji && <span className="text-2xl block mb-1">{opt.emoji}</span>}
              <span>{opt.label}</span>
              {opt.sub && <span className="block text-xs opacity-60 mt-1">{opt.sub}</span>}
            </motion.button>
          );
        })}
      </div>

      {/* Feedback flutuante */}
      <AnimatePresence>
        {feedback !== "idle" && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="fixed top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-50 text-center"
          >
            <div className={`text-6xl mb-2 ${feedback === "correct" ? "" : ""}`}>
              {feedback === "correct" ? "✨" : "❌"}
            </div>
            <div
              className={`text-4xl font-black ${feedback === "correct" ? "text-emerald-400" : "text-red-400"}`}
              style={{ textShadow: `0 0 24px ${feedback === "correct" ? "#10b981" : "#ef4444"}` }}
            >
              {feedback === "correct" ? "CORRETO!" : "ERRADO"}
            </div>
            {feedback === "wrong" && round && (
              <div className="text-sm text-white/60 mt-2">
                Resposta: {round.options.find(o => o.correct)?.label}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </GameShell>
  );
}

// ═══ GERADORES DE ROUND POR JOGO ═══
// Cada um usa o instrumento real apropriado.

const INSTRUMENTS = {
  piano: "acoustic_grand_piano" as RealInstrument,
  guitar: "acoustic_guitar_nylon" as RealInstrument,
  guitarSteel: "acoustic_guitar_steel" as RealInstrument,
  violin: "violin" as RealInstrument,
  flute: "flute" as RealInstrument,
  vibraphone: "vibraphone" as RealInstrument,
  trumpet: "trumpet" as RealInstrument,
  sax: "soprano_sax" as RealInstrument,
  harpsichord: "harpsichord" as RealInstrument,
  organ: "church_organ" as RealInstrument,
  marimba: "marimba" as RealInstrument,
  bass: "electric_bass_finger" as RealInstrument,
  cello: "cello" as RealInstrument,
  clarinet: "clarinet" as RealInstrument,
};

// Mapear instrumentos do Theta → nossos soundfonts reais
const LEVEL_INSTRUMENTS: RealInstrument[] = [
  "acoustic_grand_piano", "acoustic_guitar_nylon", "vibraphone",
  "harpsichord", "acoustic_grand_piano", "acoustic_guitar_nylon",
  "vibraphone", "harpsichord", "acoustic_grand_piano", "acoustic_guitar_nylon",
  "vibraphone", "harpsichord", "acoustic_grand_piano", "acoustic_guitar_nylon",
  "vibraphone", "harpsichord", "acoustic_grand_piano", "acoustic_guitar_nylon",
  "vibraphone", "harpsichord", "acoustic_grand_piano",
];

function getInstrumentForLevel(level: number): RealInstrument {
  return LEVEL_INSTRUMENTS[Math.min(level - 1, LEVEL_INSTRUMENTS.length - 1)] ?? INSTRUMENTS.piano;
}

// ─── PITCH COMPARE / SPEED PITCH ─────────────────────

export function makePitchCompareRound(level: number): FlashcardRound {
  const baseFreq = 220;
  const diff = Math.max(5, 200 - (level - 1) * 10);
  const r = Math.random();
  let freq2: number, answer: string;
  if (r < 0.4) { freq2 = baseFreq * Math.pow(2, diff / 1200); answer = "Mais alto"; }
  else if (r < 0.8) { freq2 = baseFreq * Math.pow(2, -diff / 1200); answer = "Mais baixo"; }
  else { freq2 = baseFreq; answer = "Igual"; }
  const inst = getInstrumentForLevel(level);
  return {
    play: () => { playNoteReal(baseFreq, 0.6, inst); setTimeout(() => playNoteReal(freq2, 0.6, inst), 800); },
    prompt: "O segundo tom está mais alto, mais baixo ou igual ao primeiro?",
    context: `Diferença: ${diff} cents`,
    instrument: inst,
    staffNotes: [midi],
    options: [
      { label: "Mais alto", correct: answer === "Mais alto", emoji: "⬆️" },
      { label: "Mais baixo", correct: answer === "Mais baixo", emoji: "⬇️" },
      { label: "Igual", correct: answer === "Igual", emoji: "➡️" },
    ],
  };
}

// ─── FLASH CHORDS / TRIADS / SEVENTH CHORDS ──────────

export function makeChordRound(level: number, chordTypes?: ChordType[]): FlashcardRound {
  const types: ChordType[] = chordTypes ?? (
    level <= 3 ? ["major", "minor"] :
    level <= 7 ? ["major", "minor", "diminished", "augmented"] :
    ["major", "minor", "diminished", "augmented", "sus4", "dominant7", "major7", "minor7"]
  );
  const selected = types[Math.floor(Math.random() * types.length)];
  const root = 60 + Math.floor(Math.random() * 12);
  const chord = generateChord(root, selected);
  const wrong = types.filter(t => t !== selected).sort(() => Math.random() - 0.5).slice(0, 3);
  const inst = getInstrumentForLevel(level);
  return {
    play: () => playChordReal(chord.map(midiToFreq), 0.8, inst),
    staffNotes: chord,
    prompt: "Qual é o tipo deste acorde?",
    context: `Nota fundamental: ${midiToName(root)}`,
    instrument: inst,
    staffNotes: [midi],
    options: [
      { label: CHORDS[selected].name, correct: true },
      ...wrong.map(t => ({ label: CHORDS[t].name, correct: false })),
    ].sort(() => Math.random() - 0.5),
  };
}

// ─── FLASH TONES / NUMBER BLASTER / PADDLE TONES ─────

export function makeScaleDegreeRound(level: number): FlashcardRound {
  const key = PRACTICE_KEYS[Math.floor(Math.random() * PRACTICE_KEYS.length)];
  const scale = generateScale(key.midi + 12, "major", 0);
  const maxDegree = Math.min(7, 2 + Math.floor(level / 3));
  const degreeIdx = Math.floor(Math.random() * maxDegree);
  const target = scale[degreeIdx];
  const labels = ["1 (Tônica)", "2", "3", "4", "5 (Dominante)", "6", "7 (Sensível)"];
  const wrongIdxs = Array.from({length: maxDegree}, (_, i) => i)
    .filter(i => i !== degreeIdx)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const inst = getInstrumentForLevel(level);
  return {
    play: () => playNoteReal(midiToFreq(target), 0.5, inst),
    prompt: "Qual scale degree desta nota?",
    context: `Tonalidade: ${key.name} Maior`,
    instrument: inst,
    staffNotes: [midi],
    options: [
      { label: labels[degreeIdx], correct: true },
      ...wrongIdxs.map(i => ({ label: labels[i], correct: false })),
    ].sort(() => Math.random() - 0.5),
  };
}

// ─── FLASH INTERVALS (MELODIC / HARMONIC) ────────────

export function makeIntervalRound(level: number, harmonic = false): FlashcardRound {
  const root = 60 + Math.floor(Math.random() * 12);
  const maxInterval = Math.min(12, 2 + Math.floor(level / 2));
  const interval = Math.floor(Math.random() * (maxInterval + 1));
  const second = root + interval;
  const correctInterval = INTERVALS.find(i => i.semitones === interval)!;
  const wrong = INTERVALS.filter(i => i.semitones !== interval && i.semitones <= maxInterval)
    .sort(() => Math.random() - 0.5).slice(0, 3);
  const inst = getInstrumentForLevel(level);
  return {
    play: harmonic
      ? () => playChordReal([midiToFreq(root), midiToFreq(second)], 0.8, inst)
      : () => { playNoteReal(midiToFreq(root), 0.4, inst); setTimeout(() => playNoteReal(midiToFreq(second), 0.4, inst), 500); },
    prompt: harmonic ? "Qual é o intervalo harmônico (notas simultâneas)?" : "Qual é o intervalo melódico (notas em sequência)?",
    context: `Nota inicial: ${midiToName(root)}`,
    instrument: inst,
    staffNotes: [midi],
    options: [
      { label: correctInterval.name, correct: true, sub: correctInterval.short },
      ...wrong.map(i => ({ label: i.name, correct: false, sub: i.short })),
    ].sort(() => Math.random() - 0.5),
  };
}

// ─── TONIC FINDER ────────────────────────────────────

export function makeTonicFinderRound(level: number): FlashcardRound {
  const key = PRACTICE_KEYS[Math.floor(Math.random() * PRACTICE_KEYS.length)];
  const scale = generateScale(key.midi + 12, "major", 0);
  const phrase = [scale[2], scale[4], scale[5], scale[0], scale[2], scale[0]];
  const wrong = scale.filter(m => m !== scale[0]).sort(() => Math.random() - 0.5).slice(0, 3);
  const inst = getInstrumentForLevel(level);
  return {
    play: () => playMelodyReal(phrase.map(midiToFreq), 0.4, inst),
    prompt: "Ouça a melodia. Qual é a nota tônica (a nota que soa como 'casa')?",
    context: `Frase de 6 notas`,
    instrument: inst,
    staffNotes: [midi],
    options: [
      { label: midiToName(scale[0]), correct: true },
      ...wrong.map(m => ({ label: midiToName(m), correct: false })),
    ].sort(() => Math.random() - 0.5),
  };
}

// ─── FLASH CADENCES ──────────────────────────────────

export function makeCadenceRound(level: number): FlashcardRound {
  const cadences = [
    { name: "Cadência Perfeita (V→I)", desc: "Resolução definitiva", from: "dominant7", to: "major" },
    { name: "Cadência Plagal (IV→I)", desc: "Resolução suave (Amen)", from: "major", to: "major", fromDegree: 3 },
    { name: "Cadência Decepcionante (V→vi)", desc: "Surpresa, sem resolução", from: "dominant7", to: "minor", toDegree: 5 },
    { name: "Semicadência (→V)", desc: "Pausa no V, sem fechar", from: "major", to: "dominant7", toDegree: 4 },
  ];
  const selected = cadences[Math.floor(Math.random() * cadences.length)];
  const root = PRACTICE_KEYS[Math.floor(Math.random() * PRACTICE_KEYS.length)];
  const scale = generateScale(root.midi, "major", 0);
  const firstRoot = scale[selected.fromDegree ?? 4];
  const secondRoot = scale[selected.toDegree ?? 0];
  const firstChord = generateChord(firstRoot, selected.from as ChordType);
  const secondChord = generateChord(secondRoot, selected.to as ChordType);
  const inst = getInstrumentForLevel(level);
  return {
    play: () => {
      playChordReal(firstChord.map(midiToFreq), 0.7, inst);
      setTimeout(() => playChordReal(secondChord.map(midiToFreq), 0.9, inst), 750);
    },
    prompt: "Ouça os dois acordes. Qual é o tipo de cadência?",
    context: `Tonalidade: ${root.name} Maior`,
    instrument: inst,
    options: cadences.map(c => ({ label: c.name, correct: c.name === selected.name, sub: c.desc })),
  };
}

// ─── BAND MATCH ──────────────────────────────────────

export function makeBandMatchRound(level: number): FlashcardRound {
  const instruments = [
    { name: "Piano", freq: 440, inst: INSTRUMENTS.piano, emoji: "🎹" },
    { name: "Violão", freq: 330, inst: INSTRUMENTS.guitar, emoji: "🎸" },
    { name: "Baixo", freq: 110, inst: INSTRUMENTS.bass, emoji: "🎸" },
    { name: "Flauta", freq: 880, inst: INSTRUMENTS.flute, emoji: "🪈" },
    { name: "Violino", freq: 660, inst: INSTRUMENTS.violin, emoji: "🎻" },
    { name: "Trompete", freq: 392, inst: INSTRUMENTS.trumpet, emoji: "🎺" },
    { name: "Vibrafone", freq: 523, inst: INSTRUMENTS.vibraphone, emoji: "🔔" },
    { name: "Sax", freq: 233, inst: INSTRUMENTS.sax, emoji: "🎷" },
  ];
  const num = Math.min(2 + Math.floor(level / 4), 5);
  const selected = [...instruments].sort(() => Math.random() - 0.5).slice(0, num);
  const correctLabel = selected.map(s => s.name).join(", ");
  const wrong = instruments.filter(i => !selected.includes(i)).sort(() => Math.random() - 0.5).slice(0, 3);
  return {
    play: () => selected.forEach((inst, i) => setTimeout(() => playNoteReal(inst.freq, 0.6, inst.inst), i * 250)),
    prompt: `Quantos instrumentos você ouve? (${num})`,
    context: `Instrumentos reais gravados`,
    staffNotes: [midi],
    options: [
      { label: correctLabel, correct: true },
      ...wrong.map(w => ({ label: [...selected.slice(0, -1).map(s => s.name), w.name].join(", "), correct: false })),
    ].sort(() => Math.random() - 0.5),
  };
}

// ─── FLASH EFFECTS ───────────────────────────────────

export function makeFlashEffectsRound(level: number): FlashcardRound {
  const effects = [
    { name: "Som seco (sem efeito)", emoji: "🔇" },
    { name: "Reverb", emoji: "🏛️" },
    { name: "Delay (eco)", emoji: "🔁" },
    { name: "Chorus", emoji: "🌊" },
  ];
  const selected = effects[Math.floor(Math.random() * effects.length)];
  const baseFreq = 440;
  const inst = INSTRUMENTS.piano;
  return {
    play: () => {
      if (selected.name.includes("Delay")) {
        playNoteReal(baseFreq, 0.2, inst);
        setTimeout(() => playNoteReal(baseFreq, 0.15, inst), 300);
        setTimeout(() => playNoteReal(baseFreq, 0.1, inst), 600);
      } else if (selected.name.includes("Chorus")) {
        playNoteReal(baseFreq, 0.4, inst);
        setTimeout(() => playNoteReal(baseFreq * 1.005, 0.4, inst), 30);
      } else if (selected.name.includes("Reverb")) {
        playNoteReal(baseFreq, 0.2, inst);
        setTimeout(() => playNoteReal(baseFreq, 0.1, inst), 250);
        setTimeout(() => playNoteReal(baseFreq, 0.08, inst), 450);
      } else {
        playNoteReal(baseFreq, 0.4, inst);
      }
    },
    prompt: "Qual efeito foi aplicado ao som?",
    instrument: inst,
    options: effects.map(e => ({ label: e.name, correct: e.name === selected.name, emoji: e.emoji })),
  };
}

// ─── CHORD SPELLS ────────────────────────────────────

export function makeChordSpellsRound(level: number): FlashcardRound {
  const types: ChordType[] = level <= 5 ? ["major", "minor"] : ["major", "minor", "major7", "dominant7", "minor7"];
  const selected = types[Math.floor(Math.random() * types.length)];
  const root = PRACTICE_KEYS[Math.floor(Math.random() * PRACTICE_KEYS.length)];
  const chord = generateChord(root.midi, selected);
  const correctNotes = chord.map(m => midiToName(m)).join(" — ");
  const wrongs: string[] = [];
  for (let w = 0; w < 3; w++) {
    const mod = [...chord]; mod[w % mod.length] += 2;
    wrongs.push(mod.map(m => midiToName(m)).join(" — "));
  }
  const inst = INSTRUMENTS.piano;
  return {
    play: () => playChordReal(chord.map(midiToFreq), 0.6, inst),
    staffNotes: chord,
    prompt: `Quais notas formam o acorde ${root.name}${CHORDS[selected].short}?`,
    context: `Tipo: ${CHORDS[selected].name}`,
    instrument: inst,
    staffNotes: [midi],
    options: [
      { label: correctNotes, correct: true },
      ...wrongs.map(l => ({ label: l, correct: false })),
    ].sort(() => Math.random() - 0.5),
  };
}

// ─── SPEAKER CHORDS / FLASH PROGRESSIONS ────────────

export function makeSpeakerChordsRound(level: number): FlashcardRound {
  const progressions = [
    { name: "I — V — vi — IV", degrees: [0, 4, 5, 3], desc: "Mais usada no pop" },
    { name: "I — IV — V — I", degrees: [0, 3, 4, 0], desc: "Clássica do rock" },
    { name: "vi — IV — I — V", degrees: [5, 3, 0, 4], desc: "Começa no relativo" },
    { name: "I — vi — IV — V", degrees: [0, 5, 3, 4], desc: "Doo-wop / 50s" },
    { name: "ii — V — I", degrees: [1, 4, 0], desc: "Jazz básico" },
  ];
  const available = level <= 5 ? progressions.slice(0, 4) : progressions;
  const selected = available[Math.floor(Math.random() * available.length)];
  const root = PRACTICE_KEYS[Math.floor(Math.random() * PRACTICE_KEYS.length)];
  const scale = generateScale(root.midi, "major", 0);
  const chords = selected.degrees.map(d => generateChord(scale[d], "major"));
  const inst = INSTRUMENTS.piano;
  return {
    play: () => chords.forEach((c, i) => setTimeout(() => playChordReal(c.map(midiToFreq), 0.5, inst), i * 600)),
    prompt: "Qual progressão de acordes você ouviu?",
    context: `Tonalidade: ${root.name} Maior · ${selected.degrees.length} acordes`,
    instrument: inst,
    options: available.map(p => ({ label: p.name, correct: p.name === selected.name, sub: p.desc })),
  };
}

// ─── INVERSIONS ──────────────────────────────────────

export function makeInversionsRound(level: number): FlashcardRound {
  const inversions = [
    { name: "Posição fundamental", desc: "Baixo = fundamental" },
    { name: "1ª inversão", desc: "Baixo = terça" },
    { name: "2ª inversão", desc: "Baixo = quinta" },
  ];
  const selected = inversions[Math.floor(Math.random() * 3)];
  const root = 60 + Math.floor(Math.random() * 12);
  const chord = generateChord(root, "major");
  let reordered: number[];
  if (selected.name === "1ª inversão") reordered = [chord[1], chord[2], chord[0] + 12];
  else if (selected.name === "2ª inversão") reordered = [chord[2], chord[0] + 12, chord[1] + 12];
  else reordered = chord;
  const inst = getInstrumentForLevel(level);
  return {
    play: () => playChordReal(reordered.map(midiToFreq), 0.6, inst),
    prompt: "Em qual inversão está este acorde?",
    context: `Acorde: ${midiToName(root)} maior`,
    instrument: inst,
    options: inversions.map(inv => ({ label: inv.name, correct: inv.name === selected.name, sub: inv.desc })),
  };
}

// ─── ARPEGGIOS ───────────────────────────────────────

export function makeArpeggioRound(level: number): FlashcardRound {
  const types: ChordType[] = ["major", "minor", "diminished", "augmented"];
  const selected = types[Math.floor(Math.random() * 4)];
  const root = 60 + Math.floor(Math.random() * 12);
  const chord = generateChord(root, selected);
  const inst = getInstrumentForLevel(level);
  return {
    play: () => playMelodyReal(chord.map(midiToFreq), 0.3, inst),
    staffNotes: chord,
    prompt: "Este arpejo (acorde tocado nota por nota) é de qual tipo?",
    context: `Nota inicial: ${midiToName(root)}`,
    instrument: inst,
    options: types.map(t => ({ label: CHORDS[t].name, correct: t === selected })),
  };
}

// ─── EQ MATCH ────────────────────────────────────────

export function makeEQMatchRound(level: number): FlashcardRound {
  const freqs = [125, 250, 500, 1000, 2000, 4000, 8000];
  const selected = freqs[Math.floor(Math.random() * freqs.length)];
  const wrong = freqs.filter(f => f !== selected).sort(() => Math.random() - 0.5).slice(0, 3);
  const inst = INSTRUMENTS.vibraphone;
  return {
    play: () => playNoteReal(selected, 0.5, inst),
    prompt: "Qual frequência está mais destacada no som?",
    context: `Frequências: ${freqs.join(", ")} Hz`,
    instrument: inst,
    staffNotes: [midi],
    options: [
      { label: `${selected} Hz`, correct: true },
      ...wrong.map(f => ({ label: `${f} Hz`, correct: false })),
    ].sort(() => Math.random() - 0.5),
  };
}

// ─── FLASH STYLES (DRUMS) ────────────────────────────

export function makeFlashStylesRound(level: number): FlashcardRound {
  const styles = [
    { name: "Rock", emoji: "🤘", bpm: 120, pattern: [1,0,1,0,1,0,1,0] },
    { name: "Jazz/Swing", emoji: "🎷", bpm: 100, pattern: [1,0,1,1,0,1,1,0] },
    { name: "Funk", emoji: "🕺", bpm: 110, pattern: [1,0,0,1,1,0,1,0] },
    { name: "Balada", emoji: "💔", bpm: 70, pattern: [1,0,0,0,1,0,0,0] },
  ];
  const selected = styles[Math.floor(Math.random() * 4)];
  const beatMs = 60000 / selected.bpm / 2;
  const inst = INSTRUMENTS.bass;
  return {
    play: () => {
      selected.pattern.forEach((beat, i) => {
        if (beat) setTimeout(() => playNoteReal(80, 0.1, inst), i * beatMs);
      });
    },
    prompt: "Qual estilo de bateria você ouviu?",
    context: `BPM: ${selected.bpm}`,
    instrument: inst,
    options: styles.map(s => ({ label: s.name, correct: s.name === selected.name, emoji: s.emoji })),
  };
}

// ─── RHYTHM PUZZLES / FLASH RHYTHMS ──────────────────

export function makeRhythmRound(level: number): FlashcardRound {
  const patterns = [
    { name: "4 colcheias iguais", beats: [0.5, 0.5, 0.5, 0.5], emoji: "♪♪♪♪" },
    { name: "2 semínimas", beats: [1, 1], emoji: "♩ ♩" },
    { name: "Semínima + 2 colcheias", beats: [1, 0.5, 0.5], emoji: "♩ ♪♪" },
    { name: "Síncope", beats: [0.5, 1, 0.5], emoji: "♪♩♪" },
    { name: "Semibreve", beats: [2], emoji: "𝅝" },
  ];
  const available = level <= 5 ? patterns.slice(0, 4) : patterns;
  const selected = available[Math.floor(Math.random() * available.length)];
  const beatMs = 400;
  const inst = INSTRUMENTS.marimba;
  return {
    play: () => {
      let t = 0;
      selected.beats.forEach(b => {
        setTimeout(() => playNoteReal(440, 0.1, inst), t);
        t += b * beatMs;
      });
    },
    prompt: "Qual padrão rítmico você ouviu?",
    context: `Beat = ${beatMs}ms`,
    instrument: inst,
    options: available.map(p => ({ label: p.name, correct: p.name === selected.name, emoji: p.emoji })),
  };
}

// ─── KEY PUZZLES ────────────────────────────────────

export function makeKeyPuzzlesRound(level: number): FlashcardRound {
  const keys = [
    { name: "C Maior", accidentals: 0, type: "Sem acidentes" },
    { name: "G Maior", accidentals: 1, type: "1 sustenido (F#)" },
    { name: "D Maior", accidentals: 2, type: "2 sustenidos (F#, C#)" },
    { name: "A Maior", accidentals: 3, type: "3 sustenidos (F#, C#, G#)" },
    { name: "F Maior", accidentals: -1, type: "1 bemol (Bb)" },
    { name: "Bb Maior", accidentals: -2, type: "2 bemóis (Bb, Eb)" },
  ];
  const available = level <= 5 ? keys.slice(0, 4) : keys;
  const selected = available[Math.floor(Math.random() * available.length)];
  const wrong = available.filter(k => k.name !== selected.name).sort(() => Math.random() - 0.5).slice(0, 3);
  const scale = generateScale(60, "major", 0);
  const inst = INSTRUMENTS.piano;
  return {
    play: () => playMelodyReal([scale[0], scale[2], scale[4], scale[0]].map(midiToFreq), 0.3, inst),
    prompt: `Esta escala tem ${selected.type}. Qual é a tonalidade?`,
    context: `${selected.accidentals > 0 ? selected.accidentals + " sustenidos" : selected.accidentals < 0 ? Math.abs(selected.accidentals) + " bemóis" : "Sem acidentes"}`,
    instrument: inst,
    staffNotes: [midi],
    options: [
      { label: selected.name, correct: true, sub: selected.type },
      ...wrong.map(k => ({ label: k.name, correct: false, sub: k.type })),
    ].sort(() => Math.random() - 0.5),
  };
}

// ─── FLASH TERMS (PERFORMANCE) ───────────────────────

export function makeFlashTermsRound(level: number): FlashcardRound {
  const terms = [
    { name: "Crescendo", def: "Aumentar o volume gradualmente", emoji: "🔊" },
    { name: "Decrescendo", def: "Diminuir o volume gradualmente", emoji: "🔉" },
    { name: "Staccato", def: "Notas curtas, destacadas e separadas", emoji: "·" },
    { name: "Legato", def: "Notas ligadas, suaves e contínuas", emoji: "∼" },
    { name: "Ritardando", def: "Diminuir o tempo gradualmente", emoji: "⏳" },
    { name: "Accelerando", def: "Aumentar o tempo gradualmente", emoji: "⏩" },
    { name: "Forte (f)", def: "Tocar forte (alto)", emoji: "💪" },
    { name: "Piano (p)", def: "Tocar suave (baixo)", emoji: "🤫" },
  ];
  const available = level <= 5 ? terms.slice(0, 4) : terms;
  const selected = available[Math.floor(Math.random() * available.length)];
  const wrong = available.filter(t => t.name !== selected.name).sort(() => Math.random() - 0.5).slice(0, 3);
  const inst = INSTRUMENTS.piano;
  // Simula o termo tocando
  const note = midiToFreq(64);
  return {
    play: () => {
      if (selected.name === "Staccato") {
        playNoteReal(note, 0.05, inst);
        setTimeout(() => playNoteReal(note, 0.05, inst), 200);
        setTimeout(() => playNoteReal(note, 0.05, inst), 400);
      } else if (selected.name === "Legato") {
        playNoteReal(note, 0.4, inst);
        setTimeout(() => playNoteReal(note * 1.122, 0.4, inst), 380);
      } else if (selected.name === "Crescendo") {
        playNoteReal(note, 0.15, inst);
        setTimeout(() => playNoteReal(note, 0.25, inst), 200);
        setTimeout(() => playNoteReal(note, 0.4, inst), 450);
      } else {
        playNoteReal(note, 0.4, inst);
      }
    },
    prompt: `O que significa "${selected.name}"?`,
    instrument: inst,
    staffNotes: [midi],
    options: [
      { label: selected.def, correct: true },
      ...wrong.map(t => ({ label: t.def, correct: false })),
    ].sort(() => Math.random() - 0.5),
  };
}

// ─── FLASH NOTATION (NOTES) ──────────────────────────

export function makeFlashNotationNotesRound(level: number): FlashcardRound {
  const midi = 55 + Math.floor(Math.random() * 24); // G3 to G5
  const noteName = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  const wrong = NOTE_NAMES.filter(n => n !== noteName).sort(() => Math.random() - 0.5).slice(0, 3);
  const inst = getInstrumentForLevel(level);
  return {
    play: () => playNoteReal(midiToFreq(midi), 0.5, inst),
    staffNotes: [midi],
    prompt: "Qual nota está sendo tocada?",
    context: `Oitava: ${octave}`,
    instrument: inst,
    staffNotes: [midi],
    options: [
      { label: noteName, correct: true },
      ...wrong.map(n => ({ label: n, correct: false })),
    ].sort(() => Math.random() - 0.5),
  };
}
