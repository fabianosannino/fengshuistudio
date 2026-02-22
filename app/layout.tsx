import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FengShui Studio",
  description: "Plataforma para Consultores de Feng Shui",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}