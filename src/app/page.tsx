"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Eye, ChevronRight, Search, Trophy, Sparkles, Volume2, TrendingUp, Gamepad2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GAMES, GAMES_BY_CATEGORY, CATEGORY_LABELS, CATEGORY_EMOJIS,
  CATEGORY_COLORS, type GameCategory,
} from "@/lib/games/gamesCatalog";
import { GameRouter } from "@/components/games/GameRouter";
import { useProgress, ACHIEVEMENTS } from "@/hooks/useProgress";

export default function Home() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<GameCategory | "all">("all");
  const { getProgress, getAllProgress, isLoaded } = useProgress();

  const filteredGames = useMemo(() => {
    let result = GAMES;
    if (activeCategory !== "all") result = result.filter(g => g.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(g =>
        g.name.toLowerCase().includes(q) ||
        g.shortDescription.toLowerCase().includes(q) ||
        g.skills.some(s => s.toLowerCase().includes(q))
      );
    }
    return result;
  }, [search, activeCategory]);

  if (selectedGame) return <GameRouter gameId={selectedGame} onExit={() => setSelectedGame(null)} />;

  const allProgress = isLoaded ? getAllProgress() : [];
  const totalPlays = allProgress.reduce((s, p) => s + p.totalPlays, 0);
  const gamesPlayed = allProgress.length;
  const maxLevel = allProgress.reduce((m, p) => Math.max(m, p.bestLevel), 0);

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-30 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xl shadow-lg shadow-violet-500/30">
                🎵
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-background animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">Music Game Center</h1>
              <p className="text-[10px] text-muted-foreground -mt-0.5">{GAMES.length} jogos · treino musical</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isLoaded && totalPlays > 0 && (
              <div className="hidden sm:flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1 text-muted-foreground"><TrendingUp className="w-3 h-3" /> {totalPlays} partidas</span>
                <span className="flex items-center gap-1 text-muted-foreground"><Gamepad2 className="w-3 h-3" /> {gamesPlayed}/{GAMES.length}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-10 text-center overflow-hidden">
        {/* Animated background blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-20 left-10 w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-32 right-10 w-[300px] h-[300px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-6">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs font-medium text-violet-300">Som de instrumentos reais · Pitch detection YIN</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight mb-6">
            <span className="text-gradient">Treino musical</span>
            <br />
            <span className="text-foreground">gamificado de verdade</span>
          </h1>

          <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg mb-10 leading-relaxed">
            50 jogos de ear training, pitch, ritmo, melodia, harmonia e canto.
            Instrumentos reais gravados (piano, violão, flauta, violino).
            Detecção de pitch por autocorrelação. Inspirado no Theta Music Trainer.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <Button
              size="lg"
              onClick={() => setSelectedGame("vocal-match")}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-8 py-6 text-base font-bold shadow-lg shadow-violet-600/30"
            >
              <Mic className="w-5 h-5 mr-2" /> Começar a cantar
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setSelectedGame("flash-chords")}
              className="glass glass-hover border-white/10 text-foreground hover:text-foreground px-8 py-6 text-base"
            >
              <Volume2 className="w-5 h-5 mr-2" /> Treinar ouvido
            </Button>
          </div>

          {/* Stats */}
          {isLoaded && totalPlays > 0 && (
            <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
              {[
                { label: "Partidas", value: totalPlays, icon: TrendingUp, color: "text-emerald-400" },
                { label: "Jogos", value: `${gamesPlayed}/${GAMES.length}`, icon: Gamepad2, color: "text-violet-400" },
                { label: "Nível máx", value: maxLevel, icon: Trophy, color: "text-amber-400" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="glass rounded-2xl p-4 text-center"
                >
                  <stat.icon className={`w-4 h-4 mx-auto mb-1 ${stat.color}`} />
                  <div className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </section>

      {/* ─── Busca + Filtros ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar jogo (pitch, acorde, ritmo, vocal...)"
            className="w-full pl-11 pr-4 py-3 glass rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/30"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeCategory === "all"
                ? "bg-white text-black shadow-lg"
                : "glass glass-hover text-muted-foreground"
            }`}
          >
            Todos ({GAMES.length})
          </button>
          {(Object.keys(CATEGORY_LABELS) as GameCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeCategory === cat
                  ? `bg-gradient-to-r ${CATEGORY_COLORS[cat]} text-white shadow-lg`
                  : "glass glass-hover text-muted-foreground"
              }`}
            >
              {CATEGORY_EMOJIS[cat]} {CATEGORY_LABELS[cat]} ({GAMES_BY_CATEGORY[cat].length})
            </button>
          ))}
        </div>
      </section>

      {/* ─── Grid de jogos ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        {filteredGames.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <p className="text-muted-foreground">Nenhum jogo encontrado pra "{search}"</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredGames.map((game, idx) => {
                const progress = getProgress(game.id);
                return (
                  <motion.div
                    key={game.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.3) }}
                    onClick={() => setSelectedGame(game.id)}
                    className="group relative glass glass-hover rounded-2xl overflow-hidden cursor-pointer"
                  >
                    {/* Gradient overlay on hover */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${game.accent} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />

                    {/* Glow border on hover */}
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${game.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} style={{ padding: "1px", mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }} />

                    <div className="relative p-5">
                      {/* Top row: emoji + mic/ear badge */}
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${game.accent} bg-opacity-20 flex items-center justify-center text-2xl shadow-lg`}>
                          {game.emoji}
                        </div>
                        <div className="flex gap-1">
                          {game.uses_mic ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[9px] font-semibold flex items-center gap-0.5">
                              <Mic className="w-2.5 h-2.5" /> MIC
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 text-[9px] font-semibold flex items-center gap-0.5">
                              <Eye className="w-2.5 h-2.5" /> EAR
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title + description */}
                      <h3 className="font-bold text-sm mb-1 text-foreground">{game.name}</h3>
                      <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed line-clamp-2 min-h-[32px]">{game.shortDescription}</p>

                      {/* Skills */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {game.skills.slice(0, 2).map(s => (
                          <span key={s} className="px-1.5 py-0.5 rounded-md bg-white/5 text-muted-foreground text-[9px]">{s}</span>
                        ))}
                        {game.skills.length > 2 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-muted-foreground text-[9px]">+{game.skills.length - 2}</span>
                        )}
                      </div>

                      {/* Progress bar */}
                      {progress && (
                        <div className="mb-3">
                          <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
                            <span>Nível {progress.bestLevel}</span>
                            <span>{progress.bestLevel}/{game.levels}</span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${game.accent} rounded-full`}
                              style={{ width: `${(progress.bestLevel / game.levels) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Play button */}
                      <button
                        className={`w-full py-2.5 rounded-lg bg-gradient-to-r ${game.accent} text-white text-xs font-bold flex items-center justify-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity`}
                      >
                        Jogar <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* ─── Conquistas ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-amber-400" />
            </div>
            <h2 className="text-lg font-bold">Conquistas</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ACHIEVEMENTS.map(a => {
              const unlocked = (a.key === "first_play" && totalPlays > 0)
                || (a.key === "level_5" && allProgress.some(p => p.bestLevel >= 5))
                || (a.key === "level_10" && allProgress.some(p => p.bestLevel >= 10))
                || (a.key === "level_20" && allProgress.some(p => p.bestLevel >= 20))
                || (a.key === "all_games" && gamesPlayed >= GAMES.length);
              return (
                <div
                  key={a.key}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    unlocked
                      ? "bg-amber-500/10 border-amber-500/30"
                      : "bg-white/2 border-white/5 opacity-50"
                  }`}
                >
                  <div className={`text-2xl ${unlocked ? "" : "grayscale"}`}>{a.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs text-foreground">{a.label}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{a.description}</div>
                  </div>
                  {unlocked && <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] text-emerald-400">✓</div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/5 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 text-center">
          <p className="text-xs text-muted-foreground mb-1">
            50 jogos · Instrumentos reais (FluidR3_GM) · Pitch detection YIN · 100% no navegador
          </p>
          <p className="text-[10px] text-muted-foreground/60">
            Inspirado no{" "}
            <a href="https://trainer.thetamusic.com/en/content/music-training-games" target="_blank" rel="noopener" className="underline hover:text-foreground">
              Theta Music Trainer
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
