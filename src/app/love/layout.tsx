import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Great_Vibes } from "next/font/google";
import "./love.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const greatVibes = Great_Vibes({
  variable: "--font-great-vibes",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "A little surprise for you",
  description: "Something made just for you.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0612",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function LoveLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${cormorant.variable} ${greatVibes.variable} love-root`}>{children}</div>
  );
}
