"use client";

/**
 * GameRouter — Roteia cada jogo pro componente correto
 */

import { GAMES_MAP } from "@/lib/games/gamesCatalog";
import { DropsGameReal, toneDropsConfig, chordDropsConfig, melodicDropsConfig } from "./DropsGameReal";
import { FlashcardGameReal, makePitchCompareRound, makeChordRound, makeScaleDegreeRound, makeIntervalRound, makeTonicFinderRound, makeCadenceRound, makeBandMatchRound, makeFlashEffectsRound, makeChordSpellsRound, makeSpeakerChordsRound, makeInversionsRound, makeArpeggioRound, makeEQMatchRound, makeFlashStylesRound, makeRhythmRound, makeKeyPuzzlesRound, makeFlashTermsRound, makeFlashNotationNotesRound } from "./FlashcardGameReal";
import { VocalMatch } from "./VocalMatch";
import { VocalDegreesMajor } from "./VocalDegreesMajor";
import { VocalStepsRepeat } from "./VocalStepsRepeat";
import { DangoBrothersReal } from "./DangoBrothersReal";
import { RhythmRepeatReal } from "./RhythmRepeatReal";
import { ChordLocksReal } from "./ChordLocksReal";
import { ChannelScrambleReal } from "./ChannelScrambleReal";
import { useMicPermission } from "@/hooks/useMicPermission";
import type { ChordType } from "@/lib/audio/musicTheory";

interface GameRouterProps { gameId: string; onExit: () => void; }

const DROPS_CONFIG = {
  "tone-drops": toneDropsConfig,
  "chord-drops": chordDropsConfig,
  "melodic-drops": melodicDropsConfig,
  "harmonic-drops": melodicDropsConfig,
  "tonal-recall": toneDropsConfig,
  "flash-intervals-melodic": melodicDropsConfig,
  "flash-intervals-harmonic": melodicDropsConfig,
};

const FLASHCARD_CONFIG: Record<string, { generateRound: (lvl: number) => ReturnType<typeof makeChordRound>; timed?: boolean; getTimeLimit?: (lvl: number) => number; numOptions?: number }> = {
  "pitch-compare": { generateRound: makePitchCompareRound },
  "speed-pitch": { generateRound: makePitchCompareRound, timed: true, getTimeLimit: (l) => Math.max(1.5, 5 - (l - 1) * 0.2) },
  "flash-chords": { generateRound: (l) => makeChordRound(l) },
  "flash-chords-quality": { generateRound: (l) => makeChordRound(l, l <= 3 ? ["major", "minor"] : ["major", "minor", "diminished", "augmented"]) },
  "triads": { generateRound: (l) => makeChordRound(l, ["major", "minor", "diminished", "augmented"]) },
  "seventh-chords": { generateRound: (l) => makeChordRound(l, ["major7", "dominant7", "minor7", "halfDiminished" as ChordType]) },
  "speed-chords": { generateRound: (l) => makeChordRound(l), timed: true, getTimeLimit: (l) => Math.max(1.5, 5 - (l - 1) * 0.2) },
  "inversions": { generateRound: makeInversionsRound },
  "arpeggios": { generateRound: makeArpeggioRound },
  "flash-tones": { generateRound: makeScaleDegreeRound },
  "number-blaster": { generateRound: makeScaleDegreeRound },
  "paddle-pitch": { generateRound: makeScaleDegreeRound },
  "flash-intervals-melodic": { generateRound: (l) => makeIntervalRound(l, false) },
  "flash-intervals-harmonic": { generateRound: (l) => makeIntervalRound(l, true) },
  "flash-notation-intervals": { generateRound: (l) => makeIntervalRound(l, false) },
  "tonic-finder": { generateRound: makeTonicFinderRound },
  "flash-cadences": { generateRound: makeCadenceRound },
  "band-match": { generateRound: makeBandMatchRound },
  "flash-effects": { generateRound: makeFlashEffectsRound },
  "chord-spells": { generateRound: makeChordSpellsRound },
  "speaker-chords": { generateRound: makeSpeakerChordsRound },
  "eq-match": { generateRound: makeEQMatchRound },
  "flash-styles-drums": { generateRound: makeFlashStylesRound },
  "rhythm-puzzles": { generateRound: makeRhythmRound },
  "flash-rhythms": { generateRound: makeRhythmRound },
  "rhythm-reader": { generateRound: makeRhythmRound },
  "key-puzzles": { generateRound: makeKeyPuzzlesRound },
  "flash-terms-performance": { generateRound: makeFlashTermsRound },
  "flash-notation-notes": { generateRound: makeFlashNotationNotesRound },
  "flash-notation-chords": { generateRound: (l) => makeChordRound(l) },
  "flash-progressions-major": { generateRound: makeSpeakerChordsRound },
  "flash-progressions-minor": { generateRound: makeSpeakerChordsRound },
  "phrase-fitter": { generateRound: (l) => makeChordRound(l) },
  "tone-trees": { generateRound: makeChordSpellsRound },
};

const SINGING_GAMES = new Set([
  "vocal-match", "vocal-degrees-major", "vocal-degrees-minor",
  "vocal-steps-repeat", "two-tones-major", "two-tones-minor",
  "three-tones-major", "three-tones-minor",
  "more-tones-major", "more-tones-minor",
  "parrot-phrases", "harmony-singing",
]);

export function GameRouter({ gameId, onExit }: GameRouterProps) {
  const game = GAMES_MAP[gameId];
  const mic = useMicPermission();

  if (!game) return <div className="min-h-screen bg-[#0a0a14] text-white flex items-center justify-center"><div className="text-center"><p className="text-xl mb-4">Jogo não encontrado</p><button onClick={onExit} className="px-4 py-2 bg-white/10 rounded">Voltar</button></div></div>;

  if (DROPS_CONFIG[gameId]) {
    return <DropsGameReal game={game} config={DROPS_CONFIG[gameId]} onExit={onExit} />;
  }

  if (FLASHCARD_CONFIG[gameId]) {
    const cfg = FLASHCARD_CONFIG[gameId];
    return <FlashcardGameReal game={game} config={cfg} onExit={onExit} />;
  }

  if (gameId === "dango-brothers") return <DangoBrothersReal onExit={onExit} />;
  if (gameId === "rhythm-repeat") return <RhythmRepeatReal onExit={onExit} />;
  if (gameId === "chord-locks") return <ChordLocksReal onExit={onExit} />;
  if (gameId === "channel-scramble") return <ChannelScrambleReal onExit={onExit} />;

  if (SINGING_GAMES.has(gameId)) {
    if (gameId === "vocal-match") return <VocalMatch onExit={onExit} micManager={mic.micManager} micActive={mic.micActive} micError={mic.micError} startMic={mic.startMic} stopMic={mic.stopMic} />;
    if (gameId === "vocal-degrees-major") return <VocalDegreesMajor onExit={onExit} micManager={mic.micManager} micActive={mic.micActive} micError={mic.micError} startMic={mic.startMic} stopMic={mic.stopMic} />;
    if (gameId === "vocal-steps-repeat") return <VocalStepsRepeat onExit={onExit} micManager={mic.micManager} micActive={mic.micActive} micError={mic.micError} startMic={mic.startMic} stopMic={mic.stopMic} />;
    return <VocalMatch onExit={onExit} micManager={mic.micManager} micActive={mic.micActive} micError={mic.micError} startMic={mic.startMic} stopMic={mic.stopMic} />;
  }

  return <FlashcardGameReal game={game} config={{ generateRound: makeChordRound }} onExit={onExit} />;
}
