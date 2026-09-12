"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Thin wrapper around the browser's Web Speech API (SpeechRecognition for
 * voice input, SpeechSynthesis for voice output). Both are only available
 * in Chromium-based browsers today (Chrome, Edge, most Android browsers) -
 * Firefox and Safari either lack support or only partially implement it, so
 * every consumer of this hook must check `supported.input` / `supported.output`
 * before showing the relevant controls.
 *
 * Nothing here talks to a server: recognition and synthesis both run
 * on-device via the OS/browser's own speech engine.
 */
export function useVoice() {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  // Persisted so the student's mute preference survives a refresh.
  const [voiceEnabled, setVoiceEnabledState] = useState(true);

  const recognitionRef = useRef<any>(null);
  const supported = useRef({ input: false, output: false });

  useEffect(() => {
    const stored = window.localStorage.getItem("cv-voice-enabled");
    if (stored !== null) setVoiceEnabledState(stored === "true");

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    supported.current.input = !!SpeechRecognitionCtor;
    supported.current.output = "speechSynthesis" in window;

    return () => {
      recognitionRef.current?.stop();
      if (supported.current.output) window.speechSynthesis.cancel();
    };
  }, []);

  const setVoiceEnabled = useCallback((value: boolean) => {
    setVoiceEnabledState(value);
    window.localStorage.setItem("cv-voice-enabled", String(value));
    if (!value && supported.current.output) window.speechSynthesis.cancel();
  }, []);

  /** Starts listening and resolves with the final transcript once the
   *  student stops talking (or calls stopListening). Resolves with "" if
   *  recognition errors out or nothing was captured. */
  const startListening = useCallback((onResult: (text: string) => void) => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) onResult(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  /** Speaks the given text aloud, replacing anything currently speaking. */
  const speak = useCallback(
    (text: string) => {
      if (!voiceEnabled || !("speechSynthesis" in window) || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [voiceEnabled]
  );

  const stopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return {
    listening,
    startListening,
    stopListening,
    speaking,
    speak,
    stopSpeaking,
    voiceEnabled,
    setVoiceEnabled,
    supported: supported.current,
  };
}
