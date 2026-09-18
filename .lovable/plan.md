# Renomear o app para "English Up PRO"

Substituir o nome atual (EnglishUp) por **English Up PRO** em toda a interface e metadados. Nenhuma mudança de lógica, rotas ou banco.

## Onde o nome aparece (confirmado por busca no código)

1. **Manifesto PWA** (`public/manifest.webmanifest`)
   - `name`: "EnglishUp — Inglês para brasileiros" → "English Up PRO — Inglês e Espanhol para brasileiros"
   - `short_name`: "EnglishUp" → "English Up PRO"
   - `description`: atualizar para citar inglês e espanhol (o app hoje cobre os dois).
   - Isso define o nome mostrado ao instalar como PWA no celular.

2. **Título/descrição global** (`src/routes/__root.tsx`)
   - `apple-mobile-web-app-title`, `title`, `og:title`, `twitter:title`, description e og:description → "English Up PRO".
   - Slogan "Inglês para brasileiros" passa a "Inglês e Espanhol para brasileiros".

3. **Tela de login** (`src/routes/auth.tsx`)
   - Título/head com EnglishUp → English Up PRO (inclui o texto visível com as bandeiras).

4. **Todas as páginas autenticadas** (títulos de aba e og:title/descriptions)
   - `inicio.tsx`, `dashboard.tsx`, `lessons.tsx`, `lesson.$id.tsx`, `exercise.tsx`, `speaking.tsx`, `speaking-free.tsx`, `listening.tsx`, `reading.tsx`, `review.tsx`, `vocabulary.tsx`, `weaknesses.tsx`, `progress.tsx`, `placement.tsx`, `plano.tsx`, `desafio.tsx`, `achievements.tsx`.

## O que NÃO muda

- Arquivos e imports (ex.: `@/components/englishup`) — são nomes internos de código, invisíveis ao usuário.
- Rotas, banco de dados, logo/ícones.
- Descrições de conteúdo das lições.

## Implementação

- Busca e substituição global de "EnglishUp" → "English Up PRO" nos arquivos listados.
- Ajuste pontual dos slogans "Inglês para brasileiros" → "Inglês e Espanhol para brasileiros" no manifesto e no `__root.tsx`.

## Verificação

- `bunx tsgo --noEmit` sem erros.
- Confirmar via busca que não resta "EnglishUp" em textos/metadados visíveis.
- Conferir no preview: nome na tela de login, título da aba e manifest.

## Endereço do app

- Ao publicar, mudar o endereço para `english-up-pro.lovable.app`.
- O endereço antigo deixa de responder; quem tiver o app instalado deve reabrir/reinstalar pelo novo link.
