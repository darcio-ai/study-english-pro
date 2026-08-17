# Aplicar o logo aprovado no favicon e nos ícones PWA

## O que será feito

Usar a imagem aprovada (círculo com bandeiras EUA/Espanha e setas orbitais, sem texto) como identidade visual do app.

1. Salvar o logo aprovado no projeto em `src/assets/logo-usa-spain.png`.
2. Gerar as versões redimensionadas (quadradas, com preenchimento em vez de esticar):
   - `public/favicon.png` — 64x64
   - `public/icon-192.png` — 192x192
   - `public/icon-512.png` — 512x512
   - `public/apple-touch-icon.png` — 180x180
3. Conferir que `src/routes/__root.tsx` já referencia `/favicon.png`, `/icon-192.png`, `/icon-512.png` e `/apple-touch-icon.png` (já está configurado) e remover `public/favicon.ico` se ainda existir.
4. Manter `public/manifest.webmanifest` apontando para os novos ícones.

## Observação

Como os ícones PWA são "maskable", o logo será centralizado com margem para não ter as bordas cortadas em telas Android.

Depois de publicar, quem já instalou o app pode precisar reinstalar para ver o novo ícone.
