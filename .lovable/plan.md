# Isolar e refinar o logo a partir da referência

## Objetivo
Criar uma versão limpa do logo enviado pelo usuário, mantendo apenas o elemento gráfico central (círculo com bandeiras dos EUA e Espanha + setas orbitais) e removendo todos os textos ("LANGUAGE ACADEMY", "INGLÊS >> ESPANHOL", "CURSOS DE IDIOMAS", "Since 2024").

## Etapas

1. **Gerar logo isolado**
   - Usar a imagem de referência como base conceitual.
   - Produzir um logo circular com as bandeiras dos EUA e da Espanha divididas por uma diagonal.
   - Manter as setas orbitais/elementos ao redor como no design original, se fizerem parte do ícone.
   - Remover todo texto, fundo de sala de aula e elementos decorativos externos.
   - Estilo: vetorial, limpo, adequado para app icon/favicon.
   - Salvar em `src/assets/logo-usa-spain.png`.

2. **Apresentar para aprovação**
   - Mostrar a imagem gerada ao usuário antes de qualquer alteração no app.
   - Aguardar confirmação ou pedido de ajustes.

3. **Implantar no app (após aprovação)**
   - Gerar favicon `public/favicon.png` (64x64).
   - Gerar ícones PWA: `public/icon-192.png`, `public/icon-512.png`.
   - Gerar `public/apple-touch-icon.png` (180x180).
   - Remover `public/favicon.ico` antigo.
   - Verificar se `src/routes/__root.tsx` já aponta para `/favicon.png` (já configurado no projeto).

## Resultado esperado
Logo circular sem texto, pronto para uso como ícone do app, favicon e ícones PWA, com visual consistente com a referência enviada.
