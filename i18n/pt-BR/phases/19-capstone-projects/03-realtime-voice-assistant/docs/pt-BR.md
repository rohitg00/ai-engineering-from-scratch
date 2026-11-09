# Capstone 03  Assistente de voz em tempo real (ASR a LLM a TTS)

> Um agente de voz que se sente bem tem latência de ponta a ponta inferior a 800ms, sabe quando você parou de falar, lida com o barge-in e pode chamar uma ferramenta sem atrasos. Retell, Vapi, LiveKit Agents e Pipecat, todos chegaram a este bar em 2026. Fazem-no com a mesma forma: um ASR de streaming, um detector de viradas, um LLM de streaming e um TTS de streaming, todos conectados através do WebRTC com orçamentos agressivos de latência a cada salto. Construir um, medir WER e MOS e taxa de corte falso, e executá-lo sob perda de pacote.

**Type:** Capstone
**Languages:** Python (agent + pipeline), TypeScript (web client, scheduler scaffold)
**Prerequisites:** Phase 6 (speech and audio), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 17 (infrastructure)
**Phases exercised:**P6 · P7 · P11 · P13 · P14 · P17
**Time:** 30 hours

## Problemas

A voz foi a categoria de UX de IA de mais rápido movimento de 2025-2026. O teto técnico caiu a cada trimestre. OpenAI Realtime API, Gemini 2.5 Live, Cartesia Sonic-2, ElevenLabs Flash v3, LiveKit Agents 1.0, e Pipecat 0.0.70 todos colocaram o primeiro áudio sub-800ms ao alcance. O bar não é apenas a latência. É a sensação de interação: não cortar o usuário, não ser cortado, recuperar de uma interrupção no meio da frase, chamar uma ferramenta no meio da conversa sem atrasar o áudio, sobreviver às redes móveis nervosas.

Não se pode chegar lá com três chamadas REST. A arquitetura é pipelineado streaming de ponta a ponta. Construí-lo e os modos de falha tornam-se visíveis: um VAD sintonizado para gravação de áudio do telefone na TV de fundo, um detector de turno esperando por pontuação que nunca vem, um TTS que amortece 400ms antes de emitir.

## Conceptos

O gasoduto tem cinco etapas de transmissão: **audio in**(WebRTC do navegador ou da PSTN), **ASR**(transcrições parciais de Deepgram Nova-3 ou sussurro mais rápido),**turn detection**(VAD mais um pequeno modelo de detector de viradas que lê transcrições parciais para sinais de conclusão), **LLM**(streaming tokens assim que a turn é julgada completa), **TTS**(streaming de áudio dentro de ~ 200ms do primeiro token LLM).

Três preocupações transversais.**Barge-in**Quando o utilizador começa a falar enquanto o agente está a falar, o TTS cancela e o ASR retoma imediatamente. **Tool use**: chamadas de função de conversação no meio (temporário, calendário) devem ser executadas em um canal lateral sem atrasar o áudio; o agente preenche um token de reconhecimento ("um segundo...") se a latência exceder 300ms. **Backpressure**A VAD aumenta o limiar de porta de fala e o agente evita falar sobre uma mensagem não reconhecida.

A barra de medição é quantitativa. WER abaixo de 8% no Hamming VAD benchmark em 15 dB SNR. Primeiro áudio-out p50 abaixo de 800ms em 100 chamadas medidas. taxa de corte falso abaixo de 3%. MOS acima de 4,2 em TTS. 50 chamadas simultâneas em um único g5.xlarge. Estes números são o entregue.

## Arquitetura

```
browser / Twilio PSTN
        |
        v
   WebRTC / SIP edge
        |
        v
  LiveKit Agents 1.0  (or Pipecat 0.0.70)
        |
   +----+--------------+--------------+-----------------+
   |                   |              |                 |
   v                   v              v                 v
  ASR              VAD v5         turn-detector     side-channel
(Deepgram         (Silero)          (LiveKit)        tools
 Nova-3 /         speech-gate    completion score    (weather,
 Whisper-v3)      per 20ms        on partials        calendar)
   |                   |              |
   +--------+----------+--------------+
            v
        LLM (streaming)
     GPT-4o-realtime / Gemini 2.5 Flash /
     cascaded Claude Haiku 4.5
            |
            v
        TTS streaming
     Cartesia Sonic-2 / ElevenLabs Flash v3
            |
            v
     audio back to caller
            |
            v
   OpenTelemetry voice traces -> Langfuse
```

## Estaca

- Transportes: LiveKit Agents 1.0 (WebRTC) mais Twilio PSTN gateway; Pipecat 0.0.70 como o quadro alternativo
- ASR: Deepgram Nova-3 (streaming, sub-300ms primeiro parcial) ou mais rápido sussurro Whisper-v3-turbo auto-hosted
- VAD: Silero VAD v5 mais o detetor de viradas LiveKit (pequeno transformador que lê transcrições parciais)
- LLM: OpenAI GPT-4o em tempo real para integração apertada, Gemini 2.5 Flash Live, ou Claude Haiku 4.5 em cascata (completações de streaming, caminho de áudio separado)
- TTS: Cartesia Sonic-2 (baixo primeiro byte), ElevenLabs Flash v3, ou Open-Source Orpheus para auto-host
- Ferramentas: canal lateral FastMCP para o tempo/calendário/reservas; pre-emite agente de preenchimento se a ferramenta levar > 300 ms
- Observabilidade: OpenTelemetry, traços de voz de Langfuse com reprodução de áudio
- Deployment: single g5.xlarge (24GB VRAM) para auto-hosted Whisper + Orpheus; hosted API para menor latência

```figure
ce-voice-latency
```

## Construí-lo

1. **WebRTC session.**Coloque um quarto LiveKit e um cliente web que transmita áudio do microfone. No servidor, anexe um agente que trabalha na sala.

2. **ASR streaming.**Alimenta os quadros PCM de 20 ms para Deepgram Nova-3 (ou sussurro mais rápido na GPU).

3. **VAD and turn detector.**Execute Silero VAD v5 no fluxo de quadro. No evento de final de fala, inicie o detector de rotação LiveKit contra a última transcrição parcial. Apenas comprometa-se a "tornar completo" quando o VAD diz silêncio por 500ms e o detector de rotação pontua a conclusão > 0,6.

4. **LLM stream.**Quando estiver concluído, inicia a chamada de LLM com a conversa em execução, mais a transcrição final, transmita tokens, no primeiro token, entrega para o TTS.

5. **TTS stream.**Cartesia Sonic-2 transmite pedaços de áudio de volta. O primeiro pedaço deve deixar o servidor dentro de 200ms do primeiro token LLM. Emite pedaços para o LiveKit sala; cliente joga através de WebRTC jitter buffer.

6. **Barge-in.**Quando o VAD detecta um novo discurso de usuário enquanto o TTS está tocando, cancele o fluxo TTS imediatamente, deixe cair a saída restante do LLM e rearm o ASR. Publicar um `tts_canceled`- Espanha.

7. **Tool side channel.**Registre o tempo e o calendário como ferramentas de chamada de função. Quando invocado, dispara a chamada simultaneamente; se não for resolvida dentro de 300 ms, faça com que o LLM emite "um segundo, deixe-me verificar" como um preenchimento; retoma assim que a ferramenta retornar.

8. **Eval harness.**Gravar 100 chamadas: calcular WER (contra uma transcrição retardada), taxa de corte falso (TTS cancelado enquanto o usuário estava no meio da frase), primeira saída de áudio p50, TTS MOS (humano ou NISQA) e um teste de perda de nervosidade (caída de 3% dos pacotes).

9. **Load test.**Acionar 50 chamadas simultâneas em um único g5.xlarge com um chamador sintético.

## Usá-lo

```
caller: "what is the weather in tokyo tomorrow"
[asr  ] partial @280ms: "what is the"
[asr  ] partial @540ms: "what is the weather"
[turn ] completion score 0.82 at @820ms; commit
[llm  ] tool call emitted @880ms
[tool ] weather.tokyo tomorrow -> 68/52 partly cloudy @940ms
[llm  ] first token @990ms
[tts  ] first audio-out @1040ms: "Tokyo tomorrow will be partly cloudy..."
turn latency: 1040ms user-stop -> audio-out
```

## Envia-o

`outputs/skill-voice-agent.md`É o produto entregue. Dado um domínio (suporte ao cliente, programação ou quiosque), ele é um agente LiveKit com o pipeline ASR/VAD/LLM/TTS sintonizado com a barra de medição.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | End-to-end latency | p50 first-audio-out under 800ms across 100 recorded calls |
| 20 | Turn-taking quality | False-cutoff rate under 3% on the Hamming VAD benchmark |
| 20 | Tool-use correctness | Mid-conversation tool calls that return the right data without stalling audio |
| 20 | Reliability under packet loss | WER and turn-taking stability with 3% packet drop injected |
| 15 | Eval harness completeness | Reproducible measurements with public config |
| **100** | | |

## Exercícios

1. Substitua Deepgram Nova-3 para o turbo v3 mais rápido em um g5.xlarge. Messa a latência e a diferença WER. Identifique onde as decisões CPU-versus GPU importam.

2. Adicione uma política de interrupção-arbitramento: o que o agente faz quando o usuário entra durante uma chamada de ferramenta? Compare três políticas (cancelar duro, terminar-ferramenta-depois-stop, fila na próxima virada).

3. Realize um teste de detecção de viradas adversária: dê ao usuário longas pausas no meio da frase.

4. Deploie o mesmo agente na PSTN através de Twilio. Compare a primeira versão de áudio da PSTN com a WebRTC. Explique as diferenças entre o jitter-buffer e o codec.

5. Adicione detecção de atividade vocal para idiomas não ingleses (japonês, espanhol). Mese a taxa de desencadeamento falso do Silero VAD v5 em relação a tons finos específicos da língua.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Turn detection | "End of utterance" | Classifier that, given VAD silence and a partial transcript, decides the user is done speaking |
| Barge-in | "Interruption handling" | Canceling TTS mid-playback when VAD detects new user speech |
| First-audio-out | "Latency" | Time from user stops speaking to the first audio packet leaving the server |
| VAD | "Speech gate" | Model classifying audio frames as speech vs silence; Silero VAD v5 is the 2026 default |
| Jitter buffer | "Audio smoothing" | Client-side buffer that holds packets briefly to absorb network variance |
| Filler | "Acknowledgment token" | Short phrase the agent emits to avoid silence when a tool is slow |
| MOS | "Mean opinion score" | Perceptual speech quality rating; NISQA is the automated proxy |

## Mais leitura

- [LiveKit Agents 1.0](https://github.com/livekit/agents) Framework de referência de agentes WebRTC
- [Pipecat](https://github.com/pipecat-ai/pipecat) framework de agente de streaming alternativo Python-first
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) Referência para modelos integrados de fala
- [Deepgram Nova-3 documentation](https://developers.deepgram.com/docs) Referência de ASR em streaming
- [Silero VAD v5](https://github.com/snakers4/silero-vad) Modelo de referência do VAD
- [Cartesia Sonic-2](https://docs.cartesia.ai) Referência TTS de baixa latência
- [Retell AI architecture](https://docs.retellai.com)Arquitetura de agentes de voz de produção
- [Vapi.ai production stack](https://docs.vapi.ai) Referência de produção alternativa
