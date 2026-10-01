import { flushSync } from 'react-dom';

export const reducedMotion = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches;

const MORPH = 'zoom';

/**
 * Apply a React update inside a same-document view transition. If `from` and
 * `to` find elements, the first morphs into the second (a tile expanding into
 * its year, say); everything else crossfades. Falls back to an instant update
 * where view transitions aren't supported or motion is reduced.
 */
export function transition(
  update: () => void,
  from?: () => Element | null,
  to?: () => Element | null
) {
  if (!document.startViewTransition || reducedMotion()) {
    update();
    return;
  }
  const src = from?.() as HTMLElement | null | undefined;
  let dst: HTMLElement | null = null;
  if (src) src.style.viewTransitionName = MORPH;
  const t = document.startViewTransition(() => {
    if (src) src.style.viewTransitionName = '';
    flushSync(update);
    dst = (to?.() as HTMLElement | null | undefined) ?? null;
    if (src && dst) dst.style.viewTransitionName = MORPH;
  });
  t.finished.finally(() => {
    if (dst) dst.style.viewTransitionName = '';
  });
}

/** A short pop on cells whose entry changed, so the update registers. */
export function pulse(selector: string) {
  if (reducedMotion()) return;
  for (const el of document.querySelectorAll(selector)) {
    el.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.18)', offset: 0.35 },
        { transform: 'scale(1)' },
      ],
      { duration: 520, delay: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }
    );
  }
}
