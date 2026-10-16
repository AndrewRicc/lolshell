import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { useSnapshot } from 'valtio';
import { animate } from 'animejs';
import { asset } from '../lib/lcu.ts';
import { ui, useClient } from '../lib/view.ts';
import { still, useMotion } from '../lib/motion.ts';
import './Backdrop.css';

export type BackdropHandle = { pulse(): void };

// The picture behind everything: a slow camera drift, and a crossfade whenever the picture changes.
export default function Backdrop({ ref }: { ref?: Ref<BackdropHandle> }) {
  const c = useClient();
  const { scene } = useSnapshot(ui);
  const src = (scene ?? c.splash) || undefined;

  // The old picture stays underneath until the new one has faded in over it.
  const [layers, setLayers] = useState(src ? [src] : []);
  if (src !== layers.at(-1)) setLayers(src ? [...layers.slice(-1), src] : []);

  const root = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({
    pulse: () => { if (!still() && root.current) animate(root.current, { scale: [1, 1.04, 1], duration: 900, ease: 'inOutSine' }); },
  }), []);
  useMotion(root, [], () => {
    animate('.camera', { scale: [1, 1.06], x: ['0%', '-1.5%'], y: ['0%', '-1%'], duration: 30000, ease: 'inOutSine', alternate: true, loop: true });
  });

  return (
    <div className="backdrop" ref={root}>
      <div className="camera">
        {layers.map((s) => <img key={s} src={asset(s)} alt="" onLoad={(e) => { e.currentTarget.style.animationPlayState = 'running'; }} onAnimationEnd={() => { setLayers([s]); }} />)}
      </div>
    </div>
  );
}
