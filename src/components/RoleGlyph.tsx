import './RoleGlyph.css';

// Riot's role icons, redrawn: the client does not serve its own over the API. Each is [lit shape, dimmed shape].
const GLYPH: Record<string, string[]> = {
  TOP: ['M4 4v24.045L9 23V9h14l5.045-5z', 'M21 14h-7v7h7zM26 11v15H11.014l-4 4H30V7.016z'],
  JUNGLE: ['M25 3c-2.128 3.3-5.147 6.851-6.966 11.469A42.373 42.373 0 0 1 20 20a27.7 27.7 0 0 1 1-3c0-4.977 1.856-8.723 4-14zM13 20c-1.488-4.487-4.76-6.966-9-9 3.868 3.136 4.422 7.52 5 12l3.743 3.312C14.215 27.917 16.527 30 17 30c4.555-9.445-3.366-20.8-8-27 2.67 6.573 4.717 10.342 4 17zm8 5a15.271 15.271 0 0 1 0 2l4-4c.578-4.48 1.132-8.864 5-12-5.288 2.537-7.866 7.854-9 14z'],
  MIDDLE: ['M25 4 4 25v5h5L30 9V4z', 'M30 12.968l-4.008 4L26 26h-9l-4 4h17zM16.979 8 21 4H4v16.977L8 17V8z'],
  BOTTOM: ['M30 5.955 25 11v14H11l-5.045 5H30z', 'M13 20h7v-7h-7zM4 4v22.984l3.955-4L8 8h14.986l4-4z'],
  UTILITY: ['M26 13c3.535 0 8-4 8-4H23l-3 3 2 7 5-2-3-4zM22 5l-1.173-2h-7.765L12 5l5 6zm-5 9-1-1-3 15 4 3 4-3-3-15zM11 9H0s4.465 4 8 4h2l-3 4 5 2 2-7z'],
  FILL: ['M17 12l5 5-5 5-5-5z', 'M17 3 3 17l14 14 14-14zm0 5.5 8.5 8.5-8.5 8.5L8.5 17z'],
  UNSELECTED: ['', 'M15 9h4v6h6v4h-6v6h-4v-6H9v-4h6z'],
};

export default function RoleGlyph({ id }: { id: string }) {
  const [lit, dim] = GLYPH[id] ?? GLYPH.UNSELECTED;
  return <svg className="glyph" viewBox="0 0 34 34" aria-hidden="true"><path d={dim} opacity="0.45" /><path d={lit} /></svg>;
}
