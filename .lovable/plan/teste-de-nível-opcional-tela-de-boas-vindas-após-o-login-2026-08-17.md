# Teste de nível opcional + tela de boas-vindas após o login

## O que está acontecendo hoje

Ao entrar, o app verifica no perfil o campo "teste concluído" e, se estiver falso, redireciona à força para o teste de nível — sem opção de pular.

Sobre o caso do app desinstalado: os dados mostram duas contas diferentes no banco. A conta antiga (de junho) está com o teste marcado como concluído; foi criada hoje (17/08, 00:38) uma conta nova com o mesmo nome e o teste pendente. Ou seja, o teste reapareceu porque o login foi feito em uma conta nova, não porque o progresso foi perdido pela desinstalação. Desinstalar o PWA limpa a sessão local, mas não apaga os dados da conta.

## Mudanças

### 1. Teste de nível deixa de ser obrigatório
- Remover o redirecionamento automático para `/placement` na proteção de rotas.
- O teste continua disponível e pode ser feito a qualquer momento (pelo card de boas-vindas e pelo botão "Refazer teste" no dashboard).

### 2. Tela de boas-vindas após o login ("o que você quer fazer?")
Nova rota `/inicio` para onde o usuário vai logo após o login (e no lugar do redirecionamento forçado), com:
- Saudação com o nome do usuário e o seletor de idioma (🇬🇧 / 🇪🇸).
- Se o teste ainda não foi feito: card em destaque "Descobrir meu nível (2 min)" + link discreto "Pular por agora, começar no nível iniciante" (marca o teste como dispensado e vai ao dashboard).
- Opções rápidas em cards: Continuar lição, Prática livre (Escrita / Escuta / Fala / Leitura), Revisão, Vocabulário e "Ir para o dashboard".
- Se o teste já foi feito, o card do teste vira uma linha discreta "Refazer teste de nível".

### 3. Ajustes de navegação
- Após login/cadastro em `/auth`, encaminhar para `/inicio`.
- `/` (index) passa a mandar usuários já logados para `/inicio` em vez de sempre `/auth`.
- Ao terminar o teste, manter os botões atuais (praticar / dashboard).

## Detalhes técnicos

- `src/routes/_authenticated/route.tsx`: remover o bloco que consulta `placement_done` e lança `redirect({ to: "/placement" })`.
- Novo arquivo `src/routes/_authenticated/inicio.tsx` com `createFileRoute("/_authenticated/inicio")`, `head()` próprio (título/descrição/og), consultando `profiles` (nome + `placement_done`), próxima lição e contagem de revisões pendentes via TanStack Query, reutilizando `LanguageSwitch` e `useLanguage`.
- "Pular por agora" faz `upsert` em `profiles` marcando `placement_done: true` (o nível permanece `beginner` e cada prática livre continua com seletor de nível próprio).
- `src/routes/auth.tsx` e `src/routes/index.tsx`: destino passa a ser `/inicio`.
- Sem alterações de schema no banco.
