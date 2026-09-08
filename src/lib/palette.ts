const COLORS = [
  "#6366F1", // indigo
  "#0EA5E9", // sky
  "#14B8A6", // teal
  "#F59E0B", // amber
  "#EC4899", // pink
  "#8B5CF6", // violet
  "#EF4444", // red
  "#22C55E", // green
];

export function colorFor(key: string | number) {
  const s = String(key);
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash += s.charCodeAt(i);
  return COLORS[hash % COLORS.length];
}
