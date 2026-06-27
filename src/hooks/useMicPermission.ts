"use client";

/**
 * useMicPermission — Hook pra gerenciar permissão de microfone
 *
 * Cria um MicManager singleton e expõe funções pra ativar/desativar.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { MicManager } from "@/lib/audio/pitchDetector";

export function useMicPermission() {
  const [micManager, setMicManager] = useState<MicManager | null>(null);
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const managerRef = useRef<MicManager | null>(null);

  const startMic = useCallback(async () => {
    setMicError(null);
    try {
      if (!managerRef.current) managerRef.current = new MicManager();
      await managerRef.current.start(2048);
      setMicManager(managerRef.current);
      setMicActive(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      let friendly = `Erro: ${msg}`;
      if (msg.includes("Permission denied") || msg.includes("NotAllowedError")) {
        friendly = "Permissão de microfone negada. Clique no ícone de microfone na barra do navegador e permita.";
      } else if (msg.includes("NotFoundError")) {
        friendly = "Nenhum microfone encontrado. Conecte um microfone e recarregue.";
      } else if (msg.includes("NotReadableError")) {
        friendly = "Microfone em uso por outro app. Feche outros apps.";
      }
      setMicError(friendly);
      setMicActive(false);
    }
  }, []);

  const stopMic = useCallback(() => {
    managerRef.current?.stop();
    managerRef.current = null;
    setMicManager(null);
    setMicActive(false);
  }, []);

  useEffect(() => {
    return () => {
      managerRef.current?.stop();
    };
  }, []);

  return { micManager, micActive, micError, startMic, stopMic, setMicError };
}
