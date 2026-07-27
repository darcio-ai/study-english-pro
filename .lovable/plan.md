## Problema

O erro "Falha ao corrigir: No object generated: response did not match schema" vem da correção por IA (`src/lib/correct-grammar.functions.ts`). O schema de saída usa limites rígidos (`score` inteiro entre 0 e 100, campos todos obrigatórios). Quando o modelo devolve algo fora desses limites (ex.: `95.0`, campo ausente, texto extra), a validação pós-resposta falha e o exercício quebra — mesmo com a chamada à IA tendo dado certo e sido cobrada.

O mesmo padrão existe na avaliação de fala (`src/lib/evaluate-speaking.functions.ts`), então listening/speaking têm o mesmo risco.

## O que fazer

1. **Correção gramatical (`correct-grammar.functions.ts`)**
   - Remover os limites do schema (`.int()`, `.min()`, `.max()`) e deixar os campos flexíveis; passar as regras ("nota de 0 a 100", "explicação em português") apenas no prompt.
   - Normalizar em código: arredondar e limitar a nota a 0–100, garantir array de erros, preencher `corrected_text` com a resposta do aluno quando vier vazio.
   - Adicionar fallback: se a IA devolver algo não conforme, tentar interpretar o texto bruto da resposta antes de mostrar erro; só falhar se realmente não houver conteúdo.
   - Manter mensagens amigáveis para limite de requisições e créditos.

2. **Avaliação de fala (`evaluate-speaking.functions.ts`)**
   - Mesmo tratamento: schema sem limites, normalização de `score`/`accuracy_pct`, fallback de parsing e mensagens de erro claras.

3. **Revisão de todos os modos de exercício**
   Verificar que cada modo envia dados válidos para as funções de IA e trata erro sem travar a tela:
   - Escrita (`/exercise`, runner de lição `/lesson/$id`)
   - Listening (`/listening`) — inclusive quando o texto do áudio é longo
   - Speaking guiado (`/speaking`) e conversação livre (`/speaking-free`)
   - Leitura (`/reading`)
   - Revisão SRS (`/review`) e vocabulário (`/vocabulary`, áudio TTS)
   Ajustar apenas o que estiver faltando: entrada vazia, texto acima do limite enviado ao TTS/correção, e exibição do erro sem perder a resposta digitada.

4. **Validação**
   Rodar uma correção real por cada caminho (escrita, listening, speaking, leitura) e conferir a resposta antes de concluir.

## Detalhes técnicos

Segue a recomendação oficial do AI SDK: schemas de saída estruturada devem ser livres de restrições (`min`/`max`/`format`), com os limites expressos no prompt e aplicados por código, e a chamada envolvida em tratamento de `NoObjectGeneratedError` usando `error.text` como fallback. Nenhuma mudança de banco de dados ou de conteúdo é necessária.
