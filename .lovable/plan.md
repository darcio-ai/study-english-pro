# Revisão de segurança antes de publicar

Verifiquei o banco do EnglishUp agora. Resultado resumido:

- Verificação automática de segurança: nenhum problema encontrado.
- Todas as 14 tabelas têm proteção por linha (RLS) ativada, com regras.
- Dados pessoais (perfil, tentativas, progresso, vocabulário, plano de estudo, sessões, níveis, conquistas) só podem ser lidos e alterados pelo próprio usuário logado.
- Só o conteúdo do curso (aulas, exercícios, textos, lista de conquistas) é de leitura pública — o que é o esperado.
- Tentativas e conquistas não podem ser apagadas nem inseridas direto pelo app; conquistas só são concedidas pelo servidor.

Ou seja: a chave pública que aparece no arquivo de configuração é inofensiva neste caso, porque o banco está fechado.

## O que ainda vale ajustar

1. Adicionar `.env` ao `.gitignore` do projeto. Hoje ele não está lá. A chave atual é pública, mas isso evita que uma chave sensível entre por acidente no futuro.
2. Retirar as permissões de escrita "anônima" que sobraram nas tabelas de conteúdo e nas de dados pessoais. Hoje elas não causam risco (as regras de linha bloqueiam tudo), mas é uma camada extra de proteção.

## Detalhes técnicos

- `.gitignore`: acrescentar a linha `.env`. Remover o arquivo do rastreamento do Git é uma ação sua, fora do Lovable: `git rm --cached .env`.
- Migração de hardening de grants:
  - `REVOKE INSERT, UPDATE, DELETE ON <tabelas de conteúdo> FROM anon;` para `lessons`, `exercises`, `reading_texts`, `achievements` (mantendo `SELECT`).
  - `REVOKE ALL ON <tabelas de usuário> FROM anon;` para `profiles`, `attempts`, `user_progress`, `user_lesson_progress`, `user_vocabulary`, `user_skill_levels`, `user_achievements`, `review_queue`, `study_plan`, `study_sessions` — nenhuma delas tem política para anônimo.
  - Manter `GRANT` completo para `authenticated` e `service_role` como está hoje.
- Nada muda no código do app nem nas telas.

## Fora do meu alcance

Criar ou tornar público um repositório no GitHub é feito por você, na conexão GitHub do Lovable e depois nas configurações do repositório.
