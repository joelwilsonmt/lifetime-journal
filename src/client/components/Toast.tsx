import { useCallback, useEffect, useRef, useState } from 'react';
import s from './Toast.module.css';

type Msg = { text: string; id: number } | null;

export function useToast() {
  const [msg, setMsg] = useState<Msg>(null);
  const toast = useCallback(
    (text: string) => setMsg(m => ({ text, id: (m?.id ?? 0) + 1 })),
    []
  );
  return { msg, toast };
}

export function Toast({ msg }: { msg: Msg }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!msg || !el) return;
    // A manual popover lives in the top layer; re-showing it puts it above
    // any modal dialog that opened since.
    if (el.matches(':popover-open')) el.hidePopover();
    el.showPopover();
    setShow(true);
    const t = setTimeout(() => setShow(false), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <div
      ref={ref}
      popover="manual"
      className={`${s.toast} ${show ? s.show : ''}`}
      role="status"
      aria-live="polite"
    >
      {msg?.text}
    </div>
  );
}
