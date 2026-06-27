"use client";

/**
 * MusicStaff.tsx — Renderização de pauta musical com VexFlow
 *
 * Igual ao Theta Music Trainer usa (eles usam VexFlow também!).
 * Renderiza: claves, notas, acordes, intervalos, ritmos numa pauta real.
 */

import { useEffect, useRef } from "react";
import { Renderer, Stave, StaveNote, Voice, Accidental, Formatter, Context } from "vexflow";

interface MusicStaffProps {
  /** Notas em formato VexFlow (ex: "c/4", "d/4", "e/4") */
  notes: string[];
  /** Duração de cada nota (ex: "q" = quarter, "h" = half, "w" = whole) */
  durations?: string[];
  /** Clave: "treble" | "bass" | "alto" | "tenor" */
  clef?: "treble" | "bass" | "alto" | "tenor";
  /** Armadura de clave (ex: "C", "G", "F") */
  keySignature?: string;
  /** Compasso (ex: "4/4", "3/4", "6/8") */
  timeSignature?: string;
  /** Cor das notas */
  color?: string;
  /** Largura */
  width?: number;
  /** Altura */
  height?: number;
  className?: string;
}

export function MusicStaff({
  notes,
  durations,
  clef = "treble",
  keySignature = "C",
  timeSignature = "4/4",
  color = "#ffffff",
  width = 500,
  height = 150,
  className = "",
}: MusicStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null>(null);

  useEffect(() => {
    if (!containerRef.current || notes.length === 0) return;

    // Limpar render anterior
    containerRef.current.innerHTML = "";

    try {
      const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
      renderer.resize(width, height);
      const context = renderer.getContext();
      context.setFont("Arial", 10);
      (context as unknown as { fillStyle: string }).fillStyle = color;
      (context as unknown as { strokeStyle: string }).strokeStyle = color;

      // Criar pauta
      const stave = new Stave(10, 20, width - 20);
      stave.addClef(cleff(clef));
      stave.addKeySignature(keySignature);
      if (timeSignature) stave.addTimeSignature(timeSignature);
      stave.setContext(context);
      stave.draw();

      // Criar notas
      const vexNotes = notes.map((note, i) => {
        const duration = durations?.[i] ?? "q";
        const staveNote = new StaveNote({
          keys: [note],
          duration,
          clef: cleff(clef),
        });
        // Adicionar acidentes se necessário
        if (note.includes("#")) {
          staveNote.addModifier(new Accidental("#"));
        } else if (note.includes("b") && !note.startsWith("b")) {
          staveNote.addModifier(new Accidental("b"));
        }
        return staveNote;
      });

      // Formatar e desenhar
      const voice = new Voice({ numBeats: 4, beatValue: 4 });
      voice.setStrict(false);
      voice.addTickables(vexNotes);

      new Formatter().joinVoices([voice]).format([voice], width - 60);
      voice.draw(context, stave);
    } catch (err) {
      console.error("[MusicStaff] Erro ao renderizar:", err);
    }
  }, [notes, durations, clef, keySignature, timeSignature, color, width, height]);

  return <div ref={containerRef} className={className} style={{ width, height }} />;
}

/** Converte nosso clef pro formato do VexFlow */
function cleff(c: string): "treble" | "bass" | "alto" | "tenor" {
  return c as "treble" | "bass" | "alto" | "tenor";
}

/**
 * Converte MIDI note → formato VexFlow (ex: 60 → "c/4")
 */
export function midiToVexFlow(midi: number): string {
  const NOTE_NAMES = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
  const octave = Math.floor(midi / 12) - 1;
  const noteName = NOTE_NAMES[((midi % 12) + 12) % 12];
  // VexFlow usa "c/4" não "c#/4" — sustenidos são com addModifier
  const baseNote = noteName.replace("#", "");
  return `${baseNote}/${octave}`;
}

/**
 * Converte array de MIDI notes → array de strings VexFlow
 */
export function midisToVexFlow(midis: number[]): string[] {
  return midis.map(midiToVexFlow);
}
