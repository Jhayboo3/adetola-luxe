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
      className={cn("inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" aria-hidden="true">
        <path
          d="M20.86 8.02c-.5-.22-.9-.02-1.3.2-.4.23-.9.49-1.35.49-.46 0-.96-.26-1.36-.49-.4-.22-.8-.42-1.3-.2a3.4 3.4 0 0 1-4.89 4.89c-.2-.1-.34-.05-.5.2a3.4 3.4 0 0 1-4.89 4.89c-.2.1-.34.05-.5-.2a3.4 3.4 0 0 0-4.89-4.89c-.2-.1-.3-.05-.5.2a3.4 3.4 0 0 1-4.88-4.89c.2-.1.3-.05.5.2.4.22.9.49 1.35.49.46 0 .96-.27 1.36-.49.4-.22.8-.42 1.3-.2a3.4 3.4 0 0 0 4.89-4.89c-.2-.1-.2-.3-.5-.2a3.4 3.4 0 0 0 4.88-4.89c.2.1.2.3.5.2.4-.22.9-.49 1.35-.49.46 0 .96.26 1.36.49.4.22.8.42 1.3.2a3.4 3.4 0 0 1 4.89 4.89Z"
          fill="#1D9BF0"
          stroke="none"
        />
        <path
          d="M9.06 17.3 5.36 13.6a1.05 1.05 0 0 1 0-1.48l1.1-1.1c.4-.4 1.06-.4 1.46 0l2.3 2.3 5.7-5.7c.4-.4 1.06-.4 1.46 0l1.1 1.1c.4.4.4 1.06 0 1.46l-6.83 6.83c-.4.4-1.06.4-1.46 0Z"
          fill="#fff"
          stroke="none"
        />
      </svg>
    </span>
  );
}
