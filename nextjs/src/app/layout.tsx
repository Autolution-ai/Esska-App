import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_PRODUCTNAME,
  description: "Saison-App der Esska Collection: Personal, Schichtplanung und Umsatzreporting.",
  // PWA: macht die App auf dem Handy installierbar ("Zum Home-Bildschirm")
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Esska",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#9e2a2b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let theme = process.env.NEXT_PUBLIC_THEME
  if(!theme) {
    theme = "theme-sass3"
  }
  return (
    <html lang="de">
    <body className={theme}>
      {children}
    </body>
    </html>
  );
}
