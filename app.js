import { initCommerce } from './commerce.js';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const lifetime = new AbortController();
const on = (element, name, handler, options = {}) => element.addEventListener(name, handler, { ...options, signal: lifetime.signal });
const motionKey = 'matter.motion.v1';
let savedMotion = null;
try { const value = localStorage.getItem(motionKey); if (value === 'reduce' || value === 'full') savedMotion = value; } catch {  }
const scenes = $$('.scene');
const motionElements = $$('[data-motion]');
const inkElements = $$('[data-ink]');
const actionButtons = $$('[data-action]');
const pullButtons = actionButtons.filter(button => button.dataset.action === 'pull');
const revealButtons = actionButtons.filter(button => button.dataset.action === 'reveal');
const motionButtons = $$('[data-motion-toggle]');
const coordinateX = $('[data-coordinate="x"]');
const coordinateY = $('[data-coordinate="y"]');
const announcement = $('#announcement');
const sculptureCanvas = $('#sculpture');
const fieldTrack = $('.field-track');
const motionNodes = motionElements.map(element => ({ element, section: element.closest('.scene'), kind: element.dataset.motion, direction: Number(element.dataset.direction) || 1, entry: null, top: 0, height: 0, transform: '' }));
const styleMemo = new WeakMap();
function writeStyle(element, property, value) {
	let memo = styleMemo.get(element);
	if (!memo) { memo = new Map(); styleMemo.set(element, memo); }
	if (memo.get(property) === value) return;
	memo.set(property, value);
	element.style.setProperty(property, value);
}
function writeData(element, property, value) { if (element.dataset[property] !== value) element.dataset[property] = value; }
let reduced = savedMotion ? savedMotion === 'reduce' : preference.matches;
let frame = 0;
let previousTime = 0;
let pointerX = 0, pointerY = 0;
let left = false, right = false, latchedPull = false, latchedReveal = false;
let pull = 0, reveal = 0, impulse = 0;
let measurements = [];
let height = innerHeight;
let fieldTop = 0;
let maxScroll = 1;
let touchStart = null;
let needsMeasure = true;
let scrollDirty = true;
let inputDirty = true;
let stateProgress = 0;
let visibleMotionNodes = [];
let approachMeasure = null;
let heroNear = true;
let modalOpen = false;
let briefOpen = false, viewerOpen = false, inlineActive = false, disposed = false;
let viewer = null, viewerPromise = null, viewerRequest = 0, viewerAttempt = 0;
let sculpturePromise = null, studiesPromise = null;
const noRenderer = () => ({ setState() {}, setReducedMotion() {}, setActive() {}, resize() {}, destroy() {} });
let sculpture = noRenderer(), studies = noRenderer();
let sculptureReady = false, studiesReady = false, sculptureFailed = false, studiesFailed = false;
let latestState = { progress: 0, pointerX: 0, pointerY: 0, pull: 0, reveal: 0, impulse: 0 };
const root = document.documentElement;
document.body.classList.add('is-enhanced');
document.body.classList.toggle('is-reduced', reduced);
const commerce = initCommerce();
function arbitrateRendering() {
	modalOpen = briefOpen || viewerOpen;
	sculpture.setActive(!modalOpen && !inlineActive && !document.hidden);
	studies.setActive(!modalOpen && !document.hidden);
	sculptureCanvas.style.visibility = modalOpen || inlineActive ? 'hidden' : '';
	if (modalOpen) releaseAll();
}
async function loadSculpture() {
	if (disposed || sculptureReady || sculptureFailed || modalOpen || inlineActive) return;
	if (!sculpturePromise) sculpturePromise = import('./sculpture.js').then(({ createSculpture }) => {
		if (disposed || modalOpen || inlineActive) return;
		sculpture = createSculpture(sculptureCanvas, { reducedMotion: reduced, onReady: info => { sculptureCanvas.dataset.renderer = info?.renderer || 'ready'; } });
		sculptureReady = true;
		sculpture.setState(reduced ? { ...latestState, progress: 0 } : latestState);
		document.body.classList.add('has-sculpture');
		arbitrateRendering();
	}).catch(() => { sculptureFailed = true; sculptureCanvas.dataset.renderer = 'unavailable'; }).finally(() => { sculpturePromise = null; });
	return sculpturePromise;
}
async function loadStudies() {
	if (disposed || studiesReady || studiesFailed || modalOpen) return;
	if (!studiesPromise) studiesPromise = import('./studies.js').then(({ mountStudies }) => {
		if (disposed || modalOpen) return;
		studies = mountStudies($$('canvas[data-study]'), { reducedMotion: reduced });
		studiesReady = true;
		studies.setState(latestState);
		arbitrateRendering();
	}).catch(() => { studiesFailed = true; root.dataset.studies = 'unavailable'; }).finally(() => { studiesPromise = null; });
	return studiesPromise;
}
const objectButtons = $$('[data-open-object]');
function cancelViewerRequest() {
	viewerRequest++;
	objectButtons.forEach(button => { if (button.getAttribute('aria-busy') === 'true') objectStatus(button.dataset.openObject, ''); });
}
function objectStatus(id, text, busy = false) {
	const status = document.getElementById(`${id}-object-status`);
	if (status) status.textContent = text;
	objectButtons.filter(button => button.dataset.openObject === id).forEach(button => button.setAttribute('aria-busy', String(busy)));
}
async function loadViewer() {
	if (viewer) return viewer;
	if (!viewerPromise) viewerPromise = import(++viewerAttempt === 1 ? './object-viewer.js' : `./object-viewer.js?retry=${viewerAttempt}`).then(({ initObjectViewer }) => {
		if (disposed) return null;
		viewer = initObjectViewer({ reducedMotion: reduced });
		return viewer;
	}).catch(error => { root.dataset.viewer = 'unavailable'; throw error; }).finally(() => { viewerPromise = null; });
	return viewerPromise;
}
objectButtons.forEach(button => {
	button.disabled = false;
	on(button, 'click', async event => {
		if (viewer) return;
		event.preventDefault();
		const id = button.dataset.openObject;
		cancelViewerRequest();
		const request = viewerRequest;
		objectStatus(id, 'Готовим пространственный просмотр…', true);
		try {
			const ready = await loadViewer();
			if (disposed || request !== viewerRequest || !ready) return;
			objectStatus(id, '');
			ready.open(id, button);
		} catch {
			if (!disposed && request === viewerRequest) objectStatus(id, '3D пока недоступно. Иллюстрация и описание доступны; нажмите кнопку, чтобы повторить.');
		} finally { button.setAttribute('aria-busy', 'false'); }
	});
});
const stageObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
	if (entries.some(entry => entry.isIntersecting)) {
		stageObserver.disconnect();
		loadViewer().catch(() => {  });
	}
}, { rootMargin: '200px' }) : null;
$$('[data-object-stage]').forEach(stage => stageObserver?.observe(stage));
const studyObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
	if (entries.some(entry => entry.isIntersecting)) loadStudies();
}, { rootMargin: '120px' }) : null;
$$('canvas[data-study]').forEach(canvas => studyObserver?.observe(canvas));
function measure() {
	height = innerHeight;
	if (fieldTrack) {
		writeStyle(fieldTrack, '--field-vh', `${height}px`);
		fieldTop = fieldTrack.getBoundingClientRect().top + scrollY;
	}
	maxScroll = Math.max(1, document.documentElement.scrollHeight - height);
	measurements = scenes.map(element => ({ element, top: element.getBoundingClientRect().top + scrollY, height: element.offsetHeight }));
	const sceneMap = new Map(measurements.map(entry => [entry.element, entry]));
	motionNodes.forEach(node => {
		node.entry = sceneMap.get(node.section);
		const bounds = node.element.getBoundingClientRect();
		node.top = bounds.top + scrollY;
		node.height = bounds.height;
	});
	approachMeasure = measurements.find(entry => entry.element.id === 'approach');
	sculpture.resize?.();
	needsMeasure = false;
	scrollDirty = true;
}
const paper = [238, 234, 226], ink = [32, 32, 29], blue = [36, 52, 218];
const tones = { intro: [paper, ink], approach: [ink, paper], work: [paper, ink], field: [paper, ink], type: [blue, paper], signal: [paper, ink], commission: [paper, ink] };
const luminance = color => color.map(value => { const v = value / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const contrast = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
function paintPage() {
	const y = scrollY;
	if (fieldTrack) writeStyle(fieldTrack, '--field-frame', reduced ? '0' : (1 - smooth((y - fieldTop) / (height * .45))).toFixed(4));
	stateProgress = clamp(y / maxScroll);
	const center = y + height * .5;
	let current = measurements[0];
	for (const entry of measurements) if (center >= entry.top) current = entry;
	writeData(document.body, 'activeScene', current.element.dataset.scene);
	writeData(root, 'scrollProgress', stateProgress.toFixed(6));
	for (const entry of measurements) {
		const local = clamp((y + height - entry.top) / (height + entry.height));
		writeData(entry.element, 'progress', local.toFixed(6));
	}
	let background = paper, foreground = ink;
	for (let i = 1; i < measurements.length; i++) {
		const entry = measurements[i];
		const factor = smooth((center - entry.top + height * .25) / (height * .5));
		const target = tones[entry.element.dataset.scene];
		if (factor > 0) {
			background = background.map((v, j) => mix(v, target[0][j], factor));
		}
	}
	background = background.map(Math.round);
	const light = luminance(background);
	foreground = contrast(light, luminance(paper)) > contrast(light, luminance(ink)) ? paper : ink;
	if (contrast(light, luminance(foreground)) < 4.5) foreground = contrast(light, 1) > contrast(light, 0) ? [255, 255, 255] : [0, 0, 0];
	writeStyle(document.body, '--page-bg', background.map(Math.round).join(','));
	writeStyle(document.body, '--page-ink', foreground.map(Math.round).join(','));
	const margin = height * .3;
	visibleMotionNodes = motionNodes.filter(node => node.top + node.height > y - margin && node.top < y + height + margin);
	heroNear = y < measurements[0].top + measurements[0].height;
	const approachNear = approachMeasure.top + approachMeasure.height > y - margin && approachMeasure.top < y + height + margin;
	if (approachNear || reduced) inkElements.forEach((element, index) => {
		const local = (y + height * .78 - approachMeasure.top) / Math.max(1, approachMeasure.height * .64);
		writeStyle(element, '--ink-level', reduced ? '1' : (.22 + smooth((local - index * .16) / .32) * .78).toFixed(4));
	});
	scrollDirty = false;
}
function paintMotion() {
	if (reduced) return;
	const y = scrollY;
	const mobile = innerWidth <= 700;
	for (const node of visibleMotionNodes) {
		const { element, entry, direction, kind } = node;
		if (!entry) continue;
		const distance = clamp((y + height * .5 - entry.top - entry.height * .5) / (height + entry.height), -.65, .65);
		const strength = mobile ? .5 : 1;
		let transform = '';
		if (kind === 'hero') {
			const start = clamp(y / Math.max(1, entry.height), 0, 1.3);
			const cursorOffset = (pointerX * 7 + pull * pointerX * 12) * strength;
			transform = `translate3d(${(start * 100 * direction * strength + cursorOffset).toFixed(2)}px,${(-start * 36).toFixed(2)}px,0) rotate(${(start * 2 * direction).toFixed(3)}deg)`;
		} else if (kind === 'slide') {
			transform = `translate3d(${(distance * 125 * direction * strength + pointerX * 3).toFixed(2)}px,0,0)`;
		} else if (kind === 'turn') {
			transform = `rotate(${(distance * 100 + pointerX * 8 + pull * 15).toFixed(3)}deg)`;
		} else if (kind === 'art') {
			transform = `translate3d(0,${(distance * -55 * strength).toFixed(2)}px,0) rotate(${(distance * 5 * direction * strength + reveal * .7 * direction).toFixed(3)}deg)`;
		}
		if (transform !== node.transform) { node.transform = transform; element.style.transform = transform; }
	}
	if (heroNear) {
		const xText = pointerX.toFixed(2), yText = pointerY.toFixed(2);
		if (coordinateX.textContent !== xText) coordinateX.textContent = xText;
		if (coordinateY.textContent !== yText) coordinateY.textContent = yText;
	}
}
function paintScroll(motionChanged = true) {
	if (needsMeasure) measure();
	const pageChanged = scrollDirty;
	if (pageChanged) paintPage();
	if (pageChanged || inputDirty || motionChanged) paintMotion();
	inputDirty = false;
	const state = { progress: stateProgress, pointerX: reduced ? 0 : pointerX, pointerY: reduced ? 0 : pointerY, pull: reduced ? 0 : pull, reveal: reduced ? 0 : reveal, impulse: reduced ? 0 : impulse };
	latestState = state;
	sculpture.setState(reduced ? { ...state, progress: 0 } : state);
	studies.setState(state);
	writeData(root, 'pull', pull.toFixed(3));
	writeData(root, 'reveal', reveal.toFixed(3));
	writeData(root, 'appReady', 'true');
}
function tick(time) {
	frame = 0;
	const dt = previousTime ? Math.min(.05, (time - previousTime) / 1000) : 1 / 60;
	previousTime = time;
	const targetPull = !reduced && (left || latchedPull) ? 1 : 0;
	const targetReveal = !reduced && (right || latchedReveal) ? 1 : 0;
	const previousPull = pull, previousReveal = reveal;
	pull = mix(pull, targetPull, 1 - Math.exp(-dt * 12));
	reveal = mix(reveal, targetReveal, 1 - Math.exp(-dt * 10));
	impulse *= Math.exp(-dt * 5);
	if (Math.abs(pull - targetPull) < .001) pull = targetPull;
	if (Math.abs(reveal - targetReveal) < .001) reveal = targetReveal;
	if (impulse < .001) impulse = 0;
	paintScroll(previousPull !== pull || previousReveal !== reveal);
	if (pull !== targetPull || reveal !== targetReveal || impulse > 0) wake();
}
function wake() { if (!frame && !document.hidden && !disposed) frame = requestAnimationFrame(tick); }
function updateControls() {
	pullButtons.forEach(button => button.setAttribute('aria-pressed', String(latchedPull)));
	revealButtons.forEach(button => button.setAttribute('aria-pressed', String(latchedReveal)));
	document.body.classList.toggle('is-pulling', left || latchedPull);
	document.body.classList.toggle('is-revealing', right || latchedReveal);
}
function releaseAll() { left = right = latchedPull = latchedReveal = false; touchStart = null; updateControls(); wake(); }
function setReduced(value, persist = false) {
	reduced = !!value;
	if (persist) {
		savedMotion = reduced ? 'reduce' : 'full';
		try { localStorage.setItem(motionKey, savedMotion); } catch {  }
	}
	releaseAll();
	pull = reveal = impulse = 0;
	document.body.classList.toggle('is-reduced', reduced);
	document.documentElement.style.scrollBehavior = reduced ? 'auto' : '';
	sculpture.setReducedMotion(reduced);
	studies.setReducedMotion(reduced);
	viewer?.setReducedMotion(reduced);
	motionButtons.forEach(button => { button.setAttribute('aria-pressed', String(reduced)); button.textContent = reduced ? 'Включить движение' : 'Уменьшить движение'; });
	actionButtons.forEach(button => button.disabled = reduced);
	if (reduced) motionNodes.forEach(node => { node.element.style.transform = ''; node.transform = ''; });
	needsMeasure = true;
	wake();
}
function interactiveTarget(target) { return target instanceof Element && target.closest('[data-interactive]') && !target.closest('a,button,input,textarea,select,[data-readable]'); }
function movePointer(event) {
	if (event.pointerType === 'touch' || modalOpen) return;
	if (!sculptureReady && heroNear) loadSculpture();
	pointerX = clamp(event.clientX / innerWidth * 2 - 1, -1, 1);
	pointerY = clamp(event.clientY / innerHeight * 2 - 1, -1, 1);
	inputDirty = true;
	wake();
}
on(window, 'pointermove', movePointer, { passive: true });
on(window, 'pointerdown', event => {
	if (!interactiveTarget(event.target) || reduced || modalOpen) return;
	if (event.pointerType === 'touch') { touchStart = { x: event.clientX, y: event.clientY, time: performance.now() }; return; }
	if (event.pointerType === 'mouse') return;
	if (event.button === 0) left = true;
	if (event.button === 2 && !event.shiftKey) right = true;
	impulse = 1;
	updateControls(); wake();
}, { passive: true });
on(window, 'pointerup', event => {
	if (event.pointerType === 'touch') {
		if (touchStart && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) < 12 && performance.now() - touchStart.time < 450) { pointerX = event.clientX / innerWidth * 2 - 1; pointerY = event.clientY / innerHeight * 2 - 1; impulse = 1; wake(); }
		touchStart = null;
		return;
	}
	if (event.pointerType === 'mouse') return;
	if (event.button === 0) left = false;
	if (event.button === 2) right = false;
	updateControls(); wake();
}, { passive: true });
on(window, 'mousedown', event => {
	if (reduced || modalOpen || (!interactiveTarget(event.target) && !left && !right)) return;
	if (event.button === 0) left = true;
	if (event.button === 2 && !event.shiftKey) right = true;
	impulse = 1; updateControls(); wake();
}, { passive: true });
on(window, 'mouseup', event => {
	if (event.button === 0) left = false;
	if (event.button === 2) right = false;
	updateControls(); wake();
}, { passive: true });
on(window, 'contextmenu', event => { if (!reduced && !event.shiftKey && interactiveTarget(event.target)) event.preventDefault(); });
on(window, 'pointercancel', releaseAll, { passive: true });
on(window, 'blur', releaseAll);
on(window, 'keydown', event => { if (event.key === 'Escape') { releaseAll(); cancelViewerRequest(); } });
on(document, 'visibilitychange', () => { if (document.hidden) { releaseAll(); if (frame) cancelAnimationFrame(frame); frame = 0; previousTime = 0; } else wake(); arbitrateRendering(); });
on(window, 'scroll', () => { scrollDirty = true; wake(); }, { passive: true });
on(window, 'wheel', () => { loadSculpture(); }, { passive: true });
on(window, 'touchstart', () => { loadSculpture(); }, { passive: true });
on(window, 'keydown', event => { if (['ArrowDown', 'PageDown', 'End', ' '].includes(event.key)) loadSculpture(); });
on(window, 'resize', () => { needsMeasure = true; wake(); }, { passive: true });
on(window, 'pageshow', () => { needsMeasure = true; wake(); });
on(window, 'load', () => { needsMeasure = true; wake(); loadSculpture(); });
document.fonts?.ready.then(() => { if (!disposed) { needsMeasure = true; wake(); } });
on(preference, 'change', event => { if (!savedMotion) setReduced(event.matches); });
actionButtons.forEach(button => on(button, 'click', () => {
	if (reduced) return;
	sculptureFailed = studiesFailed = false;
	loadSculpture(); loadStudies();
	if (button.dataset.action === 'pull') latchedPull = !latchedPull;
	if (button.dataset.action === 'reveal') latchedReveal = !latchedReveal;
	impulse = .65; updateControls(); wake();
	announcement.textContent = latchedPull && latchedReveal ? 'Натяжение и раскрытие включены. Нажмите повторно, чтобы отпустить.' : latchedPull ? 'Натяжение включено.' : latchedReveal ? 'Раскрытие включено.' : 'Форма отпущена.';
}));
motionButtons.forEach(button => on(button, 'click', () => setReduced(!reduced, true)));
$$('[data-open-brief]').forEach(button => on(button, 'click', () => document.dispatchEvent(new CustomEvent('matter:brief', { detail: { trigger: button } }))));
on(document, 'matter:brief-state', event => { briefOpen = !!event.detail?.open; if (briefOpen) cancelViewerRequest(); arbitrateRendering(); });
on(document, 'matter:viewer-state', event => { viewerOpen = !!event.detail?.open; inlineActive = !!event.detail?.inlineActive; arbitrateRendering(); });
$$('a[href^="#"]').forEach(link => on(link, 'click', () => { releaseAll(); cancelViewerRequest(); }));
on(window, 'hashchange', cancelViewerRequest);
on(window, 'popstate', cancelViewerRequest);
setReduced(reduced);
paintScroll();
function dispose() {
	disposed = true; viewerRequest++; lifetime.abort();
	if (frame) cancelAnimationFrame(frame);
	stageObserver?.disconnect(); studyObserver?.disconnect();
	viewer?.destroy(); sculpture.destroy(); studies.destroy(); commerce?.destroy();
}
on(window, 'pagehide', event => {
	cancelViewerRequest();
	if (event.persisted) { sculpture.setActive(false); studies.setActive(false); if (frame) cancelAnimationFrame(frame); frame = 0; }
	else dispose();
});
on(window, 'pageshow', () => { arbitrateRendering(); });
