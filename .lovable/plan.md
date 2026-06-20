# Plano: Exercícios de Áudio e Fala

Adicionar 3 modos de prática com áudio: Listening, Speaking (leitura em voz alta) e Speaking livre (responder pergunta falando).

## Suposições (me avise se quiser mudar)
- **Voz (TTS)**: Lovable AI `openai/gpt-4o-mini-tts` (sem custo extra, já configurado)
- **Transcrição (STT)**: Lovable AI `openai/gpt-4o-mini-transcribe`
- **Avaliação**: `google/gemini-3-flash-preview` (mesmo que já usamos)
- **Onde aparecem**: nova aba/seção dedicada no dashboard — "Listening" e "Speaking" como cards separados de "Praticar" (escrita)

---

## 1. Banco de Dados

Estender tabela `exercises` com colunas opcionais:
- `mode` text default `'writing'` — `'writing' | 'listening' | 'speaking_read' | 'speaking_free'`
- `audio_script` text — texto a ser falado pelo TTS (para listening)
- `expected_response` text — resposta-modelo esperada (para speaking livre)

Estender `attempts`:
- `audio_url` text nullable — referência ao áudio gravado (opcional, só se quiser histórico de gravações)
- `transcript` text nullable — transcrição da fala do usuário

Sem nova tabela. Sem bucket de storage por enquanto (áudio só fica em memória durante a sessão — economiza storage).

Seed: gerar ~30 exercícios de listening e ~30 de speaking via migration, por nível.

---

## 2. Servidor — 3 novas server functions

**`src/lib/tts.functions.ts`** — `synthesizeSpeech({ text, voice })`
- Chama Lovable AI TTS, retorna áudio em base64 (formato mp3)
- Frases curtas → resposta única, sem streaming (mais simples no mobile)
- Voz padrão: `alloy` (clara, neutra)

**`src/lib/stt.functions.ts`** — `transcribeAudio({ audioBase64, mimeType })`
- Recebe áudio do usuário em base64
- Encaminha multipart para `/v1/audio/transcriptions`, language=`en`
- Retorna `{ text }`

**`src/lib/evaluate-speaking.functions.ts`** — `evaluateSpeaking({ original, transcript, mode, level })`
- Usa Gemini para comparar a transcrição com o esperado
- Retorna `{ score, accuracy_pct, mispronounced_words: string[], feedback_pt, corrected_text }`
- Prompt diferente para "leitura" (comparação literal) vs "livre" (avalia se a resposta faz sentido + gramática)

Todas com `requireSupabaseAuth`.

---

## 3. Cliente — 3 novas rotas

### `/listening` — Ouvir e escrever
1. Carrega exercise (mode=`listening`)
2. Botão grande "▶️ Ouvir" → chama TTS, toca áudio (pode tocar de novo até 3x)
3. Textarea: "Escreva o que você ouviu"
4. "Verificar" → mesma `correctGrammar` que já temos, mas compara com `audio_script`
5. Mostra score + texto correto + erros

### `/speaking` — Ler em voz alta
1. Mostra frase em inglês (texto grande, legível)
2. Botão "🎤 Pressione para falar" (mobile-first: tap-to-record com `MediaRecorder`)
3. Indicador visual de gravação (onda animada simples)
4. Stop → envia áudio → STT → `evaluateSpeaking` modo `read`
5. Resultado: score de precisão, palavras pronunciadas incorretamente destacadas em vermelho, áudio modelo para reescutar (TTS)

### `/speaking-free` — Conversação
1. Mostra pergunta em PT + EN ("Talk about your weekend / Conte sobre seu fim de semana")
2. Mesmo fluxo de gravação
3. `evaluateSpeaking` modo `free` → avalia fluência + gramática + relevância
4. Mostra transcrição do que falou + feedback em PT + versão corrigida

---

## 4. Componente de gravação reutilizável

`src/components/audio-recorder.tsx`:
- `MediaRecorder` com fallback `audio/webm` → `audio/mp4` (Safari iOS)
- Pede permissão do mic explicando o motivo
- Limite: 30 segundos
- Validação: rejeita gravação < 1KB (vazia)
- Estado visual: idle → recording (com timer) → processing → done
- Acessível: aria-label, suporte a teclado

---

## 5. Dashboard — adicionar acesso

Substituir o único botão "Praticar agora" por um grid 2x2 mobile:
- 📝 Escrever
- 🎧 Ouvir  
- 🎤 Falar (leitura)
- 💬 Conversar

Cada um leva à rota correspondente.

---

## Custos / Performance

- TTS: ~$0.015 por minuto de áudio gerado (frases curtas = ~$0.001 cada)
- STT: ~$0.006 por minuto transcrito
- Cache: TTS de frases idênticas não é cacheado nesta v1 (manter simples). Posso adicionar cache no Supabase Storage depois se ficar caro.

---

## Arquivos

| Ação | Arquivo |
|------|---------|
| Migration | `..._audio_modes.sql` (alter tables + seed) |
| Criar | `src/lib/tts.functions.ts` |
| Criar | `src/lib/stt.functions.ts` |
| Criar | `src/lib/evaluate-speaking.functions.ts` |
| Criar | `src/components/audio-recorder.tsx` |
| Criar | `src/routes/_authenticated/listening.tsx` |
| Criar | `src/routes/_authenticated/speaking.tsx` |
| Criar | `src/routes/_authenticated/speaking-free.tsx` |
| Editar | `src/routes/_authenticated/dashboard.tsx` (grid de modos) |
| Editar | `src/lib/correct-grammar.functions.ts` (aceitar `expected` opcional para listening) |

---

## Para o usuário (resumo simples)

Você terá 3 novos modos: ouvir uma frase em inglês e escrever, ler uma frase em voz alta e receber score de pronúncia, e responder perguntas falando livremente. Tudo no celular, usando o microfone. Posso começar?