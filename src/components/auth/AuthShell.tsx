import Image from "next/image";
import Link from "next/link";

// Split-screen shell shared by the auth utility pages (forgot/reset password).
// Left: branded marketplace imagery. Right: the form/feedback card.
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100svh] bg-white">
      {/* Brand panel (desktop only) */}
      <div className="relative hidden w-[46%] overflow-hidden lg:block">
        <Image
          src="/hero-image.jpg"
          alt=""
          fill
          priority
          sizes="46vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[#0A241C]/80" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#06261c] via-transparent to-[#0A241C]/40" />

        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <Link href="/" className="inline-flex w-fit items-center gap-3 no-underline">
            <Image src="/logomark.png" alt="Larkvine" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
            <span className="font-heading text-2xl tracking-wide text-white">Larkvine</span>
          </Link>

          <div>
            <p className="max-w-sm font-serif text-[22px] italic leading-relaxed text-white/90">
              &ldquo;Found with vision. Bought with intent.&rdquo;
            </p>
            <p className="mt-4 max-w-sm font-body text-[12.5px] leading-relaxed text-white/55">
              A considered marketplace for wearable craft and curated goods — every piece
              chosen for the weight of its fabric and the story it carries.
            </p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-16 sm:px-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-10 inline-flex w-fit items-center gap-2.5 no-underline lg:hidden">
            <Image src="/logomark.png" alt="Larkvine" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
            <span className="font-heading text-xl tracking-wide text-black">Larkvine</span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}

export function AuthHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="mb-9">
      <div className="mb-5 h-[2px] w-12 bg-gold" />
      <p className="font-body text-[10.5px] font-semibold uppercase tracking-[2.5px] text-primary">{eyebrow}</p>
      <h1 className="mt-2 font-heading text-[30px] font-medium leading-tight text-black">{title}</h1>
      <p className="mt-3 font-body text-[13.5px] leading-relaxed text-muted">{description}</p>
    </header>
  );
}
