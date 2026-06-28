"use client";

/**
 * VocalStepsRepeat — Jogo 3: canta uma escada de notas (ascendente ou descendente)
 *
 * Inspirado no Vocal Steps (Repeat) do Theta Music.
 * Pequenas frases melódicas que se movem em steps (notas adjacentes da escala).
 * Bom pra sight-singing iniciante.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, Play, ChevronLeft, RotateCcw } from "lucide-react";
import { MicManager, type PitchDetection } from "@/lib/audio/pitchDetector";
import { playMelodyReal } from "@/lib/audio/soundfontEngine";
import { midiToFreq, generateScale, PRACTICE_KEYS } from "@/lib/audio/musicTheory";
import { useProgress } from "@/hooks/useProgress";
import { PitchVisualizer } from "./PitchVisualizer";

interface Props {
  onExit: () => void;
  micManager: MicManager | null;
  micActive: boolean;
  micError: string | null;
  startMic: () => Promise<void>;
  stopMic: () => void;
}

export function VocalStepsRepeat({ onExit, micManager, micActive, micError, startMic, stopMic }: Props) {
  const [level, setLevel] = useState(1);
  const [phrase, setPhrase] = useState<number[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [feedback, setFeedback] = useState<"idle" | "perfect" | "good">("idle");
  const lastHitRef = useRef(0);
  const { recordPlay, unlockAchievement } = useProgress();

  const numNotes = Math.min(2 + Math.floor((level - 1) / 2), 10);

  const generatePhrase = useCallback((lvl: number): number[] => {
    const key = PRACTICE_KEYS[Math.floor(Math.random() * PRACTICE_KEYS.length)];
    const scale = generateScale(key.midi + 12, "major", 0);
    const n = Math.min(2 + Math.floor((lvl - 1) / 2), 10);
    // Começa num ponto aleatório da escala e move em steps
    const startIdx = Math.floor(Math.random() * (scale.length - n - 1)) + 1;
    const direction = Math.random() > 0.5 ? 1 : -1;
    const notes: number[] = [scale[startIdx]];
    let curIdx = startIdx;
    for (let i = 1; i < n; i++) {
      const step = direction * (Math.random() > 0.7 ? 2 : 1);
      curIdx = Math.max(0, Math.min(scale.length - 1, curIdx + step));
      notes.push(scale[curIdx]);
    }
    return notes;
  }, []);

  useEffect(() => {
    const p = generatePhrase(level);
    setPhrase(p);
    setCurrentIdx(0);
    setIsPlaying(true);
    void playMelodyReal(p.map((n) => midiToFreq(n)), 0.5);
    setTimeout(() => setIsPlaying(false), p.length * 500 + 200);
  }, [level, generatePhrase]);

  const replay = useCallback(() => {
    if (phrase.length === 0) return;
    setIsPlaying(true);
    void playMelodyReal(phrase.map((n) => midiToFreq(n)), 0.5);
    setTimeout(() => setIsPlaying(false), phrase.length * 500 + 200);
  }, [phrase]);

  const handlePitch = useCallback((pitch: PitchDetection) => {
    if (pitch.isSilent || isPlaying || currentIdx >= phrase.length) return;
    const target = phrase[currentIdx];
    const centsOff = Math.abs((pitch.midi - target) * 100);
    const now = Date.now();
    if (now - lastHitRef.current < 400) return;

    if (centsOff < 10 && pitch.confidence > 0.5) {
      lastHitRef.current = now;
      setFeedback("perfect");
      setScore((s) => s + 100);
      setStreak((s) => s + 1);
      setCurrentIdx((i) => i + 1);
      setTimeout(() => setFeedback("idle"), 300);
    } else if (centsOff < 20 && pitch.confidence > 0.4) {
      lastHitRef.current = now;
      setFeedback("good");
      setScore((s) => s + 50);
      setStreak((s) => s + 1);
      setCurrentIdx((i) => i + 1);
      setTimeout(() => setFeedback("idle"), 300);
    }
  }, [phrase, currentIdx, isPlaying]);

  useEffect(() => {
    if (phrase.length > 0 && currentIdx >= phrase.length) {
      unlockAchievement("first_play");
      recordPlay("vocal-steps-repeat", level, score);
      if (level >= 5) unlockAchievement("level_5");
      if (level >= 10) unlockAchievement("level_10");
      setTimeout(() => setLevel((l) => Math.min(20, l + 1)), 1500);
    }
  }, [currentIdx, phrase.length, level, score, recordPlay, unlockAchievement]);

  const targetMidi = currentIdx < phrase.length ? phrase[currentIdx] : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a14] via-[#14142a] to-[#0a0a14] text-white flex flex-col">
      <header className="border-b border-white/10 backdrop-blur sticky top-0 z-20 bg-[#0a0a14]/80">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onExit} className="p-1"><ChevronLeft className="w-4 h-4" /></Button>
            <div>
              <h1 className="text-lg font-bold">🎵 Vocal Steps (Repeat)</h1>
              <p className="text-[11px] text-white/60 -mt-0.5">Cante a escada melódica em passos</p>
            </div>
          </div>
          <Button variant={micActive ? "default" : "outline"} size="sm" onClick={micActive ? stopMic : startMic} className={micActive ? "bg-emerald-600 hover:bg-emerald-700" : "border-white/20"}>
            {micActive ? <><Mic className="w-4 h-4 mr-1.5" /> ON</> : <><MicOff className="w-4 h-4 mr-1.5" /> OFF</>}
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        {micError && <Card className="mb-4 border-red-500/50 bg-red-950/40 p-4 text-red-200"><p className="text-sm">⚠️ {micError}</p></Card>}

        {!micActive ? (
          <Card className="bg-white/5 border-white/10 p-8 text-center">
            <div className="text-5xl mb-3">🎵</div>
            <h2 className="text-2xl font-bold mb-2">Ative o microfone</h2>
            <p className="text-white/70 text-sm mb-6 max-w-md mx-auto">
              Vocal Steps treina sight-singing com frases curtas em movimento de passos.
              Cada nível adiciona uma nota à sequência.
            </p>
            <Button onClick={startMic} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5"><Mic className="w-5 h-5 mr-2" /> Permitir microfone</Button>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <Card className="bg-white/5 border-white/10 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-white/50">Nível</div><div className="text-2xl font-bold tabular-nums">{level}/20</div></Card>
              <Card className="bg-white/5 border-white/10 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-white/50">Notas</div><div className="text-2xl font-bold tabular-nums">{numNotes}</div></Card>
              <Card className="bg-white/5 border-white/10 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-white/50">Score</div><div className="text-2xl font-bold tabular-nums">{score}</div></Card>
              <Card className="bg-white/5 border-white/10 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-white/50">Streak</div><div className="text-2xl font-bold text-emerald-400 tabular-nums">{streak}</div></Card>
            </div>

            <Card className="bg-white/5 border-white/10 p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-wider text-white/50">Sequência ({numNotes} notas)</div>
                <Button variant="outline" size="sm" onClick={replay} disabled={isPlaying} className="border-white/20"><Play className="w-3 h-3 mr-1" /> Ouvir</Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {phrase.map((midi, i) => {
                  const done = i < currentIdx;
                  const current = i === currentIdx;
                  return (
                    <div key={i} className={`px-3 py-2 rounded-lg border text-center min-w-[55px] transition-all ${
                      done ? "bg-emerald-600/30 border-emerald-500/50 text-emerald-300"
                      : current ? "bg-amber-600/30 border-amber-500/50 text-amber-200 animate-pulse"
                      : "bg-white/5 border-white/10 text-white/40"
                    }`}>
                      <div className="font-bold">{midiToNoteName(midi)}</div>
                      {done && <div className="text-[10px]">✓</div>}
                      {current && <div className="text-[10px]">→ cante</div>}
                    </div>
                  );
                })}
              </div>
            </Card>

            <PitchVisualizer micManager={micManager} targetMidi={targetMidi} onPitchDetected={handlePitch} />

            {feedback !== "idle" && (
              <div className="fixed top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-50">
                <div className={`text-6xl font-black ${feedback === "perfect" ? "text-emerald-400" : "text-amber-400"}`} style={{ textShadow: "0 0 20px currentColor" }}>
                  {feedback === "perfect" ? "PERFEITO!" : "BOM!"}
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button variant="outline" onClick={() => setLevel(1)} className="border-white/20"><RotateCcw className="w-4 h-4 mr-1" /> Recomeçar</Button>
              {level > 1 && <Button variant="ghost" onClick={() => setLevel((l) => Math.max(1, l - 1))}>Nível anterior</Button>}
            </div>

            <Card className="bg-white/5 border-white/10 p-3 mt-4 text-xs text-white/60">
              <div className="font-semibold text-white/80 mb-1">💡 Dica</div>
              Sight-singing é a habilidade de ler uma melodia escrita e cantar imediatamente. Começamos com passos curtos (notas adjacentes) pra você internalizar o movimento da escala.
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function midiToNoteName(midi: number): string {
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}
