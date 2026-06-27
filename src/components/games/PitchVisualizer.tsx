"use client";

/**
 * PitchVisualizer — Mostra a nota cantada em tempo real no microfone
 *
 * Componente reutilizável por todos os jogos de canto.
 * Mostra:
 *  - Nota detectada (ex: "A4")
 *  - Desvio em cents (-50 a +50)
 *  - Barra de afinador (verde se dentro de ±5 cents, amarelo se ±15, vermelho se mais)
 *  - Indicador de "ouvindo" (ponto vermelho pulsante)
 */

import { useEffect, useRef, useState } from "react";
import { MicManager, type PitchDetection } from "@/lib/audio/pitchDetector";

interface PitchVisualizerProps {
  micManager: MicManager | null;
  /** Nota alvo MIDI (se houver) */
  targetMidi?: number;
  /** Callback quando pitch é detectado */
  onPitchDetected?: (pitch: PitchDetection) => void;
  /** Calibração automática? */
  autoCalibrate?: boolean;
  className?: string;
}

export function PitchVisualizer({
  micManager,
  targetMidi,
  onPitchDetected,
  className = "",
}: PitchVisualizerProps) {
  const [pitch, setPitch] = useState<PitchDetection | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastCallbackRef = useRef(0);

  useEffect(() => {
    if (!micManager) return;

    const tick = () => {
      const det = micManager.detectPitch(0.15);
      if (det) {
        setPitch(det);
        // Throttled callback (max 30/s)
        const now = Date.now();
        if (now - lastCallbackRef.current > 33) {
          lastCallbackRef.current = now;
          onPitchDetected?.(det);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [micManager, onPitchDetected]);

  // Calcula desvio da nota alvo
  let centsFromTarget: number | null = null;
  if (pitch && !pitch.isSilent && targetMidi !== undefined) {
    centsFromTarget = Math.round((pitch.midi - targetMidi) * 100);
  }

  // Cor do afinador
  const absCents = Math.abs(centsFromTarget ?? 0);
  let color = "#ef4444"; // vermelho
  if (absCents < 5) color = "#10b981"; // verde
  else if (absCents < 15) color = "#f59e0b"; // amarelo
  else if (absCents < 30) color = "#fb923c"; // laranja

  return (
    <div className={`bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse"
            aria-hidden
          />
          <span className="text-xs uppercase tracking-wider text-white/60">Ouvindo seu microfone</span>
        </div>
        {targetMidi !== undefined && (
          <div className="text-xs text-white/60">
            Alvo: <span className="font-bold text-white">{midiToName(targetMidi)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 items-center">
        {/* Nota detectada */}
        <div className="text-center">
          <div className="text-5xl font-black tabular-nums" style={{ color: pitch && !pitch.isSilent ? color : "#6b7280" }}>
            {pitch && !pitch.isSilent ? pitch.fullName : "—"}
          </div>
          {pitch && !pitch.isSilent && (
            <>
              <div className="text-xs text-white/60 mt-1 tabular-nums">
                {pitch.frequency.toFixed(1)} Hz · conf {(pitch.confidence * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-white/60 tabular-nums">
                {pitch.centsOff > 0 ? `+${pitch.centsOff}` : pitch.centsOff} cents da nota
              </div>
            </>
          )}
          {pitch?.isSilent && (
            <div className="text-xs text-white/40 mt-1">silêncio</div>
          )}
        </div>

        {/* Barra de afinador */}
        <div>
          {centsFromTarget !== null ? (
            <>
              <div className="text-xs text-white/60 mb-2 text-center">
                {Math.abs(centsFromTarget) < 5 ? "✓ Afinado!" : `${centsFromTarget > 0 ? "+" : ""}${centsFromTarget} cents`}
              </div>
              <div className="relative h-8 bg-white/5 rounded-full overflow-hidden border border-white/10">
                {/* Marcador central (nota alvo) */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-400" style={{ left: "50%" }} />
                {/* Marcadores de ±15 e ±30 cents */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-white/20" style={{ left: `${50 + (15 / 50) * 50}%` }} />
                <div className="absolute top-0 bottom-0 w-0.5 bg-white/20" style={{ left: `${50 - (15 / 50) * 50}%` }} />
                {/* Indicador do pitch atual */}
                <div
                  className="absolute top-1 bottom-1 rounded-full transition-all duration-100"
                  style={{
                    left: `${Math.max(0, Math.min(100, 50 + (centsFromTarget / 50) * 50))}%`,
                    transform: "translateX(-50%)",
                    width: "8px",
                    background: color,
                    boxShadow: `0 0 12px ${color}`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-white/40 mt-1 tabular-nums">
                <span>-50</span><span>-25</span><span>0</span><span>+25</span><span>+50</span>
              </div>
            </>
          ) : (
            <div className="h-8 flex items-center justify-center text-white/40 text-xs">
              {targetMidi !== undefined ? "Cante a nota alvo" : "Cante qualquer nota"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function midiToName(midi: number): string {
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const noteIdx = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[noteIdx]}${octave}`;
}
