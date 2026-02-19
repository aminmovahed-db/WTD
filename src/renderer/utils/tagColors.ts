const PALETTE = [
  '#f87171', // red
  '#fb923c', // orange
  '#fbbf24', // amber
  '#a3e635', // lime
  '#34d399', // emerald
  '#22d3ee', // cyan
  '#60a5fa', // blue
  '#818cf8', // indigo
  '#a78bfa', // violet
  '#e879f9', // fuchsia
  '#f472b6', // pink
  '#4ade80', // green
  '#2dd4bf', // teal
  '#38bdf8', // sky
  '#c084fc', // purple
];

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getTagColor(tag: string): string {
  return PALETTE[hashString(tag) % PALETTE.length];
}

export function tagColorStyle(tag: string): React.CSSProperties {
  const color = getTagColor(tag);
  return {
    color,
    background: `color-mix(in srgb, ${color} 16%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
  };
}
