# Plano: Teste de Nível + Nome do Usuário

## Objetivo
Adicionar um teste de proficiência de 25 questões ao app e permitir que o usuário veja/edite seu nome no dashboard.

---

## 1. Banco de Dados

Nova tabela `public.profiles`:
- `user_id` (uuid, PK, referencia auth.users)
- `display_name` (text, nullable)
- `placement_done` (boolean, default false)
- `created_at`, `updated_at`

Trigger `on_auth_user_created`: ao criar conta, insere perfil com `display_name` vindo de `raw_user_meta_data->>'full_name'` (ou email como fallback).

RLS + GRANTs: usuário autenticado pode ler/alterar apenas seu próprio perfil.

---

## 2. Autenticação — Campo "Nome"

Na tela `/auth`, aba "Criar conta" ganha um campo **Nome** (obrigatório).
O nome é enviado no `user_metadata: { full_name: nome }` do `signUp`.
Login com Google já traz `full_name` automaticamente.

---

## 3. Fluxo após Login

O layout `_authenticated/route.tsx` consulta `profiles.placement_done`:
- Se `false` (primeiro acesso) → redireciona para `/placement`
- Se `true` → segue normalmente para o dashboard

---

## 4. Teste de Nível — Rota `/placement`

### Estrutura das 25 questões (múltipla escolha A/B/C/D):

| Faixa | Quantidade | Nível CEFR | Conteúdo |
|-------|-----------|------------|----------|
| 1–8   | 8         | A1–A2      | Present/past simple, articles (a/an/the), basic prepositions, can/could, common collocations |
| 9–17  | 9         | B1         | Present perfect, modal verbs (should/must), conditionals (1st/2nd), phrasal verbs, passive voice |
| 18–25 | 8         | B2         | Past perfect, mixed conditionals, reported speech, relative clauses, advanced collocations |

### Funcionamento da página:
- Uma questão por vez, com barra de progresso
- Não é possível voltar (decisão final)
- ~4–6 minutos no total
- Mobile-first (botões grandes, fonte legível)

### Resultado:
| Acertos | Nível atribuído |
|---------|----------------|
| 0–8     | beginner       |
| 9–16    | intermediate   |
| 17–25   | advanced       |

### Ao finalizar:
1. Salva nível em `user_progress.level`
2. Marca `profiles.placement_done = true`
3. Mostra tela de resultado com parabéns + nível descrito
4. Botão "Começar a praticar" → `/exercise`

---

## 5. Dashboard — Nome + Refazer Teste

- Substitui `user.email` por `profiles.display_name` (com email pequeno abaixo)
- Permite editar o nome inline (clica no nome → input → salva)
- Botão "Refazer teste de nível" que reseta `placement_done = false` e redireciona para `/placement`

---

## Arquivos novos/modificados

| Ação | Arquivo |
|------|---------|
| Criar | `supabase/migrations/..._profiles.sql` |
| Criar | `src/lib/placement-questions.ts` |
| Criar | `src/routes/_authenticated/placement.tsx` |
| Editar | `src/routes/auth.tsx` |
| Editar | `src/routes/_authenticated/route.tsx` |
| Editar | `src/routes/_authenticated/dashboard.tsx` |
| Editar | `src/routeTree.gen.ts` (auto) |

---

## Resumo para o usuário
Você terá um teste de 25 questões de múltipla escolha (progressão A1→B2) que define seu nível automaticamente. Pode refazer quando quiser. Seu nome aparece no dashboard e pode ser editado.