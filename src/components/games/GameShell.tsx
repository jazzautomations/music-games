"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, RotateCcw, Mic, MicOff } from "lucide-react";
import { motion } from "framer-motion";
import type { GameDef } from "@/lib/games/gamesCatalog";
import { CATEGORY_EMOJIS, CATEGORY_LABELS } from "@/lib/games/gamesCatalog";

interface GameShellProps {
  game: GameDef;
  level: number;
  score: number;
  streak: number;
  onExit: () => void;
  onRestart?: () => void;
  micActive?: boolean;
  onToggleMic?: () => void;
  micError?: string | null;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function GameShell({
  game, level, score, streak, onExit, onRestart,
  micActive, onToggleMic, micError, children, footer,
}: GameShellProps) {
  const levelPct = (level / game.levels) * 100;

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-30 glass border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={onExit}
                className="flex-shrink-0 w-9 h-9 rounded-lg glass glass-hover flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${game.accent} flex items-center justify-center text-xl shadow-lg`}>
                {game.emoji}
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-sm truncate">{game.name}</h1>
                <p className="text-[10px] text-muted-foreground truncate">
                  {CATEGORY_EMOJIS[game.category]} {CATEGORY_LABELS[game.category]}
                </p>
              </div>
            </div>
            {game.uses_mic && onToggleMic && (
              <button
                onClick={onToggleMic}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  micActive
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "glass glass-hover text-muted-foreground"
                }`}
              >
                {micActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                {micActive ? "ON" : "OFF"}
              </button>
            )}
          </div>

          {/* ─── HUD: Level / Score / Streak ─── */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="glass rounded-lg px-3 py-2 text-center">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Nível</div>
              <div className="text-lg font-bold tabular-nums">
                {level}<span className="text-xs text-muted-foreground">/{game.levels}</span>
              </div>
              {/* Level progress bar */}
              <div className="h-0.5 bg-white/5 rounded-full mt-1 overflow-hidden">
                <motion.div
                  className={`h-full bg-gradient-to-r ${game.accent}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${levelPct}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
            <div className="glass rounded-lg px-3 py-2 text-center">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Score</div>
              <motion.div
                key={score}
                initial={{ scale: 1.2, color: "#fbbf24" }}
                animate={{ scale: 1, color: "rgb(255 255 255 / 1)" }}
                transition={{ duration: 0.3 }}
                className="text-lg font-bold tabular-nums"
              >
                {score.toLocaleString("pt-BR")}
              </motion.div>
            </div>
            <div className="glass rounded-lg px-3 py-2 text-center">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Streak</div>
              <div className={`text-lg font-bold tabular-nums ${streak >= 5 ? "text-orange-400" : streak >= 2 ? "text-amber-400" : ""}`}>
                {streak > 0 ? `×${streak}` : "—"}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Mic error ─── */}
      {micError && (
        <div className="max-w-4xl mx-auto px-4 mt-3">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-200 text-sm flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold">{micError}</p>
              <p className="text-xs text-red-300/60 mt-1">
                Chrome: ícone 🔒 na barra → Permitir microfone. Firefox: Preferências → Privacidade → Microfone.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Main content ─── */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>

        {footer && <div className="mt-4">{footer}</div>}

        {onRestart && (
          <div className="mt-4">
            <button
              onClick={onRestart}
              className="px-4 py-2 glass glass-hover rounded-lg text-sm text-muted-foreground flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Recomeçar
            </button>
          </div>
        )}

        {/* Game description */}
        <div className="glass rounded-xl p-4 mt-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Sobre este jogo</div>
          <p className="text-xs text-muted-foreground/80 leading-relaxed">{game.longDescription}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {game.skills.map(s => (
              <span key={s} className="px-2 py-0.5 rounded-md bg-white/5 text-muted-foreground text-[10px]">{s}</span>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
