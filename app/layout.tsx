import type { Metadata } from 'next';
import './globals.css';
import './arena.css';
import './tavern.css';
import './babylon-table.css';
import {MusicProvider} from './tavern-music';
export const metadata: Metadata = {
  title: 'Mesa Imperio — Mitos y Leyendas',
  description:
    'Mesa digital de cartas editable, para jugar Mitos y Leyendas con amigos.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="dark">
      <body><MusicProvider>{children}</MusicProvider></body>
    </html>
  );
}
