// Verified badge matching Twitter/X's verification mark: a white check inside a
// blue badge with the signature wavy/lobed outline.
import { cn } from "@/lib/utils";

export default function VerifiedBadge({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      title="Verified"
      aria-label="Verified store"
      className={cn("inline-flex shrink-0 text-[#1D9BF0]", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" aria-hidden="true">
        <path
          d="M20.84 8.02a3.4 3.4 0 0 1-.34-4.89 3.4 3.4 0 0 1-4.89-.34A3.4 3.4 0 0 1 10.4 3.1 3.4 3.4 0 0 1 5.5 3.1a3.46 3.46 0 0 1-4.38.34 3.4 3.4 0 0 1-4.89 4.88 3.4 3.4 0 0 1-.34 4.9 3.4 3.4 0 0 1 .34 4.88 3.4 3.4 0 0 1 4.89.34 3.4 3.4 0 0 1 4.88-.34 3.4 3.4 0 0 1 4.9.34 3.4 3.4 0 0 1 4.89-4.34 3.4 3.4 0 0 1 .34-4.88 3.4 3.4 0 0 1-.34-4.89v.01Z"
          fill="#1D9BF0"
          stroke="none"
        />
        <path
          d="M9.11 17.35 5.4 13.64a1.06 1.06 0 0 1 0-1.5l1.07-1.07a1.06 1.06 0 0 1 1.5 0l2.53 2.53 5.83-5.83a1.06 1.06 0 0 1 1.5 0l1.07 1.07a1.06 1.06 0 0 1 0 1.5L10.6 17.35a1.06 1.06 0 0 1-1.5 0Z"
          fill="#fff"
          stroke="none"
        />
      </svg>
    </span>
  );
}
