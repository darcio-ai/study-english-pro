## Resumo

As duas questões detectadas são **vulnerabilidades de controle de acesso** no banco de dados. Nenhuma delas exige mudança no código do app — a correção é puramente no banco de dados, adicionando políticas de segurança (RLS) que bloqueiam operações não autorizadas.

---

### Questão 1 — Critical
**"Users can arbitrarily grant themselves achievements"**

A tabela `user_achievements` não tem uma política INSERT. Um usuário autenticado pode inserir conquistas para qualquer conta (incluindo outras pessoas). No app, a inserção só acontece via função servidor (`grantAchievements`), que usa `supabaseAdmin` (service role). O problema é que nada impede um usuário malicioso de chamar a API diretamente.

**Correção:** Adicionar uma política RESTRICTIVE INSERT que nega todas as inserções diretas. A função servidor continua funcionando porque o service role bypassa RLS.

---

### Questão 2 — Warning
**"Attempt records can be modified or deleted by anyone"**

A tabela `attempts` só tem políticas SELECT e INSERT. Não há políticas UPDATE ou DELETE. O app nunca faz UPDATE/DELETE em tentativas, mas a ausência de políticas explícitas deixa brecha para manipulação futura.

**Correção:** Adicionar políticas RESTRICTIVE UPDATE e DELETE que negam qualquer modificação ou exclusão de registros de tentativas.

---

### Execução

Criar uma migration SQL com:

```sql
-- user_achievements: bloquear INSERT direto (server function bypassa via service role)
CREATE POLICY "No direct insert on user_achievements"
  ON public.user_achievements
  FOR INSERT
  TO public
  WITH CHECK (false);

-- attempts: bloquear UPDATE e DELETE
CREATE POLICY "No update on attempts"
  ON public.attempts
  FOR UPDATE
  TO public
  USING (false);

CREATE POLICY "No delete on attempts"
  ON public.attempts
  FOR DELETE
  TO public
  USING (false);
```

Após aplicar a migration, marcar ambas as questões como corrigidas no scanner.