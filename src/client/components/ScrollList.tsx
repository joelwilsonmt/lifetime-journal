import {
  Fragment,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

export type Away = 'up' | 'down' | null;

interface Props {
  count: number;
  anchor: number;
  renderItem: (i: number) => ReactNode;
  /** Called with the first section still visible below the sticky header. */
  onFocus: (section: HTMLElement) => void;
  /** Index of the section holding today, for the "back to today" button. */
  homeIndex: number;
  /** Which way the home section lies once it's mostly out of view. */
  onAway: (away: Away) => void;
  headerRef: RefObject<HTMLElement | null>;
  /** Scroll to this element inside the anchor section instead of its top. */
  anchorSelector?: string;
}

const APPEND_STEP = 3;
const PREPEND_STEP = 2;

/**
 * Windowed vertical list that grows in both directions as you scroll. When it
 * prepends, it compensates the scroll position so the view doesn't jump
 * (body has overflow-anchor: none). Remount it (change its key) to re-anchor.
 */
export function ScrollList({
  count,
  anchor,
  renderItem,
  onFocus,
  homeIndex,
  onAway,
  headerRef,
  anchorSelector,
}: Props) {
  const start = Math.max(0, Math.min(count - 1, anchor));
  const [win, setWin] = useState(() => ({
    lo: Math.max(0, start - 1),
    hi: Math.min(count - 1, start + 5),
  }));
  const listRef = useRef<HTMLDivElement>(null);
  const winRef = useRef(win);
  const prependFrom = useRef<number | null>(null);
  const anchored = useRef(false);

  const check = useCallback(() => {
    const list = listRef.current;
    const first = list?.firstElementChild;
    const last = list?.lastElementChild;
    if (!first || !last) return;
    const { lo, hi } = winRef.current;
    const vh = window.innerHeight;
    if (hi < count - 1 && last.getBoundingClientRect().bottom < vh * 2.5) {
      setWin(w => ({ ...w, hi: Math.min(count - 1, w.hi + APPEND_STEP) }));
    } else if (lo > 0 && first.getBoundingClientRect().top > -vh * 1.5) {
      prependFrom.current = document.documentElement.scrollHeight;
      setWin(w => ({ ...w, lo: Math.max(0, w.lo - PREPEND_STEP) }));
    }
    const top = (headerRef.current?.getBoundingClientRect().bottom ?? 0) + 8;
    let focusIndex = lo;
    for (const [i, el] of [...list.children].entries()) {
      if (el.getBoundingClientRect().bottom > top) {
        onFocus(el as HTMLElement);
        focusIndex = lo + i;
        break;
      }
    }
    // Home counts as in view while a good part of it is on screen.
    const home = list.children[homeIndex - lo];
    const r = home?.getBoundingClientRect();
    const overlap = r ? Math.min(r.bottom, vh) - Math.max(r.top, top) : 0;
    if (r && overlap > Math.min(150, r.height / 2)) onAway(null);
    else onAway(focusIndex < homeIndex ? 'down' : 'up');
  }, [count, onFocus, homeIndex, onAway, headerRef]);

  useLayoutEffect(() => {
    winRef.current = win;
    const list = listRef.current;
    if (!anchored.current) {
      anchored.current = true;
      const section = list?.children[start - win.lo];
      const target =
        (anchorSelector && section?.querySelector(anchorSelector)) || section;
      target?.scrollIntoView({ block: 'start' });
    } else if (prependFrom.current !== null) {
      window.scrollBy(
        0,
        document.documentElement.scrollHeight - prependFrom.current
      );
      prependFrom.current = null;
    }
    const id = requestAnimationFrame(check);
    return () => cancelAnimationFrame(id);
  }, [win, start, check, anchorSelector]);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        check();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [check]);

  const items = [];
  for (let i = win.lo; i <= win.hi; i++) {
    items.push(<Fragment key={i}>{renderItem(i)}</Fragment>);
  }
  return <div ref={listRef}>{items}</div>;
}
