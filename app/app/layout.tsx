import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bússola IRTF",
  description: "Descoberta, acompanhamento e adjacência temática sobre o corpus do IRTF.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
