import { SCENE_CATALOG, MATERIAL_LIBRARY, getScene } from './scene-catalog.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
// Pure quality controller: sampling only active-frame intervals avoids idle bias.
export function createViewerQualityController({ mode = 'auto', now = 0 } = {}) {
  const tiers = [{ name: 'high', pixels: 900000, ratio: 1.5 }, { name: 'medium', pixels: 600000, ratio: 1.25 }, { name: 'low', pixels: 360000, ratio: 1 }];
  const forced = tiers.findIndex(tier => tier.name === mode);
  let level = forced < 0 ? 0 : forced, average = 1000 / 60, slow = 0, fast = 0, changedAt = now, samples = 0, total = 0;
  return {
    observe(milliseconds, time) {
      if (!Number.isFinite(milliseconds) || milliseconds <= 0 || milliseconds > 100) return false;
      samples++; total += milliseconds; average += (milliseconds - average) * .08;
      if (forced >= 0) return false;
      slow = average > 23 ? slow + 1 : Math.max(0, slow - 2);
      fast = average < 18 ? fast + 1 : 0;
      const before = level;
      if (slow >= 24 && level < 2 && time - changedAt > 1500) level++;
      else if (fast >= 180 && level > 0 && time - changedAt > 5000) level--;
      if (before !== level) { changedAt = time; slow = fast = 0; return true; }
      return false;
    },
    snapshot() { return { ...tiers[level], mode: forced < 0 ? 'auto' : mode, activeFrameMs: samples ? total / samples : 0, activeFrameSamples: samples, smoothedFrameMs: average }; }
  };
}
const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function multiply(a, b) { const out = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return out; }
function perspective(aspect) { const f = 1 / Math.tan(.7 / 2), near = .1, far = 30; return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]); }
function orthographic(aspect, distance) { const half = distance * .35 * Math.max(1, .92 / aspect); return new Float32Array([1 / (half * aspect), 0, 0, 0, 0, 1 / half, 0, 0, 0, 0, -2 / 29.9, 0, 0, 0, -30.1 / 29.9, 1]); }
function rotation(yaw, pitch) { const y = identity(), x = identity(); y[0] = y[10] = Math.cos(yaw); y[2] = -Math.sin(yaw); y[8] = Math.sin(yaw); x[5] = x[10] = Math.cos(pitch); x[6] = Math.sin(pitch); x[9] = -Math.sin(pitch); return multiply(y, x); }

const VERTEX = `
attribute vec3 aPosition; attribute vec3 aNormal; attribute vec2 aUV; attribute float aRole;
uniform mat4 uModel; uniform mat4 uVP;
varying vec3 vPosition; varying vec3 vNormal; varying vec2 vUV; varying float vRole;
void main(){vec4 p=uModel*vec4(aPosition,1.);vPosition=p.xyz;vNormal=normalize(mat3(uModel)*aNormal);vUV=aUV;vRole=aRole;gl_Position=uVP*p;}`;
const FRAGMENT = `
precision mediump float;
varying vec3 vPosition; varying vec3 vNormal; varying vec2 vUV; varying float vRole;
uniform vec3 uColor; uniform float uMaterial; uniform float uRoughness; uniform float uGrid; uniform float uShadow;
void main(){
 if(uShadow>.5){vec2 q=vUV*2.-1.;float a=exp(-dot(q,q)*3.8)*.19;gl_FragColor=vec4(.12,.14,.19,a);return;}
 vec3 N=normalize(vNormal);if(!gl_FrontFacing)N=-N;
 vec3 V=normalize(vec3(0.,0.,6.)-vPosition),L=normalize(vec3(-3.,4.,5.));
 float material=uMaterial;vec3 base=uColor;float rough=uRoughness;
 if(vRole>.5&&vRole<1.5){material=1.;base=vec3(.43,.49,.58);rough=.24;}
 if(vRole>1.5&&vRole<2.5){material=5.;base=vec3(1.,.65,.23);rough=.6;}
 if(vRole>2.5){material=0.;base=vec3(.08,.1,.16);rough=.7;}
 float diffuse=max(dot(N,L),0.);float fill=max(dot(N,normalize(vec3(3.,1.,-2.))),0.);
 float facing=max(dot(N,V),0.),fres=pow(1.-facing,5.);
 float spec=pow(max(dot(N,normalize(L+V)),0.),mix(110.,6.,rough));
 vec3 R=reflect(-V,N);float strip=pow(max(0.,1.-abs(R.y-.45)*2.3),10.);float second=pow(max(0.,1.-abs(R.x+.42)*3.),15.);
 vec3 studio=vec3(.2,.25,.38)+vec3(.72,.77,.88)*strip+vec3(.38,.46,.7)*second;
 if(material>2.5&&material<3.5){float weave=sin(vUV.x*420.)*sin(vUV.y*340.);base*=.86+.14*weave;}
 if(material>3.5&&material<4.5){float grain=sin(vPosition.y*18.+sin(vPosition.x*5.)*2.+vPosition.z*4.);float fine=sin(vPosition.y*113.+vPosition.x*12.);base*=.78+.15*grain+.055*fine;}
 vec3 color=base*(.42+diffuse*.6+fill*.2)+vec3(spec)*(.18+(1.-rough)*.5);
 if(material>.5&&material<1.5)color=base*(.24+diffuse*.22)+studio*(.35+fres*.52)+vec3(spec)*.5;
 float alpha=1.;
 if(material>1.5&&material<2.5){vec3 T=refract(-V,N,1./1.45);float panel=pow(max(0.,1.-abs(T.x+.24)*2.2),8.);vec3 refracted=vec3(.76,.83,.84)+vec3(.16,.14,.09)*panel+vec3(sin(T.y*8.+vPosition.y)*.035);color=mix(refracted,base,.16)+studio*(.12+fres*.65)+vec3(spec)*.55;alpha=.54+fres*.44;}
 if(material>4.5)color=base*.72+sqrt(base)*.48+vec3(spec)*.12;
 if(uGrid>.5&&vRole<.5){vec2 grid=abs(fract(vUV*vec2(32.,24.)+.5)-.5);float line=1.-smoothstep(.022,.06,min(grid.x,grid.y));color=mix(color,vec3(.08,.12,.3),line*.55);}
 color=color/(color+vec3(.5));color=pow(color,vec3(.8));gl_FragColor=vec4(color,alpha);
}`;

function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: false });
  if (!gl) throw new Error('WebGL недоступен');
  const compile = (type, source) => { const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const error = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(error || 'Shader compilation failed'); } return shader; };
  let vs = null, fs = null, program = null;
  try {
    vs = compile(gl.VERTEX_SHADER, VERTEX); fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Не удалось подготовить освещение');
  } catch (error) { if (vs) gl.deleteShader(vs); if (fs) gl.deleteShader(fs); if (program) gl.deleteProgram(program); throw error; }
  gl.deleteShader(vs); gl.deleteShader(fs);
  gl.useProgram(program);
  const uniforms = Object.fromEntries(['uModel', 'uVP', 'uColor', 'uMaterial', 'uRoughness', 'uGrid', 'uShadow'].map(name => [name, gl.getUniformLocation(program, name)]));
  const attributes = [['aPosition', 3, 0], ['aNormal', 3, 12], ['aUV', 2, 24], ['aRole', 1, 32]].map(([name, size, offset]) => ({ location: gl.getAttribLocation(program, name), size, offset }));
  let objectBuffer = null, geometry = null, width = 1, height = 1, mvp = identity(), draws = 0, cpuTotal = 0, lastRenderKey = '';
  const quality = createViewerQualityController({ mode: new URLSearchParams(location.search).get('quality') || 'auto', now: performance.now() });
  const shadowBuffer = gl.createBuffer();
  const shadow = [];
  const shadowVertex = (x, z, u, v) => shadow.push(x, -1.32, z, 0, 1, 0, u, v, 0);
  shadowVertex(-1.6, -1.3, 0, 0); shadowVertex(1.6, -1.3, 1, 0); shadowVertex(1.6, 1.3, 1, 1); shadowVertex(-1.6, -1.3, 0, 0); shadowVertex(1.6, 1.3, 1, 1); shadowVertex(-1.6, 1.3, 0, 1);
  gl.bindBuffer(gl.ARRAY_BUFFER, shadowBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shadow), gl.STATIC_DRAW);
  const bind = buffer => { gl.bindBuffer(gl.ARRAY_BUFFER, buffer); attributes.forEach(({ location, size, offset }) => { gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 36, offset); }); };
  function resize() {
    const cssWidth = Math.max(1, canvas.clientWidth), cssHeight = Math.max(1, canvas.clientHeight);
    const tier = quality.snapshot();
    const ratio = Math.min(devicePixelRatio || 1, tier.ratio, Math.sqrt(tier.pixels / (cssWidth * cssHeight)));
    width = Math.max(1, Math.floor(cssWidth * ratio)); height = Math.max(1, Math.floor(cssHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const pixels = String(width * height); if (canvas.dataset.pixels !== pixels) canvas.dataset.pixels = pixels;
    return cssWidth / cssHeight;
  }
  return {
    load(next) { if (objectBuffer) gl.deleteBuffer(objectBuffer); geometry = next; lastRenderKey = ''; objectBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, objectBuffer); gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW); canvas.dataset.vertices = String(geometry.count); canvas.dataset.triangles = String(geometry.triangles); },
    render(camera, material, grid) {
      if (!geometry || gl.isContextLost()) return;
      const started = performance.now();
      const aspect = resize(), key = [width, height, camera.yaw.toFixed(5), camera.pitch.toFixed(5), camera.distance.toFixed(5), !!camera.orthographic, material.id, !!grid].join('|');
      if (key === lastRenderKey) return;
      lastRenderKey = key;
      const model = rotation(camera.yaw, camera.pitch), view = identity();
      view[14] = -camera.distance * Math.max(1, 1 / aspect * .92);
      const vp = multiply(camera.orthographic ? orthographic(aspect, camera.distance) : perspective(aspect), view); mvp = multiply(vp, model);
      gl.viewport(0, 0, width, height); gl.clearColor(.914, .902, .871, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program); gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(uniforms.uVP, false, vp); gl.uniformMatrix4fv(uniforms.uModel, false, identity());
      gl.uniform1f(uniforms.uShadow, 1); gl.depthMask(false); bind(shadowBuffer); gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.uniformMatrix4fv(uniforms.uModel, false, model); gl.uniform1f(uniforms.uShadow, 0); gl.depthMask(true);
      gl.uniform3fv(uniforms.uColor, material.color); gl.uniform1f(uniforms.uMaterial, material.id); gl.uniform1f(uniforms.uRoughness, material.roughness); gl.uniform1f(uniforms.uGrid, grid ? 1 : 0);
      bind(objectBuffer); gl.drawArrays(gl.TRIANGLES, 0, geometry.count);
      draws++; cpuTotal += performance.now() - started;
    },
    observeInterval(milliseconds, time) { quality.observe(milliseconds, time); },
    flushMetrics(idle = true) { const tier = quality.snapshot(); Object.assign(canvas.dataset, { renderCount: String(draws), drawCalls: geometry ? '2' : '0', drawCpuMs: draws ? (cpuTotal / draws).toFixed(3) : '0', activeFrameMs: tier.activeFrameMs.toFixed(2), activeFrameSamples: String(tier.activeFrameSamples), smoothedFrameMs: tier.smoothedFrameMs.toFixed(2), renderIdle: String(idle), quality: tier.name, qualityLevel: tier.name, qualityMode: tier.mode, pixelBudget: String(tier.pixels) }); },
    project(point) { const p = [...point, 1], out = [0, 0, 0, 0]; for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[r] += mvp[k * 4 + r] * p[k]; return { x: (out[0] / out[3] * .5 + .5) * 100, y: (-out[1] / out[3] * .5 + .5) * 100, visible: out[3] > 0 && Math.abs(out[0] / out[3]) < .94 && Math.abs(out[1] / out[3]) < .94 }; },
    releaseGeometry() { if (objectBuffer && !gl.isContextLost()) gl.deleteBuffer(objectBuffer); objectBuffer = null; geometry = null; },
    dispose(lost = false) { if (!lost) { if (objectBuffer) gl.deleteBuffer(objectBuffer); gl.deleteBuffer(shadowBuffer); gl.deleteProgram(program); } objectBuffer = null; geometry = null; },
    gl
  };
}

export function initObjectViewer({ reducedMotion = false } = {}) {
  const cleanup = [];
  const listen = (target, type, fn, options) => { target.addEventListener(type, fn, options); cleanup.push(() => target.removeEventListener(type, fn, options)); };
  if (!document.querySelector('link[data-object-viewer-style]')) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('./object-viewer.css', import.meta.url).href; link.dataset.objectViewerStyle = ''; document.head.append(link); }
  const dialog = document.createElement('dialog'); dialog.className = 'ov-dialog'; dialog.setAttribute('aria-labelledby', 'ov-title'); dialog.setAttribute('aria-describedby', 'ov-description');
  dialog.innerHTML = `<div class="ov-shell"><header class="ov-header"><span class="ov-eyebrow">MATTER / ПРОСТРАНСТВЕННЫЙ АТЛАС</span><button type="button" class="ov-close" data-ov-close aria-label="Закрыть просмотр">×</button></header><div class="ov-layout"><div class="ov-visual"><div class="ov-stage"><div class="ov-fallback"></div><div class="ov-hotspots" aria-label="Информационные точки"></div><div class="ov-status" role="status"><span></span><button type="button" data-ov-retry>Попробовать снова</button></div></div><div class="ov-tools"><button type="button" data-ov-rotate aria-pressed="false">Вращать жестом</button><div class="ov-zoom"><button type="button" data-ov-zoom="-1" aria-label="Отдалить объект">−</button><span data-ov-scale>100%</span><button type="button" data-ov-zoom="1" aria-label="Приблизить объект">+</button></div><button type="button" data-ov-reset>Сбросить ↺</button></div><p class="ov-help">Мышь — повернуть · стрелки — ракурс · + / − — масштаб. На телефоне сначала включи вращение.</p></div><aside class="ov-info"><nav class="ov-object-tabs" aria-label="Объекты">${Object.values(SCENE_CATALOG).map(scene => `<button type="button" data-ov-object="${scene.id}">${scene.title.split(' / ')[0]}</button>`).join('')}</nav><h2 id="ov-title"></h2><p class="ov-subtitle"></p><p id="ov-description"></p><fieldset class="ov-materials"><legend>Одна форма. Разные ощущения.</legend><div></div></fieldset><p class="ov-material-note"></p><div class="ov-presets" aria-label="Ракурсы"></div><div class="ov-turn-controls"><button type="button" data-ov-turn="-1">↶ Влево</button><button type="button" data-ov-turn="1">Вправо ↷</button></div><button type="button" class="ov-grid" data-ov-grid aria-pressed="false">Показать сетку поверхности</button><div class="ov-detail-tabs" aria-label="Детали объекта"></div><section class="ov-detail" aria-live="polite"><span class="ov-eyebrow">ДЕТАЛЬ ОБЪЕКТА</span><h3></h3><p></p></section><p class="ov-source"></p><p class="ov-limitation">Студийный свет, материалы и контактная тень — визуальные приближения. Фотореалистичный HDRI и физическая симуляция не используются.</p></aside></div></div>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  const stage = $('.ov-stage'), fallback = $('.ov-fallback'), status = $('.ov-status'), statusText = $('.ov-status span'), hotspots = $('.ov-hotspots'), materialButtons = $('.ov-materials div'), presetButtons = $('.ov-presets');
  const canvas = document.createElement('canvas'); canvas.className = 'ov-canvas'; canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Трёхмерный объект. Стрелки вращают, плюс и минус изменяют масштаб.');
  let renderer = null, current = getScene('field'), currentMaterial = current.material, reduced = !!reducedMotion;
  let camera = { ...current.camera }, target = { ...camera }, grid = false, opened = false, destroyed = false, rotateMode = false, lost = false;
  let frame = 0, lastTime = 0, generation = 0, loadedId = '', returnFocus = null, inlineStage = null, inlinePointer = { x: 0, y: 0 }, pulse = 0;
  let geometryPromise = null, retryCount = 0, stateName = 'idle', drag = null, pinch = null, briefOpen = Boolean(document.querySelector('#matter-brief-dialog[open]'));
  const geometryCache = new Map(), pointers = new Map();
  const inlineStages = [...document.querySelectorAll('[data-object-stage]')];
  const visibility = new Map(inlineStages.map(element => [element, 0]));
  const emit = () => document.dispatchEvent(new CustomEvent('matter:viewer-state', { detail: { open: opened, inlineActive: !opened && !!inlineStage && !briefOpen, id: current.id } }));
  function setState(name, message = '') {
    stateName = name; dialog.dataset.state = name; canvas.dataset.state = name;
    statusText.textContent = message; status.hidden = name === 'ready' || name === 'idle';
    $('[data-ov-retry]').hidden = !['error', 'lost'].includes(name);
    const ready = name === 'ready';
    dialog.querySelectorAll('[data-ov-rotate],[data-ov-zoom],[data-ov-reset],[data-ov-material],[data-ov-preset],[data-ov-grid],[data-ov-turn]').forEach(button => button.disabled = !ready);
    canvas.tabIndex = ready && opened ? 0 : -1;
    if (!ready) setRotate(false);
    canvas.style.opacity = name === 'ready' ? '1' : '0';
    if (inlineStage) inlineStage.dataset.objectState = name;
    dialog.dataset.model = current.id;
  }
  function updateInfo() {
    $('#ov-title').textContent = current.title; $('.ov-subtitle').textContent = current.subtitle; $('#ov-description').textContent = current.description; $('.ov-source').textContent = current.source;
    fallback.innerHTML = current.fallbackSvg;
    materialButtons.innerHTML = current.materials.map(key => `<button type="button" data-ov-material="${key}" aria-pressed="${key === currentMaterial}"><i style="--swatch:rgb(${MATERIAL_LIBRARY[key].color.map(v => Math.round(v * 255)).join(',')})"></i>${MATERIAL_LIBRARY[key].name}</button>`).join('');
    $('.ov-material-note').textContent = MATERIAL_LIBRARY[currentMaterial].description;
    presetButtons.innerHTML = current.presets.map(preset => `<button type="button" data-ov-preset="${preset.id}">${preset.name}</button>`).join('') + '<button type="button" data-ov-preset="iso">Изометрия</button>';
    hotspots.innerHTML = current.hotspots.map((point, index) => `<button type="button" class="ov-hotspot" data-ov-hotspot="${point.id}" aria-label="${point.title}">${index + 1}</button>`).join('');
    $('.ov-detail-tabs').innerHTML = current.hotspots.map(point => `<button type="button" data-ov-hotspot="${point.id}">${point.title}</button>`).join('');
    $('[data-ov-grid]').hidden = current.id !== 'field'; $('[data-ov-grid]').setAttribute('aria-pressed', String(grid));
    dialog.querySelectorAll('[data-ov-object]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.ovObject === current.id)));
    showHotspot(current.hotspots[0].id);
    dialog.dataset.material = currentMaterial;
  }
  function showHotspot(id) { const info = current.hotspots.find(item => item.id === id) || current.hotspots[0]; $('.ov-detail h3').textContent = info.title; $('.ov-detail p').textContent = info.text; dialog.querySelectorAll('[data-ov-hotspot]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.ovHotspot === info.id))); }
  async function ensureReady() {
    const ticket = ++generation;
    setState('loading', 'Подготавливаем геометрию и свет…');
    try {
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (destroyed || ticket !== generation || briefOpen || (!opened && !inlineStage)) return;
      if (!geometryPromise) geometryPromise = import('./object-geometry.js').catch(error => { geometryPromise = null; throw error; });
      const { buildObjectGeometry } = await geometryPromise;
      if (destroyed || ticket !== generation || briefOpen || (!opened && !inlineStage)) return;
      if (!renderer) { renderer = createRenderer(canvas); loadedId = ''; lost = false; }
      if (!geometryCache.has(current.id)) geometryCache.set(current.id, buildObjectGeometry(current.id));
      if (loadedId !== current.id) { renderer.load(geometryCache.get(current.id)); loadedId = current.id; }
      retryCount = 0; setState('ready'); requestDraw();
    } catch (error) {
      if (ticket !== generation || destroyed) return;
      setState('error', '3D недоступен. Иллюстрация и описание остаются доступны.');
      canvas.dataset.error = error?.message || 'Renderer initialization failed';
    }
  }
  function stopRendering() { if (frame) cancelAnimationFrame(frame); frame = 0; lastTime = 0; if (renderer) renderer.flushMetrics(true); else canvas.dataset.renderIdle = 'true'; }
  function requestDraw() { if (!frame && !destroyed && !document.hidden && !briefOpen && (opened || inlineStage)) { if (canvas.dataset.renderIdle !== 'false') canvas.dataset.renderIdle = 'false'; frame = requestAnimationFrame(draw); } }
  function draw(time) {
    frame = 0;
    if (destroyed || document.hidden || briefOpen || (!opened && !inlineStage)) { stopRendering(); return; }
    const interval = lastTime ? time - lastTime : 0;
    if (interval > 0) renderer?.observeInterval(interval, time);
    const dt = interval > 0 && interval <= 100 ? Math.min(.05, interval / 1000) : 1 / 60; lastTime = time;
    if (!opened && inlineStage) {
      const rect = inlineStage.getBoundingClientRect(), travel = clamp((innerHeight * .5 - rect.top - rect.height * .5) / innerHeight, -.8, .8);
      target = { yaw: current.camera.yaw + (reduced ? 0 : travel * .5 + inlinePointer.x * .18), pitch: current.camera.pitch + (reduced ? 0 : inlinePointer.y * .09 + pulse * .06), distance: current.camera.distance + .25 };
    }
    let settling = false;
    for (const key of ['yaw', 'pitch', 'distance']) {
      const delta = target[key] - camera[key];
      if (reduced || Math.abs(delta) < .0005) camera[key] = target[key];
      else { camera[key] += delta * (1 - Math.exp(-dt * 16)); settling = true; }
    }
    camera.orthographic = !!target.orthographic;
    if (pulse > 0) { pulse *= Math.exp(-dt * 8); if (pulse < .001) pulse = 0; else settling = true; }
    if (renderer && stateName === 'ready') {
      renderer.render(camera, MATERIAL_LIBRARY[currentMaterial], grid || (!opened && pulse > .15));
      if (opened) {
        hotspots.querySelectorAll('button').forEach((button, index) => { const p = renderer.project(current.hotspots[index].point); button.style.left = `${p.x.toFixed(2)}%`; button.style.top = `${p.y.toFixed(2)}%`; button.style.visibility = p.visible ? 'visible' : 'hidden'; });
        $('[data-ov-scale]').textContent = `${Math.round(current.camera.distance / camera.distance * 100)}%`;
      }
    }
    dialog.dataset.yaw = camera.yaw.toFixed(3); dialog.dataset.pitch = camera.pitch.toFixed(3); dialog.dataset.distance = camera.distance.toFixed(3);
    dialog.dataset.projection = camera.orthographic ? 'orthographic' : 'perspective';
    if (settling) requestDraw(); else stopRendering();
  }
  function resetCamera() { target = { ...current.camera }; if (reduced) camera = { ...target }; requestDraw(); }
  function selectObject(id) { current = getScene(id); currentMaterial = current.material; grid = false; camera = { ...current.camera }; target = { ...camera }; updateInfo(); ensureReady(); }
  function zoom(amount) { target.distance = clamp(target.distance + amount, 3.4, 7.3); requestDraw(); }
  function setRotate(value) { rotateMode = !!value; canvas.style.touchAction = rotateMode && opened ? 'none' : 'pan-y'; $('[data-ov-rotate]').setAttribute('aria-pressed', String(rotateMode)); $('[data-ov-rotate]').textContent = rotateMode ? 'Завершить вращение' : 'Вращать жестом'; for (const id of pointers.keys()) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id); pointers.clear(); drag = pinch = null; }
  function chooseInline() {
    if (opened || destroyed || briefOpen) return;
    const best = inlineStages.filter(element => (visibility.get(element) || 0) > 0).sort((a, b) => (visibility.get(b) || 0) - (visibility.get(a) || 0))[0] || null;
    if (best === inlineStage) { if (best && (!reduced || stateName !== 'ready')) requestDraw(); else if (!best && loadedId) { renderer?.releaseGeometry(); loadedId = ''; } return; }
    if (inlineStage) delete inlineStage.dataset.objectActive;
    inlineStage = best; inlinePointer = { x: 0, y: 0 };
    if (!best) { generation++; stopRendering(); canvas.remove(); renderer?.releaseGeometry(); loadedId = ''; emit(); return; }
    current = getScene(best.dataset.objectStage); currentMaterial = current.material; grid = false; camera = { ...current.camera }; target = { ...camera }; best.dataset.objectActive = 'true'; canvas.classList.add('ov-inline-canvas'); canvas.tabIndex = -1; canvas.setAttribute('aria-hidden', 'true'); best.append(canvas); emit(); ensureReady();
  }
  function open(id = 'field', trigger = document.activeElement) {
    if (destroyed) return;
    returnFocus = trigger instanceof HTMLElement ? trigger : null; opened = true; inlinePointer = { x: 0, y: 0 };
    current = getScene(id); currentMaterial = current.material; grid = false; camera = { ...current.camera }; target = { ...camera };
    emit(); updateInfo(); setRotate(false); canvas.classList.remove('ov-inline-canvas'); canvas.tabIndex = 0; canvas.removeAttribute('aria-hidden'); stage.insertBefore(canvas, hotspots);
    if (!dialog.open) dialog.showModal(); document.documentElement.classList.add('ov-modal-open'); $('[data-ov-close]').focus(); ensureReady();
  }
  function close() {
    if (!opened) return;
    opened = false; generation++; setRotate(false); if (dialog.open) dialog.close(); document.documentElement.classList.remove('ov-modal-open');
    stopRendering(); inlineStage = null; canvas.remove(); emit(); chooseInline(); returnFocus?.focus({ preventScroll: true }); returnFocus = null;
  }
  listen(document, 'click', event => { const button = event.target instanceof Element ? event.target.closest('[data-open-object]') : null; if (button) { event.preventDefault(); open(button.dataset.openObject, button); } });
  listen(dialog, 'click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-ov-close')) close();
    if (button.hasAttribute('data-ov-retry')) { if (retryCount >= 3) { statusText.textContent = 'Повторные попытки остановлены. Используй иллюстрацию или открой просмотр заново.'; return; } retryCount++; if (renderer) renderer.dispose(lost); renderer = null; ensureReady(); }
    if (button.dataset.ovObject) selectObject(button.dataset.ovObject);
    if (button.dataset.ovMaterial) { currentMaterial = button.dataset.ovMaterial; materialButtons.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.ovMaterial === currentMaterial))); $('.ov-material-note').textContent = MATERIAL_LIBRARY[currentMaterial].description; dialog.dataset.material = currentMaterial; requestDraw(); }
    if (button.dataset.ovPreset) { const preset = button.dataset.ovPreset === 'iso' ? { yaw: -.65, pitch: .48, distance: 4.6, orthographic: true } : current.presets.find(item => item.id === button.dataset.ovPreset); target = { yaw: preset.yaw, pitch: preset.pitch, distance: preset.distance, orthographic: !!preset.orthographic }; requestDraw(); }
    if (button.dataset.ovHotspot) showHotspot(button.dataset.ovHotspot);
    if (button.dataset.ovZoom) zoom(-Number(button.dataset.ovZoom) * .45);
    if (button.dataset.ovTurn) { target.yaw = clamp(target.yaw + Number(button.dataset.ovTurn) * .3, -Math.PI, Math.PI); requestDraw(); }
    if (button.hasAttribute('data-ov-reset')) resetCamera();
    if (button.hasAttribute('data-ov-rotate')) setRotate(!rotateMode);
    if (button.hasAttribute('data-ov-grid')) { grid = !grid; button.setAttribute('aria-pressed', String(grid)); requestDraw(); }
  });
  listen(dialog, 'cancel', event => { event.preventDefault(); close(); });
  listen(dialog, 'close', () => { if (opened) close(); });
  listen(canvas, 'keydown', event => {
    if (!opened) return;
    if (event.key === 'ArrowLeft') target.yaw -= .18; else if (event.key === 'ArrowRight') target.yaw += .18;
    else if (event.key === 'ArrowUp') target.pitch = clamp(target.pitch + .12, -.65, .95); else if (event.key === 'ArrowDown') target.pitch = clamp(target.pitch - .12, -.65, .95);
    else if (['+', '='].includes(event.key)) zoom(-.4); else if (event.key === '-') zoom(.4); else if (event.key.toLowerCase() === 'r') resetCamera(); else return;
    target.yaw = clamp(target.yaw, -Math.PI, Math.PI); event.preventDefault(); requestDraw();
  });
  listen(canvas, 'pointerdown', event => {
    if (!opened || (event.pointerType === 'touch' && !rotateMode)) return;
    if (event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId); pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    drag = { x: event.clientX, y: event.clientY, yaw: target.yaw, pitch: target.pitch };
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { length: Math.hypot(a.x - b.x, a.y - b.y), distance: target.distance }; }
  });
  listen(canvas, 'pointermove', event => {
    if (!opened || !pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch && pointers.size === 2) { const [a, b] = [...pointers.values()]; const distance = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)); target.distance = clamp(pinch.distance * pinch.length / distance, 3.4, 7.3); }
    else if (drag) { target.yaw = clamp(drag.yaw + (event.clientX - drag.x) * .008, -Math.PI, Math.PI); target.pitch = clamp(drag.pitch + (event.clientY - drag.y) * .006, -.65, .95); }
    requestDraw();
  });
  const pointerEnd = event => { pointers.delete(event.pointerId); if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); pinch = null; if (!pointers.size) drag = null; else { const point = [...pointers.values()][0]; drag = { ...point, yaw: target.yaw, pitch: target.pitch }; } };
  listen(canvas, 'pointerup', pointerEnd); listen(canvas, 'pointercancel', pointerEnd); listen(canvas, 'lostpointercapture', event => { pointers.delete(event.pointerId); if (!pointers.size) drag = pinch = null; });
  listen(canvas, 'wheel', event => { if (!opened || !event.ctrlKey) return; event.preventDefault(); zoom(event.deltaY > 0 ? .18 : -.18); }, { passive: false });
  listen(canvas, 'webglcontextlost', event => { event.preventDefault(); lost = true; stopRendering(); setState('lost', 'Графический контекст потерян. Показана запасная иллюстрация.'); });
  listen(canvas, 'webglcontextrestored', () => { if (destroyed) return; renderer?.dispose(true); renderer = null; loadedId = ''; lost = false; if (opened || inlineStage) ensureReady(); });
  inlineStages.forEach(element => {
    listen(element, 'pointermove', event => { if (opened || reduced || inlineStage !== element || event.pointerType === 'touch') return; const rect = element.getBoundingClientRect(); inlinePointer.x = clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1); inlinePointer.y = clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1); requestDraw(); }, { passive: true });
    listen(element, 'pointerleave', () => { if (reduced) return; inlinePointer = { x: 0, y: 0 }; requestDraw(); }, { passive: true });
    listen(element, 'pointerdown', event => { if (opened || inlineStage !== element || reduced) return; pulse = 1; requestDraw(); }, { passive: true });
  });
  const observer = new IntersectionObserver(entries => { entries.forEach(entry => visibility.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0)); chooseInline(); }, { threshold: [0, .15, .4, .7, 1] });
  inlineStages.forEach(element => observer.observe(element));
  const resizeObserver = new ResizeObserver(() => requestDraw()); resizeObserver.observe(stage); inlineStages.forEach(element => resizeObserver.observe(element));
  listen(window, 'scroll', () => { if (!opened && inlineStage && !reduced) requestDraw(); }, { passive: true });
  listen(window, 'resize', requestDraw, { passive: true });
  listen(window, 'blur', () => { pointers.clear(); drag = pinch = null; });
  listen(document, 'matter:brief-state', event => { briefOpen = !!event.detail?.open; canvas.inert = briefOpen; if (briefOpen) { generation++; stopRendering(); pointers.clear(); drag = pinch = null; } else { if (opened || inlineStage) ensureReady(); else chooseInline(); } emit(); });
  listen(document, 'visibilitychange', () => { if (document.hidden) stopRendering(); else requestDraw(); });
  updateInfo();
  return {
    open, close,
    setReducedMotion(value) { reduced = !!value; pulse = 0; if (reduced) { camera = { ...target }; inlinePointer = { x: 0, y: 0 }; } requestDraw(); },
    destroy() { close(); destroyed = true; generation++; stopRendering(); observer.disconnect(); resizeObserver.disconnect(); cleanup.forEach(fn => fn()); renderer?.dispose(lost); geometryCache.clear(); canvas.remove(); dialog.remove(); inlineStage = null; emit(); }
  };
}
