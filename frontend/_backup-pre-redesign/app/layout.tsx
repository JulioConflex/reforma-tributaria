import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Simulador da Reforma Tributária | Conflex Contabilidade",
  description:
    "Simule o impacto da LC 214/2025 no seu negócio: IBS, CBS e Imposto Seletivo — por Conflex Contabilidade",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.className} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
