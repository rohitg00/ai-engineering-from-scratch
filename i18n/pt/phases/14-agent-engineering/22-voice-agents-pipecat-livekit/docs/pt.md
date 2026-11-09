# Agentes de voz: Pipecat e LiveKit

> Os agentes de voz são uma categoria de produção de primeira classe em 2026. Pipecat oferece um pipeline baseado em Python (VAD → STT → LLM → TTS → transporte). LiveKit Agents faz pontes entre os modelos de IA para os usuários através do WebRTC.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Descreva o sistema de condução baseado em quadros da Pipecat: DOWNSTREAM (fonte→sink) e UPSTREAM (controle).
- Nomear os estágios do pipeline de voz canônico e que transportam os suportes da Pipecat.
- Explique as duas classes de agentes de voz do LiveKit Agents (MultimodalAgent, VoicePipelineAgent) e quando cada uma se encaixa.
- Resumir as expectativas de latência de produção de 2026 e como elas impulsionam as escolhas de arquitetura.

## O problema

Os agentes de voz não são um ciclo de texto com TTS ligado. Os orçamentos de latência são brutais (~ 600ms), o áudio parcial é o padrão, a detecção de viradas é um modelo, e os transportes variam de telefonia SIP para WebRTC. Ou você constrói um pipeline baseado em quadros (Pipecat) ou você se apoia em uma plataforma (LiveKit).

## O conceito

### Pipecat (pipecat-ai/pipecat)

- Framework de pipeline baseado em Python.
- `Frame`→ `FrameProcessor`- A cadeia.
- Duas direcções de fluxo:
  - **DOWNSTREAM** fonte → fregona (áudio dentro, TTS fora).
  - **UPSTREAM** Feedback e controlo (cancelação, métricas, barge-in).
- `PipelineTask`gerenciam o ciclo de vida com eventos (`on_pipeline_started`- Não .`on_pipeline_finished`- Não .`on_idle_timeout`) e observadores para métricas/ rastreamento/RTVI.

Pipeline típica:

```
VAD (Silero) → STT → LLM (context alternates user/assistant) → TTS → transport
```

Transporte: Diário, LiveKit, SmallWebRTCTransport, FastAPI WebSocket, WhatsApp.

Pipecat Fluxes adiciona conversas estruturadas (máquinas de estado).

### Agentes do LiveKit (livekit/agentes)

- Ponte de modelos de IA para os usuários através de WebRTC.
- Conceptos-chave: `Agent`- Não .`AgentSession`- Não .`entrypoint`- Não .`AgentServer`- Não .
- Duas aulas de agentes vocais:
  - **MultimodalAgent** áudio direto através do OpenAI em tempo real ou equivalente.
  - **VoicePipelineAgent** STT → LLM → TTS cascata; dá controle a nível de texto.
- Detecção semântica de viradas através de um modelo transformador.
- Integração nativa de MCP.
- Telefone por SIP.
- 50+ modelos sem chaves de API através do LiveKit Inference; mais 200+ através de plugins.

### Plataformas comerciais

Vapi (~ 450600ms em uma pilha premium otimizada) e Retell (~ 600ms de ponta a ponta em 180 chamadas de teste) se baseiam nesses.

### Onde este padrão vai mal

- **No barge-in handling.**O usuário interrompe, o agente continua a falar. Requer que o UPSTREAM cancele quadros no Pipecat, equivalente no LiveKit.
- **STT confidence ignored.**Transcrições de baixa confiança alimentadas ao LLM como se fossem evangelhos.
- **TTS mid-sentence cutoff.**Quando o tubo cancelar a meia-terminação, o TTS precisa saber ou cortar áudio.
- **Latency budget ignored.**Cada componente adiciona 50200ms. Sumem a cadeia antes do envio.

### Tópicas latências de 2026

- VAD: 2060ms
- Teste de transmissão de dados:
- LLM primeiro token: 150400ms
- TTS primeiro áudio: 100200ms
- RTT de transporte: 3080ms

End-to-end 450600ms é premium. 8001200ms é comum. Qualquer coisa > 1500ms parece quebrado.

```figure
voice-pipeline
```

## Construí-lo

`code/main.py`é um tubo de brinquedos baseado em quadro com:

- `Frame`tipos (áudio, transcrição, texto, tts_audio, controle).
- `Processor`Interface com `process(frame)`- Não .
- Um gasoduto de cinco etapas (VAD → STT → LLM → TTS → transporte) como processadores de guião.
- Um quadro de cancelamento UPSTREAM para demonstrar a barragem.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

O rastro mostra fluxo normal e um barge-in cancelar que pára TTS em meados de pronunciamento.

## Usá-lo

- **Pipecat**para controlo total  processadores personalizados, fornecedores plug-in Python-first.
- **LiveKit Agents**para as primeiras instalações WebRTC e telefonia.
- **Vapi / Retell**para agentes de voz hospedados sem uma equipa WebRTC.
- **OpenAI Realtime / Gemini Live**para entrada/saída de áudio direta (MultimodalAgent).

## Envia-o

`outputs/skill-voice-pipeline.md`Estabelece um canal de voz em forma de Pipecat com VAD + STT + LLM + TTS + transporte mais manuseio de embarque.

## Exercícios

1. Adicione um observador de métricas à sua linha de brinquedos: conte quadros por estágio por segundo. Onde se acumula a latência?
2. Implementar STT com limite de confiança: abaixo do limiar, solicitar "poderia repetir isso?"
3. Adicione detecção semântica de virada: regra simples  se a transcrição termina com "?", fim da virada.
4. Leia os documentos de transporte da Pipecat. Troque o transporte stdlib para o SmallWebRTCTransport config (stub).
5. Meter uma cascata OpenAI em tempo real versus STT+LLM+TTS na mesma consulta. Qual o custo de latência que o controle de nível de texto leva?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Frame | "Event" | Typed unit of data in the pipeline (audio, transcript, text, control) |
| Processor | "Pipeline stage" | Handler with process(frame) |
| DOWNSTREAM | "Forward flow" | Source to sink: audio in, speech out |
| UPSTREAM | "Feedback flow" | Control: cancel, metrics, barge-in |
| VAD | "Voice activity detection" | Detects when user is speaking |
| Semantic turn detection | "Smart end-of-turn" | Model-based decision that the user is done |
| MultimodalAgent | "Direct audio agent" | Audio in, audio out; no text in the middle |
| VoicePipelineAgent | "Cascade agent" | STT + LLM + TTS; text-level control |

## Mais leitura

- [Pipecat docs](https://docs.pipecat.ai/getting-started/introduction) Tubos de produção baseados em quadros, processadores, transportes
- [LiveKit Agents docs](https://docs.livekit.io/agents/) WebRTC + primitivos de voz
- [Vapi](https://vapi.ai/) Plataforma de voz gerenciada
- [Retell AI](https://www.retellai.com/) voz gerenciada, com marcador de latência
