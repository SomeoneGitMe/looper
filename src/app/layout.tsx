import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Looper — Music widget for events",
  description:
    "Loop tracks, count plays, and give every artist the streams they earned.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="bg-[#050505] text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}