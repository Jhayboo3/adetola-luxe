export type BurstSpec = {
  x: number;
  y: number;
  count?: number;
  spread?: number;
  kind?: "hearts" | "glow" | "mix";
  scale?: number;
  colors?: string[];
};

type BurstHandler = (spec: BurstSpec) => void;

const listeners = new Set<BurstHandler>();

export function emitBurst(spec: BurstSpec) {
  listeners.forEach((fn) => fn(spec));
}

export function onBurst(fn: BurstHandler): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
