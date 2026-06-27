"use client";

/**
 * ChordLocksReal — Combination lock com 3 dials (RECONSTRUÍDO do Theta)
 *
 * Mecânica real:
 * - 3 dials: Função (I, IIm, IV, V, etc), Modificador (7, m7, maj7, etc), Inversão
 * - Ouça um acorde dentro de uma tonalidade
 * - Ajuste cada dial (↑↓) até o acorde correto
 * - Dados reais: chordFunctionsPerLevel, chordModifiersPerLevel, numChordsPerLevel
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, RotateCcw, ArrowUp, ArrowDown, Check, Heart } from "lucide-react";
import { GameShell } from "./GameShell";
import { GAMES_MAP } from "@/lib/games/gamesCatalog";
import { useProgress } from "@/hooks/useProgress";
import { initAudio, playChord, midiToFreq } from "@/lib/audio/audioEngine";
import { generateScale, generateChord, PRACTICE_KEYS, CHORDS, type ChordType } from "@/lib/audio/musicTheory";

const NUM_CHORDS = [0, 6,6,7,7,7, 8,8,8,8,8, 10,10,10,10,10, 12,12,12,15,16];

const CHORD_FUNCTIONS = [
  ["I", "IIm", "IV", "V", "VIm"], // lvl 1-2
  ["I", "IIm", "IIIm", "IV", "V", "VIm"], // lvl 3-5
  ["I", "IIm", "IIIm", "IV", "V", "VIm", "bVII", "VIIdim"], // lvl 6-10
  ["I", "II", "IIm", "bIII", "IIIm", "IV", "V", "VIm", "bVII", "VIIdim"], // lvl 11+
];

const MODIFIERS = ["", "7", "m7", "maj7", "m7b5"];
const INVERSIONS = ["Fundamental", "1ª Inv", "2ª Inv"];

// Mapear função → grau da escala + tipo base
const FUNCTION_MAP: Record<string, {degree: number; type: ChordType}> = {
  "I": {degree: 0, type: "major"}, "IIm": {degree: 1, type: "minor"}, "IIIm": {degree: 2, type: "minor"},
  "IV": {degree: 3, type: "major"}, "V": {degree: 4, type: "major"}, "VIm": {degree: 5, type: "minor"},
  "VIIdim": {degree: 6, type: "diminished"}, "bIII": {degree: 2, type: "major"}, "bVII": {degree: 6, type: "major"},
  "Im": {degree: 0, type: "minor"}, "IIdim": {degree: 1, type: "diminished"}, "IVm": {degree: 3, type: "minor"},
  "Vm": {degree: 4, type: "minor"}, "bVI": {degree: 5, type: "major"}, "VI": {degree: 5, type: "major"},
  "VII": {degree: 6, type: "major"}, "II": {degree: 1, type: "major"}, "III": {degree: 2, type: "major"},
};

const MODIFIER_MAP: Record<string, (base: ChordType) => ChordType> = {
  "": (b) => b,
  "7": (b) => b === "major" ? "dominant7" : b === "minor" ? "minor7" : b,
  "m7": (_b) => "minor7",
  "maj7": (_b) => "major7",
  "m7b5": (_b) => "halfDiminished" as ChordType,
};

interface Props { onExit: () => void; }

export function ChordLocksReal({ onExit }: Props) {
  const game = GAMES_MAP["chord-locks"];
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [problemNum, setProblemNum] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [levelComplete, setLevelComplete] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");

  // Dials
  const [funcIdx, setFuncIdx] = useState(0);
  const [modIdx, setModIdx] = useState(0);
  const [invIdx, setInvIdx] = useState(0);

  // Resposta correta
  const [target, setTarget] = useState<{func: string; mod: string; inv: string; chordMidis: number[]} | null>(null);

  const functions = CHORD_FUNCTIONS[Math.min(Math.floor((level - 1) / 5), CHORD_FUNCTIONS.length - 1)];
  const numProblems = NUM_CHORDS[level] || 6;
  const { recordPlay, unlockAchievement } = useProgress();

  const handleStart = useCallback(async () => { await initAudio(); setAudioReady(true); }, []);

  const generateProblem = useCallback(() => {
    const key = PRACTICE_KEYS[Math.floor(Math.random() * PRACTICE_KEYS.length)];
    const scale = generateScale(key.midi, "major", 0);
    const func = functions[Math.floor(Math.random() * functions.length)];
    const mod = MODIFIERS[Math.floor(Math.random() * Math.min(level + 1, MODIFIERS.length))];
    const inv = INVERSIONS[Math.floor(Math.random() * 3)];

    const funcInfo = FUNCTION_MAP[func];
    if (!funcInfo) return;
    const baseType = funcInfo.type;
    const chordType = MODIFIER_MAP[mod]?.(baseType) ?? baseType;
    let chord = generateChord(scale[funcInfo.degree], chordType);

    // Aplicar inversão
    if (inv === "1ª Inv") chord = [chord[1], ...chord.slice(2), chord[0] + 12];
    else if (inv === "2ª Inv") chord = [chord[2], ...chord.slice(3), chord[0] + 12, chord[1] + 12];

    setTarget({ func, mod, inv, chordMidis: chord });
    setFuncIdx(0); setModIdx(0); setInvIdx(0);
    setFeedback("idle");
    setTimeout(() => playChord(chord.map(midiToFreq), 1.0, "piano"), 300);
  }, [functions, level]);

  useEffect(() => {
    if (!audioReady) return;
    generateProblem();
    setLives(3);
  }, [level, audioReady, generateProblem]);

  const cycleDial = (which: "func" | "mod" | "inv", dir: number) => {
    if (feedback !== "idle") return;
    if (which === "func") {
      setFuncIdx(i => (i + dir + functions.length) % functions.length);
    } else if (which === "mod") {
      const maxMods = Math.min(level + 1, MODIFIERS.length);
      setModIdx(i => (i + dir + maxMods) % maxMods);
    } else {
      setInvIdx(i => (i + dir + INVERSIONS.length) % INVERSIONS.length);
    }
    // Toca o acorde atualmente selecionado
    if (target) {
      const selectedFunc = functions[which === "func" ? (funcIdx + dir + functions.length) % functions.length : funcIdx];
      const funcInfo = FUNCTION_MAP[selectedFunc];
      if (funcInfo) playChord(generateChord(60, funcInfo.type).map(midiToFreq), 0.4, "piano");
    }
  };

  const checkAnswer = useCallback(() => {
    if (!target || feedback !== "idle") return;
    const selectedFunc = functions[funcIdx];
    const selectedMod = MODIFIERS[modIdx];
    const selectedInv = INVERSIONS[invIdx];
    const correct = selectedFunc === target.func && selectedMod === target.mod && selectedInv === target.inv;

    if (correct) {
      setFeedback("correct");
      setScore(s => s + 200 + level * 10);
      unlockAchievement("first_play");
      setProblemNum(p => {
        const np = p + 1;
        if (np >= numProblems) {
          setLevelComplete(true);
          setScore(s => s + 50);
          recordPlay("chord-locks", level, score + 250);
          if (level >= 5) unlockAchievement("level_5");
          if (level >= 10) unlockAchievement("level_10");
          if (level >= 20) unlockAchievement("level_20");
        } else {
          setTimeout(() => generateProblem(), 1000);
        }
        return np;
      });
    } else {
      setFeedback("wrong");
      setLives(l => {
        const nl = l - 1;
        if (nl <= 0) { setGameOver(true); recordPlay("chord-locks", level, score); }
        return nl;
      });
      setTimeout(() => setFeedback("idle"), 1500);
    }
  }, [target, feedback, functions, funcIdx, modIdx, invIdx, level, score, numProblems, recordPlay, unlockAchievement, generateProblem]);

  const restart = () => { setLevel(1); setScore(0); setLives(3); setGameOver(false); setLevelComplete(false); setProblemNum(0); };
  const nextLevel = () => { setLevel(l => Math.min(20, l + 1)); setLevelComplete(false); setProblemNum(0); };

  if (gameOver) return (
    <GameShell game={game} level={level} score={score} streak={0} onExit={onExit} onRestart={restart}>
      <Card className="bg-white/5 border-white/10 p-8 text-center"><div className="text-6xl mb-3">💀</div><h2 className="text-3xl font-bold mb-2">Game Over</h2><p className="text-white/70 mb-6">Score: <strong className="text-emerald-400">{score}</strong></p><Button onClick={restart} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5"><RotateCcw className="w-5 h-5 mr-2" /> Jogar de novo</Button></Card>
    </GameShell>
  );

  if (levelComplete) return (
    <GameShell game={game} level={level} score={score} streak={0} onExit={onExit}>
      <Card className="bg-gradient-to-br from-emerald-900/40 to-teal-900/30 border-emerald-500/40 p-8 text-center"><div className="text-6xl mb-3">🎉</div><h2 className="text-3xl font-bold mb-2 text-emerald-300">Nível {level} Completo!</h2><p className="text-white/70 mb-6">+50 bônus · Score: {score}</p>{level < 20 ? <Button onClick={nextLevel} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5">Próximo nível →</Button> : <div className="text-2xl font-bold text-amber-300">🏆 Mestre dos Acordes!</div>}</Card>
    </GameShell>
  );

  return (
    <GameShell game={game} level={level} score={score} streak={0} onExit={onExit} onRestart={restart}>
      {!audioReady ? (
        <Card className="bg-white/5 border-white/10 p-8 text-center"><div className="text-5xl mb-3">🔐</div><h2 className="text-2xl font-bold mb-2">Chord Locks</h2><p className="text-white/70 text-sm mb-6">Ouça o acorde e ajuste 3 dials (função, modificador, inversão) até o acorde correto.</p><Button onClick={handleStart} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-5">Iniciar</Button></Card>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1">{Array.from({length: lives}).map((_,i)=><Heart key={i} className="w-4 h-4 fill-rose-500 text-rose-500" />)}</div>
            <div className="text-xs text-white/60">Problema {problemNum + 1}/{numProblems}</div>
          </div>

          {/* Replay button */}
          <Card className="bg-gradient-to-br from-amber-950/30 to-orange-950/20 border-amber-500/30 p-4 mb-4 text-center">
            <div className="text-xs text-white/60 mb-2">Ouça o acorde e identifique: função + modificador + inversão</div>
            <Button onClick={() => target && playChord(target.chordMidis.map(midiToFreq), 1.0, "piano")} variant="outline" className="border-white/30 bg-white/10">
              ▶ Ouvir acorde
            </Button>
          </Card>

          {/* 3 Dials */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {/* Function dial */}
            <Card className="bg-white/5 border-white/10 p-4 text-center">
              <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2">Função</div>
              <div className="flex flex-col items-center">
                <Button size="sm" variant="ghost" onClick={() => cycleDial("func", 1)} disabled={feedback !== "idle"}><ArrowUp className="w-4 h-4" /></Button>
                <div className="text-2xl font-bold my-2 min-h-[2rem] text-amber-300">{functions[funcIdx]}</div>
                <Button size="sm" variant="ghost" onClick={() => cycleDial("func", -1)} disabled={feedback !== "idle"}><ArrowDown className="w-4 h-4" /></Button>
              </div>
            </Card>

            {/* Modifier dial */}
            <Card className="bg-white/5 border-white/10 p-4 text-center">
              <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2">Modificador</div>
              <div className="flex flex-col items-center">
                <Button size="sm" variant="ghost" onClick={() => cycleDial("mod", 1)} disabled={feedback !== "idle"}><ArrowUp className="w-4 h-4" /></Button>
                <div className="text-2xl font-bold my-2 min-h-[2rem] text-purple-300">{MODIFIERS[modIdx] || "—"}</div>
                <Button size="sm" variant="ghost" onClick={() => cycleDial("mod", -1)} disabled={feedback !== "idle"}><ArrowDown className="w-4 h-4" /></Button>
              </div>
            </Card>

            {/* Inversion dial */}
            <Card className="bg-white/5 border-white/10 p-4 text-center">
              <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2">Inversão</div>
              <div className="flex flex-col items-center">
                <Button size="sm" variant="ghost" onClick={() => cycleDial("inv", 1)} disabled={feedback !== "idle"}><ArrowUp className="w-4 h-4" /></Button>
                <div className="text-2xl font-bold my-2 min-h-[2rem] text-emerald-300">{INVERSIONS[invIdx]}</div>
                <Button size="sm" variant="ghost" onClick={() => cycleDial("inv", -1)} disabled={feedback !== "idle"}><ArrowDown className="w-4 h-4" /></Button>
              </div>
            </Card>
          </div>

          {/* Check button */}
          <Button onClick={checkAnswer} disabled={feedback !== "idle"} className="w-full py-6 mb-4 bg-emerald-600 hover:bg-emerald-700 text-lg font-bold">
            <Check className="w-5 h-5 mr-2" /> Verificar
          </Button>

          {feedback !== "idle" && (
            <div className="fixed top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-50">
              <div className={`text-6xl font-black ${feedback === "correct" ? "text-emerald-400" : "text-red-400"}`} style={{textShadow: "0 0 20px currentColor"}}>
                {feedback === "correct" ? "✓ CORRETO!" : "✗ ERRADO"}
              </div>
              {feedback === "wrong" && target && (
                <div className="text-center text-white/70 mt-2">Resposta: {target.func} {target.mod} · {target.inv}</div>
              )}
            </div>
          )}

          <Card className="bg-white/5 border-white/10 p-3 text-xs text-white/60">
            <strong className="text-white/80">Mecânica real:</strong> 3 dials como um cadeado de combinação. Funções: {functions.join(", ")}. Modificadores: {MODIFIERS.slice(0, Math.min(level+1, 5)).join(", ") || "(nenhum)"}. {numProblems} problemas por nível.
          </Card>
        </>
      )}
    </GameShell>
  );
}
