import { useEffect, useRef, useState, useCallback } from "react";

type SR = any;

function getSR(): SR | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useVoiceInput(opts: {
  lang?: string;
  continuous?: boolean;
  onResult?: (text: string, isFinal: boolean) => void;
  onError?: (msg: string) => void;
}) {
  const { lang = "fr-FR", continuous = false, onResult, onError } = opts;
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);

  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    setSupported(!!getSR());
  }, []);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const SR = getSR();
    if (!SR) { onErrorRef.current?.("Reconnaissance vocale non supportée sur ce navigateur"); return; }
    try {
      const rec = new SR();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = continuous;
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        let text = "";
        let isFinal = false;
        for (let i = e.resultIndex; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
          if (e.results[i].isFinal) isFinal = true;
        }
        onResultRef.current?.(text, isFinal);
      };
      rec.onerror = (e: any) => {
        const err = e?.error || "unknown";
        if (err === "not-allowed" || err === "service-not-allowed") {
          onErrorRef.current?.("Micro refusé. Active-le dans les réglages du navigateur.");
        } else if (err !== "aborted" && err !== "no-speech") {
          onErrorRef.current?.("Erreur micro : " + err);
        }
        setListening(false);
      };
      rec.onend = () => setListening(false);
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch (e: any) {
      onErrorRef.current?.(e?.message || "Impossible de démarrer le micro");
      setListening(false);
    }
  }, [lang, continuous]);

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* noop */ } }, []);

  return { supported, listening, start, stop };
}
