import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { createScope } from 'animejs';

export { remember, recall } from './rects.ts';

export const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useMotion(root: RefObject<Element | null>, deps: unknown[], play: () => void | (() => void)) {
  const fn = useRef(play);
  fn.current = play;
  useEffect(() => {
    if (still() || !root.current) return; // a null root would scope selectors to the whole document
    const scope = createScope({ root: root.current as HTMLElement }).add(() => fn.current());
    return () => scope.revert();
  }, deps);
}

export function useOnChange<T>(value: T, fn: (prev: T, next: T) => void) {
  const prev = useRef(value);
  useLayoutEffect(() => {
    if (!Object.is(prev.current, value)) fn(prev.current, value);
    prev.current = value;
  });
}
