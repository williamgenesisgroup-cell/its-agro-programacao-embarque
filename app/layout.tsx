import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "IT'S AGRO | Programação de embarque",
  description: 'Planejamento de embarques, rotas e classificadores da IT\'S AGRO.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
