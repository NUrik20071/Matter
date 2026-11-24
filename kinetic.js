// Scroll poses are pure functions of progress. Temporary gesture springs recover
// to the current scroll pose rather than to a permanently assembled heading.
const MATERIALS = {
  water: { spring: 45, damping: 11.5, idle: 5, tempo: 1, pull: 1, bend: 1, drag: .055 },
  amber: { spring: 15, damping: 7.4, idle: 4.5, tempo: .48, pull: 1.35, bend: 1.3, drag: .075 },
  metal: { spring: 83, damping: 13.2, idle: 2.8, tempo: .78, pull: .75, bend: .4, drag: .038 },
  glass: { spring: 58, damping: 15, idle: 1.8, tempo: .65, pull: .7, bend: 0, drag: .035 },
};
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const ease = value => { const x = clamp(value); return x * x * (3 - 2 * x); };
const number = value => (Math.abs(value) < .00005 ? 0 : value).toFixed(3);

export function createKinetic({ title, panels = [], material = 'water', reducedMotion = false } = {}) {
  if (!title) throw new Error('createKinetic requires a title element.');
  material = MATERIALS[material] ? material : 'water';
  let progress = .5, active = true, paused = false, destroyed = false;
  let frame = 0, measureFrame = 0, lastTime = 0, time = 0, burstLife = 0, holdTime = 0;
  let letters = [], viewportWidth = window.innerWidth, viewportHeight = window.innerHeight;
  const original = { html: title.innerHTML, label: title.getAttribute('aria-label') };
  const input = { x: -10000, y: -10000, dx: 0, dy: 0, left: false, right: false, energy: 0 };
  const unsubscribe = [];
  const panelStates = Array.from(panels).map((element, index) => {
    const path = element.querySelector('svg.membrane > path');
    return { element, path, index, rect: null, x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0, pressure: 0,
      originalStyle: element.getAttribute('style'), originalTransform: element.style.transform,
      originalPath: path?.getAttribute('d'), originalPathStyle: path?.getAttribute('style'),
      originalPathLength: path?.getAttribute('pathLength') };
  });
  function listen(target, event, callback) {
    target.addEventListener(event, callback);
    unsubscribe.push(() => target.removeEventListener(event, callback));
  }
  function running() { return active && !destroyed && !paused && !reducedMotion && !document.hidden; }
  function schedule() {
    if (running() && !frame) { lastTime = 0; frame = requestAnimationFrame(tick); }
    else if (!running() && frame) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
  }
  function queueMeasure() {
    if (destroyed || measureFrame) return;
    measureFrame = requestAnimationFrame(() => { measureFrame = 0; measure(); });
  }
  function measure() {
    if (destroyed) return;
    viewportWidth = window.innerWidth; viewportHeight = window.innerHeight;
    // Fixed views use client positions. Never add scrollY or feed animated
    // transforms into measurements of the baseline layout.
    letters.forEach(letter => { letter.element.style.transform = 'none'; });
    panelStates.forEach(panel => { panel.element.style.transform = panel.originalTransform; });
    for (const letter of letters) {
      const box = letter.element.getBoundingClientRect();
      letter.baseX = box.left + box.width / 2; letter.baseY = box.top + box.height / 2;
    }
    for (const panel of panelStates) {
      const box = panel.element.getBoundingClientRect();
      panel.rect = { x: box.left, y: box.top, width: Math.max(1, box.width), height: Math.max(1, box.height) };
    }
    paint();
  }
  function buildLines(lines) {
    const normalized = Array.isArray(lines) && lines.length ? lines.map(String) : ['MATTER'];
    title.replaceChildren(); title.setAttribute('aria-label', normalized.join(' '));
    const fragment = document.createDocumentFragment(); letters = [];
    normalized.forEach((text, row) => {
      const line = document.createElement('span');
      line.className = 'title-line'; line.setAttribute('aria-hidden', 'true');
      line.style.display = 'block'; line.style.whiteSpace = 'nowrap';
      Array.from(text).forEach((character, column) => {
        const element = document.createElement('span'), index = letters.length;
        element.className = 'letter'; element.setAttribute('aria-hidden', 'true');
        element.textContent = character === ' ' ? '\u00a0' : character;
        Object.assign(element.style, { display: 'inline-block', whiteSpace: 'pre', transformOrigin: '50% 55%' });
        const seed = index * 1.6180339 + row * 2.31 + character.codePointAt(0) * .013;
        letters.push({ element, index, row, column, seed, baseX: 0, baseY: 0,
          x: 0, y: 0, r: 0, skew: 0, scale: 0, vx: 0, vy: 0, vr: 0, vs: 0 });
        line.appendChild(element);
      });
      fragment.appendChild(line);
    });
    title.appendChild(fragment); measure(); queueMeasure();
  }
  function phases(stagger = 0) {
    if (reducedMotion) return { assembled: 1, exited: 0, presence: 1 };
    const assembled = ease((progress - stagger) / (.3 - stagger));
    const exited = ease((progress - .7 - stagger * .7) / (.3 - stagger * .7));
    return { assembled, exited, presence: assembled * (1 - exited) };
  }
  function letterBase(letter) {
    const { index, row, seed } = letter;
    const state = phases(((index * 7) % 13) / 13 * .095);
    const entering = 1 - state.assembled, exiting = state.exited;
    const spreadX = Math.min(360, viewportWidth * .27), spreadY = Math.min(230, viewportHeight * .29);
    const rigid = material === 'glass';
    const originX = rigid ? (row % 2 ? 1 : -1) * spreadX * .56 : Math.sin(seed * 2.7) * spreadX;
    const originY = rigid ? (row + 1) * 70 : Math.cos(seed * 1.91) * spreadY;
    const exitX = rigid ? (row % 2 ? -1 : 1) * spreadX * .64 : Math.cos(seed * 1.47) * spreadX * .8;
    const exitY = rigid ? -(row + 1) * 75 : -spreadY * (.55 + (Math.sin(seed) + 1) * .3);
    const wave = rigid ? 0 : Math.sin(progress * Math.PI * 5 + seed) * entering * state.assembled * 65;
    return { ...state,
      x: originX * entering + exitX * exiting, y: originY * entering + exitY * exiting + wave,
      r: rigid ? ((row % 2 ? -1 : 1) * 9 * entering + 7 * exiting) : Math.sin(seed) * 62 * entering + Math.cos(seed * 1.3) * 48 * exiting,
      skew: rigid ? 0 : Math.cos(seed * .7) * 13 * (entering - exiting),
      scale: rigid ? 1 : 1 - .52 * entering - .4 * exiting };
  }
  function paintLetters() {
    const overlays = active && !paused && !reducedMotion;
    for (const letter of letters) {
      const base = letterBase(letter), blend = overlays ? base.presence : 0;
      const x = base.x + letter.x * blend, y = base.y + letter.y * blend;
      const rotation = base.r + letter.r * blend;
      const skew = base.skew + (material === 'glass' ? 0 : letter.skew * blend);
      const scale = base.scale + (material === 'glass' ? 0 : letter.scale * blend);
      letter.element.style.opacity = number(base.presence);
      letter.element.style.transform = `translate3d(${number(x)}px,${number(y)}px,0) rotate(${number(rotation)}deg) skewX(${number(skew)}deg) scale(${number(scale)})`;
    }
  }
  function panelPath(panel, presence, overlay) {
    const glass = material === 'glass', m = MATERIALS[material];
    const corner = glass ? 35 : material === 'metal' ? 22 : 52;
    const rigid = `M ${corner} 12 H ${1000 - corner} Q 988 12 988 ${corner} V ${600 - corner} Q 988 588 ${1000 - corner} 588 H ${corner} Q 12 588 12 ${600 - corner} V ${corner} Q 12 12 ${corner} 12 Z`;
    if (glass || reducedMotion) return rigid;
    const phase = progress * Math.PI * 3 + panel.index * 1.73;
    const scrollBend = Math.sin(progress * Math.PI * 2) * (1 - presence) * 42;
    const pulse = overlay ? panel.pressure * 35 + burstLife * 15 : 0;
    const ambient = overlay ? Math.sin(time * m.tempo + panel.index) * 5 * presence : 0;
    const amplitude = m.bend * (scrollBend + pulse + ambient);
    const top = Math.sin(phase) * amplitude, bottom = Math.cos(phase + .8) * amplitude;
    const left = Math.cos(phase * .7) * amplitude * .65, right = Math.sin(phase * .8) * amplitude * .65;
    return `M ${corner} 12 C 180 ${number(12 + top)} 650 ${number(12 - top * .7)} ${1000 - corner} 12 Q 988 12 988 ${corner} C ${number(988 + right)} 180 ${number(988 - right * .7)} 420 988 ${600 - corner} Q 988 588 ${1000 - corner} 588 C 800 ${number(588 + bottom)} 350 ${number(588 - bottom * .75)} ${corner} 588 Q 12 588 12 ${600 - corner} C ${number(12 + left)} 420 ${number(12 - left * .7)} 180 12 ${corner} Q 12 12 ${corner} 12 Z`;
  }
  function paintPanels() {
    const overlay = active && !paused && !reducedMotion;
    for (const panel of panelStates) {
      const state = phases(Math.min(.09, .035 + panel.index * .018));
      const enter = 1 - state.assembled, exit = state.exited, direction = panel.index % 2 ? -1 : 1;
      const x = enter * direction * Math.min(100, viewportWidth * .1) - exit * direction * 90 + (overlay ? panel.x * state.presence : 0);
      const y = enter * 115 - exit * 140 + (overlay ? panel.y * state.presence : 0);
      const r = enter * direction * 7 - exit * direction * 9 + (overlay ? panel.r * state.presence : 0);
      const scale = material === 'glass' ? 1 : 1 - enter * .13 - exit * .08;
      const prefix = panel.originalTransform && panel.originalTransform !== 'none' ? `${panel.originalTransform} ` : '';
      panel.element.style.transform = `${prefix}translate3d(${number(x)}px,${number(y)}px,0) rotate(${number(r)}deg) scale(${number(scale)})`;
      panel.element.style.opacity = number(state.presence);
      const light = material === 'glass' && overlay ? clamp(input.x / Math.max(1, viewportWidth)) : .5;
      panel.element.style.setProperty('--membrane-light', number(light));
      if (!panel.path) continue;
      panel.path.setAttribute('d', panelPath(panel, state.presence, overlay)); panel.path.setAttribute('pathLength', '1000');
      panel.path.style.strokeDasharray = '1000'; panel.path.style.strokeDashoffset = number((1 - state.presence) * 1000);
      panel.path.style.strokeOpacity = number(material === 'glass' ? .48 + light * .42 : 1);
    }
  }
  function paint() { if (!destroyed) { paintLetters(); paintPanels(); } }
  function updateSprings(dt) {
    const m = MATERIALS[material], tempo = time * m.tempo;
    const radius = Math.min(410, Math.max(230, viewportWidth * .29));
    for (const letter of letters) {
      const base = letterBase(letter);
      const dx = input.x - letter.baseX - base.x, dy = input.y - letter.baseY - base.y;
      const distance = Math.hypot(dx, dy), weight = Math.exp(-distance * distance / (radius * radius * .8)), seed = letter.seed;
      let tx = Math.sin(tempo * .66 + seed * .67) * m.idle * .48;
      let ty = Math.sin(tempo * .92 + letter.index * .39) * m.idle;
      let tr = Math.sin(tempo * .74 + seed * .8) * (material === 'glass' ? .3 : 1.2), scale = 0, skew = 0;
      if (input.left) {
        const grip = Math.min(1, .42 + holdTime * .6);
        tx += (clamp(dx * .2, -72, 72) + clamp(input.dx * m.drag, -80, 80)) * weight * m.pull * grip;
        ty += (clamp(dy * .21, -66, 66) + clamp(input.dy * m.drag, -70, 70)) * weight * m.pull * grip;
        tr += clamp(input.dx * .016, -14, 14) * weight;
        skew += clamp(input.dx * .018, -14, 14) * weight * m.pull; scale -= .07 * weight;
      }
      if (input.right) {
        const force = (65 + Math.min(holdTime, 1.4) * 28) * weight * m.pull / Math.max(distance, 35);
        tx -= dx * force; ty -= dy * force * .62;
        ty += Math.sin(tempo * 3.4 - distance * .026) * 17 * weight; tr += Math.sin(seed + tempo * 1.6) * 9 * weight;
      }
      if (input.left && input.right) { tx += Math.sin(seed * 2.1 + tempo * 2) * weight * 42; ty += Math.cos(seed * 1.7 - tempo * 1.5) * weight * 38; }
      if (burstLife) { tx += Math.sin(seed * 2.7) * 56 * burstLife * m.pull; ty += Math.cos(seed * 1.9) * 38 * burstLife * m.pull; tr += Math.sin(seed * 1.3) * 14 * burstLife; }
      if (!input.left && !input.right) { tx += clamp(input.dx * .008, -8, 8) * weight; ty += clamp(input.dy * .008, -8, 8) * weight; }
      letter.vx += ((clamp(tx, -145, 145) - letter.x) * m.spring - letter.vx * m.damping) * dt;
      letter.vy += ((clamp(ty, -110, 110) - letter.y) * m.spring - letter.vy * m.damping) * dt;
      letter.vr += ((tr - letter.r) * m.spring - letter.vr * m.damping) * dt;
      letter.vs += ((scale - letter.scale) * m.spring - letter.vs * m.damping) * dt;
      letter.x += letter.vx * dt; letter.y += letter.vy * dt; letter.r += letter.vr * dt; letter.scale += letter.vs * dt;
      letter.skew += (skew - letter.skew) * Math.min(1, dt * 5);
    }
    for (const panel of panelStates) {
      if (!panel.rect) continue;
      const rect = panel.rect, nx = clamp((input.x - rect.x) / rect.width), ny = clamp((input.y - rect.y) / rect.height);
      const distance = Math.hypot(input.x - rect.x - nx * rect.width, input.y - rect.y - ny * rect.height);
      const weight = Math.exp(-distance * distance / 100000), phase = tempo + panel.index * 1.73;
      const pressure = (input.left || input.right ? weight : input.energy * weight * .15) + burstLife * .55;
      panel.pressure += (pressure - panel.pressure) * Math.min(1, dt * (material === 'amber' ? 3 : 7));
      let tx = Math.sin(phase * .5) * 2, ty = Math.sin(phase * .73) * 2.8, tr = Math.sin(phase * .46) * .12;
      if (input.left) { tx += (clamp(input.dx * .025, -22, 22) + (nx - .5) * 18) * weight * m.pull; ty += (clamp(input.dy * .025, -18, 18) + (ny - .5) * 14) * weight * m.pull; tr += (nx - .5) * weight * 1.6; }
      if (input.right) { tx -= (nx - .5) * weight * 20; tr -= (nx - .5) * weight * 1.1; }
      panel.vx += ((tx - panel.x) * m.spring * .65 - panel.vx * m.damping) * dt;
      panel.vy += ((ty - panel.y) * m.spring * .65 - panel.vy * m.damping) * dt;
      panel.vr += ((tr - panel.r) * m.spring * .65 - panel.vr * m.damping) * dt;
      panel.x += panel.vx * dt; panel.y += panel.vy * dt; panel.r += panel.vr * dt;
    }
  }
  function clearTransient() {
    input.left = input.right = false; input.dx = input.dy = input.energy = 0; burstLife = holdTime = 0;
    letters.forEach(letter => { letter.x = letter.y = letter.r = letter.skew = letter.scale = letter.vx = letter.vy = letter.vr = letter.vs = 0; });
    panelStates.forEach(panel => { panel.x = panel.y = panel.r = panel.vx = panel.vy = panel.vr = panel.pressure = 0; });
  }
  function tick(timestamp) {
    frame = 0; if (!running()) return;
    const dt = lastTime ? Math.min(.032, Math.max(.001, (timestamp - lastTime) / 1000)) : 1 / 60;
    lastTime = timestamp; time += dt; holdTime = input.left || input.right ? holdTime + dt : 0;
    burstLife = Math.max(0, burstLife - dt * .85); updateSprings(dt); paint();
    input.dx *= Math.exp(-dt * 5); input.dy *= Math.exp(-dt * 5); input.energy *= Math.exp(-dt * 3);
    frame = requestAnimationFrame(tick);
  }
  const initialLines = Array.from(title.querySelectorAll(':scope > .title-line')).map(line => line.textContent);
  buildLines(initialLines.length ? initialLines : [title.textContent || 'MATTER']);
  listen(window, 'resize', queueMeasure);
  listen(document, 'visibilitychange', () => { if (document.hidden) clearTransient(); schedule(); });
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(queueMeasure) : null;
  resizeObserver?.observe(title); panelStates.forEach(panel => resizeObserver?.observe(panel.element));
  document.fonts?.ready.then(() => { if (!destroyed) queueMeasure(); }); schedule();
  return {
    setProgress(value) { progress = clamp(finite(value, progress)); paint(); },
    setActive(value) { const next = Boolean(value); if (next === active) return; active = next; if (!active) clearTransient(); paint(); schedule(); },
    refresh() { measure(); },
    setMaterial(value) { if (MATERIALS[value] && value !== material) { material = value; clearTransient(); paint(); } },
    setInput(value = {}) {
      input.x = finite(value.x, input.x); input.y = finite(value.y, input.y); if (!active || paused || reducedMotion) return;
      input.dx = finite(value.dx, 0); input.dy = finite(value.dy, 0); input.energy = clamp(finite(value.energy, 0));
      if ('left' in value) input.left = Boolean(value.left); if ('right' in value) input.right = Boolean(value.right);
    },
    setText(lines) { clearTransient(); buildLines(lines); },
    burst() { if (active && !paused && !reducedMotion) burstLife = 1; },
    setPaused(value) { paused = Boolean(value); if (paused) clearTransient(); paint(); schedule(); },
    setReducedMotion(value) { reducedMotion = Boolean(value); clearTransient(); paint(); schedule(); queueMeasure(); },
    destroy() {
      destroyed = true; if (frame) cancelAnimationFrame(frame); if (measureFrame) cancelAnimationFrame(measureFrame);
      resizeObserver?.disconnect(); unsubscribe.forEach(fn => fn()); title.innerHTML = original.html;
      if (original.label === null) title.removeAttribute('aria-label'); else title.setAttribute('aria-label', original.label);
      panelStates.forEach(panel => {
        if (panel.originalStyle === null) panel.element.removeAttribute('style'); else panel.element.setAttribute('style', panel.originalStyle);
        if (!panel.path) return;
        if (panel.originalPath === null) panel.path.removeAttribute('d'); else panel.path.setAttribute('d', panel.originalPath);
        if (panel.originalPathStyle === null) panel.path.removeAttribute('style'); else panel.path.setAttribute('style', panel.originalPathStyle);
        if (panel.originalPathLength === null) panel.path.removeAttribute('pathLength'); else panel.path.setAttribute('pathLength', panel.originalPathLength);
      });
    },
  };
}
