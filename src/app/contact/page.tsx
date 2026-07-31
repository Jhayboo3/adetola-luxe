"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="py-16 md:py-24">
      <div className="mx-auto max-w-[1200px] px-8">
        <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
          <div>
            <div className="mb-4 h-[2px] w-12 bg-gold" />
            <h1 className="font-heading text-[28px] font-medium text-black">
              Get in Touch
            </h1>
            <div className="mt-8 space-y-6 font-body text-[13px] text-muted">
              <p className="font-serif text-[18px] leading-relaxed">
                We&apos;d love to hear from you. Whether it&apos;s a question
                about a piece, a sizing inquiry, or a collaboration.
              </p>
              <div className="mt-8 space-y-2">
                <p>
                  <a
                    href="tel:+2347011033320"
                    className="text-muted no-underline transition-colors hover:text-primary"
                  >
                    07011033320
                  </a>
                </p>
                <p>
                  <a
                    href="mailto:preciousadetola78@gmail.com"
                    className="text-muted no-underline transition-colors hover:text-primary"
                  >
                    preciousadetola78@gmail.com
                  </a>
                </p>
                <p>
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
          </div>

          <div>
            {submitted ? (
              <div className="border border-line p-8 text-center">
                <div className="mx-auto mb-4 h-[2px] w-12 bg-gold" />
                <p className="font-heading text-[18px] font-medium text-black">
                  Message sent
                </p>
                <p className="mt-2 font-body text-[13px] text-muted">
                  We&apos;ll respond within 24 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <Input
                  id="name"
                  name="name"
                  label="Name"
                  placeholder="Your name"
                  required
                />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  label="Email"
                  placeholder="Your email"
                  required
                />
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="message"
                    className="font-body text-[12px] font-medium text-muted"
                  >
                    Message
                  </label>
                  <textarea
                    id="message"
                    rows={5}
                    className="border-b border-black bg-transparent py-3 font-body text-[14px] text-black outline-none transition-all placeholder:text-line focus:border-gold"
                    placeholder="Your message"
                    required
                  />
                </div>
                <Button type="submit" fullWidth>
                  Send Message
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
