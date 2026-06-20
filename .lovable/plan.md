
## Diagnóstico do Estado Atual

O EnglishUp já tem uma base sólida e cobre os 4 skills:

| Skill | Implementação | Status |
|---|---|---|
| Escrita | Exercícios com correção IA (score, erros detalhados) | ✅ Bom |
| Listening | TTS + transcrição (3 plays) | ✅ Bom |
| Speaking | STT + avaliação de pronúncia + conversação livre | ✅ Bom |
| Leitura | **Não existe** | ❌ Ausente |
| Teste de Nível | 25 questões A1-A2/B1/B2 | ✅ Funcional |

**Pontos fortes:** Correção em tempo real com IA, interface limpa, 4 modos de prática, streak básico.

**Pontos críticos de aprendizado:** sem caminho estruturado, sem revisão de erros, sem adaptação de dificuldade, pouco conteúdo por modo (~8 exercícios), sem gamificação significativa.

---

## 7 Recomendações Priorizadas

### 1. Sistema de Lições Estruturadas (Alta prioridade)

**Problema:** Exercícios aleatórios não criam progressão perceptível. O usuário não sente "terminei o capítulo de Present Perfect".

**Solução:** Criar `lessons` (lições) organizadas em `units` (unidades). Cada lição é um bloco sequencial de 5-8 exercícios de múltiplos modos (escrita → listening → speaking) sobre o mesmo tema gramatical.

```text
Unidade 1: Present Simple
  Lição 1.1: Forma afirmativa (5 exercícios)
  Lição 1.2: Forma negativa e perguntas (5 exercícios)
  Lição 1.3: Reading + Listening + Speaking mistos (5 exercícios)
  Quiz de revisão (3 questões rápidas)
```

**Impacto no aprendizado:** Contextualização progressiva + mix de skills no mesmo tema = retenção 3x maior (princípio da variação de prática).

---

### 2. Repetição Espaçada de Erros — "Fila de Revisão" (Alta prioridade)

**Problema:** Erros corrigidos são esquecidos. O usuário nunca revê o que errou.

**Solução:** Toda tentativa com score < 70 entra numa "fila de revisão" (`review_queue` no banco). O sistema sugere 3-5 revisões diárias no dashboard, usando intervalos crescentes (1 dia → 3 dias → 7 dias → 14 dias).

- Cada revisão reaproveita o mesmo exercício mas com dica contextual
- Se acertar a revisão, sobe o intervalo. Se errar, volta para 1 dia
- Badge "Mestre da Revisão" para quem completar 20 revisões

**Impacto:** Converte erros em oportunidades de aprendizado real. Baseado na curva do esquecimento de Ebbinghaus.

---

### 3. Dificuldade Adaptativa Automática (Média-Alta prioridade)

**Problema:** O nível do usuário é definido uma vez no placement e raramente muda. Alguém que evoluiu fica preso em exercícios fáceis.

**Solução:** Algoritmo simples baseado nas últimas 10 tentativas:
- Média ≥ 85 e ≥ 7 acertos consecutivos → oferece subir de nível
- Média ≤ 40 por 5 tentativas → sugere descer ou revisar fundamentos
- Mudança é sempre proposta ao usuário, nunca automática (dá controle)

**Impacto:** Zona de Desconforto Produtiva — nem fácil demais (tédio) nem difícil demais (frustração).

---

### 4. Mural de Fraquezas + Recomendações Personalizadas (Média prioridade)

**Problema:** O gráfico de progresso mostra médias, mas não diz "você erra artigos 70% das vezes".

**Solução:** Página `/weaknesses` que analisa as últimas 50 tentativas e agrupa por:
- Grammar focus mais errado (ex: "Third Person Singular: 65% de erros")
- Tipo de erro recorrente (ex: "Esquece artigo 'a/an' em 8/10 casos")
- Skill mais fraco (ex: "Speaking: nota média 52 vs Writing: 78")

Recomendação automática: "Você errou 'Present Perfect' 5 vezes. Que tal revisar a Lição 2.3?"

---

### 5. Modo Leitura com Compreensão (Média prioridade)

**Problema:** Não há prática de leitura. É um dos 4 skills do Cambridge/Oxford.

**Solução:** `/reading` com textos curtos (100-200 palavras) por nível:
- Texto com destaque de vocabulário-chave (hover mostra tradução)
- 3 questões de múltipla escolha de compreensão
- IA explica por que a alternativa correta é a certa e por que as outras estão erradas

Temas: emails de trabalho, notícias simples, histórias curtas, diálogos.

---

### 6. Flashcards de Vocabulário com SRS (Média prioridade)

**Problema:** Não há acumulação de vocabulário pessoal. Cada exercício é isolado.

**Solução:** Durante qualquer exercício, o usuário pode "salvar" uma palavra/frase. Isso cria um flashcard pessoal na tabela `user_vocabulary`.

- Modo `/vocabulary` mostra os flashcards do usuário
- Sistema SRS simples: Novo → Revisar em 1 dia → 3 dias → 7 dias → 14 dias → 30 dias
- Front: palavra em EN + contexto da frase original
- Back: tradução PT + áudio TTS da pronúncia

**Impacto:** Vocaubulário pessoal = mais relevante que listas genéricas.

---

### 7. Gamificação com Sentido: Conquistas e Metas Diárias (Baixa-Média prioridade)

**Problema:** Streak sozinho não motiva a longo prazo.

**Solução:**
- **Metas diárias simples:** "Pratique 10 min" / "Complete 3 exercícios" / "Acerte 2 no speaking"
- **Conquistas desbloqueáveis com critérios de aprendizado real:**
  - "Perfeccionista" — 10 exercícios com score 100
  - "Poliglota da Voz" — usou todos os 4 skills no mesmo dia
  - "Revisor" — completou 20 revisões da fila
  - "Em ascensão" — subiu de nível pela primeira vez
  - "Falante Nativo" — 30 dias de streak
- **XP por atividade** com bônus de combo (fazer 3 dias seguidos = +20% XP)

**Impacto:** Metas diárias focadas em tempo/esforço (não apenas acertos) reduzem ansiedade de performance.

---

## Plano de Implementação Sugerido

### Fase 1 — Fundamentos (semana 1-2)
1. Criar schema de `lessons` + `user_lesson_progress` + `review_queue`
2. Agrupar exercícios existentes em ~6 lições por nível (18 lições totais)
3. Implementar fila de revisão com intervalos simples
4. Atualizar dashboard para mostrar "Próxima lição" + "Revisões pendentes"

### Fase 2 — Inteligência (semana 3-4)
1. Algoritmo de dificuldade adaptativa (análise das últimas 10 tentativas)
2. Página de Mural de Fraquezas (`/weaknesses`)
3. Flashcards de vocabulário (`user_vocabulary` + SRS básico)

### Fase 3 — Expansão (semana 5-6)
1. Modo Leitura (`/reading`) com 6 textos por nível
2. Sistema de conquistas + metas diárias
3. Mais exercícios (seed): dobrar quantidade por modo e nível

### Fase 4 — Polimento (semana 7-8)
1. Múltiplas vozes TTS + velocidade ajustável
2. Lembretes diários via push (se o usuário permitir)
3. A/B test de layout no dashboard para maximizar engajamento

---

## O Que NÃO Recomendo Agora

- **Chatbot de conversação livre contínuo** — custo de IA alto, valor pedagógico questionável sem estrutura
- **Leaderboards públicos** — demora ter base de usuários, pode desmotivar iniciantes
- **Sistema de "vidas" ou penalidades** — aumenta ansiedade, reduz prática
- **Vídeo aulas** — fora do escopo do app de prática; manter foco em "fazer" não "assistir"

---

## Estimativa de Custo de IA

Com as mudanças propostas, o consumo de IA aumentaria ~2-3x (mais correções em revisão, novos modos). Para ~100 usuários ativos/dia fazendo 5 exercícios cada:
- Hoje: ~$2-3/dia
- Após Fase 1+2: ~$5-8/dia
- Após Fase 3+4: ~$8-12/dia

Isso é controlável. A fila de revisão reutiliza os mesmos exercícios (sem custo de geração de conteúdo novo), e o modo leitura pode usar correção mais simples (múltipla escolha = 1 chamada de IA por texto, não por usuário).
