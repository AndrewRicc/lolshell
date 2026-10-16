const rects = new Map<string, DOMRect>();

export function remember(key: string, el: { getBoundingClientRect(): DOMRect } | null) {
  if (el) rects.set(key, el.getBoundingClientRect());
}

export function recall(key: string): DOMRect | null {
  const r = rects.get(key) ?? null;
  rects.delete(key);
  return r;
}
