"use client";

/**
 * VocalDegreesMajor — Jogo 2: canta um scale degree sobre um acorde de fundo
 *
 * Inspirado no Vocal Degrees (Major) do Theta Music.
 * Ouve acordes de fundo na tonalidade alvo e canta o scale degree solicitado.
 * Ex: "Cante a 5ª (Dominante) de Dó Maior".
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, Play, ChevronLeft, RotateCcw } from "lucide-react";
import { MicManager, type PitchDetection } from "@/lib/audio/pitchDetector";
import { playNoteReal, playChordReal } from "@/lib/audio/soundfontEngine";
import { midiToFreq, generateScale, PRACTICE_KEYS, SCALE_DEGREE_NAMES } from "@/lib/audio/musicTheory";
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

interface Round {
  keyMidi: number;
  keyName: string;
  degreeIdx: number; // 0-6
  degreeName: string;
  targetMidi: number;
}

const DEGREE_OPTIONS = [
  { idx: 0, name: "1 (Tônica)", short: "1" },
  { idx: 1, name: "2 (Supertônica)", short: "2" },
  { idx: 2, name: "3 (Mediante)", short: "3" },
  { idx: 3, name: "4 (Subdominante)", short: "4" },
  { idx: 4, name: "5 (Dominante)", short: "5" },
  { idx: 5, name: "6 (Superdominante)", short: "6" },
  { idx: 6, name: "7 (Sensível)", short: "7" },
];

export function VocalDegreesMajor({ onExit, micManager, micActive, micError, startMic, stopMic }: Props) {
  const [round, setRound] = useState<Round | null>(null);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<"idle" | "perfect" | "good" | "miss">("idle");
  const [showAnswer, setShowAnswer] = useState(false);
  const lastHitRef = useRef(0);
  const { recordPlay, unlockAchievement } = useProgress();

  const generateRound = useCallback((lvl: number): Round => {
    const key = PRACTICE_KEYS[Math.floor(Math.random() * PRACTICE_KEYS.length)];
    // Até nível 5: graus 1-3. Até 10: 1-5. Até 15: 1-6. 20: tudo.
    const maxDegree = Math.min(7, Math.floor((lvl - 1) / 3) + 3);
    const degreeIdx = Math.floor(Math.random() * maxDegree);
    const scale = generateScale(key.midi + 12, "major", 0);
    return {
      keyMidi: key.midi + 12,
      keyName: key.name,
      degreeIdx,
      degreeName: SCALE_DEGREE_NAMES.major[degreeIdx],
      targetMidi: scale[degreeIdx],
    };
  }, []);

  useEffect(() => {
    setRound(generateRound(level));
  }, [level, generateRound]);

  const playRound = useCallback(() => {
    if (!round) return;
    // Toca acorde de tônica (I) por 1.5s, depois toca o acorde do grau alvo
    const tonicChord = generateScale(round.keyMidi, "major", 0).slice(0, 3);
    void playChordReal(tonicChord.map((m) => midiToFreq(m)), 1500);
    // Toca nota alvo depois de 1s
    setTimeout(() => void playNoteReal(midiToFreq(round.targetMidi), 800), 1600);
  }, [round]);

  useEffect(() => {
    if (round) {
      setShowAnswer(false);
      setTimeout(playRound, 300);
    }
  }, [round, playRound]);

  const handlePitch = useCallback((pitch: PitchDetection) => {
    if (pitch.isSilent || !round || showAnswer) return;
    const centsOff = Math.abs((pitch.midi - round.targetMidi) * 100);
    const now = Date.now();
    if (now - lastHitRef.current < 600) return;

    if (centsOff < 10 && pitch.confidence > 0.5) {
      lastHitRef.current = now;
      setFeedback("perfect");
      setScore((s) => s + 100);
      setStreak((s) => s + 1);
      unlockAchievement("first_play");
      recordPlay("vocal-degrees-major", level, score + 100);
      setTimeout(() => {
        setFeedback("idle");
        setShowAnswer(true);
        setTimeout(() => setLevel((l) => Math.min(20, l + 1)), 1500);
      }, 800);
    } else if (centsOff < 25 && pitch.confidence > 0.4) {
      lastHitRef.current = now;
      setFeedback("good");
      setScore((s) => s + 50);
      setTimeout(() => {
        setFeedback("idle");
        setShowAnswer(true);
        setTimeout(() => setLevel((l) => Math.min(20, l + 1)), 1500);
      }, 800);
    } else if (centsOff > 100 && pitch.confidence > 0.4 && now - lastHitRef.current > 1500) {
      // Erro grande após tentar
      lastHitRef.current = now;
      setFeedback("miss");
      setStreak(0);
      setTimeout(() => setFeedback("idle"), 500);
    }
  }, [round, showAnswer, level, score, recordPlay, unlockAchievement]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a14] via-[#14142a] to-[#0a0a14] text-white flex flex-col">
      <header className="border-b border-white/10 backdrop-blur sticky top-0 z-20 bg-[#0a0a14]/80">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onExit} className="p-1"><ChevronLeft className="w-4 h-4" /></Button>
            <div>
              <h1 className="text-lg font-bold">🎼 Vocal Degrees (Major)</h1>
              <p className="text-[11px] text-white/60 -mt-0.5">Cante o scale degree solicitado</p>
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
            <div className="text-5xl mb-3">🎼</div>
            <h2 className="text-2xl font-bold mb-2">Ative o microfone</h2>
            <p className="text-white/70 text-sm mb-6 max-w-md mx-auto">
              Vocal Degrees treina seu conhecimento dos graus da escala. Ouça um acorde de fundo
              e cante o scale degree solicitado (1=Tônica, 5=Dominante, etc).
            </p>
            <Button onClick={startMic} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5"><Mic className="w-5 h-5 mr-2" /> Permitir microfone</Button>
          </Card>
        ) : round && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Card className="bg-white/5 border-white/10 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-white/50">Nível</div><div className="text-2xl font-bold tabular-nums">{level}/20</div></Card>
              <Card className="bg-white/5 border-white/10 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-white/50">Score</div><div className="text-2xl font-bold tabular-nums">{score}</div></Card>
              <Card className="bg-white/5 border-white/10 p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-white/50">Streak</div><div className="text-2xl font-bold text-emerald-400 tabular-nums">{streak}</div></Card>
            </div>

            <Card className="bg-gradient-to-br from-indigo-950/40 to-purple-950/30 border-indigo-500/30 p-6 mb-4 text-center">
              <div className="text-xs uppercase tracking-wider text-white/60 mb-2">Tonalidade</div>
              <div className="text-4xl font-black mb-3">{round.keyName} Maior</div>
              <div className="text-xs uppercase tracking-wider text-white/60 mb-2">Cante o grau</div>
              <div className="text-5xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">{round.degreeName}</div>
              {showAnswer && (
                <div className="mt-3 text-emerald-300 text-lg font-bold">✓ Resposta: {midiToNoteName(round.targetMidi)}</div>
              )}
            </Card>

            <div className="flex gap-2 mb-4">
              <Button variant="outline" onClick={playRound} className="border-white/20"><Play className="w-4 h-4 mr-1" /> Ouvir acorde + nota</Button>
              <Button variant="outline" onClick={() => { setLevel(1); setScore(0); setStreak(0); }} className="border-white/20"><RotateCcw className="w-4 h-4 mr-1" /> Recomeçar</Button>
            </div>

            <PitchVisualizer micManager={micManager} targetMidi={round.targetMidi} onPitchDetected={handlePitch} />

            {feedback !== "idle" && (
              <div className="fixed top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-50">
                <div className={`text-6xl font-black ${feedback === "perfect" ? "text-emerald-400" : feedback === "good" ? "text-amber-400" : "text-red-400"}`} style={{ textShadow: "0 0 20px currentColor" }}>
                  {feedback === "perfect" ? "PERFEITO!" : feedback === "good" ? "BOM!" : "TENTA DE NOVO"}
                </div>
              </div>
            )}

            <Card className="bg-white/5 border-white/10 p-3 mt-4 text-xs text-white/60">
              <div className="font-semibold text-white/80 mb-1">💡 Dica</div>
              Os graus da escala maior: 1 (Tônica), 2 (Supertônica), 3 (Mediante), 4 (Subdominante), 5 (Dominante), 6 (Superdominante), 7 (Sensível). Internalizar esses sons te permite cantar qualquer melodia de ouvido.
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
