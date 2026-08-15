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
    "min-h-12 rounded-full font-body text-[12px] font-bold uppercase tracking-[1.2px] px-7 py-3 leading-none transition-all duration-200 no-underline inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none";

  const variants = {
    primary:
      "bg-gold text-black shadow-[0_8px_20px_rgba(184,150,46,0.22)] hover:-translate-y-0.5 hover:bg-gold-dark",
    outline:
      "border-2 border-black text-black bg-transparent hover:bg-black hover:text-white",
    ghost:
      "bg-transparent text-primary hover:bg-primary/5 hover:text-primary-dark",
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
