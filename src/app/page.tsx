"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, Eye, ChevronRight, Search, Trophy } from "lucide-react";
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

  // Filtra jogos por busca + categoria
  const filteredGames = useMemo(() => {
    let result = GAMES;
    if (activeCategory !== "all") {
      result = result.filter((g) => g.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((g) =>
        g.name.toLowerCase().includes(q) ||
        g.shortDescription.toLowerCase().includes(q) ||
        g.skills.some((s) => s.toLowerCase().includes(q))
      );
    }
    return result;
  }, [search, activeCategory]);

  if (selectedGame) {
    return <GameRouter gameId={selectedGame} onExit={() => setSelectedGame(null)} />;
  }

  const allProgress = isLoaded ? getAllProgress() : [];
  const totalPlays = allProgress.reduce((s, p) => s + p.totalPlays, 0);
  const gamesPlayed = allProgress.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a14] via-[#14142a] to-[#0a0a14] text-white">
      <header className="border-b border-white/10 backdrop-blur sticky top-0 z-20 bg-[#0a0a14]/80">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎤</span>
            <span className="font-bold tracking-tight">MasterSinger</span>
            <Badge variant="outline" className="ml-1 border-white/20 text-white/70 text-[10px]">{GAMES.length} jogos</Badge>
          </div>
          <div className="text-xs text-white/50">
            {isLoaded && totalPlays > 0 ? `${totalPlays} partidas · ${gamesPlayed}/${GAMES.length} jogos` : "Treino vocal gamificado"}
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 pt-12 pb-8 text-center">
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight mb-4 bg-gradient-to-b from-white via-indigo-200 to-purple-400 bg-clip-text text-transparent">
          50 jogos de treino musical
        </h1>
        <p className="text-white/70 max-w-2xl mx-auto text-base sm:text-lg mb-8">
          Ear training, pitch, ritmo, melodia, harmonia e canto. Detecção de pitch em tempo real via YIN.
          Inspirado no Theta Music Trainer — tudo no navegador, sem download.
        </p>
      </section>

      {/* Stats */}
      {isLoaded && totalPlays > 0 && (
        <section className="max-w-6xl mx-auto px-4 pb-6">
          <Card className="bg-white/5 border-white/10 p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><div className="text-3xl font-bold text-emerald-400 tabular-nums">{totalPlays}</div><div className="text-[10px] uppercase tracking-wider text-white/50">Partidas</div></div>
              <div><div className="text-3xl font-bold text-amber-400 tabular-nums">{gamesPlayed}/{GAMES.length}</div><div className="text-[10px] uppercase tracking-wider text-white/50">Jogos</div></div>
              <div><div className="text-3xl font-bold text-purple-400 tabular-nums">{allProgress.reduce((m, p) => Math.max(m, p.bestLevel), 0)}</div><div className="text-[10px] uppercase tracking-wider text-white/50">Nível máx</div></div>
            </div>
          </Card>
        </section>
      )}

      {/* Busca + filtros */}
      <section className="max-w-6xl mx-auto px-4 pb-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar jogo (ex: pitch, acorde, ritmo, vocal...)"
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/30"
          />
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeCategory === "all" ? "bg-white text-black" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
          >
            Todos ({GAMES.length})
          </button>
          {(Object.keys(CATEGORY_LABELS) as GameCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeCategory === cat ? `bg-gradient-to-r ${CATEGORY_COLORS[cat]} text-white` : "bg-white/5 text-white/60 hover:bg-white/10"}`}
            >
              {CATEGORY_EMOJIS[cat]} {CATEGORY_LABELS[cat]} ({GAMES_BY_CATEGORY[cat].length})
            </button>
          ))}
        </div>
      </section>

      {/* Grid de jogos */}
      <section className="max-w-6xl mx-auto px-4 pb-12">
        {filteredGames.length === 0 ? (
          <Card className="bg-white/5 border-white/10 p-12 text-center">
            <p className="text-white/60">Nenhum jogo encontrado pra "{search}"</p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredGames.map((game) => {
              const progress = getProgress(game.id);
              return (
                <Card key={game.id} className="bg-white/5 border-white/10 hover:border-white/30 transition-all cursor-pointer group overflow-hidden relative" onClick={() => setSelectedGame(game.id)}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${game.accent} opacity-5 group-hover:opacity-15 transition-opacity`} />
                  <div className="relative p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div className="text-3xl">{game.emoji}</div>
                      <div className="flex gap-1">
                        {game.uses_mic ? (
                          <Badge className="bg-emerald-700/40 text-emerald-300 border-0 text-[9px]"><Mic className="w-2.5 h-2.5 mr-0.5" /> mic</Badge>
                        ) : (
                          <Badge className="bg-indigo-700/40 text-indigo-300 border-0 text-[9px]"><Eye className="w-2.5 h-2.5 mr-0.5" /> ear</Badge>
                        )}
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">{game.name}</h3>
                    <p className="text-[11px] text-white/50 mb-3 leading-relaxed min-h-[32px]">{game.shortDescription}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {game.skills.slice(0, 2).map((s) => (
                        <span key={s} className="px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 text-[9px]">{s}</span>
                      ))}
                      {game.skills.length > 2 && <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 text-[9px]">+{game.skills.length - 2}</span>}
                    </div>
                    {progress && (
                      <div className="mb-2 text-[10px] text-white/60">
                        <div className="flex justify-between mb-0.5"><span>Nível</span><span className="font-bold text-white">{progress.bestLevel}/{game.levels}</span></div>
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full bg-gradient-to-r ${game.accent}`} style={{ width: `${(progress.bestLevel / game.levels) * 100}%` }} />
                        </div>
                      </div>
                    )}
                    <Button className={`w-full bg-gradient-to-r ${game.accent} hover:opacity-90 text-white text-xs py-2`}>
                      Jogar <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Conquistas */}
      <section className="max-w-6xl mx-auto px-4 pb-12">
        <Card className="bg-white/5 border-white/10 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white">Conquistas</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {ACHIEVEMENTS.map((a) => {
              const unlocked = (a.key === "first_play" && totalPlays > 0)
                || (a.key === "level_5" && allProgress.some((p) => p.bestLevel >= 5))
                || (a.key === "level_10" && allProgress.some((p) => p.bestLevel >= 10))
                || (a.key === "level_20" && allProgress.some((p) => p.bestLevel >= 20))
                || (a.key === "all_games" && gamesPlayed >= GAMES.length);
              return (
                <div key={a.key} className={`flex items-center gap-3 p-3 rounded-lg border ${unlocked ? "bg-amber-900/20 border-amber-700/40" : "bg-white/5 border-white/10 opacity-50"}`}>
                  <div className="text-2xl">{a.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-xs">{a.label}</div>
                    <div className="text-[10px] text-white/60 leading-tight">{a.description}</div>
                  </div>
                  {unlocked && <Badge className="bg-emerald-700/40 text-emerald-300 border-0 text-[10px]">✓</Badge>}
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <footer className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-sm text-white/50">
          <p>50 jogos de treino musical · YIN pitch detection · 100% no navegador</p>
          <p className="mt-1 text-xs">Inspirado no <a href="https://trainer.thetamusic.com/en/content/music-training-games" target="_blank" rel="noopener" className="underline hover:text-white">Theta Music Trainer</a></p>
        </div>
      </footer>
    </div>
  );
}
