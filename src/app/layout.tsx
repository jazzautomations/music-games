import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "MasterSinger — Afinador Vocal, Cursos e Estúdio MIDI",
  description:
    "MasterSinger é o app gratuito pra aprender a cantar: afinador em tempo real (precisão YIN), estúdio MIDI, prática gamificada de escalas e intervalos, treino de ouvido e academia com 8 cursos. Tudo no navegador, sem download.",
  keywords: [
    "cantar", "afinador vocal", "treino vocal", "ear training",
    "pitch detection", "YIN", "escala maior", "intervalos", "acordes",
    "sight singing", "vocal match", "tone drops",
  ],
  authors: [{ name: "MasterSinger" }],
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "MasterSinger — Cante Afinado",
    description: "Afinador em tempo real, estúdio MIDI e academia de canto. Grátis, sem download — tudo no navegador.",
    locale: "pt_BR",
    type: "website",
    siteName: "MasterSinger",
  },
  twitter: {
    card: "summary_large_image",
    title: "MasterSinger — Cante Afinado",
    description: "Afinador em tempo real, estúdio MIDI e academia de canto. Grátis, sem download.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#0a0a14",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">{children}<Toaster /></body>
    </html>
  );
}
