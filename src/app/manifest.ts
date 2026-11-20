import type {MetadataRoute} from 'next';

// /manifest.webmanifest · Lets people add curadiário to the home screen (PWA).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'curadiário',
    short_name: 'curadiário',
    description: 'Diário de cuidado para a família, cifrado no aparelho e compartilhado só com quem você escolher.',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f2f4f3',
    theme_color: '#1d6b61',
    icons: [
      {src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
      {src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
      {src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
    ],
  };
}
