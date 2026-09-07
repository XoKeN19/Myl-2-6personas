'use client';
import { useEffect, useRef, useState } from 'react';

// Original, quiet modal melody with plucked accompaniment; no downloaded audio.
export function useTavernMusic() {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(25);
  const audio = useRef<AudioContext | null>(null);
  const master = useRef<GainNode | null>(null);
  const currentVolume = useRef(25);
  const toggle = () => {
    if (!playing) {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    }
    setPlaying((v) => !v);
  };
  useEffect(() => {
    currentVolume.current = volume;
    if (master.current && audio.current)
      master.current.gain.setTargetAtTime(
        (volume / 100) * 0.18,
        audio.current.currentTime,
        0.1,
      );
  }, [volume]);
  useEffect(() => {
    if (!playing || !audio.current) return;
    const ctx = audio.current,
      gain = ctx.createGain();
    master.current = gain;
    gain.gain.value = (currentVolume.current / 100) * 0.18;
    gain.connect(ctx.destination);
    let beat = 0,
      next = ctx.currentTime + 0.05;
    const melody = [
      74, 76, 77, 81, 79, 77, 76, 72, 74, 77, 76, 72, 69, 72, 74, 76, 74, 72,
      69, 67, 69, 72, 74, 0, 77, 79, 81, 84, 81, 79, 77, 76, 74, 77, 81, 79, 77,
      74, 72, 76, 79, 77, 76, 72, 69, 72, 74, 0,
    ];
    const chords = [
      [50, 57, 62, 65, 69, 65],
      [48, 55, 60, 64, 67, 64],
      [46, 53, 58, 62, 65, 62],
      [48, 55, 60, 64, 67, 64],
    ];
    function note(midi: number, t: number, level: number, length: number) {
      if (!midi) return;
      const osc = ctx.createOscillator(),
        env = ctx.createGain(),
        filter = ctx.createBiquadFilter();
      osc.type = 'triangle';
      osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
      filter.type = 'lowpass';
      filter.frequency.value = 1700;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(level, t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t + length);
      osc.connect(filter);
      filter.connect(env);
      env.connect(gain);
      osc.start(t);
      osc.stop(t + length + 0.03);
      osc.onended = () => {
        osc.disconnect();
        filter.disconnect();
        env.disconnect();
      };
    }
    const schedule = () => {
      if (document.hidden) {
        next = ctx.currentTime + 0.05;
        return;
      }
      if (next < ctx.currentTime) next = ctx.currentTime + 0.05;
      while (next < ctx.currentTime + 0.2) {
        note(chords[Math.floor(beat / 12) % 4][beat % 6], next, 0.48, 0.75);
        if (beat % 2 === 0)
          note(melody[(beat / 2) % melody.length], next, 0.52, 0.6);
        beat++;
        next += 0.23;
      }
    };
    schedule();
    const timer = setInterval(schedule, 100);
    return () => {
      clearInterval(timer);
      gain.disconnect();
      master.current = null;
    };
    // Volume is updated on the existing gain without restarting the tune.
  }, [playing]);
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  return { playing, volume, setVolume, toggle };
}
