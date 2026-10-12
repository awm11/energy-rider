import { useEffect, useRef, useState } from 'react';

// Shows a button's hint (and its hotkey) the instant the pointer is over it,
// instead of waiting for the browser's slow built-in tooltip.
export function Tooltip() {
  const [tip, setTip] = useState(null);
  const current = useRef(null);

  useEffect(() => {
    const take = (el) => {
      const t = el.getAttribute('title');
      if (t) {
        el.setAttribute('data-tip', t);
        el.removeAttribute('title'); // stop the slow native tooltip appearing too
        if (!el.getAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', t);
      }
      return el.getAttribute('data-tip');
    };
    const show = (e) => {
      if (e.pointerType === 'touch') return;
      const el = e.target.closest?.('[title],[data-tip]');
      if (!el || el === current.current) return;
      const text = take(el);
      if (!text) return;
      current.current = el;
      const r = el.getBoundingClientRect();
      const below = r.top < 60;
      setTip({
        text,
        x: Math.min(Math.max(r.left + r.width / 2, 90), window.innerWidth - 90),
        y: below ? r.bottom + 8 : r.top - 8,
        below,
      });
    };
    const hide = () => {
      current.current = null;
      setTip(null);
    };
    const out = (e) => {
      if (current.current && !current.current.contains(e.relatedTarget)) hide();
    };
    document.addEventListener('pointerover', show);
    document.addEventListener('pointerout', out);
    document.addEventListener('pointerdown', hide);
    document.addEventListener('focusin', (e) => {
      if (e.target.matches?.(':focus-visible')) show({ target: e.target });
    });
    document.addEventListener('focusout', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('pointerover', show);
      document.removeEventListener('pointerout', out);
      document.removeEventListener('pointerdown', hide);
      document.removeEventListener('focusout', hide);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);

  if (!tip) return null;
  return (
    <div className={'tip' + (tip.below ? ' is-below' : '')} role="tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.text}
    </div>
  );
}
