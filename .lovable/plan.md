# Transcrição confiável nos exercícios de fala + refazer tentativa

## O problema

Na lição "Numbers 1–20", você pronunciou certo, mas a transcrição voltou em caracteres chineses. O app tratou isso como resposta do aluno, mandou para a avaliação e gravou 0/100 no seu histórico — sem chance de tentar de novo.

## O que muda

1. **Detectar transcrição inválida antes de avaliar**
   - Se o texto transcrito contiver caracteres fora do alfabeto latino (chinês, japonês, cirílico, árabe etc.), ou vier vazio/quase vazio, o app não pontua e não grava tentativa.
   - Mostra uma mensagem clara: "Não consegui entender o áudio. Vamos tentar de novo?" com botão para regravar.

2. **Até 3 tentativas de gravação**
   - Contador de tentativas por exercício (1/3, 2/3, 3/3). Cada falha de reconhecimento incrementa e permite regravar.
   - Após a 3ª falha, o app oferece duas saídas: "Tentar mais uma vez" (zera o contador) ou "Pular exercício" — pular não grava nota 0, apenas segue.
   - Uma gravação bem-sucedida zera o contador e segue o fluxo normal de avaliação.

3. **Reduzir o erro de idioma na transcrição**
   - O idioma já é enviado; além disso será enviado um `prompt` de contexto com a frase-alvo, o que ajuda o modelo a ancorar no idioma e vocabulário corretos.
   - Se ainda assim vier em outro alfabeto, cai na regra 1 (nova tentativa), nunca em nota 0.

4. **Mesmo comportamento na prática livre**
   - As telas `/speaking` e `/speaking-free` recebem a mesma proteção e o mesmo fluxo de tentativas, para não gravar 0 por falha de reconhecimento.

## Detalhes técnicos

- `src/lib/stt.functions.ts`: enviar `prompt` (frase esperada) no formulário de transcrição; retornar também um sinalizador quando o texto não tiver caracteres latinos suficientes.
- Novo helper (ex.: `src/lib/transcript-quality.ts`): função `isUnreliableTranscript(text)` — verifica presença de scripts não-latinos, proporção mínima de letras latinas e comprimento mínimo.
- `src/routes/_authenticated/lesson.$id.tsx`: estado `sttAttempts`; em `handleRecorded`, se a transcrição for inválida, incrementar, exibir aviso e sair sem chamar `evalFn` nem `persistAttempt`; após 3 falhas mostrar as ações "tentar de novo" / "pular".
- `src/routes/_authenticated/speaking.tsx` e `speaking-free.tsx`: mesma verificação e contador antes de `evalFn` e do `insert` em `attempts`.
