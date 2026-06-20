## Problemas

1. **Editar nome não é descoberto**: o lápis só aparece no hover (`opacity-0 group-hover:opacity-100`), invisível no mobile. O clique no nome até funciona, mas o usuário não sabe.
2. **Teste de nível**: a rota `/placement` existe mas não há nenhum link visível no dashboard nem em "More".

## Mudanças (UI apenas, sem mexer em schema)

**`src/routes/_authenticated/dashboard.tsx`**
- Tornar o lápis de editar nome sempre visível (remover `opacity-0 group-hover:opacity-100`, deixar discreto com `text-gray-400`).
- Adicionar um card/botão "Fazer teste de nível" que leva para `/placement`:
  - Se `profiles.placement_done === false` (ou null), mostrar em destaque logo abaixo do header como um banner clicável ("Descubra seu nível em 5 min →").
  - Se já fez, mostrar um link discreto "Refazer teste de nível" junto da linha de Track/Level/XP ou no grid de navegação inferior (4ª coluna ao lado de Lições/Fraquezas/Progresso).

Sem mudanças em backend, rotas novas ou lógica de negócio.