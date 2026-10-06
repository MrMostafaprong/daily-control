import { useEffect, useRef, useState } from 'react';
import { readSettings } from '../lib/settings';
import { createScene } from './themeScenes';

function readTheme() {
  const s = readSettings();
  return { family: s.themeFamily, mode: s.themeMode };
}

// طبقة المؤثرات: canvas واحد ثابت ورا الواجهة، بيتوقف لما التبويب يتخفي
export default function ThemeEffects() {
  const [theme, setTheme] = useState(readTheme);
  const canvasRef = useRef(null);
  const pointer = useRef({ x: -999, y: -999, active: false });

  useEffect(() => {
    const sync = () => setTheme(readTheme());
    window.addEventListener('storage', sync);
    window.addEventListener('daily-control-theme-change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('daily-control-theme-change', sync);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.themeFamily = theme.family;
    document.documentElement.dataset.themeMode = theme.mode;
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const scene = createScene(theme.family, theme.mode);
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    let clock = 0;
    let acc = 0;
    const FRAME = 1 / 48; // سقف ~48 إطار/ثانية عشان الجهاز ما يسخنش

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene.resize(w, h);
    };

    const render = (dt) => {
      ctx.clearRect(0, 0, w, h);
      scene.draw(ctx, clock, dt, pointer.current);
    };

    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += dt;
      if (acc < FRAME) return;
      const step = Math.min(acc, 0.05);
      acc = 0;
      clock += step;
      render(step);
    };

    const move = (e) => {
      pointer.current.x = e.clientX;
      pointer.current.y = e.clientY;
      pointer.current.active = true;
    };
    const leave = () => { pointer.current.active = false; };
    const visibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    resize();
    clock = 5; // نبدأ من نقطة فيها حركة بالفعل
    if (reduced) {
      render(0.016); // إطار ثابت بدون حركة
    } else {
      raf = requestAnimationFrame(loop);
    }

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [theme.family, theme.mode]);

  return (
    <div className="theme-effects" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
