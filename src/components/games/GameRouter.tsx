"use client";

/**
 * GameRouter — Roteia o jogo correto baseado no ID
 *
 * - Jogos de microfone (singing): usam VocalMatch/VocalDegreesMajor/VocalStepsRepeat
 *   (já existentes do projeto anterior)
 * - Jogos de multiple-choice: usam MultipleChoiceGame com o gerador correto
 * - Jogos específicos (Tone Drops, Dango Brothers, Speed Pitch): usam componentes próprios
 */

import { GAMES_MAP, type GameDef } from "@/lib/games/gamesCatalog";
import { MultipleChoiceGame } from "./MultipleChoiceGame";
import { VocalMatch } from "./VocalMatch";
import { VocalDegreesMajor } from "./VocalDegreesMajor";
import { VocalStepsRepeat } from "./VocalStepsRepeat";
import { DangoBrothers } from "./DangoBrothers";
import { SpeedPitch } from "./SpeedPitch";
import { ToneDropsReal } from "./ToneDropsReal";
import { useMicPermission } from "@/hooks/useMicPermission";
import * as gen from "@/lib/games/roundGenerators";

interface GameRouterProps {
  gameId: string;
  onExit: () => void;
}

/** Mapa de jogos que usam MultipleChoiceGame com gerador específico */
const MC_GAMES: Record<string, { generator: (level: number) => import("@/components/games/MultipleChoiceGame").MCRound; timed?: boolean }> = {
  "channel-scramble": { generator: gen.genChannelScramble },
  "band-match": { generator: gen.genBandMatch },
  "eq-match": { generator: gen.genEQMatch },
  "flash-effects": { generator: gen.genFlashEffects },
  "flash-terms-performance": { generator: gen.genFlashTerms },
  "pitch-compare": { generator: gen.genPitchCompare },
  "rhythm-puzzles": { generator: gen.genRhythmPuzzles },
  "flash-rhythms": { generator: gen.genFlashRhythms },
  "rhythm-repeat": { generator: gen.genRhythmRepeat },
  "rhythm-reader": { generator: gen.genRhythmReader },
  "flash-styles-drums": { generator: gen.genFlashStylesDrums },
  "tonic-finder": { generator: gen.genTonicFinder },
  "flash-notation-notes": { generator: gen.genFlashNotationNotes },
  "key-puzzles": { generator: gen.genKeyPuzzles },
  "number-blaster": { generator: gen.genNumberBlaster },
  "paddle-tones": { generator: gen.genPaddleTones },
  "tonal-recall": { generator: gen.genTonalRecall },
  "flash-tones": { generator: gen.genFlashTones },
  "melodic-drops": { generator: gen.genMelodicDrops },
  "harmonic-drops": { generator: gen.genHarmonicDrops },
  "flash-intervals-melodic": { generator: gen.genFlashIntervalsMelodic },
  "flash-intervals-harmonic": { generator: gen.genFlashIntervalsHarmonic },
  "flash-notation-intervals": { generator: gen.genFlashNotationIntervals },
  "chord-drops": { generator: gen.genChordDrops },
  "flash-chords": { generator: gen.genFlashChords },
  "tone-trees": { generator: gen.genToneTrees },
  "phrase-fitter": { generator: gen.genPhraseFitter },
  "speed-chords": { generator: gen.genSpeedChords, timed: true },
  "flash-chords-quality": { generator: gen.genFlashChordsQuality },
  "flash-notation-chords": { generator: gen.genFlashNotationChords },
  "chord-spells": { generator: gen.genChordSpells },
  "chord-locks": { generator: gen.genChordLocks },
  "speaker-chords": { generator: gen.genSpeakerChords },
  "flash-progressions-major": { generator: gen.genFlashProgressionsMajor },
  "flash-progressions-minor": { generator: gen.genFlashProgressionsMinor },
  "flash-cadences": { generator: gen.genFlashCadences },
  "triads": { generator: gen.genTriads },
  "seventh-chords": { generator: gen.genSeventhChords },
  "inversions": { generator: gen.genInversions },
  "arpeggios": { generator: gen.genArpeggios },
};

/** Jogos de microfone (singing) */
const SINGING_GAMES = new Set([
  "vocal-match", "vocal-degrees-major", "vocal-degrees-minor",
  "vocal-steps-repeat", "two-tones-major", "two-tones-minor",
  "three-tones-major", "three-tones-minor",
  "more-tones-major", "more-tones-minor",
  "parrot-phrases", "harmony-singing",
]);

/** Jogos com componentes próprios */
const CUSTOM_GAMES = new Set([
  "dango-brothers", "speed-pitch", "tone-drops",
]);

export function GameRouter({ gameId, onExit }: GameRouterProps) {
  const game = GAMES_MAP[gameId];
  const mic = useMicPermission();

  if (!game) {
    return (
      <div className="min-h-screen bg-[#0a0a14] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">Jogo não encontrado: {gameId}</p>
          <button onClick={onExit} className="px-4 py-2 bg-white/10 rounded">Voltar</button>
        </div>
      </div>
    );
  }

  // Jogos com componentes próprios
  if (gameId === "dango-brothers") return <DangoBrothers onExit={onExit} />;
  if (gameId === "speed-pitch") return <SpeedPitch onExit={onExit} />;
  if (gameId === "tone-drops") return <ToneDropsReal onExit={onExit} />;

  // Jogos de microfone — usa VocalMatch como base (mesma mecânica)
  // Para os jogos de singing que não têm componente próprio, usa VocalMatch com config diferente
  if (SINGING_GAMES.has(gameId)) {
    // Vocal Match, Vocal Degrees Major, Vocal Steps Repeat têm componentes próprios
    if (gameId === "vocal-match") return <VocalMatch onExit={onExit} micManager={mic.micManager} micActive={mic.micActive} micError={mic.micError} startMic={mic.startMic} stopMic={mic.stopMic} />;
    if (gameId === "vocal-degrees-major") return <VocalDegreesMajor onExit={onExit} micManager={mic.micManager} micActive={mic.micActive} micError={mic.micError} startMic={mic.startMic} stopMic={mic.stopMic} />;
    if (gameId === "vocal-steps-repeat") return <VocalStepsRepeat onExit={onExit} micManager={mic.micManager} micActive={mic.micActive} micError={mic.micError} startMic={mic.startMic} stopMic={mic.stopMic} />;

    // Outros jogos de singing usam VocalMatch como fallback
    return <VocalMatch onExit={onExit} micManager={mic.micManager} micActive={mic.micActive} micError={mic.micError} startMic={mic.startMic} stopMic={mic.stopMic} />;
  }

  // Multiple Choice games
  if (MC_GAMES[gameId]) {
    const config = MC_GAMES[gameId];
    return (
      <MultipleChoiceGame
        game={game}
        onExit={onExit}
        generateRound={config.generator}
        timed={config.timed}
      />
    );
  }

  // Fallback: MultipleChoiceGame genérico
  return (
    <MultipleChoiceGame
      game={game}
      onExit={onExit}
      generateRound={() => ({
        play: () => {},
        options: [{ label: "Em breve", correct: true }],
        prompt: "Este jogo será implementado em breve.",
      })}
    />
  );
}
