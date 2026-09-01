import type { GardenData } from '../../games/core/ProgressStore';
import { h } from './common/el';
import { createParentGate } from '../parentlens/gate';
import { loadLensData } from '../parentlens/lensData';
import { renderDashboard } from '../parentlens/dashboard';

export interface ParentLensCallbacks {
  loadGarden(): GardenData;
  onExit(): void;
}

export interface ParentLensHandle {
  root: HTMLElement;
  /** Shows the adult gate (fresh question + reset hold each open). */
  open(): void;
}

/**
 * ParentLens — "עֲדֶשֶׁת הַהוֹרֶה" (Stage 5).
 *
 * The adult dashboard behind a child-safe gate: hold the star for
 * two seconds (or answer the grown-up question). The dashboard is
 * a warm, read-only view over the untouched cognitive core —
 * process-focused language only (docs/ETHICS.md), everything
 * stored locally on this device.
 */
export function createParentLens(callbacks: ParentLensCallbacks): ParentLensHandle {
  const gate = createParentGate({
    onUnlock: () => showDashboard(),
    onExit: () => callbacks.onExit(),
  });
  const dashboard = h('div', { class: 'parent-dashboard', hidden: true });

  const root = h(
    'section',
    { class: 'screen screen--parent hidden', id: 'parent-screen', 'aria-label': 'פינת ההורים' },
    h('div', { class: 'parent-scroll' }, gate.root, dashboard),
  );

  function showDashboard(): void {
    gate.root.hidden = true;
    dashboard.hidden = false;
    dashboard.replaceChildren();
    const data = loadLensData(callbacks.loadGarden());
    dashboard.append(renderDashboard(data, { onExit: () => callbacks.onExit() }));
  }

  return {
    root,
    open() {
      dashboard.hidden = true;
      dashboard.replaceChildren();
      gate.root.hidden = false;
      gate.open();
    },
  };
}
