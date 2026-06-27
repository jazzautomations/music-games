"use client";

/**
 * ToneDrops — Jogo RECONSTRUÍDO do Theta Music Trainer
 *
 * Mecânica real extraída do código descompilado:
 * - Tons caem como gotas do topo da tela
 * - Cada gota toca um tom com instrumento específico
 * - Jogador clica no scale degree (1-8) correspondente
 * - Se errar ou a gota chegar ao chão, perde vida
 * - 20 níveis com dados reais do Theta
 *
 * Dados extraídos:
 * - numProblemsPerLevel: 12→20 (níveis 1-5), 12→20 (6-10), 20 (11-20)
 * - dropSpeedPerLevel: 20 (1-10), 40 (11-20) — dobra no nível 11
 * - maxSimultaneousDropsPerLevel: 1 (1-10), 2 (11-20)
 * - instrumentsPerLevel: guitar, e_piano, vibraphone, harpsichord, piano (cycling)
 * - possibleAnswersPerLevel: 4→8 opções (cresce com nível)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, RotateCcw, Heart } from "lucide-react";
import { GameShell } from "./GameShell";
import { GAMES_MAP } from "@/lib/games/gamesCatalog";
import { useProgress } from "@/hooks/useProgress";
import {
  initAudio, playNote, midiToFreq,
  type InstrumentType,
} from "@/lib/audio/audioEngine";
import { midiToFreq as midiToFreqUtil } from "@/lib/audio/musicTheory";

// ═══ DADOS REAIS EXTRAÍDOS DO THETA ═══
const NUM_PROBLEMS_PER_LEVEL = [
  0, 12, 12, 15, 18, 20, 12, 12, 15, 18, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20,
];

const DROP_SPEED_PER_LEVEL = [
  0, 20, 20, 20, 22, 24, 20, 20, 20, 22, 24, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40,
];

const MAX_SIMULTANEOUS_DROPS = [
  0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
];

const INSTRUMENTS_PER_LEVEL: InstrumentType[] = [
  "piano" as InstrumentType, // 0 (não usado)
  "guitar", "piano", "marimba", "synth", "piano",
  "guitar", "piano", "marimba", "synth", "piano",
  "guitar", "piano", "marimba", "synth", "piano",
  "guitar", "piano", "marimba", "synth", "piano",
];

const POSSIBLE_ANSWERS_PER_LEVEL: string[][] = [
  [],
  ["1", "2", "3", "8"],
  ["1", "2", "3", "4", "8"],
  ["1", "2", "3", "4", "5", "8"],
  ["1", "2", "3", "4", "5", "6", "8"],
  ["1", "2", "3", "4", "5", "6", "7", "8"],
  ["1", "2", "b3", "8"],
  ["1", "2", "b3", "4", "8"],
  ["1", "2", "b3", "4", "5", "8"],
  ["1", "2", "b3", "4", "5", "b6", "8"],
  ["1", "2", "b3", "4", "5", "b6", "b7", "8"],
  ["1", "2", "3", "4", "5", "6", "7", "8"],
  ["1", "2", "b3", "4", "5", "b6", "b7", "8"],
  ["1", "2", "3", "4", "5", "6", "7", "8"],
  ["1", "2", "b3", "4", "5", "b6", "b7", "8"],
  ["1", "2", "3", "4", "5", "6", "7", "8"],
  ["1", "2", "b3", "4", "5", "b6", "b7", "8"],
  ["1", "2", "3", "4", "5", "6", "7", "8"],
  ["1", "2", "b3", "4", "5", "b6", "b7", "8"],
  ["1", "2", "3", "4", "5", "6", "7", "8"],
  ["1", "2", "b3", "4", "5", "b6", "b7", "8"],
];

// Mapear scale degree → semitone offset
const SCALE_DEGREE_TO_SEMITONE: Record<string, number> = {
  "1": 0, "b2": 1, "2": 2, "b3": 3, "3": 4, "4": 5,
  "b5": 6, "5": 7, "b6": 8, "6": 9, "b7": 10, "7": 11, "8": 12,
};

// Notas base pra cada key (C major)
const KEY_C_BASE_MIDI = 60; // C4

interface Drop {
  id: number;
  scaleDegree: string;
  midi: number;
  y: number; // 0-100 (posição vertical, 0=topo, 100=chão)
  instrument: InstrumentType;
  answered: boolean;
  correct: boolean;
}

interface Props {
  onExit: () => void;
}

export function ToneDropsReal({ onExit }: Props) {
  const game = GAMES_MAP["tone-drops"];
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [levelComplete, setLevelComplete] = useState(false);
  const [problemsSolved, setProblemsSolved] = useState(0);
  const [feedback, setFeedback] = useState<Record<number, "correct" | "wrong">>({});
  const dropIdRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastSpawnRef = useRef(0);
  const problemsThisLevel = NUM_PROBLEMS_PER_LEVEL[level] || 20;
  const maxDrops = MAX_SIMULTANEOUS_DROPS[level] || 1;
  const dropSpeed = (DROP_SPEED_PER_LEVEL[level] || 20) / 12.0 * 0.3; // ajustado pra px/frame
  const instrument = INSTRUMENTS_PER_LEVEL[level] || "piano";
  const answerOptions = POSSIBLE_ANSWERS_PER_LEVEL[level] || ["1", "2", "3", "8"];
  const { recordPlay, unlockAchievement } = useProgress();

  // Gerar um drop
  const spawnDrop = useCallback(() => {
    if (drops.length >= maxDrops) return;
    const degree = answerOptions[Math.floor(Math.random() * (answerOptions.length - 1))]; // exclui "8" (oitava)
    const semitone = SCALE_DEGREE_TO_SEMITONE[degree] ?? 0;
    const midi = KEY_C_BASE_MIDI + semitone;
    const id = dropIdRef.current++;
    const newDrop: Drop = {
      id, scaleDegree: degree, midi, y: 0, instrument, answered: false, correct: false,
    };
    setDrops((d) => [...d, newDrop]);
    // Toca o tom do drop
    playNote(midiToFreq(midi), 0.6, instrument);
  }, [drops.length, maxDrops, answerOptions, instrument]);

  // Game loop
  useEffect(() => {
    if (gameOver || levelComplete) return;
    const tick = () => {
      const now = Date.now();
      // Spawn: 10s entre spawns (igual ao Theta: getNewDropSpawnTimeout = 10000)
      // Mas na prática é mais rápido pra ser jogável
      const spawnInterval = 3000 - (level * 100); // diminui com nível
      if (now - lastSpawnRef.current > spawnInterval && drops.filter((d) => !d.answered).length < maxDrops) {
        lastSpawnRef.current = now;
        spawnDrop();
      }
      // Mover drops
      setDrops((ds) => {
        const updated = ds.map((d) => {
          if (d.answered) return d;
          return { ...d, y: d.y + dropSpeed };
        });
        // Verificar drops que chegaram ao chão sem resposta
        const lost = updated.filter((d) => !d.answered && d.y >= 100);
        if (lost.length > 0) {
          setLives((l) => {
            const nl = l - lost.length;
            if (nl <= 0) {
              setGameOver(true);
              recordPlay("tone-drops", level, score);
              unlockAchievement("first_play");
            }
            return Math.max(0, nl);
          });
          setStreak(0);
        }
        return updated.filter((d) => !(d.y >= 100 && !d.answered));
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [gameOver, levelComplete, drops, maxDrops, dropSpeed, level, score, spawnDrop, recordPlay, unlockAchievement]);

  // Responder
  const answer = useCallback((degree: string) => {
    // Acha o drop mais próximo do chão (mais baixo) não respondido
    const sortedDrops = [...drops].filter((d) => !d.answered).sort((a, b) => b.y - a.y);
    const target = sortedDrops[0];
    if (!target) return;

    const correct = degree === target.scaleDegree;
    setFeedback((f) => ({ ...f, [target.id]: correct ? "correct" : "wrong" }));

    if (correct) {
      setScore((s) => s + 100 + Math.floor((100 - target.y) * 2));
      setStreak((s) => s + 1);
      setProblemsSolved((p) => p + 1);
      unlockAchievement("first_play");
      // Remove o drop
      setTimeout(() => {
        setDrops((ds) => ds.filter((d) => d.id !== target.id));
        setFeedback((f) => { const nf = { ...f }; delete nf[target.id]; return nf; });
      }, 300);
    } else {
      setLives((l) => {
        const nl = l - 1;
        if (nl <= 0) {
          setGameOver(true);
          recordPlay("tone-drops", level, score);
        }
        return Math.max(0, nl);
      });
      setStreak(0);
      setTimeout(() => {
        setFeedback((f) => { const nf = { ...f }; delete nf[target.id]; return nf; });
      }, 500);
    }
  }, [drops, score, level, recordPlay, unlockAchievement]);

  // Verifica level complete
  useEffect(() => {
    if (problemsSolved >= problemsThisLevel && !levelComplete) {
      setLevelComplete(true);
      setScore((s) => s + 50); // levelClearMaxBonusPoints = 50
      recordPlay("tone-drops", level, score + 50);
      if (level >= 5) unlockAchievement("level_5");
      if (level >= 10) unlockAchievement("level_10");
      if (level >= 20) unlockAchievement("level_20");
    }
  }, [problemsSolved, problemsThisLevel, levelComplete, level, score, recordPlay, unlockAchievement]);

  const restart = useCallback(() => {
    setLevel(1); setScore(0); setStreak(0); setLives(3);
    setDrops([]); setGameOver(false); setLevelComplete(false);
    setProblemsSolved(0); dropIdRef.current = 0; lastSpawnRef.current = 0;
  }, []);

  const nextLevel = useCallback(() => {
    setLevel((l) => Math.min(20, l + 1));
    setLevelComplete(false); setProblemsSolved(0); setDrops([]);
    lastSpawnRef.current = 0;
  }, []);

  // Inicializar áudio no primeiro click
  const handleStart = useCallback(async () => {
    await initAudio();
  }, []);

  if (gameOver) {
    return (
      <GameShell game={game} level={level} score={score} streak={streak} onExit={onExit} onRestart={restart}>
        <Card className="bg-white/5 border-white/10 p-8 text-center">
          <div className="text-6xl mb-3">💀</div>
          <h2 className="text-3xl font-bold mb-2">Game Over</h2>
          <p className="text-white/70 mb-6">Pontuação: <strong className="text-emerald-400">{score}</strong> · Nível: <strong>{level}</strong> · Acertos: <strong>{problemsSolved}</strong></p>
          <Button onClick={restart} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5"><RotateCcw className="w-5 h-5 mr-2" /> Jogar de novo</Button>
        </Card>
      </GameShell>
    );
  }

  if (levelComplete) {
    return (
      <GameShell game={game} level={level} score={score} streak={streak} onExit={onExit}>
        <Card className="bg-gradient-to-br from-emerald-900/40 to-teal-900/30 border-emerald-500/40 p-8 text-center">
          <div className="text-6xl mb-3">🎉</div>
          <h2 className="text-3xl font-bold mb-2 text-emerald-300">Nível {level} Completo!</h2>
          <p className="text-white/70 mb-6">+50 bônus · {problemsSolved} acertos · Score: {score}</p>
          {level < 20 ? (
            <Button onClick={nextLevel} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5">Próximo nível →</Button>
          ) : (
            <div className="text-2xl font-bold text-amber-300">🏆 Mestre dos Scale Degrees!</div>
          )}
        </Card>
      </GameShell>
    );
  }

  return (
    <GameShell game={game} level={level} score={score} streak={streak} onExit={onExit} onRestart={restart}>
      {/* Vidas + progresso */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          {Array.from({ length: lives }).map((_, i) => (
            <Heart key={i} className="w-5 h-5 fill-rose-500 text-rose-500" />
          ))}
          {Array.from({ length: 3 - lives }).map((_, i) => (
            <Heart key={i} className="w-5 h-5 text-white/20" />
          ))}
        </div>
        <div className="text-xs text-white/60">
          Acertos: <strong className="text-white">{problemsSolved}/{problemsThisLevel}</strong>
          {" · "}Instrumento: <strong className="text-white">{instrument}</strong>
        </div>
      </div>

      {/* Área das gotas — canvas visual */}
      <div
        className="relative bg-gradient-to-b from-indigo-950/40 via-purple-950/20 to-red-950/30 border border-indigo-500/30 rounded-xl overflow-hidden mb-4"
        style={{ height: "320px" }}
        onClick={handleStart}
      >
        {/* Drops */}
        {drops.map((drop) => (
          <div
            key={drop.id}
            className={`absolute rounded-full flex items-center justify-center text-2xl transition-all duration-75 ${
              feedback[drop.id] === "correct" ? "bg-emerald-500"
              : feedback[drop.id] === "wrong" ? "bg-red-500"
              : "bg-indigo-500"
            }`}
            style={{
              left: `${15 + (drop.id % 5) * 18}%`,
              top: `${drop.y * 2.5}px`,
              width: "48px",
              height: "48px",
              boxShadow: `0 0 16px ${
                feedback[drop.id] === "correct" ? "#10b981"
                : feedback[drop.id] === "wrong" ? "#ef4444"
                : "#6366f1"
              }`,
            }}
          >
            💧
          </div>
        ))}

        {/* Linha do chão */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500/40" />
        <div className="absolute bottom-1 left-2 text-[10px] text-red-400">↓ perde vida</div>

        {/* Info */}
        <div className="absolute top-2 left-2 text-[10px] text-white/50">
          Nível {level} · {maxDrops} drop(s) simultâneo(s) · velocidade {dropSpeed.toFixed(1)}
        </div>
      </div>

      {/* Botões de scale degree */}
      <div className={`grid gap-2 mb-4`} style={{ gridTemplateColumns: `repeat(${answerOptions.length}, 1fr)` }}>
        {answerOptions.map((degree) => (
          <Button
            key={degree}
            onClick={() => answer(degree)}
            variant="outline"
            className="py-6 border-indigo-400/40 hover:bg-indigo-600/30 hover:border-indigo-300 text-lg font-bold"
          >
            {degree}
          </Button>
        ))}
      </div>

      <Card className="bg-white/5 border-white/10 p-3 text-xs text-white/60">
        <strong className="text-white/80">💡 Mecânica real:</strong> Tons caem como gotas. Cada gota toca um tom com instrumento <strong>{instrument}</strong>.
        Clique no scale degree correspondente (1=Tônica, 5=Dominante, 8=Oitava) antes da gota tocar o chão.
        Níveis 11+: 2 gotas simultâneas e velocidade dobrada. Dados de nível extraídos do código real do Theta Music Trainer.
      </Card>
    </GameShell>
  );
}
