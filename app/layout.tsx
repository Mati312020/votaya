import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VotaYa — Votación Digital",
  description: "Sistema de votación electrónica seguro y accesible",
  applicationName: "VotaYa",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
