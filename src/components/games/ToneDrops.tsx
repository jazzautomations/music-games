"use client";

/**
 * ToneDrops — Jogo 6: identificar scale degree do tom que cai
 *
 * Inspirado no Tone Drops do Theta Music.
 * Tons caem do topo da tela como "gotas". Você ouve o tom e clica no
 * scale degree correspondente (1-7) ANTES de a gota tocar o chão.
 * Treina relative pitch.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, RotateCcw, Play } from "lucide-react";
import { playTone } from "@/lib/audio/pitchDetector";
import { midiToFreq, generateScale, PRACTICE_KEYS } from "@/lib/audio/musicTheory";
import { useProgress } from "@/hooks/useProgress";

interface Props { onExit: () => void; }
interface Drop {
  id: number;
  midi: number;
  degreeIdx: number; // 0-6
  y: number; // 0-100 (posição vertical, 0=topo, 100=chão)
  speed: number; // % por frame
}

const DEGREE_LABELS = ["1", "2", "3", "4", "5", "6", "7"];

export function ToneDrops({ onExit }: Props) {
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [feedback, setFeedback] = useState<Record<number, "correct" | "wrong">>({});
  const [keyMidi, setKeyMidi] = useState(60);
  const [scaleNotes, setScaleNotes] = useState<number[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const dropIdRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const { recordPlay, unlockAchievement } = useProgress();

  // Velocidade e intervalo de spawn por nível
  const speed = 0.15 + (level - 1) * 0.02; // % por frame
  const spawnInterval = Math.max(2000, 5000 - (level - 1) * 150); // ms

  useEffect(() => {
    const key = PRACTICE_KEYS[Math.floor(Math.random() * PRACTICE_KEYS.length)];
    setKeyMidi(key.midi);
    setScaleNotes(generateScale(key.midi + 12, "major", 0));
  }, [level]);

  const spawnDrop = useCallback(() => {
    if (drops.length >= 3) return; // max 3 gotas simultâneas
    const degreeIdx = Math.floor(Math.random() * 7);
    const midi = scaleNotes[degreeIdx];
    const id = dropIdRef.current++;
    setDrops((d) => [...d, { id, midi, degreeIdx, y: 0, speed }]);
    // Toca o tom
    playTone(midiToFreq(midi), 600);
  }, [drops.length, scaleNotes, speed]);

  // Game loop
  useEffect(() => {
    if (gameOver || paused) return;
    const tick = () => {
      const now = Date.now();
      if (now - lastSpawnRef.current > spawnInterval) {
        lastSpawnRef.current = now;
        spawnDrop();
      }
      // Move drops
      setDrops((ds) => {
        const updated = ds.map((d) => ({ ...d, y: d.y + d.speed }));
        // Verifica gotas que chegaram no chão sem ser clicadas
        const lost = updated.filter((d) => d.y >= 100);
        if (lost.length > 0) {
          setLives((l) => {
            const nl = l - lost.length;
            if (nl <= 0) {
              setGameOver(true);
              unlockAchievement("first_play");
              recordPlay("tone-drops", level, score);
            }
            return Math.max(0, nl);
          });
          setStreak(0);
        }
        return updated.filter((d) => d.y < 100);
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [gameOver, paused, spawnDrop, spawnInterval, level, score, recordPlay, unlockAchievement]);

  const answer = useCallback((degreeIdx: number) => {
    // Acha a gota mais próxima do chão (mais baixa) que ainda não foi respondida
    const sortedDrops = [...drops].sort((a, b) => b.y - a.y);
    const target = sortedDrops[0];
    if (!target) return;

    const correct = degreeIdx === target.degreeIdx;
    setFeedback((f) => ({ ...f, [target.id]: correct ? "correct" : "wrong" }));

    if (correct) {
      setScore((s) => s + 100 + Math.floor((100 - target.y) * 2));
      setStreak((s) => s + 1);
      unlockAchievement("first_play");
      // Remove a gota
      setTimeout(() => {
        setDrops((ds) => ds.filter((d) => d.id !== target.id));
        setFeedback((f) => { const nf = { ...f }; delete nf[target.id]; return nf; });
      }, 300);
      // Sobe nível a cada 5 acertos
      if (streak > 0 && streak % 5 === 0) {
        setLevel((l) => Math.min(20, l + 1));
      }
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
  }, [drops, streak, level, score, recordPlay, unlockAchievement]);

  const restart = useCallback(() => {
    setLevel(1); setScore(0); setStreak(0); setLives(3);
    setDrops([]); setGameOver(false); setPaused(false);
    dropIdRef.current = 0;
    lastSpawnRef.current = 0;
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a14] via-[#14142a] to-[#0a0a14] text-white flex flex-col">
      <header className="border-b border-white/10 backdrop-blur sticky top-0 z-20 bg-[#0a0a14]/80">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onExit} className="p-1"><ChevronLeft className="w-4 h-4" /></Button>
            <div>
              <h1 className="text-lg font-bold">💧 Tone Drops</h1>
              <p className="text-[11px] text-white/60 -mt-0.5">Identifique o scale degree da gota</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        <div className="grid grid-cols-4 gap-3 mb-4">
          <Card className="bg-white/5 border-white/10 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-white/50">Nível</div><div className="text-2xl font-bold tabular-nums">{level}/20</div></Card>
          <Card className="bg-white/5 border-white/10 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-white/50">Score</div><div className="text-2xl font-bold tabular-nums">{score}</div></Card>
          <Card className="bg-white/5 border-white/10 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-white/50">Streak</div><div className="text-2xl font-bold text-emerald-400 tabular-nums">{streak}</div></Card>
          <Card className="bg-white/5 border-white/10 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-white/50">Vidas</div><div className="text-2xl font-bold text-rose-400 tabular-nums">{"❤️".repeat(lives) || "—"}</div></Card>
        </div>

        {!gameOver ? (
          <>
            {/* Área das gotas */}
            <Card className="bg-gradient-to-b from-indigo-950/40 to-purple-950/20 border-indigo-500/30 p-4 mb-4 relative h-80 overflow-hidden">
              <div className="absolute top-2 left-2 text-xs text-white/60">
                Tonalidade: <strong className="text-white">{NOTE_NAME(keyMidi)} Maior</strong>
              </div>
              {drops.map((drop) => (
                <div
                  key={drop.id}
                  className={`absolute w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all duration-75 ${
                    feedback[drop.id] === "correct" ? "bg-emerald-500 text-white"
                    : feedback[drop.id] === "wrong" ? "bg-red-500 text-white"
                    : "bg-indigo-500 text-white"
                  }`}
                  style={{
                    left: `${20 + (drop.id % 5) * 15}%`,
                    top: `${drop.y}%`,
                    boxShadow: `0 0 20px ${feedback[drop.id] === "correct" ? "#10b981" : feedback[drop.id] === "wrong" ? "#ef4444" : "#6366f1"}`,
                  }}
                >
                  💧
                </div>
              ))}
              {/* Linha do chão */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500/40" />
              <div className="absolute bottom-1 left-2 text-[10px] text-red-400">↓ chão (perde vida)</div>
            </Card>

            {/* Botões de scale degree */}
            <div className="grid grid-cols-7 gap-2 mb-4">
              {DEGREE_LABELS.map((label, idx) => (
                <Button
                  key={idx}
                  onClick={() => answer(idx)}
                  variant="outline"
                  className="py-6 border-white/20 hover:bg-indigo-600/30 hover:border-indigo-400"
                >
                  <div className="text-2xl font-bold">{label}</div>
                </Button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPaused((p) => !p)} className="border-white/20">{paused ? "▶ Continuar" : "⏸ Pausar"}</Button>
              <Button variant="outline" onClick={restart} className="border-white/20"><RotateCcw className="w-4 h-4 mr-1" /> Recomeçar</Button>
            </div>

            <Card className="bg-white/5 border-white/10 p-3 mt-4 text-xs text-white/60">
              <div className="font-semibold text-white/80 mb-1">💡 Como jogar</div>
              Cada gota toca um tom da escala. Ouça e clique no número do scale degree correspondente (1=Tônica, 5=Dominante, etc). Gotas que chegam ao chão = perde vida. Quanto mais cedo clicar, mais pontos.
            </Card>
          </>
        ) : (
          <Card className="bg-white/5 border-white/10 p-8 text-center">
            <div className="text-6xl mb-3">💀</div>
            <h2 className="text-3xl font-bold mb-2">Game Over</h2>
            <p className="text-white/70 mb-6">Pontuação: <strong className="text-emerald-400">{score}</strong> · Nível: <strong>{level}</strong></p>
            <Button onClick={restart} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5"><RotateCcw className="w-5 h-5 mr-2" /> Jogar de novo</Button>
          </Card>
        )}
      </main>
    </div>
  );
}

function NOTE_NAME(midi: number): string {
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}
