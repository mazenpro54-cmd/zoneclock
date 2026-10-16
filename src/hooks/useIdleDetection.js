/**
 * useIdleDetection — monitors user inactivity during active work sessions.
 * Triggers warnings when no interaction occurs for `timeoutMinutes`.
 */
import { useState, useEffect, useRef, useCallback } from "react";

// Web Audio API Synthesizer Chime — no external sound files required
export function playAlertChime(type = "idle") {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === "pomodoro") {
      // Pleasant double chime for Pomodoro cycle change (G5 -> C6)
      osc.type = "sine";
      osc.frequency.setValueAtTime(783.99, now); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.15); // C6
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.start(now);
      osc.stop(now + 0.8);
    } else {
      // Muted attention chime for Inactivity (A4 -> E4)
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(329.63, now + 0.2);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc.start(now);
      osc.stop(now + 0.9);
    }
  } catch (e) {
    // AudioContext might be locked until user interaction
  }
}

export function useIdleDetection({ enabled = false, timeoutMinutes = 5, onIdle } = {}) {
  const [isIdle, setIsIdle] = useState(false);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const lastActiveRef = useRef(Date.now());
  const idleStartRef = useRef(null);

  const resetIdle = useCallback(() => {
    lastActiveRef.current = Date.now();
    idleStartRef.current = null;
    setIsIdle(false);
    setIdleSeconds(0);
  }, []);

  useEffect(() => {
    if (!enabled) {
      resetIdle();
      return;
    }

    const handleActivity = () => {
      // Only auto-reset if not already in the idle modal prompt
      if (!idleStartRef.current) {
        lastActiveRef.current = Date.now();
      }
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedMs = now - lastActiveRef.current;
      const thresholdMs = timeoutMinutes * 60 * 1000;

      if (elapsedMs >= thresholdMs) {
        if (!idleStartRef.current) {
          idleStartRef.current = now;
          setIsIdle(true);
          playAlertChime("idle");
          if (onIdle) onIdle();
        } else {
          setIdleSeconds(Math.floor((now - idleStartRef.current) / 1000));
        }
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, [enabled, timeoutMinutes, onIdle, resetIdle]);

  return { isIdle, idleSeconds, resetIdle, playChime: playAlertChime };
}
