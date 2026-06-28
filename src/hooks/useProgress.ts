/**
 * useProgress — Hook pra persistir progresso dos jogos no localStorage
 */

"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "music_game_center_progress_v1";

export interface GameProgress {
  gameId: string;
  level: number;
  bestLevel: number;
  totalPlays: number;
  bestScore: number;
  lastPlayed: string; // ISO date
}

interface ProgressData {
  games: Record<string, GameProgress>;
  achievements: Record<string, { unlockedAt: string }>;
}

function load(): ProgressData {
  if (typeof window === "undefined") return { games: {}, achievements: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { games: {}, achievements: {} };
  } catch {
    return { games: {}, achievements: {} };
  }
}

function save(data: ProgressData): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* */ }
}

export function useProgress() {
  const [data, setData] = useState<ProgressData | null>(null);

  useEffect(() => { setData(load()); }, []);

  const recordPlay = useCallback((gameId: string, level: number, score: number) => {
    setData((prev) => {
      const cur = prev ?? load();
      const existing = cur.games[gameId] ?? {
        gameId, level: 1, bestLevel: 1, totalPlays: 0, bestScore: 0, lastPlayed: "",
      };
      const updated: GameProgress = {
        ...existing,
        level: Math.max(existing.level, level),
        bestLevel: Math.max(existing.bestLevel, level),
        totalPlays: existing.totalPlays + 1,
        bestScore: Math.max(existing.bestScore, score),
        lastPlayed: new Date().toISOString(),
      };
      const newData: ProgressData = {
        ...cur,
        games: { ...cur.games, [gameId]: updated },
      };
      save(newData);
      return newData;
    });
  }, []);

  const unlockAchievement = useCallback((key: string) => {
    setData((prev) => {
      const cur = prev ?? load();
      if (cur.achievements[key]) return prev;
      const newData: ProgressData = {
        ...cur,
        achievements: { ...cur.achievements, [key]: { unlockedAt: new Date().toISOString() } },
      };
      save(newData);
      return newData;
    });
  }, []);

  const getProgress = useCallback((gameId: string): GameProgress | null => {
    if (!data) return null;
    return data.games[gameId] ?? null;
  }, [data]);

  const getAllProgress = useCallback((): GameProgress[] => {
    if (!data) return [];
    return Object.values(data.games);
  }, [data]);

  return {
    recordPlay,
    unlockAchievement,
    getProgress,
    getAllProgress,
    isLoaded: data !== null,
  };
}

export const ACHIEVEMENTS = [
  { key: "first_play", label: "Primeira Nota", description: "Jogue qualquer jogo pela 1ª vez", emoji: "🎵" },
  { key: "level_5", label: "Em Progresso", description: "Alcance o nível 5 em qualquer jogo", emoji: "⭐" },
  { key: "level_10", label: "Avançado", description: "Alcance o nível 10 em qualquer jogo", emoji: "🏆" },
  { key: "level_20", label: "Mestre Vocal", description: "Alcance o nível 20 em qualquer jogo", emoji: "🎤" },
  { key: "all_games", label: "Explorador", description: "Jogue os 6 jogos pelo menos uma vez", emoji: "🗺️" },
  { key: "perfect_pitch", label: "Pitch Perfeito", description: "Acerte 50 notas seguidas em Vocal Match", emoji: "✨" },
  { key: "speed_demon", label: "Velocista", description: "Alcance nível 15 no Speed Pitch", emoji: "⚡" },
];
