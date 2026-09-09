'use client';

import { useEffect, useRef } from 'react';

type Props = { enabled: boolean; children: React.ReactNode };

/** A light composited 3D playmat: cards remain ordinary accessible HTML. */
export default function Table3D({ enabled, children }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = stage.current;
    if (!el || !enabled) return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = el.getBoundingClientRect();
        const x = ((event.clientX - box.left) / box.width - 0.5) * 2;
        const y = ((event.clientY - box.top) / box.height - 0.5) * 2;
        el.style.setProperty('--tilt-x', `${Math.max(-1, Math.min(1, y)) * -3.2}deg`);
        el.style.setProperty('--tilt-y', `${Math.max(-1, Math.min(1, x)) * 3.2}deg`);
      });
    };
    const leave = () => {
      el.style.setProperty('--tilt-x', '0deg');
      el.style.setProperty('--tilt-y', '0deg');
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, [enabled]);

  useEffect(() => {
    const node = canvas.current;
    if (!node || !enabled || matchMedia('(prefers-reduced-motion: reduce)').matches)
      return;
    const context = node.getContext('2d');
    if (!context) return;
    let raf = 0;
    const sparks = Array.from({ length: 22 }, (_, i) => ({
      x: (i * 47) % 100,
      y: (i * 29) % 100,
      speed: 0.008 + (i % 5) * 0.003,
      size: 0.7 + (i % 4) * 0.45,
    }));
    const resize = () => {
      const box = node.getBoundingClientRect();
      const ratio = Math.min(devicePixelRatio, 1.5);
      node.width = Math.max(1, Math.floor(box.width * ratio));
      node.height = Math.max(1, Math.floor(box.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    let then = performance.now();
    const draw = (now: number) => {
      const delta = Math.min(50, now - then);
      then = now;
      const box = node.getBoundingClientRect();
      context.clearRect(0, 0, box.width, box.height);
      for (const spark of sparks) {
        spark.y -= spark.speed * delta;
        if (spark.y < -2) {
          spark.y = 102;
          spark.x = (spark.x * 31 + 17) % 100;
        }
        const gradient = context.createRadialGradient(
          (spark.x / 100) * box.width,
          (spark.y / 100) * box.height,
          0,
          (spark.x / 100) * box.width,
          (spark.y / 100) * box.height,
          spark.size * 5,
        );
        gradient.addColorStop(0, 'rgba(255,202,104,.65)');
        gradient.addColorStop(1, 'rgba(255,149,44,0)');
        context.fillStyle = gradient;
        context.beginPath();
        context.arc((spark.x / 100) * box.width, (spark.y / 100) * box.height, spark.size * 5, 0, Math.PI * 2);
        context.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [enabled]);

  return (
    <div ref={stage} className={`table-3d-stage ${enabled ? 'enabled' : ''}`}>
      {enabled && <canvas ref={canvas} className="table-3d-atmosphere" aria-hidden="true" />}
      <div className="table-3d-surface">{children}</div>
    </div>
  );
}
