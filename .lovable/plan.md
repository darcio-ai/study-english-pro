## Causa

O nome em minúsculo vem do fallback `user.email?.split("@")[0]` — não existe linha em `profiles` para você. O `update` no `saveName` filtra por `user_id`, encontra 0 linhas e não dá erro, então parece que "não salva".

A linha de `profiles` só é criada pelo trigger `handle_new_user` para contas novas; usuários criados antes do trigger ficaram sem registro.

## Mudanças

**`src/routes/_authenticated/dashboard.tsx`** (apenas frontend):

- Trocar o `update` em `saveName` por um `upsert` em `profiles` com `onConflict: "user_id"`, inserindo `{ user_id, display_name: trimmed }`. Assim funciona tanto para quem já tem perfil quanto para quem não tem.
- Após salvar, invalidar `["profile", user.id]` (já é feito).

Sem migration, sem mudança de schema. Resolve o caso atual e qualquer outro usuário antigo sem linha em `profiles`.