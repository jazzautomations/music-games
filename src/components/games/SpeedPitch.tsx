"use client";

/**
 * SpeedPitch — Jogo 5: comparar 2 tons rápido (cronometrado)
 *
 * Inspirado no Speed Pitch do Theta Music.
 * Igual ao Dango Brothers mas com cronômetro — você tem poucos segundos
 * pra responder. Velocidade aumenta com o nível.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Play, RotateCcw, ArrowUp, ArrowDown, Equal, Clock } from "lucide-react";
import { playTone } from "@/lib/audio/pitchDetector";
import { useProgress } from "@/hooks/useProgress";

interface Props { onExit: () => void; }
interface Round { freq1: number; freq2: number; answer: "higher" | "lower" | "same"; }

const BASE_FREQ = 220;

function generateRound(level: number): Round {
  const maxDiff = Math.max(5, 300 - (level - 1) * 15);
  const diff = Math.floor(Math.random() * maxDiff) + 5;
  const r = Math.random();
  if (r < 0.4) return { freq1: BASE_FREQ, freq2: BASE_FREQ * Math.pow(2, diff / 1200), answer: "higher" };
  if (r < 0.8) return { freq1: BASE_FREQ, freq2: BASE_FREQ * Math.pow(2, -diff / 1200), answer: "lower" };
  return { freq1: BASE_FREQ, freq2: BASE_FREQ, answer: "same" };
}

export function SpeedPitch({ onExit }: Props) {
  const [level, setLevel] = useState(1);
  const [round, setRound] = useState<Round | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong" | "timeout">("idle");
  const [selected, setSelected] = useState<"higher" | "lower" | "same" | null>(null);
  const [timeLeft, setTimeLeft] = useState(3);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { recordPlay, unlockAchievement } = useProgress();

  // Tempo limite: nível 1 = 5s, nível 20 = 1.5s
  const timeLimit = Math.max(1.5, 5 - (level - 1) * 0.2);

  useEffect(() => {
    setRound(generateRound(level));
    setTimeLeft(timeLimit);
    setSelected(null);
    setFeedback("idle");
  }, [level]);

  const playTones = useCallback(() => {
    if (!round) return;
    playTone(round.freq1, 400);
    setTimeout(() => playTone(round.freq2, 400), 500);
  }, [round]);

  useEffect(() => {
    if (round) {
      setTimeout(playTones, 200);
      // Inicia timer
      const start = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - start) / 1000;
        const left = Math.max(0, timeLimit - elapsed);
        setTimeLeft(left);
        if (left <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          setFeedback("timeout");
          setStreak(0);
          setTimeout(() => setLevel((l) => Math.max(1, l - 1 > 0 ? 1 : 1)), 1500); // não desce, só repete
          setTimeout(() => { setFeedback("idle"); setRound(generateRound(level)); setTimeLeft(timeLimit); }, 1500);
        }
      }, 50);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [round, playTones, timeLimit, level]);

  const answer = useCallback((choice: "higher" | "lower" | "same") => {
    if (selected || !round) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelected(choice);
    const correct = choice === round.answer;
    if (correct) {
      setFeedback("correct");
      const timeBonus = Math.floor(timeLeft * 20);
      setScore((s) => s + 100 + timeBonus);
      setStreak((s) => s + 1);
      unlockAchievement("first_play");
      if (level >= 15) unlockAchievement("speed_demon");
      recordPlay("speed-pitch", level, score + 100 + timeBonus);
      setTimeout(() => { setFeedback("idle"); setSelected(null); setLevel((l) => Math.min(20, l + 1)); }, 800);
    } else {
      setFeedback("wrong");
      setStreak(0);
      setTimeout(() => { setFeedback("idle"); setSelected(null); setRound(generateRound(level)); setTimeLeft(timeLimit); }, 1500);
    }
  }, [selected, round, timeLeft, level, score, recordPlay, unlockAchievement, timeLimit]);

  const timePct = (timeLeft / timeLimit) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a14] via-[#14142a] to-[#0a0a14] text-white flex flex-col">
      <header className="border-b border-white/10 backdrop-blur sticky top-0 z-20 bg-[#0a0a14]/80">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onExit} className="p-1"><ChevronLeft className="w-4 h-4" /></Button>
            <div>
              <h1 className="text-lg font-bold">⚡ Speed Pitch</h1>
              <p className="text-[11px] text-white/60 -mt-0.5">Compare 2 tons — rápido!</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        <div className="grid grid-cols-4 gap-3 mb-4">
          <Card className="bg-white/5 border-white/10 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-white/50">Nível</div><div className="text-2xl font-bold tabular-nums">{level}/20</div></Card>
          <Card className="bg-white/5 border-white/10 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-white/50">Score</div><div className="text-2xl font-bold tabular-nums">{score}</div></Card>
          <Card className="bg-white/5 border-white/10 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-white/50">Streak</div><div className="text-2xl font-bold text-emerald-400 tabular-nums">{streak}</div></Card>
          <Card className="bg-white/5 border-white/10 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-white/50">Tempo</div><div className="text-2xl font-bold tabular-nums text-amber-400">{timeLeft.toFixed(1)}s</div></Card>
        </div>

        {/* Timer bar */}
        <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-4 border border-white/10">
          <div
            className="h-full transition-all duration-75"
            style={{
              width: `${timePct}%`,
              background: timePct > 50 ? "linear-gradient(90deg, #10b981, #34d399)" : timePct > 20 ? "linear-gradient(90deg, #f59e0b, #fb923c)" : "linear-gradient(90deg, #ef4444, #dc2626)",
            }}
          />
        </div>

        <Card className="bg-gradient-to-br from-amber-950/30 to-orange-950/20 border-amber-500/30 p-8 mb-4 text-center">
          <Clock className="w-12 h-12 mx-auto mb-3 text-amber-400" />
          <div className="text-sm text-white/70 mb-4">Ouça os 2 tons e decida rápido!</div>
          <Button onClick={playTones} variant="outline" className="border-white/20"><Play className="w-4 h-4 mr-1" /> Ouvir de novo</Button>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Button onClick={() => answer("lower")} disabled={selected !== null} variant={selected === "lower" ? (feedback === "correct" ? "default" : "destructive") : "outline"} className={`py-8 ${selected === "lower" && feedback === "correct" ? "bg-emerald-600" : "border-white/20"}`}>
            <ArrowDown className="w-6 h-6 mx-auto mb-1" /><div className="text-sm">Mais baixo</div>
          </Button>
          <Button onClick={() => answer("same")} disabled={selected !== null} variant={selected === "same" ? (feedback === "correct" ? "default" : "destructive") : "outline"} className={`py-8 ${selected === "same" && feedback === "correct" ? "bg-emerald-600" : "border-white/20"}`}>
            <Equal className="w-6 h-6 mx-auto mb-1" /><div className="text-sm">Igual</div>
          </Button>
          <Button onClick={() => answer("higher")} disabled={selected !== null} variant={selected === "higher" ? (feedback === "correct" ? "default" : "destructive") : "outline"} className={`py-8 ${selected === "higher" && feedback === "correct" ? "bg-emerald-600" : "border-white/20"}`}>
            <ArrowUp className="w-6 h-6 mx-auto mb-1" /><div className="text-sm">Mais alto</div>
          </Button>
        </div>

        {feedback !== "idle" && (
          <div className="fixed top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-50">
            <div className={`text-6xl font-black ${feedback === "correct" ? "text-emerald-400" : "text-red-400"}`} style={{ textShadow: "0 0 20px currentColor" }}>
              {feedback === "correct" ? "✓ CORRETO!" : feedback === "timeout" ? "⏰ TEMPO!" : "✗ ERRADO"}
            </div>
            {feedback === "wrong" && round && <div className="text-center text-white/70 mt-2">Resposta: {round.answer === "higher" ? "Mais alto" : round.answer === "lower" ? "Mais baixo" : "Igual"}</div>}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => { setLevel(1); setScore(0); setStreak(0); }} className="border-white/20"><RotateCcw className="w-4 h-4 mr-1" /> Recomeçar</Button>
        </div>

        <Card className="bg-white/5 border-white/10 p-3 mt-4 text-xs text-white/60">
          <div className="font-semibold text-white/80 mb-1">💡 Sobre o jogo</div>
          Speed Pitch é o Dango Brothers com cronômetro. Resposta rápida + correta = mais pontos. Velocidade aumenta a cada nível — no 20, você tem só 1.5s pra decidir. Treina reação rápida pra tuning em tempo real.
        </Card>
      </main>
    </div>
  );
}
