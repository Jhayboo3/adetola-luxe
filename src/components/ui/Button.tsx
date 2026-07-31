import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost";
  fullWidth?: boolean;
  children: React.ReactNode;
}

export default function Button({
  variant = "primary",
  fullWidth = false,
  className,
  children,
  ...props
}: ButtonProps) {
  const base =
    "font-body text-[13px] font-semibold uppercase tracking-[1px] px-6 py-3 leading-none transition-all duration-200 no-underline inline-flex items-center justify-center";

  const variants = {
    primary:
      "bg-gold text-black hover:bg-gold-dark active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
    outline:
      "border border-black text-black bg-transparent hover:bg-black hover:text-white disabled:opacity-50 disabled:cursor-not-allowed",
    ghost:
      "bg-transparent text-primary hover:text-primary-light disabled:opacity-50 disabled:cursor-not-allowed",
  };

  return (
    <button
      className={cn(base, variants[variant], fullWidth && "w-full", className)}
      {...props}
    >
      {children}
    </button>
  );
}
