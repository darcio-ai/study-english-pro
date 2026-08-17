# Plano de Estudo Inteligente + Calendário

Duas funcionalidades novas: um "treinador" que analisa seu desempenho por habilidade e recomenda o que praticar, e um plano/calendário de estudos com metas e lembretes.

## 1. Inteligência de acompanhamento por habilidade

Hoje o app já grava cada tentativa (nota, modo, foco gramatical) e já tem níveis separados por habilidade. Falta transformar isso em recomendação automática.

O que será criado:

- **Diagnóstico por habilidade** (escrita, escuta, fala guiada, fala livre, leitura, vocabulário): média das últimas tentativas, tendência (melhorando/piorando), volume de prática e data da última prática.
- **Score de necessidade**: cada habilidade recebe uma prioridade calculada a partir de nota baixa, pouca prática recente e tendência de queda. A habilidade mais fraca vira o foco da semana.
- **Recomendações do dia**: a tela inicial passa a mostrar "Seu plano de hoje" — 3 a 5 blocos concretos (ex.: 2 exercícios de escuta, 1 fala livre, 5 flashcards), com peso maior para as habilidades fracas e sempre incluindo as revisões vencidas.
- **Ajuste automático de nível por habilidade**: se a média de uma habilidade ficar alta por várias tentativas seguidas, o app sugere subir o nível daquela habilidade; se ficar muito baixa, sugere descer. O usuário confirma (nada muda sem aviso).
- **Foco gramatical fraco**: os tópicos com pior desempenho entram na fila de revisão e nas sugestões.
- A página "Mural de Fraquezas" é ampliada para mostrar o radar por habilidade, além do que já existe por gramática.

## 2. Calendário e agenda de estudos

- **Configuração do plano**: dias da semana em que pretende estudar, minutos por dia e horário preferido.
- **Meta diária**: cada dia tem uma meta (por exercícios ou por minutos) gerada a partir do diagnóstico acima, com as habilidades fracas priorizadas.
- **Tela de calendário**: visão mensal com dias concluídos, parciais e perdidos, sequência atual (streak) e resumo semanal (o que praticou por habilidade).
- **Sessões agendadas**: dá para agendar uma sessão específica ("terça 19h — escuta, 15 min"), marcá-la como feita e reagendar.
- **Lembrete**: notificação local no navegador/PWA no horário escolhido (opt-in). Sem e-mail nesta etapa.
- Atalho na tela inicial: "Plano de hoje" com barra de progresso da meta.

## 3. Resumo semanal de progresso

- **Card "Sua semana"** na tela inicial e uma aba dedicada no calendário, fechando toda segunda-feira.
- Conteúdo: exercícios feitos vs. meta, minutos estudados, XP ganho, dias cumpridos/streak, nota média por habilidade com comparação à semana anterior (subiu/caiu), habilidade mais praticada e a mais negligenciada, palavras novas no vocabulário, conquistas desbloqueadas.
- **Destaques em texto**: 1 ponto forte e 1 ponto a melhorar, com um botão que já leva à prática recomendada da semana seguinte.
- Histórico das últimas semanas em gráfico simples de barras.

## Detalhes técnicos


- Novas tabelas no backend: `study_plan` (preferências: dias, minutos/dia, horário, meta), `study_sessions` (sessões agendadas/concluídas com habilidade, duração e status) e `skill_stats` derivada em tempo real (sem tabela — calculada por consulta sobre `attempts`).
- Todas as tabelas com RLS por `auth.uid()` e GRANTs para `authenticated`/`service_role`.
- Nova lib `src/lib/recommendations.ts`: agrega `attempts`, `review_queue`, `user_vocabulary` e `user_skill_levels` para produzir diagnóstico, prioridades e o plano diário. Lógica determinística (sem custo de IA).
- Ajuste automático de nível reaproveita e amplia `suggestLevelChange` em `src/lib/learning.ts`, agora por habilidade.
- Novas rotas: `/_authenticated/plano` (calendário + configuração) e cards de recomendação em `inicio.tsx`; `weaknesses.tsx` ganha o painel por habilidade.
- Lembretes via Notification API + service worker já existente do PWA.
- Textos em pt-BR, funcionando igual para inglês e espanhol (filtro por `preferred_language`).
- Resumo semanal calculado sob demanda a partir de `attempts`, `user_vocabulary`, `user_achievements` e `study_sessions` (janelas de 7 dias), sem tabela extra; gráfico com a lib de charts já presente no projeto.
