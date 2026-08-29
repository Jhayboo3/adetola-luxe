import type { Metadata } from "next";
import { Suspense } from "react";
import { Noto_Serif, Montserrat } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
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
  title: "Larkvine — The Archive",
  description: "Cut from vision. Worn with intent.",
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
        <Providers>
          <Header />
          <Suspense fallback={null}>
            <ScrollRestorer />
          </Suspense>
          <main className="flex-1">{children}</main>
          <Footer />
          <Toast />
        </Providers>
      </body>
    </html>
  );
}
