import type { PointerEvent, MouseEvent as ReactMouseEvent } from 'react';

const outside = (e: { clientX: number; clientY: number }, el: Element) => {
  const r = el.getBoundingClientRect();
  return (
    e.clientX < r.left ||
    e.clientX > r.right ||
    e.clientY < r.top ||
    e.clientY > r.bottom
  );
};

/**
 * Close a modal <dialog> when its backdrop is tapped. Both the press and the
 * release must land on the backdrop, so dragging a text selection out of the
 * dialog doesn't close it.
 */
export function backdropDismiss(canClose: () => boolean = () => true) {
  let downOutside = false;
  return {
    onPointerDown: (e: PointerEvent<HTMLDialogElement>) => {
      downOutside = e.target === e.currentTarget && outside(e, e.currentTarget);
    },
    onClick: (e: ReactMouseEvent<HTMLDialogElement>) => {
      const ok =
        downOutside &&
        e.target === e.currentTarget &&
        outside(e, e.currentTarget);
      downOutside = false;
      if (ok && canClose()) e.currentTarget.close();
    },
  };
}
