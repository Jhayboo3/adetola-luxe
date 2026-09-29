import type { Metadata } from "next";
import { Suspense } from "react";
import { Noto_Serif, Montserrat } from "next/font/google";
import "./globals.css";
import SiteChrome from "@/components/layout/SiteChrome";
import Providers from "@/components/layout/Providers";
import Toast from "@/components/ui/Toast";
import ScrollRestorer from "@/components/layout/ScrollRestorer";

const notoSerif = Noto_Serif({
  variable: "--font-noto-serif",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Larkvine — one stop, many finds",
  description: "Found with vision. Bought with intent.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${notoSerif.variable} ${montserrat.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">
        <Suspense fallback={null}>
          <Providers>
            <SiteChrome>
              <main className="flex-1">{children}</main>
            </SiteChrome>
            <ScrollRestorer />
            <Toast />
          </Providers>
        </Suspense>
      </body>
    </html>
  );
}
