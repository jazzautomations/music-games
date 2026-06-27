"use client";

/**
 * MultipleChoiceGame — Componente genérico pra jogos de "ouça X e escolha"
 *
 * Cobre ~30 dos 50 jogos (todos os Flash*, *Drops, *Compare, etc).
 *
 * Como usar:
 *  1. Passa um `generateRound(level)` que retorna { audio: () => void, options: [{label, correct}], description }
 *  2. O componente toca o áudio, mostra as opções, gerencia score/streak/level
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, RotateCcw } from "lucide-react";
import { GameShell } from "./GameShell";
import { type GameDef } from "@/lib/games/gamesCatalog";
import { useProgress } from "@/hooks/useProgress";

export interface MCOption {
  label: string;
  correct: boolean;
  /** Emoji opcional pra mostrar no botão */
  emoji?: string;
}

export interface MCRound {
  /** Função que toca o áudio do round */
  play: () => void;
  /** Opções de resposta */
  options: MCOption[];
  /** Descrição do que está sendo tocado (mostrada no card) */
  prompt: string;
}

interface MultipleChoiceGameProps {
  game: GameDef;
  onExit: () => void;
  /** Gera um round baseado no nível */
  generateRound: (level: number) => MCRound;
  /** Cronometrado? (default: false) */
  timed?: boolean;
  /** Tempo limite em segundos (se timed) */
  timeLimit?: number;
  /** Número de opções (default: 4) */
  numOptions?: number;
}

export function MultipleChoiceGame({
  game, onExit, generateRound, timed = false, timeLimit = 5, numOptions = 4,
}: MultipleChoiceGameProps) {
  const [level, setLevel] = useState(1);
  const [round, setRound] = useState<MCRound | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [selected, setSelected] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { recordPlay, unlockAchievement } = useProgress();

  useEffect(() => {
    const r = generateRound(level);
    setRound(r);
    setSelected(null);
    setFeedback("idle");
    setTimeLeft(timeLimit);
    setTimeout(() => r.play(), 300);
  }, [level, generateRound, timeLimit]);

  // Timer (se cronometrado)
  useEffect(() => {
    if (!timed || !round || selected !== null) return;
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const left = Math.max(0, timeLimit - elapsed);
      setTimeLeft(left);
      if (left <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        handleAnswer(-1); // timeout = errado
      }
    }, 50);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [round, timed, timeLimit, selected]);

  const handleAnswer = useCallback((idx: number) => {
    if (selected !== null || !round) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelected(idx);
    const correct = idx >= 0 && round.options[idx]?.correct;
    if (correct) {
      setFeedback("correct");
      const timeBonus = timed ? Math.floor(timeLeft * 20) : 0;
      setScore((s) => s + 100 + timeBonus + level * 5);
      setStreak((s) => s + 1);
      unlockAchievement("first_play");
      if (level >= 5) unlockAchievement("level_5");
      if (level >= 10) unlockAchievement("level_10");
      if (level >= 20) unlockAchievement("level_20");
      recordPlay(game.id, level, score + 100 + timeBonus);
      setTimeout(() => {
        setFeedback("idle");
        setSelected(null);
        setLevel((l) => Math.min(game.levels, l + 1));
      }, 1000);
    } else {
      setFeedback("wrong");
      setStreak(0);
      setTimeout(() => {
        setFeedback("idle");
        setSelected(null);
        setRound(generateRound(level));
        setTimeLeft(timeLimit);
        setTimeout(() => setRound((r) => { r?.play(); return r; }), 100);
      }, 1500);
    }
  }, [selected, round, timed, timeLeft, level, score, game, recordPlay, unlockAchievement, generateRound, timeLimit]);

  const restart = useCallback(() => {
    setLevel(1); setScore(0); setStreak(0); setSelected(null); setFeedback("idle");
  }, []);

  if (!round) return null;

  return (
    <GameShell game={game} level={level} score={score} streak={streak} onExit={onExit} onRestart={restart}>
      {/* Timer bar (se cronometrado) */}
      {timed && (
        <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-4 border border-white/10">
          <div
            className="h-full transition-all duration-75"
            style={{
              width: `${(timeLeft / timeLimit) * 100}%`,
              background: timeLeft > timeLimit * 0.5 ? "linear-gradient(90deg, #10b981, #34d399)" : timeLeft > timeLimit * 0.2 ? "linear-gradient(90deg, #f59e0b, #fb923c)" : "linear-gradient(90deg, #ef4444, #dc2626)",
            }}
          />
        </div>
      )}

      {/* Prompt */}
      <Card className={`bg-gradient-to-br ${game.accent} bg-opacity-10 border-white/20 p-6 mb-4 text-center`}>
        <div className="text-sm text-white/70 mb-3">{round.prompt}</div>
        <Button onClick={() => round.play()} variant="outline" className="border-white/30 bg-white/10">
          <Play className="w-4 h-4 mr-1" /> Ouvir de novo
        </Button>
      </Card>

      {/* Opções */}
      <div className={`grid gap-3 ${numOptions === 2 ? "grid-cols-2" : numOptions === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
        {round.options.map((opt, i) => {
          const isSelected = selected === i;
          const showCorrect = feedback !== "idle" && opt.correct;
          const showWrong = isSelected && !opt.correct;
          return (
            <Button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={selected !== null}
              variant={showCorrect ? "default" : showWrong ? "destructive" : "outline"}
              className={`py-8 text-base font-bold ${
                showCorrect ? "bg-emerald-600 hover:bg-emerald-600"
                : showWrong ? "bg-red-600 hover:bg-red-600"
                : "border-white/20 hover:bg-white/5"
              }`}
            >
              {opt.emoji && <span className="text-2xl mr-2">{opt.emoji}</span>}
              {opt.label}
            </Button>
          );
        })}
      </div>

      {/* Feedback flutuante */}
      {feedback !== "idle" && (
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-50">
          <div className={`text-6xl font-black ${feedback === "correct" ? "text-emerald-400" : "text-red-400"}`} style={{ textShadow: "0 0 20px currentColor" }}>
            {feedback === "correct" ? "✓ CORRETO!" : "✗ ERRADO"}
          </div>
        </div>
      )}
    </GameShell>
  );
}
