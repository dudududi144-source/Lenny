import { h, svg } from './el';

export interface ProgressRingOptions {
  size?: number;
  stroke?: number;
  trackColor?: string;
  fillColor?: string;
  ariaLabel?: string;
}

let ringSeq = 0;

/** Animated SVG progress ring (stroke-dashoffset, eased via CSS transition). */
export class ProgressRing {
  readonly el: HTMLElement;

  private circle: SVGCircleElement;
  private valueText: HTMLSpanElement;
  private readonly circumference: number;
  private fraction = 0;

  constructor(options: ProgressRingOptions = {}) {
    const size = options.size ?? 64;
    const stroke = options.stroke ?? 6;
    const track = options.trackColor ?? 'rgba(255,255,255,0.12)';
    const fill = options.fillColor ?? '#ffd76a';
    const gradId = `ring-grad-${++ringSeq}`;
    const radius = (size - stroke) / 2;
    this.circumference = 2 * Math.PI * radius;

    this.circle = svg('circle', {
      cx: size / 2,
      cy: size / 2,
      r: radius,
      fill: 'none',
      stroke: `url(#${gradId})`,
      'stroke-width': stroke,
      'stroke-linecap': 'round',
      'stroke-dasharray': this.circumference,
      'stroke-dashoffset': this.circumference,
      transform: `rotate(-90 ${size / 2} ${size / 2})`,
      style: 'transition: stroke-dashoffset 600ms cubic-bezier(0.22,0.8,0.2,1);',
    });

    const trackCircle = svg('circle', {
      cx: size / 2,
      cy: size / 2,
      r: radius,
      fill: 'none',
      stroke: track,
      'stroke-width': stroke,
    });

    const ringSvg = svg(
      'svg',
      { viewBox: `0 0 ${size} ${size}`, width: size, height: size, 'aria-hidden': 'true' },
      svg(
        'defs',
        {},
        svg(
          'linearGradient',
          { id: gradId, x1: '0', y1: '0', x2: '1', y2: '1' },
          svg('stop', { offset: '0', 'stop-color': '#ffe9a6' }),
          svg('stop', { offset: '0.55', 'stop-color': fill }),
          svg('stop', { offset: '1', 'stop-color': '#f2549a' }),
        ),
      ),
      trackCircle,
      this.circle,
    );

    this.valueText = h('span', { class: 'ring-value' });
    this.el = h(
      'div',
      { class: 'progress-ring', role: 'img', 'aria-label': options.ariaLabel ?? 'התקדמות' },
      ringSvg,
      this.valueText,
    );
  }

  set(fraction: number): void {
    this.fraction = Math.min(1, Math.max(0, fraction));
    this.circle.setAttribute('stroke-dashoffset', String(this.circumference * (1 - this.fraction)));
  }

  setCounts(done: number, total: number): void {
    this.set(total > 0 ? done / total : 0);
    this.valueText.textContent = total > 0 ? `${done}/${total}` : '';
  }

  value(): number {
    return this.fraction;
  }
}
