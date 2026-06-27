"use client";

/**
 * PitchCircle.tsx — Círculo de notas com indicador de pitch detectado
 *
 * Igual ao PitchCircle do Theta Music Trainer.
 * Mostra as 12 notas num círculo. A nota detectada pelo microfone
 * acende e cresce. As barras ao redor mostram a confiança.
 */

import { motion } from "framer-motion";
import type { PitchDetection } from "@/lib/audio/pitchDetector";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SOLFEGE = ["Do", "Di", "Re", "Ra", "Mi", "Fa", "Fi", "Sol", "Si", "La", "Li", "Ti"];

interface PitchCircleProps {
  pitch: PitchDetection | null;
  /** Nota alvo (MIDI) — se houver, destaca no círculo */
  targetMidi?: number;
  /** Tamanho em px */
  size?: number;
  /** Mostrar solfege em vez de nomes? */
  useSolfege?: boolean;
  /** Tonalidade atual (pra destacar notas da escala) */
  keyMidi?: number;
  scaleType?: "major" | "minor";
}

export function PitchCircle({
  pitch,
  targetMidi,
  size = 240,
  useSolfege = false,
  keyMidi,
  scaleType = "major",
}: PitchCircleProps) {
  const center = size / 2;
  const radius = size * 0.35;
  const innerRadius = size * 0.22;

  // Notas da escala (pra destacar)
  const scaleSemitones = scaleType === "major"
    ? [0, 2, 4, 5, 7, 9, 11]
    : [0, 2, 3, 5, 7, 8, 10];
  const keySemitone = keyMidi !== undefined ? ((keyMidi % 12) + 12) % 12 : 0;
  const inScale = scaleSemitones.map(s => (s + keySemitone) % 12);

  // Nota detectada atual
  const detectedIdx = pitch && !pitch.isSilent
    ? ((pitch.midiRounded % 12) + 12) % 12
    : -1;

  // Nota alvo
  const targetIdx = targetMidi !== undefined
    ? ((targetMidi % 12) + 12) % 12
    : -1;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Círculo externo */}
        <circle cx={center} cy={center} r={radius + 8} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        <circle cx={center} cy={center} r={innerRadius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />

        {/* 12 notas ao redor do círculo */}
        {NOTE_NAMES.map((note, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180); // -90 pra começar em C no topo
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          const isDetected = i === detectedIdx;
          const isTarget = i === targetIdx;
          const isInScale = inScale.includes(i);
          const isCorrect = isDetected && isTarget;

          // Tamanho e cor baseados no estado
          const noteRadius = isDetected ? 20 : isTarget ? 16 : 13;
          let bgColor = "rgba(255,255,255,0.05)";
          let textColor = "rgba(255,255,255,0.4)";
          let borderColor = "rgba(255,255,255,0.1)";

          if (isInScale) {
            bgColor = "rgba(99,102,241,0.15)";
            textColor = "rgba(199,210,254,0.8)";
          }
          if (isTarget) {
            bgColor = "rgba(251,191,36,0.3)";
            textColor = "#fbbf24";
            borderColor = "rgba(251,191,36,0.5)";
          }
          if (isDetected) {
            bgColor = isCorrect ? "rgba(16,185,129,0.5)" : "rgba(244,63,94,0.4)";
            textColor = "#ffffff";
            borderColor = isCorrect ? "#10b981" : "#f43f5e";
          }

          const label = useSolfege ? SOLFEGE[i] : note;

          return (
            <g key={i}>
              {/* Linha do centro pra nota (se detectada) */}
              {isDetected && (
                <motion.line
                  x1={center}
                  y1={center}
                  x2={x}
                  y2={y}
                  stroke={isCorrect ? "#10b981" : "#f43f5e"}
                  strokeWidth={2}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                />
              )}
              {/* Círculo da nota */}
              <motion.circle
                cx={x}
                cy={y}
                r={noteRadius}
                fill={bgColor}
                stroke={borderColor}
                strokeWidth={2}
                animate={{
                  scale: isDetected ? [1, 1.15, 1] : 1,
                }}
                transition={{ duration: 0.3 }}
                style={{ transformOrigin: `${x}px ${y}px` }}
              />
              {/* Texto da nota */}
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fontSize={isDetected ? 14 : 11}
                fontWeight={isDetected || isTarget ? 700 : 400}
                fill={textColor}
                fontFamily="system-ui, sans-serif"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Centro: cents off */}
        {pitch && !pitch.isSilent && (
          <text
            x={center}
            y={center - 5}
            textAnchor="middle"
            fontSize={20}
            fontWeight={800}
            fill={Math.abs(pitch.centsOff) < 5 ? "#10b981" : Math.abs(pitch.centsOff) < 15 ? "#fbbf24" : "#f43f5e"}
            fontFamily="system-ui, sans-serif"
          >
            {pitch.centsOff > 0 ? "+" : ""}{pitch.centsOff}
          </text>
        )}
        {pitch && !pitch.isSilent && (
          <text
            x={center}
            y={center + 12}
            textAnchor="middle"
            fontSize={9}
            fill="rgba(255,255,255,0.4)"
            fontFamily="system-ui, sans-serif"
          >
            cents
          </text>
        )}
        {(!pitch || pitch.isSilent) && (
          <text
            x={center}
            y={center + 4}
            textAnchor="middle"
            fontSize={11}
            fill="rgba(255,255,255,0.3)"
            fontFamily="system-ui, sans-serif"
          >
            cante
          </text>
        )}
      </svg>
    </div>
  );
}
