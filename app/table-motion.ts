'use client';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

// The browser compositor animates transforms; the server remains the source of truth.
export function useTableMotion(revision: number, latestEvent: string) {
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef(new Map<string, DOMRect>());
  const previousEvent = useRef('');
  const audio = useRef<AudioContext | null>(null);
  const [sound, updateSound] = useState(false);
  const setSound = (enabled: boolean) => {
    updateSound(enabled);
    if (enabled) {
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume();
      } catch {}
    }
  };
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  const play = useCallback(
    (kind: 'pick' | 'drop' | 'draw' | 'shuffle' | 'turn' | 'request') => {
      if (!sound) return;
      try {
        audio.current ??= new AudioContext();
        const ctx = audio.current;
        void ctx.resume();
        const notes =
          kind === 'shuffle'
            ? [180, 220, 170, 250]
            : kind === 'turn'
              ? [392, 523, 659]
              : kind === 'request'
                ? [523, 784]
                : [kind === 'pick' ? 330 : kind === 'draw' ? 620 : 220];
        notes.forEach((frequency, i) => {
          const oscillator = ctx.createOscillator(),
            gain = ctx.createGain();
          const t = ctx.currentTime + i * 0.065;
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(frequency, t);
          oscillator.frequency.exponentialRampToValueAtTime(
            frequency * 0.6,
            t + 0.1,
          );
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.045, t + 0.008);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
          oscillator.connect(gain);
          gain.connect(ctx.destination);
          oscillator.start(t);
          oscillator.stop(t + 0.18);
        });
      } catch {
        /* Audio is optional on browsers without Web Audio. */
      }
    },
    [sound],
  );
  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>();
    root.current
      ?.querySelectorAll<HTMLElement>('[data-motion-card]')
      .forEach((el) => {
        const key = el.dataset.motionCard!;
        const rect = el.getBoundingClientRect();
        const before = previous.current.get(key);
        next.set(key, rect);
        if (reduced || previous.current.size === 0) return;
        if (
          before &&
          (Math.abs(before.x - rect.x) > 1 || Math.abs(before.y - rect.y) > 1)
        ) {
          el.animate(
            [
              {
                transform: `translate(${before.x - rect.x}px,${before.y - rect.y}px)`,
                opacity: 0.7,
              },
              { transform: 'translate(0,0)', opacity: 1 },
            ],
            { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' },
          );
        } else if (!before) {
          const pile = root.current
            ?.querySelector<HTMLElement>(
              `[data-pile-owner="${el.dataset.owner}"]`,
            )
            ?.getBoundingClientRect();
          el.animate(
            [
              {
                transform: pile
                  ? `translate(${pile.x - rect.x}px,${pile.y - rect.y}px) rotateY(80deg) scale(.7)`
                  : 'translateY(-12px) scale(.8)',
                opacity: 0.1,
              },
              { transform: 'none', opacity: 1 },
            ],
            { duration: 380, easing: 'ease-out' },
          );
        }
      });
    previous.current = next;
  }, [revision, reduced]);
  useEffect(() => {
    if (previousEvent.current && previousEvent.current !== latestEvent) {
      if (latestEvent.includes('baraj')) {
        play('shuffle');
        if (!reduced)
          root.current
            ?.querySelectorAll('[data-pile-owner]')
            .forEach((el) =>
              el.animate(
                [
                  { transform: 'rotate(0)' },
                  { transform: 'translateX(-8px) rotate(-7deg)' },
                  { transform: 'translateX(8px) rotate(7deg)' },
                  { transform: 'none' },
                ],
                { duration: 450, iterations: 2 },
              ),
            );
      } else if (
        latestEvent.includes('robó') ||
        latestEvent.includes('mano inicial')
      )
        play('draw');
      else if (latestEvent.includes('turno')) play('turn');
      else if (latestEvent.includes('pidió')) play('request');
      else if (latestEvent.includes('movió')) play('drop');
    }
    previousEvent.current = latestEvent;
  }, [latestEvent, play, reduced]);
  return { root, sound, setSound, play, reduced };
}
