## Objetivo

Hoje existe **um único nível** por usuário (`user_progress.level`), usado igualmente em escrita, listening, speaking, conversa livre e leitura — nos dois idiomas. A mudança: cada prática livre passa a ter o **seu próprio nível**, ajustável na hora, separado por idioma.

## Como fica para o usuário

Em cada tela de prática livre (Escrita, Listening, Speaking, Conversa livre, Leitura), no lugar da etiqueta fixa de nível aparece um **seletor**: Iniciante / Intermediário / Avançado. Trocar o nível recarrega imediatamente o próximo exercício naquele nível e a escolha fica salva para aquela habilidade + idioma.

Exemplo: 🇬🇧 Leitura = Avançado, Listening = Iniciante, Fala = Iniciante, Escrita = Intermediário — e um conjunto independente para 🇪🇸.

O teste de nivelamento continua definindo o nível inicial: ao concluir, ele preenche todas as habilidades com aquele nível, e o usuário refina depois. As **lições estruturadas** continuam usando o nível geral (não são prática livre).

## Detalhes técnicos

1. **Banco** — nova tabela `user_skill_levels`:
   - colunas: `user_id`, `language` (`en`/`es`), `skill` (`writing`, `listening`, `speaking`, `reading`), `level`, timestamps; único por (user_id, language, skill).
   - GRANTs para `authenticated`/`service_role`, RLS habilitada, política única escopada a `auth.uid() = user_id`.
   - Sem seed: quando não houver linha, a UI usa `user_progress.level` como padrão (fallback), e grava ao primeiro ajuste.

2. **Hook `useSkillLevel(userId, language, skill)`** (novo, espelhando `use-language.ts`): lê o nível salvo, faz fallback para `user_progress.level`, expõe `setLevel` que faz upsert e cacheia em localStorage para evitar flash.

3. **Componente `LevelSelect`** (novo): três botões/segmented control reutilizando o visual de `LevelPill`.

4. **Rotas atualizadas** (`exercise.tsx`, `listening.tsx`, `speaking.tsx`, `speaking-free.tsx`, `reading.tsx`): trocam a leitura direta de `user_progress.level` pelo hook, renderizam o `LevelSelect` no cabeçalho e recarregam o exercício/lista ao mudar de nível. Em `reading.tsx`, o nível filtra a lista de textos em vez de apenas marcar como "difícil".

5. **Placement** (`placement.tsx`): ao finalizar, além de gravar `user_progress.level`, grava as 4 habilidades do idioma atual com o mesmo nível.

Sem mudanças nas funções de IA — elas já recebem `level` e `language` por parâmetro.
