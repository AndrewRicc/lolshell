import { useRef } from 'react';
import { animate } from 'animejs';
import { useOnChange, still } from '../lib/motion.ts';

// The unread count; it pops when it goes up. Always mounted (hidden at 0) so the 0 -> 1 step pops too.
export default function Badge({ n, label }: { n: number; label?: string }) {
  const el = useRef<HTMLSpanElement>(null);
  useOnChange(n, (prev, next) => {
    if (next > prev && !still()) animate(el.current!, { scale: [1.4, 1], duration: 300, ease: 'outBack' });
  });
  return <span className="badge" ref={el} hidden={!n} aria-label={n ? label : undefined}>{n}</span>;
}
