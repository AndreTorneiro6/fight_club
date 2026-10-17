import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeSelector from "@/components/theme-selector";
export const metadata: Metadata = {
  title: {
    default: "Fight Club Padel League — Neiva Padel Club",
    template: "%s · Fight Club",
  },
  description: "Desafia. Marca. Vence. A liga de padel do Neiva Padel Club.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.ico", apple: "/icons/player-180.png" },
  appleWebApp: {
    capable: true,
    title: "Fight Club",
    statusBarStyle: "black-translucent",
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
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('fightclub-theme');if(['arena','fight-night','forest','ocean','violet'].includes(t))document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <ThemeSelector />
      </body>
    </html>
  );
}
