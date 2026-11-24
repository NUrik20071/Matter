const limit = (n, low, high) => Math.min(high, Math.max(low, n));
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const TAU = Math.PI * 2;

// Three original, responsive graphic studies. A frame is scheduled only when
// input, scroll state, visibility, or dimensions change; there is no idle loop.
export function mountStudies(elements, { reducedMotion = false } = {}) {
  let reduced = Boolean(reducedMotion);
  let destroyed = false;
  let scheduled = 0;
  let active = true;
  let diagnosticsTimer = 0;
  let lastDrawAt = 0;
  const hasVisibilityObserver = typeof IntersectionObserver === 'function';
  const coarse = matchMedia('(pointer: coarse)').matches;
  const state = { progress: 0, pointerX: 0, pointerY: 0, pull: 0, reveal: 0 };
  const studies = Array.from(elements || []).map(canvas => ({
    canvas,
    context: canvas.getContext('2d', { alpha: false }),
    kind: canvas.dataset.study || 'field',
    width: 0,
    height: 0,
    scale: 1,
    visible: !hasVisibilityObserver,
    dirty: true,
    needsSize: true,
    layoutWidth: 0,
    layoutHeight: 0,
    inside: false,
    down: false,
    x: 0.5,
    y: 0.5,
    clientX: 0,
    clientY: 0,
    buffer: null,
    draws: 0,
    drawCPU: 0,
    cleanups: [],
  })).filter(study => study.context);

  function invalidate(study) {
    if (destroyed) return;
    if (study) study.dirty = true;
    else studies.forEach(item => { item.dirty = true; });
    if (!scheduled && active && !document.hidden && studies.some(item => item.visible && item.dirty)) scheduled = requestAnimationFrame(render);
  }

  function size(study) {
    if (!study.needsSize) return;
    study.needsSize = false;
    // Intrinsic size is independent of the artwork's rotating CSS transform.
    // A transformed bounding box changes every frame and would recreate the
    // backing store and type buffer continuously while scrolling.
    const width = Math.max(1, study.layoutWidth || study.canvas.clientWidth);
    const height = Math.max(1, study.layoutHeight || study.canvas.clientHeight);
    const scale = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt((coarse ? 300000 : 430000) / (width * height)));
    if (study.width === width && study.height === height && study.scale === scale) return;
    study.width = width;
    study.height = height;
    study.scale = scale;
    study.canvas.width = Math.max(1, Math.floor(width * scale));
    study.canvas.height = Math.max(1, Math.floor(height * scale));
    study.buffer = null;
  }

  function interaction(study) {
    if (reduced) return { x: 0.5, y: 0.5, pressure: 0, reveal: 0, progress: 0 };
    const rect = study.canvas.getBoundingClientRect();
    const globalX = (state.pointerX + 1) * window.innerWidth * 0.5;
    const globalY = (state.pointerY + 1) * window.innerHeight * 0.5;
    const inRect = globalX >= rect.left && globalX <= rect.right && globalY >= rect.top && globalY <= rect.bottom;
    return {
      x: study.inside ? limit((study.clientX - rect.left) / Math.max(1, rect.width), 0, 1) : inRect ? limit((globalX - rect.left) / Math.max(1, rect.width), 0, 1) : 0.5,
      y: study.inside ? limit((study.clientY - rect.top) / Math.max(1, rect.height), 0, 1) : inRect ? limit((globalY - rect.top) / Math.max(1, rect.height), 0, 1) : 0.5,
      pressure: Math.max(study.down ? 1 : 0, state.pull),
      reveal: state.reveal,
      progress: state.progress,
    };
  }

  function label(ctx, text, x, y, size = 9, color = '#1b2eac') {
    ctx.font = `500 ${size}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function field(study, input) {
    const { context: ctx, width: w, height: h } = study;
    ctx.fillStyle = '#ecebe0';
    ctx.fillRect(0, 0, w, h);
    const margin = Math.min(w, h) * 0.075;
    const lineCount = Math.round(limit(w / 7, 48, 88));
    const px = input.x * w;
    const py = input.y * h;
    const bend = (input.x - 0.5) * 0.1 + input.pressure * 0.13;
    const phase = input.progress * 0.8;
    const steps = coarse ? 70 : 94;
    const samples = [];
    for (let step = 0; step <= steps; step++) {
      const v = step / steps;
      const angle = v * TAU * 0.91 - 1.1 + phase;
      samples.push({ y: margin + v * (h - margin * 2), envelope: Math.sin(v * Math.PI), sin: Math.sin(angle), cos: Math.cos(angle), reveal: Math.sin(v * TAU) });
    }
    ctx.strokeStyle = '#2446ce';
    ctx.lineWidth = Math.max(0.7, w / 900);
    ctx.beginPath();
    for (let line = 0; line < lineCount; line++) {
      const t = line / (lineCount - 1);
      const sin = Math.sin(t * 2.5), cos = Math.cos(t * 2.5);
      for (let step = 0; step <= steps; step++) {
        const sample = samples[step], y = sample.y;
        const wave = (sample.sin * cos + sample.cos * sin) * w * 0.17 * sample.envelope;
        let x = margin + t * (w - margin * 2) + wave;
        if (bend !== 0 || input.reveal !== 0) {
          const dx = (x - px) / w, dy = (y - py) / h;
          const influence = Math.exp(-(dx * dx * 12 + dy * dy * 10));
          x += influence * (bend * w + sample.reveal * w * input.reveal * 0.09);
        }
        if (step === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    // An offset orange incision makes the field feel printed and composed.
    ctx.save();
    ctx.translate(w * 0.727 + (input.x - 0.5) * 14, h * 0.31 + (input.y - 0.5) * 12);
    ctx.rotate(-0.18 - input.reveal * 0.1);
    ctx.fillStyle = '#ff6a28';
    ctx.fillRect(-w * 0.027, -h * 0.105, w * 0.054, h * 0.21);
    ctx.restore();
    ctx.fillStyle = '#ecebe0';
    ctx.fillRect(margin - 4, h - margin * 0.83, w * 0.32, margin * 0.58);
    label(ctx, 'FIELD / 01', margin, h - margin * 0.38, Math.max(8, Math.min(10, w / 65)));
  }

  function typeBuffer(study) {
    if (study.buffer) return study.buffer;
    const buffer = document.createElement('canvas');
    buffer.width = study.canvas.width;
    buffer.height = study.canvas.height;
    const ctx = buffer.getContext('2d');
    const { width: w, height: h, scale } = study;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    let fontSize = h * 1.03;
    ctx.font = `900 ${fontSize}px Georgia, 'Times New Roman', serif`;
    fontSize *= Math.min(1, w * 0.91 / ctx.measureText('Aa').width);
    ctx.font = `900 ${fontSize}px Georgia, 'Times New Roman', serif`;
    const metrics = ctx.measureText('Aa');
    const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.72;
    const descent = metrics.actualBoundingBoxDescent || fontSize * 0.05;
    const baseline = h * 0.51 + (ascent - descent) / 2;
    ctx.fillStyle = '#141514';
    ctx.fillText('Aa', (w - metrics.width) / 2 - w * 0.012, baseline);
    study.buffer = buffer;
    return buffer;
  }

  function typography(study, input) {
    const { context: ctx, width: w, height: h, scale } = study;
    ctx.fillStyle = '#ff6a2d';
    ctx.fillRect(0, 0, w, h);
    const buffer = typeBuffer(study);
    const stripes = 38;
    const sourceHeight = buffer.height / stripes;
    for (let i = 0; i < stripes; i++) {
      const y = i / stripes;
      const proximity = Math.exp(-Math.pow((y - input.y) * 4.5, 2));
      const amplitude = (0.007 + Math.abs(input.x - 0.5) * 0.025 + input.pressure * 0.09 + input.reveal * 0.035) * w;
      const shift = Math.sin(y * 17 + input.progress * 3 + input.x * 3) * amplitude * proximity;
      const sy = Math.floor(i * sourceHeight);
      const sh = Math.min(buffer.height - sy, Math.ceil(sourceHeight) + 1);
      if (input.reveal > 0.02) {
        ctx.fillStyle = '#ddf284';
        ctx.fillRect(w * 0.08 + shift * 0.5, sy / scale, w * 0.84, Math.max(0.5, input.reveal * 1.2));
      }
      ctx.drawImage(buffer, 0, sy, buffer.width, sh, shift, sy / scale, buffer.width / scale, sh / scale);
    }
    const margin = Math.min(w, h) * 0.07;
    const small = Math.max(8, Math.min(10, w / 65));
    label(ctx, 'TYPE IN MOTION', margin, margin + small, small, '#141514');
    ctx.save();
    ctx.translate(w - margin, h - margin);
    ctx.rotate(-Math.PI / 2);
    label(ctx, 'FORM / FEELING', 0, 0, small, '#141514');
    ctx.restore();
    ctx.fillStyle = '#141514';
    ctx.fillRect(margin, h - margin - 1, w * 0.16, 1);
    label(ctx, '02', margin + w * 0.18, h - margin + small * 0.3, small, '#141514');
  }

  function signal(study, input) {
    const { context: ctx, width: w, height: h } = study;
    ctx.fillStyle = '#111e32';
    ctx.fillRect(0, 0, w, h);
    const margin = Math.min(w, h) * 0.085;
    const expansion = input.pressure * 0.11 + input.reveal * 0.06;
    const px = (input.x - 0.5) * w * 0.12;
    const py = (input.y - 0.5) * h * 0.12;
    const centerX = w * 0.49 + px;
    const centerY = h * 0.5 + py;
    const width = w * (0.35 + expansion);
    const height = h * (0.32 + expansion);
    ctx.lineWidth = Math.max(0.65, w / 1050);
    const rays = Math.round(limit(w / 6, 55, 105));
    for (let i = 0; i < rays; i++) {
      const t = i / (rays - 1);
      const swing = Math.sin(t * Math.PI);
      const ax = centerX - width + t * width * 0.42;
      const ay = centerY + height - t * height * 1.77;
      const bx = centerX + width - t * width * 0.42;
      const by = centerY - height + t * height * 1.77;
      const twist = Math.sin(t * Math.PI * 2 + input.progress) * h * (0.075 + input.reveal * 0.03);
      ctx.strokeStyle = i % 9 === 0 ? '#d6f083' : `rgba(163,199,231,${0.32 + swing * 0.48})`;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.bezierCurveTo(centerX - width * 0.16, centerY + height * 0.43 + twist, centerX + width * 0.16, centerY - height * 0.43 - twist, bx, by);
      ctx.stroke();
    }
    // Crossing straight rays create a luminous folded sheet, never a torus.
    ctx.lineWidth = 0.65;
    for (let i = 0; i < 29; i++) {
      const t = i / 28;
      ctx.strokeStyle = `rgba(212,239,132,${0.12 + Math.sin(t * Math.PI) * 0.3})`;
      ctx.beginPath();
      ctx.moveTo(centerX - width * 0.7 + t * width * 1.4, centerY - height * 0.77);
      ctx.lineTo(centerX + width * 0.7 - t * width * 1.4, centerY + height * 0.77);
      ctx.stroke();
    }
    const size = Math.max(8, Math.min(10, w / 65));
    label(ctx, 'SIGNAL / 03', margin, margin + size, size, '#cad9df');
    label(ctx, 'LINE → VOLUME', margin, h - margin, size, '#cad9df');
    ctx.fillStyle = '#d6f083';
    ctx.fillRect(w - margin - w * 0.075, h - margin - 3, w * 0.075, 3);
  }

  function render() {
    scheduled = 0;
    if (destroyed || document.hidden || !active) return;
    for (const study of studies) {
      if (!study.dirty || !study.visible) continue;
      const started = performance.now();
      size(study);
      const ctx = study.context;
      ctx.setTransform(study.scale, 0, 0, study.scale, 0, 0);
      const input = interaction(study);
      if (study.kind === 'type') typography(study, input);
      else if (study.kind === 'signal') signal(study, input);
      else field(study, input);
      study.dirty = false;
      study.draws++;
      study.drawCPU += performance.now() - started;
      lastDrawAt = performance.now();
    }
    if (!diagnosticsTimer && lastDrawAt) diagnosticsTimer = setTimeout(publishDiagnostics, 220);
  }

  function publishDiagnostics() {
    diagnosticsTimer = 0;
    if (destroyed) return;
    if (performance.now() - lastDrawAt < 200) { diagnosticsTimer = setTimeout(publishDiagnostics, 220); return; }
    for (const study of studies) Object.assign(study.canvas.dataset, {
      renderFrames: String(study.draws), renderPixels: String(study.canvas.width * study.canvas.height),
      drawCpuMs: study.draws ? (study.drawCPU / study.draws).toFixed(3) : '0',
      qualityLevel: reduced ? 'static' : coarse ? 'medium' : 'high', renderIdle: 'true',
    });
  }

  const observer = hasVisibilityObserver ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      const study = studies.find(item => item.canvas === entry.target);
      if (!study) continue;
      study.visible = entry.isIntersecting;
      if (study.visible) invalidate(study);
    }
  }, { rootMargin: '120px' }) : null;
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
    for (const entry of entries) {
      const study = studies.find(item => item.canvas === entry.target);
      if (study) {
        study.layoutWidth = entry.contentRect.width;
        study.layoutHeight = entry.contentRect.height;
        study.needsSize = true;
        invalidate(study);
      }
    }
  }) : null;

  for (const study of studies) {
    const move = event => {
      if (event.pointerType === 'mouse') return;
      study.clientX = event.clientX;
      study.clientY = event.clientY;
      study.inside = true;
      invalidate(study);
    };
    // Mouse chords are owned by the page controller. Pointer Events send
    // pointerup only after the last mouse button is released, so a local mouse
    // latch would otherwise keep left-button pressure after that button lifts.
    const down = event => { if (event.pointerType === 'mouse') return; move(event); study.down = event.button === 0; invalidate(study); };
    const leave = () => { study.inside = false; study.down = false; invalidate(study); };
    const release = () => { if (study.down) { study.down = false; invalidate(study); } };
    const on = (target, event, handler) => {
      target.addEventListener(event, handler, { passive: true });
      study.cleanups.push(() => target.removeEventListener(event, handler));
    };
    on(study.canvas, 'pointermove', move);
    on(study.canvas, 'pointerdown', down);
    on(study.canvas, 'pointerleave', leave);
    on(study.canvas, 'pointercancel', leave);
    on(window, 'pointerup', release);
    on(window, 'blur', leave);
    on(window, 'keydown', event => { if (event.key === 'Escape') leave(); });
    observer?.observe(study.canvas);
    resizeObserver?.observe(study.canvas);
  }
  const resize = () => { studies.forEach(study => { study.needsSize = true; study.layoutWidth = study.layoutHeight = 0; }); invalidate(); };
  const visibility = () => { if (document.hidden) { if (scheduled) cancelAnimationFrame(scheduled); scheduled = 0; } else invalidate(); };
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', visibility);
  // Render immediately so every study is composed even before its first input.
  render();

  function setActive(value) {
    const next = Boolean(value);
    if (next === active) return;
    active = next;
    if (!active) { if (scheduled) cancelAnimationFrame(scheduled); scheduled = 0; }
    else invalidate();
  }

  return {
    setState(next = {}) {
      let changed = false;
      for (const key of Object.keys(state)) {
        if (!(key in next)) continue;
        const value = limit(number(next[key]), key.startsWith('pointer') ? -1 : 0, 1);
        if (value !== state[key]) { state[key] = value; changed = true; }
      }
      if (changed && !reduced) invalidate();
    },
    setReducedMotion(value) {
      reduced = Boolean(value);
      studies.forEach(study => { study.down = false; });
      invalidate();
    },
    setActive,
    setPaused(value) { setActive(!value); },
    destroy() {
      destroyed = true;
      if (scheduled) cancelAnimationFrame(scheduled);
      if (diagnosticsTimer) clearTimeout(diagnosticsTimer);
      observer?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      studies.forEach(study => {
        study.cleanups.forEach(cleanup => cleanup());
        study.buffer = null;
      });
    },
  };
}
