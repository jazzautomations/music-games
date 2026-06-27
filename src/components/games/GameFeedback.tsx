"use client";

/**
 * GameFeedback.tsx — Feedback visual rico para todos os jogos
 *
 * Animações com Framer Motion: acerto, erro, combo, level up.
 */

import { motion, AnimatePresence } from "framer-motion";

/** Feedback flutuante de acerto/erro */
export function FloatingFeedback({
  show,
  type,
  text,
  subtext,
}: {
  show: boolean;
  type: "correct" | "wrong" | "perfect" | "combo";
  text: string;
  subtext?: string;
}) {
  const colors = {
    correct: "#10b981",
    wrong: "#ef4444",
    perfect: "#fbbf24",
    combo: "#f97316",
  };
  const emojis = {
    correct: "✓",
    wrong: "✗",
    perfect: "✨",
    combo: "🔥",
  };
  const color = colors[type];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, opacity: 0, y: 0 }}
          animate={{ scale: 1.2, opacity: 1, y: -20 }}
          exit={{ scale: 0.8, opacity: 0, y: -60 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="fixed top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-50 text-center"
        >
          <div className="text-5xl mb-2">{emojis[type]}</div>
          <div
            className="text-4xl font-black tracking-tight"
            style={{ color, textShadow: `0 0 24px ${color}, 0 0 8px ${color}` }}
          >
            {text}
          </div>
          {subtext && (
            <div className="text-sm text-white/60 mt-2">{subtext}</div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Barra de progresso do nível com animação */
export function LevelProgressBar({
  current,
  total,
  color = "#10b981",
}: {
  current: number;
  total: number;
  color?: string;
}) {
  const pct = (current / total) * 100;
  return (
    <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
      <motion.div
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}, ${color}aa)` }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.3 }}
      />
    </div>
  );
}

/** Banner de nível completo */
export function LevelCompleteBanner({
  show,
  level,
  score,
  bonus = 50,
  onNext,
}: {
  show: boolean;
  level: number;
  score: number;
  bonus?: number;
  onNext: () => void;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur"
        >
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-emerald-900/60 to-teal-900/40 border border-emerald-500/40 rounded-2xl p-8 text-center max-w-md"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.4, type: "spring" }}
              className="text-6xl mb-3"
            >
              🎉
            </motion.div>
            <h2 className="text-3xl font-bold text-emerald-300 mb-2">Nível {level} Completo!</h2>
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Bônus</span>
                <span className="text-emerald-400 font-bold">+{bonus}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Score total</span>
                <span className="text-white font-bold">{score}</span>
              </div>
            </div>
            <button
              onClick={onNext}
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold transition-colors"
            >
              Próximo nível →
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Indicador de combo com pulse */
export function ComboIndicator({ combo }: { combo: number }) {
  if (combo < 2) return null;
  const multiplier = (1 + Math.min(combo, 20) * 0.1).toFixed(1);
  return (
    <motion.div
      key={combo}
      initial={{ scale: 1.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-2"
    >
      <span className="text-orange-400 font-bold text-lg">🔥 ×{combo}</span>
      <span className="text-orange-400/60 text-xs">({multiplier}x pts)</span>
    </motion.div>
  );
}

/** HUD card com animação de update */
export function StatCard({
  label,
  value,
  color = "#ffffff",
  icon,
}: {
  label: string;
  value: string | number;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1 flex items-center justify-center gap-1">
        {icon}
        {label}
      </div>
      <motion.div
        key={String(value)}
        initial={{ scale: 1.3, color: "#fbbf24" }}
        animate={{ scale: 1, color }}
        transition={{ duration: 0.3 }}
        className="text-2xl font-bold tabular-nums"
        style={{ color }}
      >
        {value}
      </motion.div>
    </div>
  );
}
