import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_PRODUCTNAME,
  description: "Saison-App der Esska Collection: Personal, Schichtplanung und Umsatzreporting.",
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
