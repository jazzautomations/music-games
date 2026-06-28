# Music Game Center 🎤

> 50 jogos de treino musical — ear training, pitch, ritmo, melodia, harmonia e canto. Tudo no navegador, sem download.

## ✨ Features

### 🎮 50 jogos em 6 categorias

#### 🔊 Som (5 jogos)
- Channel Scramble, Band Match, EQ Match, Flash Effects, Flash Terms

#### 🎵 Pitch (4 jogos)
- Pitch Compare, Speed Pitch, Dango Brothers, Vocal Match

#### 🥁 Ritmo (5 jogos)
- Rhythm Puzzles, Flash Rhythms, Rhythm Repeat, Rhythm Reader, Flash Styles (Drums)

#### 🎼 Tonalidade (10 jogos)
- Tonic Finder, Flash Notation (Notes), Key Puzzles, Number Blaster, Paddle Tones, Tone Drops, Tonal Recall, Vocal Degrees (Major/Minor), Flash Tones

#### 🎶 Melodia (13 jogos)
- Melodic Drops, Harmonic Drops, Flash Intervals (Melodic/Harmonic), Two Tones (Major/Minor), Three Tones (Major/Minor), More Tones (Major/Minor), Flash Notation (Intervals), Parrot Phrases, Vocal Steps (Repeat)

#### 🎸 Harmonia (18 jogos)
- Chord Drops, Flash Chords, Tone Trees, Phrase Fitter, Speed Chords, Flash Chords (Quality), Flash Notation (Chords), Chord Spells, Chord Locks, Speaker Chords, Flash Progressions (Major/Minor), Flash Cadences, Triads, Seventh Chords, Inversions, Arpeggios, Harmony Singing

### 🎯 Engine de detecção de pitch
- **Algoritmo YIN** (de Cheveigné & Kawahara, 2002) — padrão da indústria pra voz humana
- **Precisão sub-cent**
- **Detecção em tempo real** a cada frame (~16ms)
- **Feedback visual** com nota + cents + barra colorida

### 🏆 Sistema de progresso
- 20 níveis por jogo
- Scores, streaks, e achievements
- Persistência local via localStorage

### 🔍 Home com busca e filtros
- Busca por nome/skill
- Filtro por categoria
- Stats globais (partidas, jogos, nível máx)

## 🛠️ Stack
- **Next.js 16** + **TypeScript 5** + **Tailwind CSS 4** + **shadcn/ui**
- **Web Audio API** (AnalyserNode + OscillatorNode)
- 100% client-side

## 🚀 Como rodar
```bash
bun install
bun run dev  # http://localhost:3000
```

## 🌐 Deploy
Push pro GitHub → import em vercel.com/new → deploy.

## 📁 Estrutura
```
src/
├── app/page.tsx              # Home com 50 jogos + busca + filtros
├── components/games/
│   ├── GameShell.tsx         # Layout comum (header + HUD + footer)
│   ├── MultipleChoiceGame.tsx # Componente genérico (~40 jogos)
│   ├── GameRouter.tsx        # Roteia jogo → componente
│   ├── PitchVisualizer.tsx   # Nota + cents em tempo real
│   ├── VocalMatch.tsx        # Jogo de canto (mic)
│   ├── VocalDegreesMajor.tsx # Canto de scale degrees (mic)
│   ├── VocalStepsRepeat.tsx  # Sight-singing (mic)
│   ├── DangoBrothers.tsx     # Tuning game (ear)
│   ├── SpeedPitch.tsx        # Pitch compare cronometrado (ear)
│   └── ToneDrops.tsx         # Falling objects (ear)
├── hooks/
│   ├── useProgress.ts        # localStorage + achievements
│   └── useMicPermission.ts   # Mic manager
└── lib/
    ├── audio/
    │   ├── pitchDetector.ts  # YIN + MicManager + playTone/Melody/Chord
    │   └── musicTheory.ts    # Escalas, intervalos, acordes
    └── games/
        ├── gamesCatalog.ts   # Catálogo dos 50 jogos
        └── roundGenerators.ts # Geradores de round por jogo
```

## 🎨 Créditos
- Jogos inspirados no [Theta Music Trainer](https://trainer.thetamusic.com/en/content/music-training-games)
- YIN: de Cheveigné & Kawahara, 2002

## 📝 Licença
MIT
