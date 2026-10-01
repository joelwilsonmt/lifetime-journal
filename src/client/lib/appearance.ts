import type { Appearance } from '../../shared/types.ts';

const KEY = 'lifecal:appearance';

/** Put the theme on <html>, remember it for the next first paint, and tint the browser chrome. */
export function applyAppearance(a: Appearance) {
  const root = document.documentElement;
  root.dataset.palette = a.theme;
  root.dataset.font = a.font;
  if (a.mode === 'system') delete root.dataset.theme;
  else root.dataset.theme = a.mode;
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {}
  syncThemeColor();
}

/** The browser/PWA status bar matches the page background. */
export function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta)
    meta.setAttribute(
      'content',
      getComputedStyle(document.body).backgroundColor
    );
}
