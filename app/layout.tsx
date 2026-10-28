import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeSelector from "@/components/theme-selector";
import ViewportInsets from "@/components/viewport-insets";
export const metadata: Metadata = {
  title: {
    default: "Fight Club Padel League — Neiva Padel Club",
    template: "%s · Fight Club",
  },
  description: "Desafia. Marca. Vence. A liga de padel do Neiva Padel Club.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: { url: "/neiva-club-transparent.ico", type: "image/x-icon" },
    shortcut: "/neiva-club-transparent.ico",
    apple: "/icons/player-180.png",
  },
  appleWebApp: {
    capable: true,
    title: "Fight Club",
    statusBarStyle: "black",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a1425",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/fonts/bebas-neue/BebasNeue-Regular.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/manrope/Manrope-Variable.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('fightclub-theme');if(t==='fight-night'){t='fight-club';localStorage.setItem('fightclub-theme',t)}if(['arena','fight-club','forest','ocean','violet'].includes(t))document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body>
        <ViewportInsets />
        {children}
        <ThemeSelector />
      </body>
    </html>
  );
}
