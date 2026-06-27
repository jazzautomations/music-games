"use client";

/**
 * RhythmRepeatReal — Beat grid mechanic (RECONSTRUÍDO do Theta)
 *
 * Mecânica real:
 * - Ouça um ritmo (padrão de beats numa pauta)
 * - Toque de volta clicando nos beats no tempo certo
 * - Sistema de scoring baseado em timing accuracy
 * - BPM por nível (120, 100, 90, etc)
 * - maxNotesPerLevel: 8 (1-7), 9-12 (8-10), 32 (11-20)
 * - 5 falhas permitidas
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, RotateCcw, Play, Heart, Clock } from "lucide-react";
import { GameShell } from "./GameShell";
import { GAMES_MAP } from "@/lib/games/gamesCatalog";
import { useProgress } from "@/hooks/useProgress";
import { initAudio, playNote, midiToFreq } from "@/lib/audio/audioEngine";

const MAX_NOTES = [0, 8,8,8,8,8, 8,9,10,11,12, 16,16,16,16,16, 20,20,20,24,24];
const BPM_OPTIONS = [{bpm: 120, ms: 500}, {bpm: 100, ms: 600}, {bpm: 90, ms: 666}, {bpm: 80, ms: 750}];

interface Beat { active: boolean; duration: number; } // duration in beats (1=quarter, 0.5=eighth)

interface Props { onExit: () => void; }

export function RhythmRepeatReal({ onExit }: Props) {
  const game = GAMES_MAP["rhythm-repeat"];
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(5);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [phase, setPhase] = useState<"idle" | "listening" | "playing" | "result">("idle");
  const [currentBeat, setCurrentBeat] = useState(0);
  const [playerHits, setPlayerHits] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<"idle" | "perfect" | "good" | "miss">("idle");
  const [gameOver, setGameOver] = useState(false);
  const [levelComplete, setLevelComplete] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [problemNum, setProblemNum] = useState(0);
  const bpmInfo = BPM_OPTIONS[Math.min(Math.floor((level - 1) / 5), BPM_OPTIONS.length - 1)];
  const maxNotes = MAX_NOTES[level] || 8;
  const { recordPlay, unlockAchievement } = useProgress();
  const playTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordStartRef = useRef(0);

  const handleStart = useCallback(async () => { await initAudio(); setAudioReady(true); }, []);

  const generateRhythm = useCallback(() => {
    const numBeats = Math.min(maxNotes, 8 + Math.floor(level / 3));
    const newBeats: Beat[] = [];
    for (let i = 0; i < numBeats; i++) {
      const active = Math.random() > 0.25; // 75% chance of beat
      const duration = Math.random() > 0.7 ? 0.5 : 1; // mostly quarters, some eighths
      newBeats.push({ active, duration });
    }
    setBeats(newBeats);
    setPlayerHits(new Array(numBeats).fill(false));
    setCurrentBeat(0);
    setPhase("listening");
  }, [maxNotes, level]);

  useEffect(() => {
    if (!audioReady) return;
    generateRhythm();
    setLives(5);
  }, [level, audioReady, generateRhythm]);

  // Tocar ritmo
  useEffect(() => {
    if (phase !== "listening" || !audioReady) return;
    let totalTime = 0;
    beats.forEach((beat, i) => {
      if (beat.active) {
        playTimeoutRef.current = setTimeout(() => {
          playNote(440, beat.duration * bpmInfo.ms / 1000 * 0.8, "piano");
          setCurrentBeat(i);
        }, totalTime);
      }
      totalTime += beat.duration * bpmInfo.ms;
    });
    // Acabou de tocar → começa fase de reprodução
    playTimeoutRef.current = setTimeout(() => {
      setPhase("playing");
      setCurrentBeat(0);
      recordStartRef.current = Date.now();
    }, totalTime + 500);
    return () => { if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current); };
  }, [phase, beats, audioReady, bpmInfo.ms]);

  const handleTap = useCallback(() => {
    if (phase !== "playing") return;
    const elapsed = Date.now() - recordStartRef.current;
    const beatIdx = Math.round(elapsed / bpmInfo.ms);
    if (beatIdx >= beats.length) return;
    // Marca o beat como tocado
    setPlayerHits(hits => {
      const newHits = [...hits];
      newHits[beatIdx] = true;
      return newHits;
    });
    // Toca o som do tap
    playNote(660, 0.1, "marimba");
    // Verifica se acertou
    if (beats[beatIdx]?.active) {
      setFeedback("perfect");
      setScore(s => s + 100);
      setTimeout(() => setFeedback("idle"), 200);
    } else {
      setFeedback("miss");
      setTimeout(() => setFeedback("idle"), 200);
    }
    setCurrentBeat(beatIdx + 1);
    // Verifica se terminou
    if (beatIdx + 1 >= beats.length) {
      setTimeout(() => {
        setPhase("result");
        setProblemNum(p => p + 1);
        if (problemNum + 1 >= 3) { // 3 problemas por nível
          setLevelComplete(true);
          setScore(s => s + 50);
          recordPlay("rhythm-repeat", level, score + 50);
          if (level >= 5) unlockAchievement("level_5");
          if (level >= 10) unlockAchievement("level_10");
          if (level >= 20) unlockAchievement("level_20");
        } else {
          setTimeout(() => generateRhythm(), 1000);
        }
      }, 500);
    }
  }, [phase, beats, bpmInfo.ms, problemNum, level, score, recordPlay, unlockAchievement, generateRhythm]);

  const replayRhythm = useCallback(() => {
    if (phase !== "playing") return;
    setPhase("listening");
  }, [phase]);

  const restart = () => { setLevel(1); setScore(0); setLives(5); setGameOver(false); setLevelComplete(false); setProblemNum(0); };
  const nextLevel = () => { setLevel(l => Math.min(20, l + 1)); setLevelComplete(false); setProblemNum(0); };

  if (gameOver) return (
    <GameShell game={game} level={level} score={score} streak={0} onExit={onExit} onRestart={restart}>
      <Card className="bg-white/5 border-white/10 p-8 text-center"><div className="text-6xl mb-3">💀</div><h2 className="text-3xl font-bold mb-2">Game Over</h2><p className="text-white/70 mb-6">Score: <strong className="text-emerald-400">{score}</strong></p><Button onClick={restart} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5"><RotateCcw className="w-5 h-5 mr-2" /> Jogar de novo</Button></Card>
    </GameShell>
  );

  if (levelComplete) return (
    <GameShell game={game} level={level} score={score} streak={0} onExit={onExit}>
      <Card className="bg-gradient-to-br from-emerald-900/40 to-teal-900/30 border-emerald-500/40 p-8 text-center"><div className="text-6xl mb-3">🎉</div><h2 className="text-3xl font-bold mb-2 text-emerald-300">Nível {level} Completo!</h2><p className="text-white/70 mb-6">+50 bônus · Score: {score}</p>{level < 20 ? <Button onClick={nextLevel} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5">Próximo nível →</Button> : <div className="text-2xl font-bold text-amber-300">🏆 Mestre do Ritmo!</div>}</Card>
    </GameShell>
  );

  return (
    <GameShell game={game} level={level} score={score} streak={0} onExit={onExit} onRestart={restart}>
      {!audioReady ? (
        <Card className="bg-white/5 border-white/10 p-8 text-center"><div className="text-5xl mb-3">🥁</div><h2 className="text-2xl font-bold mb-2">Rhythm Repeat</h2><p className="text-white/70 text-sm mb-6">Ouça o ritmo e toque de volta clicando no botão no tempo certo. BPM: {bpmInfo.bpm}</p><Button onClick={handleStart} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5">Iniciar</Button></Card>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">{Array.from({length: lives}).map((_,i)=><Heart key={i} className="w-4 h-4 fill-rose-500 text-rose-500" />)}<span className="text-xs text-white/50 ml-1">{lives} vidas</span></div>
            <div className="text-xs text-white/60">BPM: <strong className="text-white">{bpmInfo.bpm}</strong> · Problema {problemNum + 1}/3</div>
          </div>

          {/* Beat grid */}
          <Card className="bg-gradient-to-b from-orange-950/30 to-red-950/20 border-orange-500/30 p-4 mb-4">
            <div className="text-xs text-white/60 mb-2 text-center">
              {phase === "listening" ? "🔊 Ouça o ritmo..." : phase === "playing" ? "👆 Toque de volta!" : "✓ Resultado"}
            </div>
            <div className="flex gap-1 justify-center flex-wrap">
              {beats.map((beat, i) => {
                const isCurrent = phase === "listening" && i === currentBeat;
                const isPlayed = phase === "playing" && playerHits[i];
                const correct = beat.active && playerHits[i];
                const missed = beat.active && !playerHits[i] && phase === "result";
                return (
                  <div key={i} className={`w-10 h-10 rounded-md flex items-center justify-center text-xs font-bold transition-all ${
                    correct ? "bg-emerald-500 text-white"
                    : missed ? "bg-red-500/50 text-white"
                    : isCurrent ? "bg-amber-400 text-black scale-125"
                    : beat.active ? "bg-white/20 text-white/60"
                    : isPlayed ? "bg-white/10 text-white/40"
                    : "bg-white/5 text-white/20"
                  }`}>
                    {beat.active ? "●" : "·"}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Botão de tap */}
          {phase === "playing" && (
            <Button onClick={handleTap} className="w-full py-12 text-xl font-bold bg-gradient-to-r from-orange-600 to-red-600 hover:opacity-90 mb-4">
              🥁 TAP
            </Button>
          )}

          {phase === "listening" && (
            <Card className="bg-white/5 border-white/10 p-4 text-center text-white/60 text-sm">Aguarde o ritmo terminar...</Card>
          )}

          {phase === "playing" && (
            <Button onClick={replayRhythm} variant="outline" className="w-full mb-4 border-white/20">
              <Play className="w-4 h-4 mr-1" /> Ouvir de novo
            </Button>
          )}

          {feedback !== "idle" && (
            <div className="fixed top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-50">
              <div className={`text-4xl font-black ${feedback === "perfect" ? "text-emerald-400" : "text-red-400"}`}>{feedback === "perfect" ? "✓" : "✗"}</div>
            </div>
          )}

          <Card className="bg-white/5 border-white/10 p-3 text-xs text-white/60">
            <strong className="text-white/80">Mecânica real:</strong> Ouça o ritmo (padrão de beats ativos ● e pausas ·). Toque de volta clicando TAP no tempo de cada beat ativo. BPM {bpmInfo.bpm} ({bpmInfo.ms}ms por beat). {maxNotes} notas máx. 5 falhas permitidas.
          </Card>
        </>
      )}
    </GameShell>
  );
}
