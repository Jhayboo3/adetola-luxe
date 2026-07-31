import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Input({ label, className, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label
          htmlFor={id}
          className="font-body text-[12px] font-medium text-muted"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "h-[46px] border-b border-black bg-transparent px-0 py-3 font-body text-[14px] text-black outline-none transition-all placeholder:text-line focus:border-gold",
          className
        )}
        {...props}
      />
    </div>
  );
}
