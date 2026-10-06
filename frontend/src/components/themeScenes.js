// ─────────────────────────────────────────────
// themeScenes.js — مشاهد الثيمات (Canvas 2D)
// كل مشهد: { resize(w, h), draw(ctx, t, dt, pointer) }
// الخلفية الأساسية (التدرجات) في CSS؛ هنا بنرسم الطبقات الحية بس.
// ─────────────────────────────────────────────

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;

// مولّد أرقام عشوائية ثابت — عشان شكل المشهد ما يتغيرش مع كل resize
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// رياح: موجتين + هبّة بطيئة
function wind(x, t) {
  return (
    Math.sin(x * 0.0045 + t * 0.9) * 0.55 +
    Math.sin(x * 0.012 - t * 1.7) * 0.25 +
    Math.sin(t * 0.37 + x * 0.0008) * 0.45
  );
}

function glow(ctx, x, y, r, rgb, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.45, `rgba(${rgb},${a * 0.35})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

// سبرايت توهج جاهز (أرخص بكتير من gradient لكل جسيم)
function makeGlowSprite(rgb) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.18, `rgba(${rgb},0.65)`);
  grad.addColorStop(0.5, `rgba(${rgb},0.14)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

// ═════════════ البركاني ═════════════
function volcanic(mode) {
  const dark = mode === 'dark';
  const rand = rng(7);
  let W = 0, H = 0;
  let plates = [];
  let embers = [];
  let smoke = [];
  let ash = [];
  let nextBurst = 4;
  const sprites = [makeGlowSprite('255,236,170'), makeGlowSprite('255,140,40'), makeGlowSprite('205,55,18')];
  const maxEmbers = () => (W < 700 ? 34 : 78);

  const spawnEmber = (burst = false, x0) => {
    const x = x0 ?? rand() * W;
    return {
      x,
      y: H - rand() * 26,
      vx: (rand() - 0.5) * 22 + (burst ? (rand() - 0.5) * 140 : 0),
      vy: -(burst ? 120 + rand() * 220 : 28 + rand() * 70),
      life: burst ? 1.2 + rand() * 1.6 : 3.5 + rand() * 6,
      age: 0,
      size: burst ? 0.9 + rand() * 1.4 : 0.9 + rand() * 2.3,
      phase: rand() * TAU,
      burst,
    };
  };

  return {
    resize(w, h) {
      W = w; H = h;
      const r = rng(11);
      plates = [];
      let x = -120;
      while (x < W + 240) {
        const pw = 90 + r() * 170;
        plates.push({ x, w: pw, h: 9 + r() * 12, y: r() * 12, jag: r() * 4 + 2, speed: 3 + r() * 5 });
        x += pw + 10 + r() * 40;
      }
      embers = [];
      for (let i = 0; i < maxEmbers(); i += 1) {
        const e = spawnEmber();
        e.age = rand() * e.life;
        e.y = H - rand() * (H * 0.7);
        embers.push(e);
      }
      smoke = Array.from({ length: W < 700 ? 4 : 7 }, (_, i) => ({
        x: rand() * W, y: H - rand() * 120, r: 160 + rand() * 220, vy: 6 + rand() * 9,
        vx: (rand() - 0.5) * 10, a: 0.5 + rand() * 0.5, off: i * 3.1,
      }));
      ash = Array.from({ length: dark ? 22 : 40 }, () => ({
        x: rand() * W, y: rand() * H, s: 1 + rand() * 2.4, vy: 12 + rand() * 22,
        rot: rand() * TAU, vr: (rand() - 0.5) * 2, sway: rand() * TAU,
      }));
    },

    draw(ctx, t, dt) {
      // ── توهج الحمم من تحت ──
      const flick = 0.82 + Math.sin(t * 2.1) * 0.08 + Math.sin(t * 5.3 + 1) * 0.05 + Math.sin(t * 11) * 0.02;
      const gh = H * (dark ? 0.55 : 0.4);
      const g = ctx.createLinearGradient(0, H, 0, H - gh);
      if (dark) {
        g.addColorStop(0, `rgba(255,110,20,${0.5 * flick})`);
        g.addColorStop(0.25, `rgba(220,60,10,${0.2 * flick})`);
        g.addColorStop(1, 'rgba(120,20,5,0)');
      } else {
        g.addColorStop(0, `rgba(255,140,50,${0.34 * flick})`);
        g.addColorStop(0.3, `rgba(255,170,100,${0.14 * flick})`);
        g.addColorStop(1, 'rgba(255,200,150,0)');
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, H - gh, W, gh);

      // ── دخان ──
      for (const s of smoke) {
        s.y -= s.vy * dt;
        s.x += (s.vx + wind(s.x, t) * 10) * dt;
        if (s.y < H * 0.25) { s.y = H + 40; s.x = rand() * W; }
        const rise = clamp((H - s.y) / (H * 0.8), 0, 1);
        const a = Math.sin(rise * Math.PI) * (dark ? 0.16 : 0.2) * s.a;
        const r = s.r * (0.7 + rise * 0.9);
        glow(ctx, s.x, s.y, r, dark ? '40,26,22' : '125,112,105', a);
      }

      // ── سطح الحمم (موج) ──
      const base = H - 16;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) {
        const y = base + Math.sin(x * 0.02 + t * 0.8) * 4 + Math.sin(x * 0.047 - t * 1.3) * 2.5 + Math.sin(x * 0.009 + t * 0.4) * 3;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      const lava = ctx.createLinearGradient(0, base - 8, 0, H);
      lava.addColorStop(0, '#ffd27a');
      lava.addColorStop(0.35, '#ff8a1e');
      lava.addColorStop(0.75, '#d9380a');
      lava.addColorStop(1, '#7a1604');
      ctx.fillStyle = lava;
      ctx.globalAlpha = 0.95;
      ctx.fill();
      ctx.globalAlpha = 1;

      // ── ألواح القشرة الباردة طايفة فوق الحمم ──
      for (const p of plates) {
        p.x += p.speed * dt;
        if (p.x > W + 120) p.x = -p.w - 120;
        const y = base + 3 + p.y * 0.5 + Math.sin(p.x * 0.02 + t * 0.8) * 3;
        ctx.beginPath();
        ctx.moveTo(p.x, y + p.h);
        ctx.lineTo(p.x + p.jag, y + 2);
        ctx.lineTo(p.x + p.w * 0.3, y);
        ctx.lineTo(p.x + p.w * 0.62, y + 3);
        ctx.lineTo(p.x + p.w - p.jag, y + 1);
        ctx.lineTo(p.x + p.w, y + p.h);
        ctx.closePath();
        ctx.fillStyle = dark ? '#150805' : '#3a2018';
        ctx.fill();
        ctx.strokeStyle = `rgba(255,140,40,${0.55 * flick})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // ── جمر متطاير ──
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < embers.length; i += 1) {
        const e = embers[i];
        e.age += dt;
        e.vy += (e.burst ? 150 : -2) * dt; // الشرر بيرجع يقع، الجمر بيطلع
        e.x += (e.vx + wind(e.x, t) * 26) * dt;
        e.y += e.vy * dt;
        if (e.age >= e.life || e.y < -20) {
          embers[i] = spawnEmber(rand() < 0.04 && embers.length <= maxEmbers() + 14);
          continue;
        }
        const u = e.age / e.life;
        const fl = 0.7 + Math.sin(t * 14 + e.phase) * 0.3;
        const a = Math.pow(1 - u, 1.25) * fl;
        const rr = e.size * (1 - u * 0.45);
        const sp = sprites[u < 0.28 ? 0 : u < 0.62 ? 1 : 2];
        const size = rr * 8;
        ctx.globalAlpha = clamp(a * (dark ? 0.9 : 0.75), 0, 1);
        if (sp) ctx.drawImage(sp, e.x - size / 2, e.y - size / 2, size, size);
        ctx.globalAlpha = clamp(a * 1.1, 0, 1);
        ctx.fillStyle = u < 0.5 ? '#fff2c4' : '#ffb15a';
        ctx.beginPath(); ctx.arc(e.x, e.y, rr * 0.55, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'source-over';

      // انفجار شرر كل شوية
      nextBurst -= dt;
      if (nextBurst <= 0) {
        nextBurst = 6 + rand() * 7;
        const bx = rand() * W;
        for (let i = 0; i < 12; i += 1) embers.push(spawnEmber(true, bx + (rand() - 0.5) * 60));
      }

      // ── رماد ساقط ──
      ctx.fillStyle = dark ? 'rgba(160,140,130,.45)' : 'rgba(95,80,75,.5)';
      for (const f of ash) {
        f.y += f.vy * dt;
        f.x += (wind(f.x, t) * 16 + Math.sin(t + f.sway) * 8) * dt;
        f.rot += f.vr * dt;
        if (f.y > H + 8) { f.y = -8; f.x = rand() * W; }
        if (f.x > W + 8) f.x = -8; else if (f.x < -8) f.x = W + 8;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        ctx.fillRect(-f.s, -f.s * 0.35, f.s * 2, f.s * 0.7);
        ctx.restore();
      }
    },
  };
}

// ═════════════ العشبي ═════════════
function grass(mode) {
  const dark = mode === 'dark';
  const rand = rng(23);
  let W = 0, H = 0;
  let layers = [];
  let flies = [];
  let beams = [];

  const palette = dark
    ? [
        { base: '#031109', tip: ['#0e3a1f', '#12452a', '#0b3320'], max: 70, w: 2.2, density: 7, amp: 0.55, speed: 0.8 },
        { base: '#04170c', tip: ['#1b6a37', '#207a40', '#175c30'], max: 115, w: 2.8, density: 9, amp: 0.8, speed: 1 },
        { base: '#052010', tip: ['#37a85a', '#43bd64', '#2d9650'], max: 165, w: 3.6, density: 13, amp: 1, speed: 1.2 },
      ]
    : [
        { base: '#3f7a2a', tip: ['#79b04a', '#88bc52', '#6ba541'], max: 70, w: 2.2, density: 7, amp: 0.55, speed: 0.8 },
        { base: '#3a7a28', tip: ['#8fc455', '#a2d05f', '#7db84a'], max: 115, w: 2.8, density: 9, amp: 0.8, speed: 1 },
        { base: '#2f6a22', tip: ['#b7de6a', '#c9e977', '#a3d05a'], max: 165, w: 3.6, density: 13, amp: 1, speed: 1.2 },
      ];

  return {
    resize(w, h) {
      W = w; H = h;
      const r = rng(31);
      layers = palette.map((p) => {
        const count = Math.ceil(W / p.density) + 6;
        const blades = Array.from({ length: count }, (_, i) => ({
          x: (i / count) * (W + 40) - 20 + (r() - 0.5) * p.density,
          h: p.max * (0.45 + r() * 0.55),
          w: p.w * (0.7 + r() * 0.6),
          lean: (r() - 0.5) * 0.5,
          ph: r() * TAU,
          grp: Math.floor(r() * 3),
          cur: 0,
          vel: 0,
        }));
        return { p, blades };
      });
      flies = Array.from({ length: dark ? 26 : 34 }, () => ({
        x: r() * W, y: H * (0.35 + r() * 0.6), a: r() * TAU, sp: 8 + r() * 16,
        ph: r() * TAU, s: dark ? 1.4 + r() * 1.4 : 1 + r() * 1.3, drift: r() * TAU,
      }));
      beams = Array.from({ length: 5 }, (_, i) => ({ k: i / 4, ph: r() * TAU, wd: 60 + r() * 90 }));
    },

    draw(ctx, t, dt, pointer) {
      // ── شمس / قمر ──
      const sx = dark ? W * 0.36 : W * 0.8, sy = dark ? H * 0.115 : H * 0.12;
      if (dark) {
        glow(ctx, sx, sy, Math.min(W, 520) * 0.7, '170,215,255', 0.2);
        ctx.fillStyle = 'rgba(232,244,255,.85)';
        ctx.beginPath(); ctx.arc(sx, sy, 26, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(160,190,220,.35)';
        ctx.beginPath(); ctx.arc(sx - 7, sy - 4, 5, 0, TAU); ctx.arc(sx + 8, sy + 7, 3.5, 0, TAU); ctx.fill();
      } else {
        glow(ctx, sx, sy, Math.min(W, 640) * 0.85, '255,236,160', 0.5);
        glow(ctx, sx, sy, 70, '255,252,230', 0.95);
        // أشعة الشمس
        ctx.globalCompositeOperation = 'lighter';
        for (const b of beams) {
          const ang = lerp(1.9, 2.75, b.k) + Math.sin(t * 0.25 + b.ph) * 0.04;
          const len = Math.hypot(W, H);
          const wdt = b.wd * (0.9 + Math.sin(t * 0.4 + b.ph) * 0.15);
          const ex = sx + Math.cos(ang) * len, ey = sy + Math.sin(ang) * len;
          const nx = -Math.sin(ang), ny = Math.cos(ang);
          const g = ctx.createLinearGradient(sx, sy, ex, ey);
          g.addColorStop(0, 'rgba(255,244,190,.16)');
          g.addColorStop(0.7, 'rgba(255,244,190,.03)');
          g.addColorStop(1, 'rgba(255,244,190,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(sx - nx * 8, sy - ny * 8);
          ctx.lineTo(sx + nx * 8, sy + ny * 8);
          ctx.lineTo(ex + nx * wdt * 3, ey + ny * wdt * 3);
          ctx.lineTo(ex - nx * wdt * 3, ey - ny * wdt * 3);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      // ── عشب: 3 طبقات بعمق ──
      const pointerLow = pointer.active && pointer.y > H - 280;
      for (const { p, blades } of layers) {
        const groups = [new Path2D(), new Path2D(), new Path2D()];
        for (const b of blades) {
          const wv = wind(b.x, t * p.speed + b.ph * 0.05);
          let target = (wv * p.amp + b.lean) * b.h * 0.42;
          if (pointerLow) {
            const dx = b.x - pointer.x;
            const ad = Math.abs(dx);
            if (ad < 150) target += Math.sign(dx || 1) * (1 - ad / 150) * (1 - ad / 150) * b.h * 0.9 * (p.amp + 0.3);
          }
          // نابض: حركة مرنة بدل انتقال مباشر
          b.vel += ((target - b.cur) * 38 - b.vel * 6.5) * dt;
          b.cur += b.vel * dt;
          const path = groups[b.grp];
          const tipX = b.x + b.cur;
          const tipY = H - b.h * (1 - Math.min(0.28, Math.abs(b.cur) / (b.h * 3)));
          const midX = b.x + b.cur * 0.38;
          const midY = H - b.h * 0.55;
          path.moveTo(b.x - b.w / 2, H + 2);
          path.quadraticCurveTo(midX - b.w * 0.34, midY, tipX, tipY);
          path.quadraticCurveTo(midX + b.w * 0.34, midY, b.x + b.w / 2, H + 2);
        }
        for (let gi = 0; gi < 3; gi += 1) {
          const gg = ctx.createLinearGradient(0, H, 0, H - p.max);
          gg.addColorStop(0, p.base);
          gg.addColorStop(1, p.tip[gi]);
          ctx.fillStyle = gg;
          ctx.fill(groups[gi]);
        }
      }

      // ── يراعات (ليل) / حبوب لقاح (نهار) ──
      if (dark) ctx.globalCompositeOperation = 'lighter';
      for (const f of flies) {
        f.drift += dt * 0.6;
        f.a += Math.sin(f.drift + f.ph) * dt * 1.6;
        f.x += (Math.cos(f.a) * f.sp + wind(f.x, t) * 14) * dt;
        f.y += (Math.sin(f.a) * f.sp * 0.6 - (dark ? 0 : 5)) * dt;
        if (f.x < -20) f.x = W + 20; else if (f.x > W + 20) f.x = -20;
        if (f.y < H * 0.2) f.y = H * 0.95; else if (f.y > H + 10) f.y = H * 0.4;
        if (dark) {
          const pulse = Math.max(0, Math.sin(t * 1.6 + f.ph * 3));
          const a = 0.15 + pulse * 0.85;
          glow(ctx, f.x, f.y, 16 * f.s * 0.8, '190,255,120', a * 0.55);
          ctx.fillStyle = `rgba(235,255,190,${a})`;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.s * 0.8, 0, TAU); ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(255,250,215,.75)';
          ctx.beginPath(); ctx.arc(f.x, f.y, f.s * 0.8, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,250,215,.2)';
          ctx.beginPath(); ctx.arc(f.x, f.y, f.s * 2.6, 0, TAU); ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

// ═════════════ الظلام ═════════════
function darkness(mode) {
  const dark = mode === 'dark';
  const rand = rng(59);
  let W = 0, H = 0;
  let stars = [];
  let fog = [];
  let motes = [];
  let beams = [];
  let flashlight = { x: -999, y: -999, a: 0 };
  let dip = 0;
  let nextDip = 9;

  return {
    resize(w, h) {
      W = w; H = h;
      const r = rng(61);
      stars = dark ? Array.from({ length: W < 700 ? 40 : 90 }, () => ({
        x: r() * W, y: r() * H * 0.62, s: 0.4 + r() * 1.1, ph: r() * TAU, sp: 0.6 + r() * 1.6,
      })) : [];
      fog = Array.from({ length: W < 700 ? 5 : 9 }, (_, i) => ({
        x: r() * W, y: H * (0.25 + r() * 0.8), r: 220 + r() * 340,
        vx: (r() < 0.5 ? -1 : 1) * (5 + r() * 14), a: 0.5 + r() * 0.5, ph: i * 1.7,
      }));
      motes = Array.from({ length: 46 }, () => ({
        x: r() * W, y: r() * H, s: 0.6 + r() * 1.4, vx: (r() - 0.5) * 6, vy: -(1 + r() * 5), ph: r() * TAU,
      }));
      beams = [{ x: 0.22, ph: 0.2 }, { x: 0.68, ph: 2.4 }];
    },

    draw(ctx, t, dt, pointer) {
      // ── نجوم ──
      for (const s of stars) {
        const a = 0.25 + (Math.sin(t * s.sp + s.ph) * 0.5 + 0.5) * 0.65;
        ctx.fillStyle = `rgba(215,222,255,${a})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, TAU); ctx.fill();
      }

      // ── أعمدة ضوء خافتة من فوق ──
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      for (const b of beams) {
        const bx = b.x * W + Math.sin(t * 0.18 + b.ph) * 40;
        const g = ctx.createLinearGradient(bx, 0, bx + 120, H * 0.85);
        const col = dark ? '140,150,255' : '255,255,255';
        g.addColorStop(0, `rgba(${col},${dark ? 0.07 : 0.4})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(bx - 30, 0); ctx.lineTo(bx + 30, 0);
        ctx.lineTo(bx + 260, H * 0.85); ctx.lineTo(bx + 20, H * 0.85);
        ctx.closePath(); ctx.fill();
      }

      // ── ضباب متحرك ──
      for (const f of fog) {
        f.x += f.vx * dt;
        if (f.x > W + f.r) f.x = -f.r; else if (f.x < -f.r) f.x = W + f.r;
        const breathe = 0.75 + Math.sin(t * 0.3 + f.ph) * 0.25;
        glow(ctx, f.x, f.y + Math.sin(t * 0.2 + f.ph) * 18, f.r, dark ? '115,125,205' : '255,255,255', (dark ? 0.12 : 0.45) * f.a * breathe);
      }
      ctx.globalCompositeOperation = 'source-over';

      // ── تراب معلّق: بيبان أكتر قرب الضوء ──
      const fx = flashlight.x, fy = flashlight.y;
      for (const m of motes) {
        m.x += (m.vx + wind(m.x, t) * 5) * dt;
        m.y += m.vy * dt;
        if (m.y < -4) { m.y = H + 4; m.x = rand() * W; }
        if (m.x < -4) m.x = W + 4; else if (m.x > W + 4) m.x = -4;
        const d = Math.hypot(m.x - fx, m.y - fy);
        const near = clamp(1 - d / 340, 0, 1) * flashlight.a;
        const a = 0.12 + near * 0.7 + Math.sin(t * 1.2 + m.ph) * 0.04;
        ctx.fillStyle = dark ? `rgba(190,198,255,${a})` : `rgba(90,95,150,${a * 0.8})`;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.s, 0, TAU); ctx.fill();
      }

      // ── كشاف: هالة ناعمة بتتبع المؤشر ──
      const target = pointer.active ? 1 : 0;
      flashlight.a = lerp(flashlight.a, target, clamp(dt * 3, 0, 1));
      if (pointer.active) {
        if (flashlight.x < -500) { flashlight.x = pointer.x; flashlight.y = pointer.y; }
        flashlight.x = lerp(flashlight.x, pointer.x, clamp(dt * 7, 0, 1));
        flashlight.y = lerp(flashlight.y, pointer.y, clamp(dt * 7, 0, 1));
      }
      if (flashlight.a > 0.01) {
        ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
        glow(ctx, flashlight.x, flashlight.y, 340, dark ? '130,140,255' : '255,255,255', (dark ? 0.12 : 0.32) * flashlight.a);
        glow(ctx, flashlight.x, flashlight.y, 120, dark ? '190,200,255' : '255,255,255', (dark ? 0.1 : 0.3) * flashlight.a);
        ctx.globalCompositeOperation = 'source-over';
      }

      // ── فينيت: حواف معتمة + وميض نادر ──
      nextDip -= dt;
      if (nextDip <= 0) { dip = 0.22; nextDip = 8 + rand() * 12; }
      dip = Math.max(0, dip - dt);
      const dipK = dip > 0 ? 1 + Math.sin((dip / 0.22) * Math.PI * 3) * 0.25 : 1;
      const v = ctx.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.25, W / 2, H * 0.5, Math.hypot(W, H) * 0.62);
      if (dark) {
        v.addColorStop(0, 'rgba(0,0,6,0)');
        v.addColorStop(1, `rgba(0,0,6,${clamp(0.72 * dipK, 0, 0.9)})`);
      } else {
        v.addColorStop(0, 'rgba(205,208,235,0)');
        v.addColorStop(1, 'rgba(190,194,228,.5)');
      }
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
    },
  };
}

// ═════════════ الثيم العادي: لمسة هادئة ═════════════
function slate(mode) {
  const dark = mode === 'dark';
  let W = 0, H = 0;
  return {
    resize(w, h) { W = w; H = h; },
    draw(ctx, t) {
      const a = 0.5 + Math.sin(t * 0.25) * 0.08;
      glow(ctx, W * 0.15, -H * 0.05, Math.max(W, H) * 0.6, dark ? '59,130,246' : '96,165,250', (dark ? 0.1 : 0.14) * a);
      glow(ctx, W * 0.95, H * 1.05, Math.max(W, H) * 0.5, dark ? '99,102,241' : '129,140,248', (dark ? 0.07 : 0.1) * a);
    },
  };
}

export const SCENES = { slate, volcanic, grass, darkness };

export function createScene(family, mode) {
  const factory = SCENES[family] || slate;
  return factory(mode === 'light' ? 'light' : 'dark');
}
