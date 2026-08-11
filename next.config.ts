import type { NextConfig } from "next";
import { montarCsp } from "./src/lib/csp";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        // Buckets privados (C8): as fotos passam a chegar por URL assinada.
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/sign/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // geolocation liberada só para a própria origem (self): o Modo C de orientação
          // (alinhar planta sobre satélite) oferece "usar minha localização atual" para
          // centralizar o mapa. Câmera e microfone seguem totalmente bloqueados.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          // Montada em `src/lib/csp.ts`, que documenta cada liberação e é
          // coberta por teste — o cabeçalho não é lugar de decisão implícita.
          {
            key: 'Content-Security-Policy',
            value: montarCsp(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
