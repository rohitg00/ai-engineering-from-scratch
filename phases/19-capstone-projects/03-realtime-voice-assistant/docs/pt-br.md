# Capstone 03 — Assistente de Voz em Tempo Real (ASR para LLM para TTS)

> Um agente de voz que se sente certo tem latência ponta a ponta abaixo de 800ms, sabe quando você parou de falar, lida com interrupção, e pode chamar uma ferramenta sem travar. Retell, Vapi, LiveKit Agents e Pipecat batem essa barra em 2026. Eles fazem isso com a mesma forma: um ASR streaming, um detector de turno, um LLM streaming e um TTS streaming, todos conectados via WebRTC com orçamentos de latência agressivos em cada salto. Construa um, meça WER e MOS e taxa de corte falso, e rode sob perda de pacotes.

**Tipo:** Capstone
**Linguagens:** Python (agent + pipeline), TypeScript (cliente web)
**Pré-requisitos:** Fase 6 (fala e áudio), Fase 7 (transformers), Fase 11 (engenharia de LLM), Fase 13 (ferramentas), Fase 14 (agents), Fase 17 (infraestrutura)
**Fases exercitadas:** P6 · P7 · P11 · P13 · P14 · P17
**Tempo:** 30 horas

## Problema

Voz tem sido a categoria de UX de IA que mais avançou em 2025-2026. O teto técnico caiu a cada trimestre. OpenAI Realtime API, Gemini 2.5 Live, Cartesia Sonic-2, ElevenLabs Flash v3, LiveKit Agents 1.0 e Pipecat 0.0.70 colocaram primeiro-áudio-em-saída sub-800ms ao alcance. A barra não é só latência. É a sensação da interação: não cortar o usuário, não ser cortado, se recuperar de uma interrupção no meio da frase, chamar uma ferramenta no meio da conversa sem travar o áudio, sobreviver a redes mobile instáveis.

Você não chega lá costurando três chamadas REST. A arquitetura é uma pipeline streaming ponta a ponta. Construa e os modos de falha ficam visíveis: um VAD calibrado para áudio de telefone disparando em TV de fundo, um detector de turno esperando pontuação que nunca chega, um TTS que armazena 400ms antes de emitir. O capstone é consertar esses um a um sob carga e publicar um relatório de latência-e-qualidade.

## Conceito

A pipeline tem cinco estágios streaming: **entrada de áudio** (WebRTC do browser ou PSTN), **ASR** (transcrições parciais em streaming do Deepgram Nova-3 ou faster-whisper), **detecção de turno** (VAD mais um pequeno modelo detector de turno que lê transcrições parciais para pistas de conclusão), **LLM** (tokens em streaming assim que o turno é julgado completo), **TTS** (áudio em streaming em ~200ms do primeiro token do LLM).

Três preocupações transversais. **Interrupção**: quando o usuário começa a falar enquanto o agente fala, o TTS é cancelado e o ASR retoma imediatamente. **Uso de ferramentas**: chamadas de função no meio da conversa (clima, calendário) devem rodar num canal lateral sem travar o áudio; o agente emite um token de confirmação ("um segundo...") se a latência ultrapassar 300ms. **Contrapressão**: sob perda de pacotes, transcrições parciais são retidas, o VAD levanta o limiar do gate de fala e o agente evita falar sobre uma mensagem não confirmada.

A barra de medição é quantitativa. WER abaixo de 8% no benchmark Hamming VAD a 15 dB SNR. Primeiro-áudio-em-saída p50 abaixo de 800ms em 100 chamadas medidas. Taxa de corte falso abaixo de 3%. MOS acima de 4.2 no TTS. 50 chamadas concorrentes em um único g5.xlarge. Esses números são a entrega.

## Arquitetura

```
browser / Twilio PSTN
        |
        v
   WebRTC / SIP edge
        |
        v
  LiveKit Agents 1.0  (ou Pipecat 0.0.70)
        |
   +----+--------------+--------------+-----------------+
   |                   |              |                 |
   v                   v              v                 v
  ASR              VAD v5         detector de turno  canal lateral
(Deepgram         (Silero)          (LiveKit)        ferramentas
 Nova-3 /         speech-gate    escore de conclusão  (clima,
 Whisper-v3)      a cada 20ms     em parciais         calendário)
   |                   |              |
   +--------+----------+--------------+
            v
        LLM (streaming)
     GPT-4o-realtime / Gemini 2.5 Flash /
     cascata Claude Haiku 4.5
            |
            v
        TTS streaming
     Cartesia Sonic-2 / ElevenLabs Flash v3
            |
            v
     áudio de volta ao chamador
            |
            v
   traces de voz OpenTelemetry -> Langfuse
```

## Stack

- Transporte: LiveKit Agents 1.0 (WebRTC) mais gateway PSTN do Twilio; Pipecat 0.0.70 como framework alternativo
- ASR: Deepgram Nova-3 (streaming, primeiro parcial sub-300ms) ou faster-whisper Whisper-v3-turbo auto-hospedado
- VAD: Silero VAD v5 mais o detector de turno do LiveKit (pequeno transformer que lê transcrições parciais)
- LLM: OpenAI GPT-4o-realtime para integração apertada, Gemini 2.5 Flash Live, ou cascata Claude Haiku 4.5 (completions em streaming, caminho de áudio separado)
- TTS: Cartesia Sonic-2 (menor primeiro-byte), ElevenLabs Flash v3, ou Orpheus open-source para auto-hospedagem
- Ferramentas: canal lateral FastMCP para clima/calendário/reserva; agente emite preenchimento se ferramenta demora >300ms
- Observabilidade: spans de voz OpenTelemetry, traces de voz Langfuse com replay de áudio
- Deploy: um único g5.xlarge (24GB VRAM) para Whisper + Orpheus auto-hospedados; APIs hospedadas para menor latência

## Construa

1. **Sessão WebRTC.** Monte uma sala LiveKit e um cliente web que faça streaming do microfone. No servidor, anexe um worker de agente que entra na sala.

2. **Streaming de ASR.** Alimente frames PCM de 20ms ao Deepgram Nova-3 (ou faster-whisper na GPU). Inscreva-se em transcrições parciais e finais. Registre a latência por parcial.

3. **VAD e detector de turno.** Rode o Silero VAD v5 no stream de frames. No evento de fim de fala, dispare o detector de turno do LiveKit contra a transcrição parcial mais recente. Só confirme "turno completo" quando o VAD disser silêncio por 500ms e o detector de turno pontuar conclusão > 0.6.

4. **Stream do LLM.** No turno completo, inicie a chamada do LLM com a conversa em curso mais a transcrição final. Faça streaming dos tokens. No primeiro token, entregue ao TTS.

5. **Stream do TTS.** Cartesia Sonic-2 faz streaming dos chunks de áudio de volta. O primeiro chunk deve sair do servidor dentro de 200ms do primeiro token do LLM. Emita chunks para a sala LiveKit; o cliente toca via jitter buffer do WebRTC.

6. **Interrupção.** Quando o VAD detecta nova fala do usuário enquanto o TTS toca, cancele o stream do TTS imediatamente, descarte a saída restante do LLM e rearme o ASR. Publique um span `tts_canceled`.

7. **Canal lateral de ferramentas.** Registre clima e calendário como ferramentas de function-calling. Quando invocadas, dispare a chamada em paralelo; se não resolver em 300ms, faça o LLM emitir "um segundo, deixa eu verificar" como preenchimento; retome quando a ferramenta retornar.

8. **Avaliação.** Grave 100 chamadas. Compute WER (contra uma transcrição retida), taxa de corte falso (TTS cancelado enquanto o usuário estava no meio da frase), p50 do primeiro-áudio-em-saída, MOS do TTS (humano ou NISQA) e um teste de perda de jitter (drop de 3% dos pacotes).

9. **Teste de carga.** Execute 50 chamadas concorrentes em um único g5.xlarge com um chamador sintético. Meça o p95 sustentado de primeiro-áudio-em-saída.

## Use

```
chamador: "qual o tempo em tokyo amanhã"
[asr    ] parcial @280ms: "qual o"
[asr    ] parcial @540ms: "qual o tempo"
[turno  ] escore de conclusão 0.82 em @820ms; confirmado
[llm    ] primeiro token @960ms
[ferram]  weather.tokyo amanhã -> 68/52 parcialmente nublado @1140ms
[tts    ] primeiro áudio-em-saída @1040ms: "Amanhã em Tóquio será parcialmente nublado..."
latência do turno: 1040ms parada do usuário -> áudio-em-saída
```

## Entregue

`outputs/skill-voice-agent.md` é a entrega. Dado um domínio (suporte ao cliente, agendamento ou kiosque), ela monta um agente LiveKit com a pipeline ASR/VAD/LLM/TTS calibrada na barra de medição. Rubrica:

| Peso | Critério | Como é medido |
|:-:|---|---|
| 25 | Latência ponta a ponta | p50 do primeiro-áudio-em-saída abaixo de 800ms em 100 chamadas gravadas |
| 20 | Qualidade de troca de turno | Taxa de corte falso abaixo de 3% no benchmark Hamming VAD |
| 20 | Corretude do uso de ferramentas | Chamadas de ferramenta no meio da conversa que retornam os dados certos sem travar o áudio |
| 20 | Confiabilidade sob perda de pacotes | WER e estabilidade de troca de turno com drop de 3% de pacotes injetado |
| 15 | Completude da avaliação | Medições reproduzíveis com configuração pública |
| **100** | | |

## Exercícios

1. Troque Deepgram Nova-3 por faster-whisper v3 turbo num g5.xlarge. Meça o gap de latência e WER. Identifique onde decisões CPU-vs-GPU importam.

2. Adicione uma política de arbitração de interrupção: o que o agente faz quando o usuário interrompe durante uma chamada de ferramenta? Compare três políticas (cancelar bruscamente, terminar-ferramenta-depois-parar, enfileirar próximo turno).

3. Rode um teste adversarial de detector de turnaround: dê ao usuário pausas longas no meio de frases. Calibre o limiar de silêncio do VAD e o limiar de escore do detector de turno para o menor corte falso sem passar de 900ms.

4. Deploy o mesmo agente via PSTN no Twilio. Compare primeiro-áudio-em-saída PSTN com WebRTC. Explique as diferenças de jitter buffer e codec.

5. Adicione detecção de atividade de voz para idiomas não-english (japonês, espanhol). Meça a taxa de falso-disparo do Silero VAD v5 versus fine-tunes eespecificaçãoíficos por idioma.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|------------------------|------------------------|
| Detecção de turno | "Fim da fala" | Classificador que, dado silêncio do VAD e uma transcrição parcial, decide que o usuário parou de falar |
| Interrupção | "Tratamento de interrupção" | Cancelar o TTS no meio da reprodução quando o VAD detecta nova fala do usuário |
| Primeiro-áudio-em-saída | "Latência" | Tempo de quando o usuário para de falar até o primeiro pacote de áudio sair do servidor |
| VAD | "Gate de fala" | Modelo que classifica frames de áudio como fala vs silêncio; Silero VAD v5 é o padrão de 2026 |
| Jitter buffer | "Suavização de áudio" | Buffer no lado do cliente que segura pacotes brevemente para absorver variação de rede |
| Preenchimento | "Token de confirmação" | Frase curta que o agente emite para evitar silêncio quando uma ferramenta é lenta |
| MOS | "Mean opinion score" | Avaliação perceptual de qualidade de fala; NISQA é o proxy automatizado |

## Leitura Complementar

- [LiveKit Agents 1.0](https://github.com/livekit/agents) — framework de referência para agentes WebRTC
- [Pipecat](https://github.com/pipecat-ai/pipecat) — framework alternativo de agente streaming Python-first
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) — referência para modelos de fala integrados
- [Documentação Deepgram Nova-3](https://developers.deepgram.com/docs) — referência de ASR streaming
- [Silero VAD v5](https://github.com/snakers4/silero-vad) — modelo de referência de VAD
- [Cartesia Sonic-2](https://docs.cartesia.ai) — referência de TTS de baixa latência
- [Arquitetura Retell AI](https://docs.retellai.com) — arquitetura de agente de voz em produção
- [Stack de produção Vapi.ai](https://docs.vapi.ai) — referência de produção alternativa
