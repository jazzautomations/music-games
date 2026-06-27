"use client";

/**
 * GameShell — Layout comum pra todos os jogos
 *
 * Fornece: header com botão voltar + título + badge de categoria,
 * HUD com nível/score/streak, área de conteúdo, e botões de controle.
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, RotateCcw, Mic, MicOff, Trophy } from "lucide-react";
import type { GameDef } from "@/lib/games/gamesCatalog";
import { CATEGORY_LABELS, CATEGORY_EMOJIS } from "@/lib/games/gamesCatalog";

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
  /** Conteúdo extra (ex: controles específicos do jogo) */
  footer?: React.ReactNode;
}

export function GameShell({
  game,
  level,
  score,
  streak,
  onExit,
  onRestart,
  micActive,
  onToggleMic,
  micError,
  children,
  footer,
}: GameShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a14] via-[#14142a] to-[#0a0a14] text-white flex flex-col">
      <header className="border-b border-white/10 backdrop-blur sticky top-0 z-20 bg-[#0a0a14]/80">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onExit} className="p-1">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <span>{game.emoji}</span>
                <span>{game.name}</span>
              </h1>
              <p className="text-[11px] text-white/60 -mt-0.5">
                {CATEGORY_EMOJIS[game.category]} {CATEGORY_LABELS[game.category]} · {game.shortDescription}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {game.uses_mic && onToggleMic && (
              <Button
                variant={micActive ? "default" : "outline"}
                size="sm"
                onClick={onToggleMic}
                className={micActive ? "bg-emerald-600 hover:bg-emerald-700" : "border-white/20"}
              >
                {micActive ? <><Mic className="w-4 h-4 mr-1.5" /> ON</> : <><MicOff className="w-4 h-4 mr-1.5" /> OFF</>}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        {micError && (
          <Card className="mb-4 border-red-500/50 bg-red-950/40 p-4 text-red-200">
            <p className="text-sm font-semibold">⚠️ {micError}</p>
          </Card>
        )}

        {/* HUD */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card className="bg-white/5 border-white/10 p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-white/50">Nível</div>
            <div className="text-2xl font-bold tabular-nums">{level}<span className="text-xs text-white/50">/{game.levels}</span></div>
          </Card>
          <Card className="bg-white/5 border-white/10 p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-white/50">Score</div>
            <div className="text-2xl font-bold tabular-nums">{score}</div>
          </Card>
          <Card className="bg-white/5 border-white/10 p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-white/50">Streak</div>
            <div className="text-2xl font-bold text-emerald-400 tabular-nums">{streak}</div>
          </Card>
        </div>

        {/* Conteúdo do jogo */}
        {children}

        {/* Footer com controles */}
        {footer && <div className="mt-4">{footer}</div>}

        {onRestart && (
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={onRestart} className="border-white/20">
              <RotateCcw className="w-4 h-4 mr-1" /> Recomeçar
            </Button>
          </div>
        )}

        {/* Descrição */}
        <Card className="bg-white/5 border-white/10 p-3 mt-4 text-xs text-white/60">
          <div className="font-semibold text-white/80 mb-1">💡 Sobre</div>
          {game.longDescription}
          <div className="mt-2 flex flex-wrap gap-1">
            {game.skills.map((s) => (
              <span key={s} className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-[10px]">{s}</span>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}
