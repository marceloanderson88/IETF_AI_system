import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bússola IRTF",
  description: "Descoberta, acompanhamento e adjacência temática sobre o corpus do IRTF.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <nav style={{ borderBottom: "1px solid #243140", padding: "12px 20px", display: "flex", gap: 16, fontSize: 14 }}>
          <Link href="/">Descoberta</Link>
          <Link href="/trilha">Trilha</Link>
          <Link href="/grafo">Grafo</Link>
          <Link href="/torre">Torre</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
