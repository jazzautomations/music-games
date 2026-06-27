"use client";

/**
 * VocalMatch — Jogo 1: canta a nota alvo com precisão
 *
 * Inspirado no Vocal Match do Theta Music Trainer.
 * Progressão: nota isolada → 2 notas → 3 notas → intervalo → acorde.
 * 20 níveis no total.
 *
 * Detecta pitch via YIN e mostra desvio em cents em tempo real.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Play, ChevronLeft, RotateCcw, Trophy } from "lucide-react";
import { MicManager, playTone, playMelody, type PitchDetection, freqToMidi } from "@/lib/audio/pitchDetector";
import { midiToFreq, generateScale, PRACTICE_KEYS } from "@/lib/audio/musicTheory";
import { useMicPermission } from "@/hooks/useMicPermission";
import { useProgress } from "@/hooks/useProgress";
import { PitchVisualizer } from "./PitchVisualizer";

interface VocalMatchProps {
  onExit: () => void;
  micManager: MicManager | null;
  micActive: boolean;
  micError: string | null;
  startMic: () => Promise<void>;
  stopMic: () => void;
}

interface Level {
  level: number;
  numNotes: number;
  description: string;
}

const LEVELS: Level[] = [
  { level: 1, numNotes: 1, description: "Nota isolada — cante a nota que ouvir" },
  { level: 2, numNotes: 1, description: "Nota isolada — casa mais alta" },
  { level: 3, numNotes: 1, description: "Nota isolada — casas altas" },
  { level: 4, numNotes: 2, description: "Duas notas — cante a sequência" },
  { level: 5, numNotes: 2, description: "Duas notas — maior intervalo" },
  { level: 6, numNotes: 3, description: "Três notas — frase curta" },
  { level: 7, numNotes: 3, description: "Três notas — intervalos maiores" },
  { level: 8, numNotes: 4, description: "Quatro notas" },
  { level: 9, numNotes: 4, description: "Quatro notas — salto de oitava" },
  { level: 10, numNotes: 5, description: "Cinco notas — frase completa" },
  { level: 11, numNotes: 3, description: "Tríade maior — cante o acorde" },
  { level: 12, numNotes: 3, description: "Tríade menor" },
  { level: 13, numNotes: 4, description: "Acorde de sétima" },
  { level: 14, numNotes: 4, description: "Acorde sus4" },
  { level: 15, numNotes: 5, description: "Pentatônica" },
  { level: 16, numNotes: 5, description: "Blues scale" },
  { level: 17, numNotes: 6, description: "Sequência longa" },
  { level: 18, numNotes: 7, description: "Escala completa" },
  { level: 19, numNotes: 8, description: "Frase complexa" },
  { level: 20, numNotes: 8, description: "Mestre vocal — tudo vale" },
];

export function VocalMatch({ onExit, micManager, micActive, micError, startMic, stopMic }: VocalMatchProps) {
  const [currentLevel, setCurrentLevel] = useState(1);
  const [targetNotes, setTargetNotes] = useState<number[]>([]);
  const [currentNoteIdx, setCurrentNoteIdx] = useState(0);
  const [hits, setHits] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState<"idle" | "perfect" | "good" | "miss">("idle");
  const [isPlaying, setIsPlaying] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [score, setScore] = useState(0);

  const { recordPlay, unlockAchievement } = useProgress();
  const matchWindowRef = useRef<number | null>(null);
  const matchStartRef = useRef<number>(0);
  const lastHitRef = useRef<number>(-1000);

  // Gerar notas pra um nível
  const generateLevelNotes = useCallback((level: number): number[] => {
    const cfg = LEVELS[Math.min(level - 1, LEVELS.length - 1)];
    const root = PRACTICE_KEYS[Math.floor(Math.random() * PRACTICE_KEYS.length)];
    const scale = generateScale(root.midi + 12, "major", 0); // oitava acima (C5+)

    if (level >= 11 && level <= 14) {
      // Acordes
      if (level === 11) return [root.midi + 12, root.midi + 16, root.midi + 19]; // major triad
      if (level === 12) return [root.midi + 12, root.midi + 15, root.midi + 19]; // minor triad
      if (level === 13) return [root.midi + 12, root.midi + 16, root.midi + 19, root.midi + 22]; // maj7
      if (level === 14) return [root.midi + 12, root.midi + 17, root.midi + 19]; // sus4
    }

    if (level === 15) return generateScale(root.midi + 12, "pentatonicMajor", 0).slice(0, 5);
    if (level === 16) return generateScale(root.midi + 12, "blues", 0).slice(0, 6);

    // Default: gera frase aleatória
    const notes: number[] = [scale[0]];
    for (let i = 1; i < cfg.numNotes; i++) {
      const stepOptions = [-2, -1, -1, 0, 1, 1, 2];
      const step = stepOptions[Math.floor(Math.random() * stepOptions.length)];
      const lastIdx = scale.indexOf(notes[i - 1]);
      let nextIdx = lastIdx + step;
      if (nextIdx < 0) nextIdx = 1;
      if (nextIdx >= scale.length) nextIdx = scale.length - 2;
      notes.push(scale[nextIdx]);
    }
    return notes;
  }, []);

  // Inicia um novo nível
  const startLevel = useCallback((level: number) => {
    const notes = generateLevelNotes(level);
    setTargetNotes(notes);
    setCurrentNoteIdx(0);
    setHits(0);
    setAttempts(0);
    setFeedback("idle");
    setIsPlaying(false);
    // Toca a frase
    setTimeout(() => {
      setIsPlaying(true);
      playMelody(notes.map((n) => midiToFreq(n)), 600);
      setTimeout(() => setIsPlaying(false), notes.length * 600 + 200);
    }, 300);
  }, [generateLevelNotes]);

  useEffect(() => {
    startLevel(currentLevel);
  }, [currentLevel, startLevel]);

  // Verifica pitch detectado contra nota alvo
  const handlePitch = useCallback((pitch: PitchDetection) => {
    if (pitch.isSilent || isPlaying) return;
    if (currentNoteIdx >= targetNotes.length) return;

    const target = targetNotes[currentNoteIdx];
    const centsOff = Math.abs((pitch.midi - target) * 100);

    // Threshold pra aceitar (5 cents = perfeito, 15 = bom, mais = miss)
    const now = Date.now();
    if (now - lastHitRef.current < 400) return; // debounce 400ms

    if (centsOff < 5 && pitch.confidence > 0.5) {
      // Perfeito!
      lastHitRef.current = now;
      setFeedback("perfect");
      setHits((h) => h + 1);
      setAttempts((a) => a + 1);
      setStreak((s) => {
        const ns = s + 1;
        setBestStreak((b) => Math.max(b, ns));
        if (ns >= 50) unlockAchievement("perfect_pitch");
        return ns;
      });
      setScore((s) => s + 100 + Math.floor(pitch.confidence * 50));
      setCurrentNoteIdx((i) => i + 1);
      setTimeout(() => setFeedback("idle"), 300);
    } else if (centsOff < 15 && pitch.confidence > 0.4) {
      // Bom
      lastHitRef.current = now;
      setFeedback("good");
      setHits((h) => h + 1);
      setAttempts((a) => a + 1);
      setStreak((s) => s + 1);
      setScore((s) => s + 50);
      setCurrentNoteIdx((i) => i + 1);
      setTimeout(() => setFeedback("idle"), 300);
    }
    // Miss não conta como attempt direto (deixa o jogador tentar)
  }, [targetNotes, currentNoteIdx, isPlaying, unlockAchievement]);

  // Verifica vitória/derrota
  useEffect(() => {
    if (targetNotes.length > 0 && currentNoteIdx >= targetNotes.length) {
      // Venceu o nível!
      if (currentLevel >= 5) unlockAchievement("level_5");
      if (currentLevel >= 10) unlockAchievement("level_10");
      if (currentLevel >= 20) unlockAchievement("level_20");
      unlockAchievement("first_play");
      recordPlay("vocal-match", currentLevel, score);
      setTimeout(() => {
        if (currentLevel < 20) {
          setCurrentLevel((l) => l + 1);
        }
      }, 1500);
    }
  }, [currentNoteIdx, targetNotes.length, currentLevel, score, recordPlay, unlockAchievement]);

  const replayTarget = useCallback(() => {
    if (targetNotes.length === 0) return;
    setIsPlaying(true);
    playMelody(targetNotes.map((n) => midiToFreq(n)), 600);
    setTimeout(() => setIsPlaying(false), targetNotes.length * 600 + 200);
  }, [targetNotes]);

  const targetMidi = currentNoteIdx < targetNotes.length ? targetNotes[currentNoteIdx] : undefined;
  const cfg = LEVELS[currentLevel - 1];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a14] via-[#14142a] to-[#0a0a14] text-white flex flex-col">
      <header className="border-b border-white/10 backdrop-blur sticky top-0 z-20 bg-[#0a0a14]/80">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onExit} className="p-1"><ChevronLeft className="w-4 h-4" /></Button>
            <div>
              <h1 className="text-lg font-bold">🎤 Vocal Match</h1>
              <p className="text-[11px] text-white/60 -mt-0.5">Cante a frase melódica que ouvir</p>
            </div>
          </div>
          <Button
            variant={micActive ? "default" : "outline"}
            size="sm"
            onClick={micActive ? stopMic : startMic}
            className={micActive ? "bg-emerald-600 hover:bg-emerald-700" : "border-white/20"}
          >
            {micActive ? <><Mic className="w-4 h-4 mr-1.5" /> ON</> : <><MicOff className="w-4 h-4 mr-1.5" /> OFF</>}
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        {micError && (
          <Card className="mb-4 border-red-500/50 bg-red-950/40 p-4 text-red-200">
            <p className="text-sm font-semibold">⚠️ {micError}</p>
          </Card>
        )}

        {!micActive ? (
          <Card className="bg-white/5 border-white/10 p-8 text-center">
            <div className="text-5xl mb-3">🎤</div>
            <h2 className="text-2xl font-bold mb-2">Ative o microfone</h2>
            <p className="text-white/70 text-sm mb-6 max-w-md mx-auto">
              Vocal Match treina sua capacidade de cantar frases melódicas com precisão.
              20 níveis: de nota isolada até acordes completos.
            </p>
            <Button onClick={startMic} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5">
              <Mic className="w-5 h-5 mr-2" /> Permitir microfone
            </Button>
          </Card>
        ) : (
          <>
            {/* HUD */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <Card className="bg-white/5 border-white/10 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-white/50">Nível</div>
                <div className="text-2xl font-bold tabular-nums">{currentLevel}<span className="text-xs text-white/50">/20</span></div>
              </Card>
              <Card className="bg-white/5 border-white/10 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-white/50">Score</div>
                <div className="text-2xl font-bold tabular-nums">{score}</div>
              </Card>
              <Card className="bg-white/5 border-white/10 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-white/50">Streak</div>
                <div className="text-2xl font-bold text-emerald-400 tabular-nums">{streak}</div>
              </Card>
              <Card className="bg-white/5 border-white/10 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-white/50">Acertos</div>
                <div className="text-2xl font-bold tabular-nums">{hits}/{targetNotes.length}</div>
              </Card>
            </div>

            {/* Descrição do nível */}
            <Card className="bg-white/5 border-white/10 p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white/60">Nível {currentLevel}</div>
                  <div className="text-base font-semibold">{cfg.description}</div>
                </div>
                <Button variant="outline" size="sm" onClick={replayTarget} disabled={isPlaying} className="border-white/20">
                  <Play className="w-3 h-3 mr-1" /> Ouvir de novo
                </Button>
              </div>
            </Card>

            {/* Progresso da frase */}
            <Card className="bg-white/5 border-white/10 p-4 mb-4">
              <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2">Frase melódica</div>
              <div className="flex gap-2 flex-wrap">
                {targetNotes.map((midi, i) => {
                  const done = i < currentNoteIdx;
                  const current = i === currentNoteIdx;
                  return (
                    <div
                      key={i}
                      className={`px-3 py-2 rounded-lg border text-center min-w-[60px] transition-all ${
                        done ? "bg-emerald-600/30 border-emerald-500/50 text-emerald-300"
                        : current ? "bg-amber-600/30 border-amber-500/50 text-amber-200 animate-pulse"
                        : "bg-white/5 border-white/10 text-white/40"
                      }`}
                    >
                      <div className="font-bold">{midiToNoteName(midi)}</div>
                      {done && <div className="text-[10px]">✓</div>}
                      {current && <div className="text-[10px]">→ cante</div>}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Pitch visualizer */}
            <PitchVisualizer micManager={micManager} targetMidi={targetMidi} onPitchDetected={handlePitch} />

            {/* Feedback flutuante */}
            {feedback !== "idle" && (
              <div className="fixed top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-50">
                <div className={`text-6xl font-black ${feedback === "perfect" ? "text-emerald-400" : "text-amber-400"}`} style={{ textShadow: "0 0 20px currentColor" }}>
                  {feedback === "perfect" ? "PERFEITO!" : "BOM!"}
                </div>
              </div>
            )}

            {/* Controles */}
            <div className="mt-4 flex gap-2">
              <Button variant="outline" onClick={() => startLevel(currentLevel)} className="border-white/20">
                <RotateCcw className="w-4 h-4 mr-1" /> Reiniciar nível
              </Button>
              {currentLevel > 1 && (
                <Button variant="ghost" onClick={() => setCurrentLevel((l) => Math.max(1, l - 1))}>
                  Nível anterior
                </Button>
              )}
            </div>

            {/* Dicas */}
            <Card className="bg-white/5 border-white/10 p-3 mt-4 text-xs text-white/60">
              <div className="font-semibold text-white/80 mb-1">💡 Como funciona</div>
              Ouça a frase alvo → cante cada nota em sequência. Verde = perfeito (±5 cents), amarelo = bom (±15 cents). O YIN detecta seu pitch com precisão sub-cent. Heads recomendado pra evitar eco.
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function midiToNoteName(midi: number): string {
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const noteIdx = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[noteIdx]}${octave}`;
}
