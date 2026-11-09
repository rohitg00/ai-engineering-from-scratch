# Transmissão de Diálogo de Fala a Fala  Moshi, Hibiki e Full-Duplex Dialogue

> 2024-2026 redefinido voz IA. Moshi envia um único modelo que ouve e fala simultaneamente em 200 ms de latência. Hibiki faz a tradução de fala para fala pedaço por pedaço. Ambos abandonam o pipeline ASR → LLM → TTS para uma arquitetura unificada de duplex completo sobre tokens de codec Mimi. Este é o novo design de referência.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 13 (Neural Audio Codecs), Phase 6 · 11 (Real-Time Audio), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## O problema

Cada agente de voz construído a partir das lições 11 + 12 tem um nível de latência fundamental de cerca de 300-500 ms: incêndios VAD, processos STT, razões LLM, gera TTS. Cada etapa tem sua própria latência mínima. Você pode sintonizar e paralelalizar, mas a forma do pipeline o limita.

Moshi (Kyutai, 2024-2026) faz uma pergunta diferente: e se não houver um pipeline? e se um modelo absorver áudio e emitir áudio diretamente, continuamente, com texto como um "monólogo interno" intermediário em vez de um estágio necessário?

A resposta é:**full-duplex speech-to-speech**A latença teórica de 160 ms (80 ms Mimi frame + 80 ms atraso acústico) a latença prática de 200 ms em uma única GPU L4.

## O conceito

![Moshi architecture: two parallel Mimi streams + inner-monologue text](../assets/moshi-hibiki.svg)

### A arquitetura Moshi

**Inputs.**Dois fluxos de codec Mimi, ambos a 12,5 Hz × 8 codes:

- Fluxo 1: áudio do usuário (Mimi-encodado, chegando constantemente)
- Stream 2: Áudio próprio de Moshi (generado por Moshi)

**The transformer.**Um Transformador Temporal de parâmetro 7B processa ambos os fluxos e um fluxo de texto "monólogo interno".

1. Consuma os mais recentes tokens Mimi (8 codes).
2. Consume os mais recentes tokens Moshi Mimi (8 codes, conforme produzido).
3. Gera o próximo token de texto Moshi (monólogo interno).
4. Gera os próximos tokens Moshi Mimi (8 cédulos através de um pequeno Transformador de Profundeza).

Os três fluxos  áudio do usuário, áudio de Moshi, texto de Moshi  funcionam em paralelo. Moshi pode ouvir o usuário enquanto fala; pode interromper-se quando o usuário interrompe; pode retrocânal ("mhm") sem quebrar sua pronunciação principal.

**The depth transformer.**Dentro de um quadro, os 8 codebooks não são previstos em paralelo  eles têm dependências entre os codebooks. Um pequeno "transformador de profundidade" de 2 camadas prevê-los sequencialmente dentro de 80 ms. Esta é a fatorização padrão para os LMs de codec AR (também usado por VALL-E, VibeVoice).

### Por que o texto interno do monólogo ajuda

Sem texto explícito, o modelo tem que modelar a linguagem em sua corrente acústica. Moshi: forçá-lo a emitir tokens de texto ao lado do áudio. O fluxo de texto é essencialmente a transcrição do que Moshi está dizendo. Isso melhora a coerência semântica, torna mais fácil trocar uma cabeça de modelo de linguagem e dá-lhe transcrições gratuitamente.

### Hibiki: translação de fala em fala em streaming

A mesma arquitetura, treinada em pares de traduções. Áudio de origem, áudio de língua-alvo, continuamente. Hibiki-Zero (Feb 2026) elimina a necessidade de dados de treinamento alinhados a nível de palavras  usa dados de nível de frase + aprendizado de reforço GRPO para otimização de latência.

Quatro pares de línguas suportados inicialmente; podem ser adaptados a uma nova língua com ≈1000 horas.

### A pilha mais ampla de Kyutai (2026)

- **Moshi** Diálogo duplex completo (em primeiro lugar em francês, com boa assistência em inglês)
- **Hibiki / Hibiki-Zero** Tradução simultânea de fala
- **Kyutai STT** RAS de streaming (500 ms ou 2,5 segundos de antecedência)
- **Kyutai Pocket TTS** TTS de 100M-param executado em CPU (Jan 2026)
- **Unmute** um conjunto completo de canais combinando estes em servidores públicos

Transmissão em uma GPU L40S: 64 sessões simultâneas em 3x em tempo real.

### Sesame CSM  o primo

O Sesame CSM (2025) usa uma ideia similar  uma espinha dorsal Llama-3 com uma cabeça de codec Mimi. Mas o CSM é unidirecional (tomando contexto + texto, produz fala) em vez de duplex completo. É o melhor TTS "presença de voz" no mercado; não é o mesmo que a capacidade de duplex completo de Moshi.

### Números de desempenho 2026

| Model | Latency | Use case | License |
|-------|---------|----------|---------|
| Moshi | 200 ms (L4) | full-duplex English / French dialogue | CC-BY 4.0 |
| Hibiki | 12.5 Hz framerate | French ↔ English streaming translation | CC-BY 4.0 |
| Hibiki-Zero | same | 5 language-pairs, no aligned data | CC-BY 4.0 |
| Sesame CSM-1B | 200 ms TTFA | context-conditioned TTS | Apache-2.0 |
| GPT-4o Realtime | ~300 ms | closed, OpenAI API | commercial |
| Gemini 2.5 Live | ~350 ms | closed, Google API | commercial |

```figure
sp-fullduplex
```

## Construí-lo

### Passo 1: interface

Moshi expõe um servidor WebSocket que recebe 80 ms de áudio codificado por Mimi e retorna 80 ms de áudio codificado por Mimi.

```python
import asyncio
import websockets
from moshi.client_utils import encode_audio_mimi, decode_audio_mimi

async def moshi_chat():
    async with websockets.connect("ws://localhost:8998/api/chat") as ws:
        mic_task = asyncio.create_task(stream_mic_to(ws))
        spk_task = asyncio.create_task(stream_from_to_speaker(ws))
        await asyncio.gather(mic_task, spk_task)
```

### Passo 2: o ciclo duplex completo

```python
async def stream_mic_to(ws):
    async for chunk_80ms in mic_stream_at_12_5_hz():
        mimi_tokens = encode_audio_mimi(chunk_80ms)
        await ws.send(serialize(mimi_tokens))

async def stream_from_to_speaker(ws):
    async for msg in ws:
        mimi_tokens, text_token = deserialize(msg)
        audio = decode_audio_mimi(mimi_tokens)
        await play(audio)
```

As duas direções executam simultaneamente. Python asyncio ou futuros Rust são o transporte padrão.

### Passo 3: objectivo da formação (concepcional)

Por cada quadro de 80 ms `t`- Não .

- - Introdução:`user_mimi[0..t]`- Não .`moshi_mimi[0..t-1]`- Não .`moshi_text[0..t-1]`
- Previsão: `moshi_text[t]`, então`moshi_mimi[t, codebook_0..7]`

O texto é previsto antes do áudio (monólogo interno); o áudio é previsto como sequencial de código dentro do transformador de profundidade.

### Passo 4: onde o Moshi ganha e onde não ganha

Moshi ganha:

- Sub-250 ms de ponta a ponta em hardware barato.
- - Cabeça natural e interrupções.
- Não há código de cola de oleoduto.

Moshi não ganha:

- O curso de formação profissional é gratuito e é gratuito.
- Raciocínio longo (Moshi é um modelo de diálogo 8B, não Claude/GPT-4).
- Precisão factual em tópicos de nicho.
- A maioria dos casos de utilização das empresas de produção (a seguir a utilizar oleodutos em 2026).

## Usá-lo

| Situation | Pick |
|-----------|------|
| Lowest-latency voice companion | Moshi |
| Live translation call | Hibiki |
| Voice demo / research | Moshi, CSM |
| Enterprise agent with tools | Pipeline (Lesson 12), not Moshi |
| Custom-voice TTS in context | Sesame CSM |
| Speech-to-speech, any languages | GPT-4o Realtime or Gemini 2.5 Live (commercial) |

## Encurralagens

- **Limited tool calling.**O Moshi é um modelo de diálogo, não um quadro de agentes.
- **Specific-voice conditioning.**Moshi usa uma única persona treinada; clonagem é uma corrida de treinamento separada.
- **Language coverage.**O francês + inglês é excelente; outros são limitados. Hibiki-Zero ajuda, mas ainda precisa de dados de treinamento.
- **Resource cost.**Uma sessão completa do Moshi tem um slot da GPU; não um padrão de implantação barata de inquilinos compartilhados.

## Envia-o

Salva como`outputs/skill-duplex-pipeline.md`Escolha pipeline versus arquitetura duplex completa para uma carga de trabalho de agente de voz, com razão.

## Exercícios

1. **Easy.**Corra .`code/main.py`Simula simbolicamente a arquitetura de dois fluxos + monólogo interno.
2. **Medium.**Pegue Moshi no HuggingFace, execute o servidor, teste uma conversa, mede a latência do relógio de parede do end-of-user speech ao começo da resposta de Moshi.
3. **Hard.**Leve o seu agente de pipeline lição 12 e compare a latência P50 vs Moshi em 20 declarações de teste correspondentes.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Full-duplex | Hear-and-speak at once | Two audio streams active simultaneously on the same model. |
| Inner monologue | Model's text stream | Moshi emits text tokens alongside its audio output. |
| Depth transformer | Inter-codebook predictor | Small transformer that predicts 8 codebooks within one 80 ms frame. |
| Mimi | Kyutai's codec | 12.5 Hz × 8 codebooks; semantic+acoustic; powers Moshi. |
| Streaming S2S | Audio → audio live | Chunk-by-chunk translation/dialogue, no pipeline stages. |
| Back-channeling | "Mhm" reactions | Moshi can emit small acknowledgments without breaking its turn. |

## Mais leitura

- [Défossez et al. (2024). Moshi — speech-text foundation model](https://arxiv.org/html/2410.00037v2)- O jornal.
- [Kyutai Labs (2026). Hibiki-Zero](https://arxiv.org/abs/2602.12345) Translação em streaming sem dados alinhados.
- [Sesame (2025). Crossing the uncanny valley of voice](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice) Especificidade do CSM.
- [Kyutai — Moshi repo](https://github.com/kyutai-labs/moshi) instalar + servidor.
- [OpenAI — Realtime API](https://platform.openai.com/docs/guides/realtime)- Peer comercial fechado.
- [Kyutai — Delayed Streams Modeling](https://github.com/kyutai-labs/delayed-streams-modeling) o quadro STT/TTS sob o capô.
