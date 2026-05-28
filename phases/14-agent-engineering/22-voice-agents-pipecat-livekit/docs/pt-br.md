# Voice Agents: Pipecat e LiveKit

> Voice agents são uma categoria de produção de primeira classe em 2026. Pipecat te dá um pipeline baseado em frames em Python (VAD → STT → LLM → TTS → transport). LiveKit Agents conecta modelos de IA a usuários via WebRTC. Alvos de latência de produção ficam entre 450–600ms ponta a ponta em stacks premium.

**Tipo:** Aprender
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 01 (Agent Loop), Fase 14 · 12 (Workflow Patterns)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Descrever o pipeline baseado em frames do Pipecat: DOWNSTREAM (source→sink) e UPSTREAM (controle).
- Nomear as etapas canônicas do pipeline de voz e quais transports o Pipecat suporta.
- Explicar as duas classes de voice agent do LiveKit Agents (MultimodalAgent, VoicePipelineAgent) e quando cada uma se encaixa.
- Resumir as expectativas de latência de produção em 2026 e como elas influenciam escolhas de arquitetura.

## O Problema

Voice agents não são um loop de texto com TTS encaixado. Orçamentos de latência são brutais (~600ms), áudio parcial é o padrão, detecção de turn é um modelo, e transports vão de SIP telefônico a WebRTC. Ou você constrói um pipeline baseado em frames (Pipecat) ou apoiado numa plataforma (LiveKit).

## O Conceito

### Pipecat (pipecat-ai/pipecat)

- Framework de pipeline baseado em frames em Python.
- `Frame` → cadeia de `FrameProcessor`.
- Duas direções de fluxo:
  - **DOWNSTREAM** — source → sink (áudio de entrada, TTS de saída).
  - **UPSTREAM** — feedback e controle (cancelamento, métricas, barge-in).
- `PipelineTask` gerencia o lifecycle com eventos (`on_pipeline_started`, `on_pipeline_finished`, `on_idle_timeout`) e observers pra métricas/tracing/RTVI.

Pipeline típico:

```
VAD (Silero) → STT → LLM (contexto alterna user/assistant) → TTS → transport
```

Transports: Daily, LiveKit, SmallWebRTCTransport, FastAPI WebSocket, WhatsApp.

Pipecat Flows adiciona conversas estruturadas (máquinas de estados). Pipecat Cloud é o runtime gerenciado.

### LiveKit Agents (livekit/agents)

- Conecta modelos de IA a usuários via WebRTC.
- Conceitos-chave: `Agent`, `AgentSession`, `entrypoint`, `AgentServer`.
- Duas classes de voice agent:
  - **MultimodalAgent** — áudio direto via OpenAI Realtime ou equivalente.
  - **VoicePipelineAgent** — cascade STT → LLM → TTS; controle no nível de texto.
- Detecção de turn semântica via modelo transformer.
- Integração MCP nativa.
- Telefonia via SIP.
- 50+ modelos sem chaves de API via LiveKit Inference; 200+ via plugins.

### Plataformas comerciais

Vapi (~450–600ms num stack premium otimizado) e Retell (~600ms ponta a ponta em 180 chamadas de teste) constroem sobre essas. Escolha uma plataforma quando quiser um stack de voz gerenciado sem um time de WebRTC.

### Onde esse pattern dá errado

- **Sem tratamento de barge-in.** Usuário interrompe; agente continua falando. Requer frames de cancelamento UPSTREAM no Pipecat, equivalente no LiveKit.
- **Confiança do STT ignorada.** Transcrições com baixa confiança alimentam o LLM como se fossem gospel. Filtre por confiança ou peça confirmação.
- **Corte de TTS no meio da frase.** Quando o pipeline cancela no meio de uma fala, o TTS precisa saber ou cortar o áudio.
- **Orçamento de latência ignorado.** Cada componente adiciona 50–200ms. Some sua cadeia antes de entregar.

### Latências típicas de 2026

- VAD: 20–60ms
- STT parcial: 100–250ms
- LLM primeiro token: 150–400ms
- TTS primeiro áudio: 100–200ms
- Transport RTT: 30–80ms

Ponta a ponta 450–600ms é premium. 800–1200ms é comum. Qualquer coisa > 1500ms parece quebrado.

## Construa

`code/main.py` é um pipeline toy baseado em frames com:

- Tipos de `Frame` (áudio, transcrição, texto, tts_audio, controle).
- Interface `Processor` com `process(frame)`.
- Um pipeline de cinco etapas (VAD → STT → LLM → TTS → transport) como processors roteados.
- Um frame UPSTREAM de cancelamento pra demonstrar barge-in.

Execute:

```
python3 code/main.py
```

O trace mostra o fluxo normal e um cancelamento por barge-in que interrompe o TTS no meio da fala.

## Use

- **Pipecat** pra controle total — processors customizados, Python-first, providers plugáveis.
- **LiveKit Agents** pra deploys WebRTC-first e telefonia.
- **Vapi / Retell** pra voice agents hospedados sem time de WebRTC.
- **OpenAI Realtime / Gemini Live** pra áudio direto-in/direto-out (MultimodalAgent).

## Entregue

`outputs/skill-voice-pipeline.md` monta um scaffold de pipeline de voz estilo Pipecat com VAD + STT + LLM + TTS + transport e tratamento de barge-in.

## Exercícios

1. Adicione um observer de métricas no seu pipeline toy: conte frames por etapa por segundo. Onde a latência acumula?
2. Implemente STT com gate de confiança: abaixo do limiar, peça "pode repetir?".
3. Adicione detecção de turn semântica: regra simples — se a transcrição termina com "?", fim do turn.
4. Leia a documentação de transports do Pipecat. Troque o transport stdlib pelo SmallWebRTCTransport config (stub).
5. Meça um OpenAI Realtime vs cascade STT+LLM+TTS na mesma query. Qual custo de latência o controle no nível de texto carrega?

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Frame | "Evento" | Unidade tipada de dados no pipeline (áudio, transcrição, texto, controle) |
| Processor | "Etapa do pipeline" | Handler com process(frame) |
| DOWNSTREAM | "Fluxo direto" | Source pra sink: áudio de entrada, fala de saída |
| UPSTREAM | "Fluxo de feedback" | Controle: cancelar, métricas, barge-in |
| VAD | "Voice activity detection" | Detecta quando o usuário está falando |
| Detecção de turn semântica | "Fim-de-turn inteligente" | Decisão baseada em modelo que o usuário terminou |
| MultimodalAgent | "Agente de áudio direto" | Áudio de entrada, áudio de saída; sem texto no meio |
| VoicePipelineAgent | "Agente cascade" | STT + LLM + TTS; controle no nível de texto |

## Leitura Complementar

- [Pipecat docs](https://docs.pipecat.ai/getting-started/introduction) — pipeline baseado em frames, processors, transports
- [LiveKit Agents docs](https://docs.livekit.io/agents/) — WebRTC + primitivos de voz
- [Vapi](https://vapi.ai/) — plataforma de voz gerenciada
- [Retell AI](https://www.retellai.com/) — voz gerenciada, com benchmark de latência
