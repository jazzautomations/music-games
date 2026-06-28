"use client";

/**
 * DangoBrothersReal — Tuner mechanic (RECONSTRUÍDO do Theta)
 *
 * Mecânica real extraída do código:
 * - 4 "dangos" (notas) aparecem, cada uma desafinada
 * - Player move o tuner (↑↓) pra ajustar cada dango em passos de 10 cents
 * - Range: -80 a +80 cents. Quando tuner = 0, está afinado
 * - Lives = numMissesPerLevel (10→5 conforme nível)
 * - Time = timeAllowedPerLevel (90s→40s)
 * - 4 problemas por nível
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, RotateCcw, ArrowUp, ArrowDown, Check, Heart, Clock } from "lucide-react";
import { GameShell } from "./GameShell";
import { GAMES_MAP } from "@/lib/games/gamesCatalog";
import { useProgress } from "@/hooks/useProgress";
import { initAudio, playNoteReal, midiToFreq, type RealInstrument } from "@/lib/audio/soundfontEngine";
import { PRACTICE_KEYS, generateScale } from "@/lib/audio/musicTheory";

const NUM_PROBLEMS = 4; // sempre 4 por nível
const NUM_MISSES_PER_LEVEL = [0, 10,9,9,8,8, 9,8,8,7,7, 8,7,7,6,6, 7,6,6,5,5];
const TIME_ALLOWED = [0, 90,80,70,60,60, 80,70,60,50,50, 70,60,60,50,50, 50,50,50,45,40];

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

interface Props { onExit: () => void; }

export function DangoBrothersReal({ onExit }: Props) {
  const game = GAMES_MAP["dango-brothers"];
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(NUM_MISSES_PER_LEVEL[1]);
  const [timeLeft, setTimeLeft] = useState(TIME_ALLOWED[1]);
  const [dangos, setDangos] = useState<{midi: number; tuning: number; tuned: boolean; checked: boolean}[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [problemNum, setProblemNum] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [levelComplete, setLevelComplete] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { recordPlay, unlockAchievement } = useProgress();

  const maxLives = NUM_MISSES_PER_LEVEL[level];
  const totalTime = TIME_ALLOWED[level];

  const handleStart = useCallback(async () => { await initAudio(); setAudioReady(true); }, []);

  // Gerar 4 dangos com afinações aleatórias
  const generateDangos = useCallback(() => {
    const key = PRACTICE_KEYS[Math.floor(Math.random() * PRACTICE_KEYS.length)];
    const scale = generateScale(key.midi + 12, "major", 0);
    const newDangos = [];
    for (let i = 0; i < NUM_PROBLEMS; i++) {
      const noteMidi = scale[Math.floor(Math.random() * 7)];
      // Afinação aleatória: múltiplos de 10, entre -80 e +80 (excluindo 0)
      let tuning;
      do { tuning = (Math.floor(Math.random() * 16) - 8) * 10; } while (tuning === 0);
      newDangos.push({ midi: noteMidi, tuning, tuned: false, checked: false });
    }
    setDangos(newDangos);
    setCurrentIdx(0);
    setFeedback("idle");
    // Toca o primeiro dango
    if (audioReady) void playNoteReal(midiToFreq(newDangos[0].midi), 0.5, "acoustic_grand_piano");
  }, [audioReady]);

  useEffect(() => {
    if (!audioReady) return;
    generateDangos();
    setLives(maxLives);
    setTimeLeft(totalTime);
  }, [level, audioReady, generateDangos, maxLives, totalTime]);

  // Timer
  useEffect(() => {
    if (!audioReady || gameOver || levelComplete) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 0.1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setGameOver(true);
          recordPlay("dango-brothers", level, score);
          return 0;
        }
        return t - 0.1;
      });
    }, 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [audioReady, gameOver, levelComplete, level, score, recordPlay]);

  const tune = useCallback((dir: number) => {
    if (feedback !== "idle") return;
    setDangos(ds => ds.map((d, i) => {
      if (i !== currentIdx) return d;
      const newTuning = d.tuning + 10 * dir;
      if (newTuning < -80 || newTuning > 80) return d;
      // Toca o som com a nova afinação
      const detunedFreq = midiToFreq(d.midi) * Math.pow(2, newTuning / 1200);
      void playNoteReal(detunedFreq, 0.3, "acoustic_grand_piano");
      return { ...d, tuning: newTuning };
    }));
  }, [currentIdx, feedback]);

  const checkDango = useCallback(() => {
    const dango = dangos[currentIdx];
    if (!dango || dango.checked) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const correct = dango.tuning === 0;
    if (correct) {
      setFeedback("correct");
      setScore(s => s + 250);
      setDangos(ds => ds.map((d, i) => i === currentIdx ? { ...d, tuned: true, checked: true } : d));
      // Avança pro próximo dango
      setTimeout(() => {
        setFeedback("idle");
        if (currentIdx < dangos.length - 1) {
          const nextIdx = currentIdx + 1;
          setCurrentIdx(nextIdx);
          void playNoteReal(midiToFreq(dangos[nextIdx].midi), 0.5, "acoustic_grand_piano");
          // Reinicia timer
          timerRef.current = setInterval(() => {
            setTimeLeft(t => { if (t <= 0.1) { setGameOver(true); return 0; } return t - 0.1; });
          }, 100);
        } else {
          // Nível completo
          setProblemNum(p => p + 1);
          if (problemNum + 1 >= 1) { // 1 rodada de 4 dangos = nível completo
            setLevelComplete(true);
            setScore(s => s + 50);
            recordPlay("dango-brothers", level, score + 50);
            if (level >= 5) unlockAchievement("level_5");
            if (level >= 10) unlockAchievement("level_10");
            if (level >= 20) unlockAchievement("level_20");
          } else {
            generateDangos();
          }
        }
      }, 800);
    } else {
      setFeedback("wrong");
      setLives(l => {
        const nl = l - 1;
        if (nl <= 0) { setGameOver(true); recordPlay("dango-brothers", level, score); }
        return nl;
      });
      setTimeout(() => {
        setFeedback("idle");
        setDangos(ds => ds.map((d, i) => i === currentIdx ? { ...d, checked: true } : d));
        // Avança mesmo errando
        if (currentIdx < dangos.length - 1) {
          setCurrentIdx(currentIdx + 1);
        } else {
          setLevelComplete(true);
          recordPlay("dango-brothers", level, score);
        }
      }, 1000);
    }
  }, [dangos, currentIdx, feedback, level, score, problemNum, recordPlay, unlockAchievement, generateDangos]);

  const restart = () => { setLevel(1); setScore(0); setGameOver(false); setLevelComplete(false); setProblemNum(0); };
  const nextLevel = () => { setLevel(l => Math.min(20, l + 1)); setLevelComplete(false); setProblemNum(0); };

  if (gameOver) return (
    <GameShell game={game} level={level} score={score} streak={0} onExit={onExit} onRestart={restart}>
      <Card className="bg-white/5 border-white/10 p-8 text-center"><div className="text-6xl mb-3">💀</div><h2 className="text-3xl font-bold mb-2">Game Over</h2><p className="text-white/70 mb-6">Score: <strong className="text-emerald-400">{score}</strong> · Nível: <strong>{level}</strong></p><Button onClick={restart} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5"><RotateCcw className="w-5 h-5 mr-2" /> Jogar de novo</Button></Card>
    </GameShell>
  );

  if (levelComplete) return (
    <GameShell game={game} level={level} score={score} streak={0} onExit={onExit}>
      <Card className="bg-gradient-to-br from-emerald-900/40 to-teal-900/30 border-emerald-500/40 p-8 text-center"><div className="text-6xl mb-3">🎉</div><h2 className="text-3xl font-bold mb-2 text-emerald-300">Nível {level} Completo!</h2><p className="text-white/70 mb-6">+50 bônus · Score: {score}</p>{level < 20 ? <Button onClick={nextLevel} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5">Próximo nível →</Button> : <div className="text-2xl font-bold text-amber-300">🏆 Mestre da Afinação!</div>}</Card>
    </GameShell>
  );

  const timePct = (timeLeft / totalTime) * 100;

  return (
    <GameShell game={game} level={level} score={score} streak={0} onExit={onExit} onRestart={restart}>
      {!audioReady ? (
        <Card className="bg-white/5 border-white/10 p-8 text-center">
          <div className="text-5xl mb-3">🍡</div>
          <h2 className="text-2xl font-bold mb-2">Dango Brothers</h2>
          <p className="text-white/70 text-sm mb-6">Cada dango está desafinado. Use as setas ↑↓ pra ajustar o tuner em passos de 10 cents. Quando tuner = 0, clique em Check.</p>
          <Button onClick={handleStart} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5">Iniciar</Button>
        </Card>
      ) : (
        <>
          {/* Timer + vidas */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              {Array.from({length: Math.min(lives, 10)}).map((_,i)=><Heart key={i} className="w-4 h-4 fill-rose-500 text-rose-500" />)}
              <span className="text-xs text-white/50 ml-1">{lives} vidas</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/60">
              <Clock className="w-3 h-3" />
              <span className={`tabular-nums font-bold ${timeLeft < 10 ? "text-red-400" : "text-white"}`}>{timeLeft.toFixed(0)}s</span>
            </div>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-4">
            <div className="h-full transition-all" style={{width: `${timePct}%`, background: timePct > 50 ? "linear-gradient(90deg,#10b981,#34d399)" : timePct > 20 ? "linear-gradient(90deg,#f59e0b,#fb923c)" : "linear-gradient(90deg,#ef4444,#dc2626)"}} />
          </div>

          {/* Dangos */}
          <Card className="bg-gradient-to-b from-orange-950/30 to-red-950/20 border-orange-500/30 p-6 mb-4">
            <div className="text-xs text-white/60 mb-3 text-center">Dango {currentIdx + 1} de {dangos.length} · Ajuste o tuner até 0</div>
            <div className="flex justify-center gap-4 mb-4">
              {dangos.map((d, i) => (
                <div key={i} className={`flex flex-col items-center transition-all ${i === currentIdx ? "scale-110" : "opacity-50"}`}>
                  <div className={`text-3xl ${d.tuned ? "grayscale-0" : i === currentIdx ? "" : "grayscale"}`}>
                    {d.tuned ? "😊" : d.checked ? "😰" : "🍡"}
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">{NOTE_NAMES[((d.midi%12)+12)%12]}</div>
                  {i === currentIdx && (
                    <div className="mt-2 text-center">
                      <div className={`text-2xl font-black tabular-nums ${d.tuning === 0 ? "text-emerald-400" : Math.abs(d.tuning) <= 20 ? "text-amber-400" : "text-red-400"}`}>
                        {d.tuning > 0 ? "+" : ""}{d.tuning}
                      </div>
                      <div className="text-[9px] text-white/40">cents</div>
                      {/* Tuner bar */}
                      <div className="relative w-24 h-3 bg-white/5 rounded-full mt-1 border border-white/10">
                        <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-400" style={{left: "50%"}} />
                        <div className="absolute top-0 bottom-0 w-2 rounded-full transition-all" style={{
                          left: `${50 + (d.tuning / 80) * 50}%`, transform: "translateX(-50%)",
                          background: d.tuning === 0 ? "#10b981" : Math.abs(d.tuning) <= 20 ? "#f59e0b" : "#ef4444"
                        }} />
                      </div>
                      <div className="flex justify-between w-24 text-[8px] text-white/30"><span>-80</span><span>0</span><span>+80</span></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Controles do tuner */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Button onClick={() => tune(-1)} disabled={feedback !== "idle"} variant="outline" className="py-8 border-orange-400/40 hover:bg-orange-600/30 text-lg font-bold">
              <ArrowDown className="w-6 h-6 mx-auto mb-1" /><div>-10 cents</div>
            </Button>
            <Button onClick={checkDango} disabled={feedback !== "idle"} className="py-8 bg-emerald-600 hover:bg-emerald-700 text-lg font-bold">
              <Check className="w-6 h-6 mx-auto mb-1" /><div>Check</div>
            </Button>
            <Button onClick={() => tune(1)} disabled={feedback !== "idle"} variant="outline" className="py-8 border-orange-400/40 hover:bg-orange-600/30 text-lg font-bold">
              <ArrowUp className="w-6 h-6 mx-auto mb-1" /><div>+10 cents</div>
            </Button>
          </div>

          {feedback !== "idle" && (
            <div className="fixed top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-50">
              <div className={`text-6xl font-black ${feedback === "correct" ? "text-emerald-400" : "text-red-400"}`} style={{textShadow: "0 0 20px currentColor"}}>
                {feedback === "correct" ? "✓ AFINADO!" : "✗ DESAFINADO"}
              </div>
            </div>
          )}

          <Card className="bg-white/5 border-white/10 p-3 text-xs text-white/60">
            <strong className="text-white/80">Mecânica real:</strong> Cada dango tem uma afinação aleatória (-80 a +80 cents). Use ↑↓ pra ajustar em passos de 10. Quando o tuner = 0, clique Check. Vidas: {maxLives} (diminui com nível). Tempo: {totalTime}s.
          </Card>
        </>
      )}
    </GameShell>
  );
}
