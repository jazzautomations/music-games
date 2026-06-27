/**
 * DropsGameReal.tsx — Jogo de "gotas que caem" (ToneDrops, ChordDrops, MelodicDrops, etc)
 *
 * Mecânica real do Theta: tons/acordes caem do topo. Jogador identifica
 * e clica na resposta correta antes da gota tocar o chão.
 *
 * Cada jogo subclassifica configurando: instrumento, tipo de resposta,
 * velocidade, drops simultâneos, etc.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heart, Play, RotateCcw } from "lucide-react";
import { GameShell } from "./GameShell";
import { GAMES_MAP, type GameDef } from "@/lib/games/gamesCatalog";
import { useProgress } from "@/hooks/useProgress";
import { initAudio, playNote, playChord, playMelody, midiToFreq, type InstrumentType } from "@/lib/audio/audioEngine";
import { generateScale, generateChord, PRACTICE_KEYS, INTERVALS, CHORDS, type ChordType } from "@/lib/audio/musicTheory";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function midiToName(midi: number): string { return `${NOTE_NAMES[((midi % 12) + 12) % 12]}`; }

interface Drop {
  id: number;
  y: number;
  answered: boolean;
  correct: boolean;
  audioFreq: number[];
  answerLabel: string;
}

interface DropsGameConfig {
  /** Tipos de resposta disponíveis por nível */
  getAnswers: (level: number) => string[];
  /** Gera um problema (audio + resposta) */
  generateProblem: (level: number, answers: string[]) => { freqs: number[]; answer: string };
  /** Velocidade por nível */
  getSpeed: (level: number) => number;
  /** Drops simultâneos por nível */
  getMaxDrops: (level: number) => number;
  /** Instrumento por nível */
  getInstrument: (level: number) => InstrumentType;
  /** Número de problemas pra completar o nível */
  getNumProblems: (level: number) => number;
}

interface Props {
  game: GameDef;
  config: DropsGameConfig;
  onExit: () => void;
}

export function DropsGameReal({ game, config, onExit }: Props) {
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [levelComplete, setLevelComplete] = useState(false);
  const [solved, setSolved] = useState(0);
  const [feedback, setFeedback] = useState<Record<number, "correct" | "wrong">>({});
  const [audioReady, setAudioReady] = useState(false);
  const dropIdRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastSpawnRef = useRef(0);
  const { recordPlay, unlockAchievement } = useProgress();

  const answers = config.getAnswers(level);
  const speed = config.getSpeed(level);
  const maxDrops = config.getMaxDrops(level);
  const instrument = config.getInstrument(level);
  const numProblems = config.getNumProblems(level);

  const handleStart = useCallback(async () => {
    await initAudio();
    setAudioReady(true);
  }, []);

  const spawnDrop = useCallback(() => {
    if (!audioReady || drops.filter(d => !d.answered).length >= maxDrops) return;
    const problem = config.generateProblem(level, answers);
    const id = dropIdRef.current++;
    setDrops(d => [...d, { id, y: 0, answered: false, correct: false, audioFreq: problem.freqs, answerLabel: problem.answer }]);
    // Toca o áudio (nota, acorde, ou intervalo)
    if (problem.freqs.length === 1) {
      playNote(problem.freqs[0], 0.6, instrument);
    } else if (problem.freqs.length <= 4) {
      playChord(problem.freqs, 0.8, instrument);
    }
  }, [audioReady, drops, maxDrops, config, level, answers, instrument]);

  useEffect(() => {
    if (gameOver || levelComplete || !audioReady) return;
    const tick = () => {
      const now = Date.now();
      const spawnInterval = Math.max(1500, 4000 - level * 120);
      if (now - lastSpawnRef.current > spawnInterval) {
        lastSpawnRef.current = now;
        spawnDrop();
      }
      setDrops(ds => {
        const updated = ds.map(d => d.answered ? d : { ...d, y: d.y + speed });
        const lost = updated.filter(d => !d.answered && d.y >= 100);
        if (lost.length > 0) {
          setLives(l => {
            const nl = l - lost.length;
            if (nl <= 0) { setGameOver(true); recordPlay(game.id, level, score); unlockAchievement("first_play"); }
            return Math.max(0, nl);
          });
          setStreak(0);
        }
        return updated.filter(d => !(d.y >= 100 && !d.answered));
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [gameOver, levelComplete, audioReady, speed, spawnDrop, level, score, game.id, recordPlay, unlockAchievement]);

  const answer = useCallback((choice: string) => {
    const target = [...drops].filter(d => !d.answered).sort((a, b) => b.y - a.y)[0];
    if (!target) return;
    const correct = choice === target.answerLabel;
    setFeedback(f => ({ ...f, [target.id]: correct ? "correct" : "wrong" }));
    if (correct) {
      setScore(s => s + 100 + Math.floor((100 - target.y) * 2));
      setStreak(s => s + 1);
      setSolved(s => s + 1);
      unlockAchievement("first_play");
      setTimeout(() => { setDrops(ds => ds.filter(d => d.id !== target.id)); setFeedback(f => { const nf = { ...f }; delete nf[target.id]; return nf; }); }, 300);
    } else {
      setLives(l => { const nl = l - 1; if (nl <= 0) { setGameOver(true); recordPlay(game.id, level, score); } return Math.max(0, nl); });
      setStreak(0);
      setTimeout(() => setFeedback(f => { const nf = { ...f }; delete nf[target.id]; return nf; }), 500);
    }
  }, [drops, score, level, game.id, recordPlay, unlockAchievement]);

  useEffect(() => {
    if (solved >= numProblems && !levelComplete) {
      setLevelComplete(true);
      setScore(s => s + 50);
      recordPlay(game.id, level, score + 50);
      if (level >= 5) unlockAchievement("level_5");
      if (level >= 10) unlockAchievement("level_10");
      if (level >= 20) unlockAchievement("level_20");
    }
  }, [solved, numProblems, levelComplete, level, score, game.id, recordPlay, unlockAchievement]);

  const restart = () => { setLevel(1); setScore(0); setStreak(0); setLives(3); setDrops([]); setGameOver(false); setLevelComplete(false); setSolved(0); dropIdRef.current = 0; lastSpawnRef.current = 0; };
  const nextLevel = () => { setLevel(l => Math.min(20, l + 1)); setLevelComplete(false); setSolved(0); setDrops([]); lastSpawnRef.current = 0; };

  if (gameOver) return (
    <GameShell game={game} level={level} score={score} streak={streak} onExit={onExit} onRestart={restart}>
      <Card className="bg-white/5 border-white/10 p-8 text-center"><div className="text-6xl mb-3">💀</div><h2 className="text-3xl font-bold mb-2">Game Over</h2><p className="text-white/70 mb-6">Score: <strong className="text-emerald-400">{score}</strong> · Nível: <strong>{level}</strong> · Acertos: <strong>{solved}</strong></p><Button onClick={restart} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5"><RotateCcw className="w-5 h-5 mr-2" /> Jogar de novo</Button></Card>
    </GameShell>
  );

  if (levelComplete) return (
    <GameShell game={game} level={level} score={score} streak={streak} onExit={onExit}>
      <Card className="bg-gradient-to-br from-emerald-900/40 to-teal-900/30 border-emerald-500/40 p-8 text-center"><div className="text-6xl mb-3">🎉</div><h2 className="text-3xl font-bold mb-2 text-emerald-300">Nível {level} Completo!</h2><p className="text-white/70 mb-6">+50 bônus · {solved} acertos · Score: {score}</p>{level < 20 ? <Button onClick={nextLevel} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5">Próximo nível →</Button> : <div className="text-2xl font-bold text-amber-300">🏆 Mestre!</div>}</Card>
    </GameShell>
  );

  return (
    <GameShell game={game} level={level} score={score} streak={streak} onExit={onExit} onRestart={restart}>
      {!audioReady ? (
        <Card className="bg-white/5 border-white/10 p-8 text-center"><div className="text-5xl mb-3">{game.emoji}</div><h2 className="text-2xl font-bold mb-2">Clique pra começar</h2><p className="text-white/70 text-sm mb-6">{game.shortDescription}</p><Button onClick={handleStart} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5"><Play className="w-5 h-5 mr-2" /> Iniciar</Button></Card>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1">{Array.from({length: lives}).map((_,i)=><Heart key={i} className="w-5 h-5 fill-rose-500 text-rose-500" />)}{Array.from({length: 3-lives}).map((_,i)=><Heart key={i} className="w-5 h-5 text-white/20" />)}</div>
            <div className="text-xs text-white/60">Acertos: <strong className="text-white">{solved}/{numProblems}</strong> · {instrument}</div>
          </div>
          <div className="relative bg-gradient-to-b from-indigo-950/40 via-purple-950/20 to-red-950/30 border border-indigo-500/30 rounded-xl overflow-hidden mb-4" style={{height: "300px"}}>
            {drops.map(drop => (
              <div key={drop.id} className={`absolute rounded-full flex items-center justify-center text-xl transition-all duration-75 ${feedback[drop.id]==="correct"?"bg-emerald-500":feedback[drop.id]==="wrong"?"bg-red-500":"bg-indigo-500"}`} style={{left: `${15+(drop.id%5)*18}%`, top: `${drop.y*2.5}px`, width: "44px", height: "44px", boxShadow: `0 0 16px ${feedback[drop.id]==="correct"?"#10b981":feedback[drop.id]==="wrong"?"#ef4444":"#6366f1"}`}}>💧</div>
            ))}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500/40" />
          </div>
          <div className="grid gap-2 mb-4" style={{gridTemplateColumns: `repeat(${answers.length}, 1fr)`}}>
            {answers.map(a => <Button key={a} onClick={()=>answer(a)} variant="outline" className="py-5 border-indigo-400/40 hover:bg-indigo-600/30 text-sm font-bold">{a}</Button>)}
          </div>
          <Card className="bg-white/5 border-white/10 p-3 text-xs text-white/60">Mecânica real do Theta · {maxDrops} drop(s) simultâneo(s) · Instrumento: {instrument}</Card>
        </>
      )}
    </GameShell>
  );
}

// ═══ CONFIGURAÇÕES POR JOGO ═══

/** ToneDrops — identifica scale degree */
export const toneDropsConfig: DropsGameConfig = {
  getAnswers: (lvl) => {
    if (lvl <= 1) return ["1", "2", "3", "8"];
    if (lvl <= 2) return ["1", "2", "3", "4", "8"];
    if (lvl <= 4) return ["1", "2", "3", "4", "5", "8"];
    if (lvl <= 10) return ["1", "2", "3", "4", "5", "6", "8"];
    return ["1", "2", "3", "4", "5", "6", "7", "8"];
  },
  generateProblem: (_lvl, answers) => {
    const answer = answers[Math.floor(Math.random() * (answers.length - 1))];
    const semitoneMap: Record<string, number> = {"1":0,"2":2,"b3":3,"3":4,"4":5,"b5":6,"5":7,"b6":8,"6":9,"b7":10,"7":11,"8":12};
    const semitone = semitoneMap[answer] ?? 0;
    const baseMidi = 60 + semitone;
    return { freqs: [midiToFreq(baseMidi)], answer };
  },
  getSpeed: (lvl) => lvl >= 11 ? 1.0 : 0.5,
  getMaxDrops: (lvl) => lvl >= 11 ? 2 : 1,
  getInstrument: (lvl) => (["guitar","piano","marimba","synth","piano"] as InstrumentType[])[(lvl - 1) % 5],
  getNumProblems: (lvl) => lvl >= 11 ? 20 : Math.min(20, 12 + lvl),
};

/** ChordDrops — identifica tipo de acorde */
export const chordDropsConfig: DropsGameConfig = {
  getAnswers: (lvl) => {
    if (lvl <= 3) return ["Maior", "Menor"];
    if (lvl <= 7) return ["Maior", "Menor", "Dim", "Aug"];
    return ["Maior", "Menor", "Dim", "Aug", "sus4", "7", "maj7", "m7"];
  },
  generateProblem: (_lvl, answers) => {
    const answer = answers[Math.floor(Math.random() * answers.length)];
    const typeMap: Record<string, ChordType> = {"Maior":"major","Menor":"minor","Dim":"diminished","Aug":"augmented","sus4":"sus4","7":"dominant7","maj7":"major7","m7":"minor7"};
    const root = 60 + Math.floor(Math.random() * 12);
    const chord = generateChord(root, typeMap[answer] ?? "major");
    return { freqs: chord.map(midiToFreq), answer };
  },
  getSpeed: (lvl) => lvl >= 11 ? 0.9 : 0.45,
  getMaxDrops: (lvl) => lvl >= 11 ? 2 : 1,
  getInstrument: (_lvl) => "piano" as InstrumentType,
  getNumProblems: (lvl) => Math.min(20, 10 + lvl),
};

/** MelodicDrops — identifica intervalo melódico */
export const melodicDropsConfig: DropsGameConfig = {
  getAnswers: (lvl) => {
    const base = ["m2", "M2", "m3", "M3"];
    if (lvl <= 3) return base;
    if (lvl <= 7) return [...base, "P4", "P5"];
    return [...base, "P4", "trítono", "P5", "m6", "M6", "m7", "M7", "P8"];
  },
  generateProblem: (_lvl, answers) => {
    const answer = answers[Math.floor(Math.random() * answers.length)];
    const intervalMap: Record<string, number> = {"m2":1,"M2":2,"m3":3,"M3":4,"P4":5,"trítono":6,"P5":7,"m6":8,"M6":9,"m7":10,"M7":11,"P8":12};
    const root = 60 + Math.floor(Math.random() * 12);
    const interval = intervalMap[answer] ?? 2;
    // Melódico: toca notas em sequência
    const second = root + interval;
    return { freqs: [midiToFreq(root), midiToFreq(second)], answer };
  },
  getSpeed: (lvl) => lvl >= 11 ? 0.8 : 0.4,
  getMaxDrops: (lvl) => 1,
  getInstrument: (_lvl) => "piano" as InstrumentType,
  getNumProblems: (lvl) => Math.min(20, 10 + lvl),
};
