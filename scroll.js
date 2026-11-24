const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (start, end, value) => {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

/** A reversible timeline: its result depends only on the current position. */
export function sampleChapter(localProgress = 0) {
  const progress = clamp(Number.isNaN(localProgress) ? 0 : localProgress);
  const enter = smoothstep(0, 0.3, progress);
  const exit = smoothstep(0.7, 1, progress);
  return {
    progress,
    assembly: enter * (1 - exit),
    phase: progress < 0.3 ? 'assembling' : progress > 0.7 ? 'dissolving' : 'reading',
    enter,
    exit,
  };
}

/** Observe native document scrolling without taking control of input or layout. */
export function createScrollJourney({
  sections = [],
  outro = null,
  onUpdate = () => {},
  reducedMotion = false,
} = {}) {
  const chapters = Array.from(sections);
  let bounds = [];
  let frame = 0;
  let needsMeasure = true;
  let destroyed = false;
  let reduced = Boolean(reducedMotion);

  function measure() {
    const y = window.scrollY;
    const rectangles = chapters.map(section => section.getBoundingClientRect());
    bounds = rectangles.map((rect, index) => {
      const top = rect.top + y;
      const nextTop = rectangles[index + 1]?.top;
      const span = nextTop === undefined ? rect.height : nextTop - rect.top;
      return { top, span: Math.max(1, span) };
    });
    needsMeasure = false;
  }

  function update() {
    if (destroyed) return;
    if (needsMeasure) measure();
    const scrollY = window.scrollY;
    const viewport = Math.max(1, window.innerHeight);
    const lastIndex = chapters.length - 1;
    const fallbackIndex = lastIndex < 0 ? -1 : scrollY < bounds[0].top ? 0 : lastIndex;
    let activeIndex = fallbackIndex;
    let greatestAssembly = 0;
    let totalAssembly = 0;
    let weightedMaterial = 0;
    // In the ordinary-flow layout, identify the section at the reading line.
    // Animated overlap weights describe a different geometry and would select
    // the preceding material after goTo positions a section below the header.
    const readingLine = scrollY + Math.min(viewport * 0.35, 160);
    if (reduced && bounds.length) {
      activeIndex = 0;
      bounds.forEach(({ top }, index) => {
        if (top <= readingLine) activeIndex = index;
      });
    }
    const states = bounds.map(({ top, span }, index) => {
      if (reduced) {
        return {
          index,
          raw: (readingLine - top) / span,
          ...sampleChapter(0.5),
          visible: top < scrollY + viewport && top + span > scrollY,
        };
      }
      const raw = (scrollY - top + 0.2 * span) / (1.4 * span);
      const sample = sampleChapter(raw);
      totalAssembly += sample.assembly;
      weightedMaterial += index * sample.assembly;
      if (sample.assembly > greatestAssembly) {
        greatestAssembly = sample.assembly;
        activeIndex = index;
      }
      return { index, raw, ...sample, visible: raw > 0 && raw < 1 };
    });
    const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
    const scrollRange = Math.max(1, scrollHeight - viewport);
    onUpdate({
      chapters: states,
      activeIndex,
      materialValue: reduced ? Math.max(0, activeIndex) : totalAssembly > 0 ? weightedMaterial / totalAssembly : Math.max(0, fallbackIndex),
      globalProgress: clamp(scrollY / scrollRange),
      outroProgress: outro ? clamp((viewport - outro.getBoundingClientRect().top) / viewport) : 0,
      scrollY,
    });
  }

  function schedule() {
    if (destroyed || frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  }

  function requestMeasure() {
    needsMeasure = true;
    schedule();
  }

  function refresh() {
    if (destroyed) return;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    measure();
    update();
  }

  function goTo(index, { behavior = 'smooth' } = {}) {
    if (destroyed || !chapters.length) return;
    measure();
    const target = bounds[clamp(Math.round(index), 0, bounds.length - 1)];
    if (!target) return;
    window.scrollTo({
      top: Math.max(0, reduced ? target.top - 80 : target.top + 0.5 * target.span),
      behavior: reduced ? 'auto' : behavior,
    });
    schedule();
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', requestMeasure, { passive: true });
  window.addEventListener('orientationchange', requestMeasure, { passive: true });
  window.addEventListener('pageshow', requestMeasure);
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(requestMeasure) : null;
  chapters.forEach(section => resizeObserver?.observe(section));
  if (outro) resizeObserver?.observe(outro);
  document.fonts?.addEventListener('loadingdone', requestMeasure);
  document.fonts?.ready.then(() => {
    if (!destroyed) requestMeasure();
  });

  // The caller receives the restored scroll position before the first frame.
  refresh();

  return {
    refresh,
    goTo,
    setReducedMotion(value) {
      reduced = Boolean(value);
      requestMeasure();
    },
    destroy() {
      destroyed = true;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', requestMeasure);
      window.removeEventListener('orientationchange', requestMeasure);
      window.removeEventListener('pageshow', requestMeasure);
      document.fonts?.removeEventListener('loadingdone', requestMeasure);
      resizeObserver?.disconnect();
    },
  };
}
