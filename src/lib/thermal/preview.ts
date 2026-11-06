import { CAP_HEIGHT, minSize, type Box, type TextLayout } from './layout';
import type { Settings } from './settings';
import { buildSvg, contentBox, grainFrequency, stripeTransform } from './svg';

const ID = 'tp';
/** Fraction of the distance to the target viewBox covered per frame (at 60 fps). */
const EASE = 0.16;
/** Minimum viewBox size, so short words don't get zoomed in too much. */
const MIN_W = CAP_HEIGHT * 4;
const MIN_H = CAP_HEIGHT * 3;

/**
 * Live preview. The stripe is animated with JS (not SMIL) so that changing
 * text or parameters never restarts the cycle, and so the phase is shared
 * with the exporters.
 */
export class ThermalPreview {
  phase = 0;
  private svg: SVGSVGElement | null = null;
  private gradient: SVGLinearGradientElement | null = null;
  private turbulence: SVGFETurbulenceElement | null = null;
  private settings: Settings | null = null;
  private current: Box | null = null;
  private target: Box | null = null;
  private hostSize = { w: 1, h: 1 };
  private grainFreq = 0;
  private last = 0;
  private raf = 0;

  constructor(private host: HTMLElement) {
    new ResizeObserver(([entry]) => {
      this.hostSize = { w: entry.contentRect.width || 1, h: entry.contentRect.height || 1 };
    }).observe(host);
  }

  update(layout: TextLayout, settings: Settings, label: string) {
    this.settings = settings;
    this.target = minSize(contentBox(layout, settings), MIN_W, MIN_H);
    if (!this.current) this.current = { ...this.target };

    this.grainFreq = grainFrequency(this.pxPerUnit());
    this.host.innerHTML = buildSvg({
      layout,
      settings,
      id: ID,
      viewBox: this.current,
      phase: this.phase,
      grainScale: this.pxPerUnit(),
      label,
    });
    this.svg = this.host.querySelector('svg');
    this.gradient = this.host.querySelector(`#${ID}-stripe`);
    this.turbulence = this.host.querySelector(`#${ID}-grain`);
    this.svg?.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    if (!this.raf) this.start();
  }

  /** Device pixels per SVG unit at the current zoom. */
  private pxPerUnit() {
    const c = this.current!;
    return Math.min(this.hostSize.w / c.w, this.hostSize.h / c.h) * (window.devicePixelRatio || 1);
  }

  private start() {
    this.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - this.last, 100) / 1000;
      this.last = now;
      this.step(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private step(dt: number) {
    const s = this.settings;
    if (!s || !this.svg || !this.gradient) return;

    this.phase = (this.phase + dt / s.duration) % 1;
    this.gradient.setAttribute('gradientTransform', stripeTransform(s, this.phase));

    const c = this.current!;
    const t = this.target!;
    const k = 1 - Math.pow(1 - EASE, dt * 60);
    const keys = ['x', 'y', 'w', 'h'] as const;
    if (keys.some((key) => Math.abs(t[key] - c[key]) > 0.05)) {
      for (const key of keys) c[key] += (t[key] - c[key]) * k;
      this.svg.setAttribute('viewBox', `${c.x} ${c.y} ${c.w} ${c.h}`);
    }

    // Keep the grain at a constant pixel size while zooming or resizing.
    if (this.turbulence) {
      const freq = grainFrequency(this.pxPerUnit());
      if (Math.abs(freq - this.grainFreq) / this.grainFreq > 0.01) {
        this.grainFreq = freq;
        this.turbulence.setAttribute('baseFrequency', String(freq));
      }
    }
  }
}
