"use client";

/**
 * ChannelScrambleReal — Mixer com sliders (RECONSTRUÍDO do Theta)
 *
 * Mecânica real:
 * - Vários canais de instrumentos com volumes aleatórios
 * - Ajuste os sliders pra match com o som alvo
 * - sliderSpeedPerLevel: 1.0 → 0.5 (velocidade dos bots diminui)
 * - timeAllowedPerSlider: 6s por slider
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, RotateCcw, Play, Check, Clock } from "lucide-react";
import { GameShell } from "./GameShell";
import { GAMES_MAP } from "@/lib/games/gamesCatalog";
import { useProgress } from "@/hooks/useProgress";
import { initAudio, playNote, midiToFreq, type RealInstrument } from "@/lib/audio/soundfontEngine";

const SLIDER_SPEED = [0, 1,1,1,1,1, 0.8,0.8,0.8,0.8,0.8, 0.7,0.7,0.7,0.7,0.6, 0.6,0.6,0.6,0.5,0.5];
const TIME_PER_SLIDER = 6; // segundos

interface Channel {
  name: string;
  emoji: string;
  freq: number;
  instrument: RealInstrument;
  targetVolume: number; // 0-100
  currentVolume: number; // 0-100
}

const CHANNEL_PRESETS: Omit<Channel, "targetVolume" | "currentVolume">[] = [
  { name: "Bateria", emoji: "🥁", freq: 80, instrument: "marimba" },
  { name: "Baixo", emoji: "🎸", freq: 110, instrument: "electric_bass_finger" },
  { name: "Guitarra", emoji: "🎸", freq: 330, instrument: "acoustic_guitar_nylon" },
  { name: "Piano", emoji: "🎹", freq: 440, instrument: "acoustic_grand_piano" },
  { name: "Vocal", emoji: "🎤", freq: 660, instrument: "soprano_sax" },
  { name: "Teclado", emoji: "🎼", freq: 880, instrument: "church_organ" },
];

interface Props { onExit: () => void; }

export function ChannelScrambleReal({ onExit }: Props) {
  const game = GAMES_MAP["channel-scramble"];
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_SLIDER);
  const [gameOver, setGameOver] = useState(false);
  const [levelComplete, setLevelComplete] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [problemNum, setProblemNum] = useState(0);
  const numChannels = Math.min(3 + Math.floor(level / 3), 6);
  const numProblems = 5;
  const { recordPlay, unlockAchievement } = useProgress();

  const handleStart = useCallback(async () => { await initAudio(); setAudioReady(true); }, []);

  const generateProblem = useCallback(() => {
    const selected = [...CHANNEL_PRESETS].sort(() => Math.random() - 0.5).slice(0, numChannels);
    const newChannels = selected.map(c => ({
      ...c,
      targetVolume: 20 + Math.floor(Math.random() * 70),
      currentVolume: 20 + Math.floor(Math.random() * 70),
    }));
    setChannels(newChannels);
    setFeedback("idle");
    setTimeLeft(TIME_PER_SLIDER);
  }, [numChannels]);

  useEffect(() => {
    if (!audioReady) return;
    generateProblem();
  }, [level, audioReady, generateProblem]);

  // Timer
  useEffect(() => {
    if (!audioReady || gameOver || levelComplete || feedback !== "idle") return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 0.1) { clearInterval(timer); checkAnswer(); return 0; }
        return t - 0.1;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [audioReady, gameOver, levelComplete, feedback]);

  const setVolume = (idx: number, vol: number) => {
    setChannels(cs => cs.map((c, i) => i === idx ? { ...c, currentVolume: Math.max(0, Math.min(100, vol)) } : c));
  };

  const playTarget = useCallback(() => {
    channels.forEach(c => {
      const volume = c.targetVolume / 100;
      // Toca cada canal com o volume alvo
      const gain = 0.02 + volume * 0.15;
      playNoteReal(c.freq, 0.8, c.instrument);
    });
  }, [channels]);

  const playCurrent = useCallback(() => {
    channels.forEach(c => {
      const volume = c.currentVolume / 100;
      const gain = 0.02 + volume * 0.15;
      playNoteReal(c.freq, 0.8, c.instrument);
    });
  }, [channels]);

  const checkAnswer = useCallback(() => {
    const tolerance = 15; // ±15% é aceito
    const allCorrect = channels.every(c => Math.abs(c.currentVolume - c.targetVolume) <= tolerance);
    if (allCorrect) {
      setFeedback("correct");
      setScore(s => s + 150 + Math.floor(timeLeft * 10));
      setProblemNum(p => {
        const np = p + 1;
        if (np >= numProblems) {
          setLevelComplete(true);
          setScore(s => s + 50);
          recordPlay("channel-scramble", level, score + 200);
          if (level >= 5) unlockAchievement("level_5");
          if (level >= 10) unlockAchievement("level_10");
        } else {
          setTimeout(() => generateProblem(), 1000);
        }
        return np;
      });
    } else {
      setFeedback("wrong");
      setTimeout(() => { setFeedback("idle"); generateProblem(); }, 1500);
    }
  }, [channels, timeLeft, level, score, numProblems, recordPlay, unlockAchievement, generateProblem]);

  const restart = () => { setLevel(1); setScore(0); setGameOver(false); setLevelComplete(false); setProblemNum(0); };
  const nextLevel = () => { setLevel(l => Math.min(20, l + 1)); setLevelComplete(false); setProblemNum(0); };

  if (gameOver) return (
    <GameShell game={game} level={level} score={score} streak={0} onExit={onExit} onRestart={restart}>
      <Card className="bg-white/5 border-white/10 p-8 text-center"><div className="text-6xl mb-3">💀</div><h2 className="text-3xl font-bold mb-2">Game Over</h2><Button onClick={restart} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5"><RotateCcw className="w-5 h-5 mr-2" /> Jogar de novo</Button></Card>
    </GameShell>
  );
  if (levelComplete) return (
    <GameShell game={game} level={level} score={score} streak={0} onExit={onExit}>
      <Card className="bg-gradient-to-br from-emerald-900/40 to-teal-900/30 border-emerald-500/40 p-8 text-center"><div className="text-6xl mb-3">🎉</div><h2 className="text-3xl font-bold mb-2 text-emerald-300">Nível {level} Completo!</h2><p className="text-white/70 mb-6">Score: {score}</p>{level < 20 ? <Button onClick={nextLevel} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5">Próximo nível →</Button> : <div className="text-2xl font-bold text-amber-300">🏆 Mestre da Mixagem!</div>}</Card>
    </GameShell>
  );

  return (
    <GameShell game={game} level={level} score={score} streak={0} onExit={onExit} onRestart={restart}>
      {!audioReady ? (
        <Card className="bg-white/5 border-white/10 p-8 text-center"><div className="text-5xl mb-3">🎛️</div><h2 className="text-2xl font-bold mb-2">Channel Scramble</h2><p className="text-white/70 text-sm mb-6">Ajuste os volumes dos canais pra match com o som alvo.</p><Button onClick={handleStart} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5">Iniciar</Button></Card>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-white/60">Problema {problemNum + 1}/{numProblems} · {numChannels} canais</div>
            <div className="flex items-center gap-2 text-xs"><Clock className="w-3 h-3 text-amber-400" /><span className="font-bold text-amber-400 tabular-nums">{timeLeft.toFixed(1)}s</span></div>
          </div>

          {/* Mixer */}
          <Card className="bg-gradient-to-b from-cyan-950/30 to-blue-950/20 border-cyan-500/30 p-4 mb-4">
            <div className="text-xs text-white/60 mb-3 text-center">🎚️ Ajuste os sliders até o som ficar igual ao alvo</div>
            <div className="grid gap-3" style={{gridTemplateColumns: `repeat(${numChannels}, 1fr)`}}>
              {channels.map((ch, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="text-2xl mb-1">{ch.emoji}</div>
                  <div className="text-[10px] text-white/50 mb-2">{ch.name}</div>
                  {/* Vertical slider */}
                  <div className="relative h-32 w-8 bg-white/5 rounded-lg border border-white/10 mb-2">
                    {/* Target marker */}
                    <div className="absolute left-0 right-0 h-0.5 bg-emerald-400" style={{bottom: `${ch.targetVolume}%`}} />
                    <div className="absolute left-0 right-0 text-[8px] text-emerald-400/60 text-center" style={{bottom: `${ch.targetVolume + 2}%`}}>alvo</div>
                    {/* Slider handle */}
                    <input
                      type="range" min="0" max="100" value={ch.currentVolume}
                      onChange={e => setVolume(i, parseInt(e.target.value))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      style={{writingMode: "vertical-lr", direction: "rtl"}}
                      disabled={feedback !== "idle"}
                    />
                    <div className="absolute left-0 right-0 h-3 rounded bg-cyan-500" style={{bottom: `${ch.currentVolume}%`}} />
                  </div>
                  <div className="text-[10px] text-white/60 tabular-nums">{ch.currentVolume}%</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Controles */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Button onClick={playTarget} variant="outline" className="border-emerald-400/40 hover:bg-emerald-600/30"><Play className="w-4 h-4 mr-1" /> Alvo</Button>
            <Button onClick={playCurrent} variant="outline" className="border-cyan-400/40 hover:bg-cyan-600/30"><Play className="w-4 h-4 mr-1" /> Seu mix</Button>
            <Button onClick={checkAnswer} disabled={feedback !== "idle"} className="bg-emerald-600 hover:bg-emerald-700"><Check className="w-4 h-4 mr-1" /> Check</Button>
          </div>

          {feedback !== "idle" && (
            <div className="fixed top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-50">
              <div className={`text-6xl font-black ${feedback === "correct" ? "text-emerald-400" : "text-red-400"}`}>{feedback === "correct" ? "✓ MATCH!" : "✗ TENTA DE NOVO"}</div>
            </div>
          )}

          <Card className="bg-white/5 border-white/10 p-3 text-xs text-white/60">
            <strong className="text-white/80">Mecânica real:</strong> Cada canal tem um volume alvo (linha verde). Ajuste os sliders até match (±15%). Ouça o alvo e seu mix pra comparar. {numChannels} canais, {TIME_PER_SLIDER}s por problema.
          </Card>
        </>
      )}
    </GameShell>
  );
}
