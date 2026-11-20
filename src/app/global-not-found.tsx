import Link from 'next/link';
import './globals.css';

// 404 for URLs that match no route. It lives outside [locale], so it has no
// translations.
export default function GlobalNotFound() {
  return (
    <html lang="pt-BR">
      <body>
        <main style={{maxWidth: 480, margin: '0 auto', padding: 20}}>
          <h1 style={{fontSize: 24, fontWeight: 800}}>404</h1>
          <p>Página não encontrada.</p>
          <Link href="/" style={{color: 'var(--brand)', fontWeight: 700}}>
            curadiário
          </Link>
        </main>
      </body>
    </html>
  );
}
