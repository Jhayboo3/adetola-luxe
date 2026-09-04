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
      <svg
        viewBox="0 0 24 24"
        width="100%"
        height="100%"
        aria-hidden="true"
      >
        <path
          fill="#1D9BF0"
          d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-4.81 1.41 1.42-6.14 6.29z"
        />
      </svg>
    </span>
  );
}
