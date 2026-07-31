export default function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-8 py-16 md:grid-cols-3">
        <div>
          <h3 className="font-heading text-lg text-black">Adetola Luxe</h3>
          <p className="mt-2 font-body text-[13px] leading-relaxed text-muted">
            Cut from vision. Worn with intent.
          </p>
        </div>

        <div>
          <h4 className="mb-4 font-body text-[11px] font-medium uppercase tracking-[2px] text-black">
            Connect
          </h4>
          <div className="flex flex-col gap-2">
            <a
              href="https://instagram.com/ADETOLASLUXE"
              target="_blank"
              rel="noopener noreferrer"
              className="font-body text-[13px] text-muted no-underline transition-colors hover:text-primary"
            >
              Instagram
            </a>
            <a
              href="mailto:preciousadetola78@gmail.com"
              className="font-body text-[13px] text-muted no-underline transition-colors hover:text-primary"
            >
              Email
            </a>
          </div>
        </div>

        <div>
          <h4 className="mb-4 font-body text-[11px] font-medium uppercase tracking-[2px] text-black">
            Contact
          </h4>
          <div className="flex flex-col gap-2 font-body text-[13px] text-muted">
            <a
              href="tel:+2347011033320"
              className="text-muted no-underline transition-colors hover:text-primary"
            >
              07011033320
            </a>
            <a
              href="mailto:preciousadetola78@gmail.com"
              className="text-muted no-underline transition-colors hover:text-primary"
            >
              preciousadetola78@gmail.com
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-8 py-6">
          <p className="font-body text-[11px] text-muted">
            &copy; {new Date().getFullYear()} Adetola Luxe. All rights reserved.
          </p>
          <p className="font-body text-[11px] text-muted">
            <a
              href="https://instagram.com/ADETOLASLUXE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted no-underline transition-colors hover:text-primary"
            >
              @ADETOLASLUXE
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
