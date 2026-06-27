"use client";

/**
 * DangoBrothers — Jogo 4: distinguir 2 tons muito próximos (tuning)
 *
 * Inspirado no Dango Brothers do Theta Music.
 * Você ouve 2 tons e precisa dizer se o segundo está mais alto, mais baixo ou igual.
 * Começa com diferenças grandes, vai apertando até diferenças de poucos cents.
 * Não usa microfone — só ear training.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Play, RotateCcw, ArrowUp, ArrowDown, Equal } from "lucide-react";
import { playTone } from "@/lib/audio/pitchDetector";
import { useProgress } from "@/hooks/useProgress";

interface Props { onExit: () => void; }

interface Round {
  freq1: number;
  freq2: number;
  answer: "higher" | "lower" | "same";
}

const BASE_FREQ = 220; // A3

function generateRound(level: number): Round {
  // Diff em cents: começa com 200 (2 semitons), diminui até 3 cents
  const maxDiff = Math.max(3, 200 - (level - 1) * 10);
  const diff = Math.floor(Math.random() * maxDiff) + 3;
  const direction = Math.random();
  let freq2: number;
  let answer: Round["answer"];
  if (direction < 0.4) { freq2 = BASE_FREQ * Math.pow(2, diff / 1200); answer = "higher"; }
  else if (direction < 0.8) { freq2 = BASE_FREQ * Math.pow(2, -diff / 1200); answer = "lower"; }
  else { freq2 = BASE_FREQ; answer = "same"; }
  return { freq1: BASE_FREQ, freq2, answer };
}

export function DangoBrothers({ onExit }: Props) {
  const [level, setLevel] = useState(1);
  const [round, setRound] = useState<Round | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [selected, setSelected] = useState<"higher" | "lower" | "same" | null>(null);
  const { recordPlay, unlockAchievement } = useProgress();

  useEffect(() => { setRound(generateRound(level)); }, [level]);

  const playTones = useCallback(() => {
    if (!round) return;
    playTone(round.freq1, 800);
    setTimeout(() => playTone(round.freq2, 800), 1000);
  }, [round]);

  useEffect(() => {
    if (round) setTimeout(playTones, 300);
  }, [round, playTones]);

  const answer = useCallback((choice: "higher" | "lower" | "same") => {
    if (selected || !round) return;
    setSelected(choice);
    const correct = choice === round.answer;
    if (correct) {
      setFeedback("correct");
      setScore((s) => s + 100 + level * 5);
      setStreak((s) => s + 1);
      unlockAchievement("first_play");
      recordPlay("dango-brothers", level, score + 100 + level * 5);
      setTimeout(() => {
        setFeedback("idle");
        setSelected(null);
        setLevel((l) => Math.min(20, l + 1));
      }, 1200);
    } else {
      setFeedback("wrong");
      setStreak(0);
      setTimeout(() => {
        setFeedback("idle");
        setSelected(null);
        setRound(generateRound(level));
      }, 1500);
    }
  }, [selected, round, level, score, recordPlay, unlockAchievement]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a14] via-[#14142a] to-[#0a0a14] text-white flex flex-col">
      <header className="border-b border-white/10 backdrop-blur sticky top-0 z-20 bg-[#0a0a14]/80">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onExit} className="p-1"><ChevronLeft className="w-4 h-4" /></Button>
            <div>
              <h1 className="text-lg font-bold">🍡 Dango Brothers</h1>
              <p className="text-[11px] text-white/60 -mt-0.5">Detecte a diferença fina entre 2 tons</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card className="bg-white/5 border-white/10 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-white/50">Nível</div><div className="text-2xl font-bold tabular-nums">{level}/20</div></Card>
          <Card className="bg-white/5 border-white/10 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-white/50">Score</div><div className="text-2xl font-bold tabular-nums">{score}</div></Card>
          <Card className="bg-white/5 border-white/10 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-white/50">Streak</div><div className="text-2xl font-bold text-emerald-400 tabular-nums">{streak}</div></Card>
        </div>

        <Card className="bg-gradient-to-br from-orange-950/30 to-red-950/20 border-orange-500/30 p-8 mb-4 text-center">
          <div className="text-6xl mb-4">🍡 🍡</div>
          <div className="text-sm text-white/70 mb-4">Ouça os dois tons e diga: o segundo está mais alto, mais baixo ou igual ao primeiro?</div>
          <Button onClick={playTones} variant="outline" className="border-white/20 mb-2"><Play className="w-4 h-4 mr-1" /> Ouvir de novo</Button>
          <div className="text-[11px] text-white/50">Nível {level}: diferença mínima de {Math.max(3, 200 - (level - 1) * 10)} cents</div>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Button
            onClick={() => answer("lower")}
            disabled={selected !== null}
            variant={selected === "lower" ? (feedback === "correct" ? "default" : "destructive") : "outline"}
            className={`py-8 ${selected === "lower" && feedback === "correct" ? "bg-emerald-600" : "border-white/20"}`}
          >
            <ArrowDown className="w-6 h-6 mx-auto mb-1" />
            <div className="text-sm">Mais baixo</div>
          </Button>
          <Button
            onClick={() => answer("same")}
            disabled={selected !== null}
            variant={selected === "same" ? (feedback === "correct" ? "default" : "destructive") : "outline"}
            className={`py-8 ${selected === "same" && feedback === "correct" ? "bg-emerald-600" : "border-white/20"}`}
          >
            <Equal className="w-6 h-6 mx-auto mb-1" />
            <div className="text-sm">Igual</div>
          </Button>
          <Button
            onClick={() => answer("higher")}
            disabled={selected !== null}
            variant={selected === "higher" ? (feedback === "correct" ? "default" : "destructive") : "outline"}
            className={`py-8 ${selected === "higher" && feedback === "correct" ? "bg-emerald-600" : "border-white/20"}`}
          >
            <ArrowUp className="w-6 h-6 mx-auto mb-1" />
            <div className="text-sm">Mais alto</div>
          </Button>
        </div>

        {feedback !== "idle" && (
          <div className="fixed top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-50">
            <div className={`text-6xl font-black ${feedback === "correct" ? "text-emerald-400" : "text-red-400"}`} style={{ textShadow: "0 0 20px currentColor" }}>
              {feedback === "correct" ? "✓ CORRETO!" : "✗ ERRADO"}
            </div>
            {feedback === "wrong" && round && (
              <div className="text-center text-white/70 mt-2">Resposta: {round.answer === "higher" ? "Mais alto" : round.answer === "lower" ? "Mais baixo" : "Igual"}</div>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => { setLevel(1); setScore(0); setStreak(0); }} className="border-white/20"><RotateCcw className="w-4 h-4 mr-1" /> Recomeçar</Button>
        </div>

        <Card className="bg-white/5 border-white/10 p-3 mt-4 text-xs text-white/60">
          <div className="font-semibold text-white/80 mb-1">💡 Sobre o jogo</div>
          Dango Brothers afia seu ouvido pra micro-diferenças de pitch (cents). Quanto maior o nível, menor a diferença. Músicos que tocam instrumentos de corda precisam dessa habilidade pra afinar "on the fly" durante apresentações.
        </Card>
      </main>
    </div>
  );
}
