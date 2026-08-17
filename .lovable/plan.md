# Refazer lições + remover etiqueta Lovable

## 1. Opção de refazer lições

Hoje uma lição concluída (com `completed_at`) abre sempre do início, mas na lista ela só mostra o check verde — não há ação explícita de refazer, e ao terminar novamente o progresso é sobrescrito sem escolha.

O que muda:

- **Lista de lições** (`/lessons`): em cada lição já concluída, além do check verde, um botão "Refazer" que abre a lição em modo de repetição (`/lesson/$id?redo=1`), reiniciando do primeiro exercício.
- **Tela final da lição**: junto de "Continuar", incluir o botão "Refazer lição", que reseta o estado local (índice, respostas, notas) sem sair da página.
- **Progresso**: ao refazer, o registro em `user_lesson_progress` é atualizado normalmente (nova média de acertos), mantendo a lição como concluída — refazer nunca "desconclui" a lição nem apaga histórico de tentativas.

## 2. Remover a etiqueta do Lovable

Desativar o badge "Edit with Lovable" exibido no canto do app publicado, via configuração de publicação do projeto. Nada muda no código.

## Detalhes técnicos

- `src/routes/_authenticated/lessons.tsx`: card da lição concluída ganha botão secundário "Refazer" (evitando propagar o clique do `Link`), navegando com search param `redo`.
- `src/routes/_authenticated/lesson.$id.tsx`: ler o search param para começar limpo; função `restart()` que zera `index`, `scores`, `done` e estados transitórios; botão na tela de conclusão.
- Badge: `set_badge_visibility` com visibilidade desligada.
