import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dove Expressions | Discipleship Hub & Creative Studio",
  description:
    "Draw Near, Rooted, Hear God, Kingdom Mandate — a discipleship learning platform organized around four pathways, helping believers pursue their Kingdom mandate."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Manrope:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
