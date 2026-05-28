---
name: voice-agent
description: Crie um agente de voz em tempo real com primeira saída de áudio inferior a 800 ms, tratamento de interrupção e uso de ferramentas no meio da conversa.
version: 1.0.0
phase: 19
lesson: 03
tags: [capstone, voice, webrtc, livekit, pipecat, asr, tts, streaming]
---

Dado um domínio (suporte ao cliente, agendamento, assistente de varejo), implante um agente de voz WebRTC que mantenha a primeira saída de áudio de ponta a ponta abaixo de 800 ms enquanto lida com invasões, chamadas de ferramentas e perda de pacotes.

Plano de construção:

1. Crie uma sala do LiveKit Agents 1.0 com um cliente web que transmite áudio do microfone. Adicione um gateway Twilio PSTN para cobertura telefônica.
2. Execute o streaming ASR (hospedado Deepgram Nova-3 ou Whisper-v3-turbo mais rápido em um g5.xlarge). Assine transcrições parciais e finais.
3. Execute o Silero VAD v5 em quadros de 20 ms. No final da fala, marque a última parcial com o detector de giro LiveKit; comprometa-se a completar a curva somente quando o silêncio do VAD >= 500 ms e a pontuação de conclusão >= 0,6.
4. Transmita o LLM (GPT-4o-realtime, Gemini 2.5 Flash Live ou Claude Haiku 4.5 em cascata). Entregue o primeiro token ao TTS em 200 ms.
5. Transmita TTS (Cartesia Sonic-2 ou ElevenLabs Flash v3). O primeiro pedaço de áudio deve deixar o servidor dentro de 200 ms do primeiro token LLM.
6. Interrupção: quando o VAD detecta a fala de um novo usuário durante FALAR ou PENSAR, cancele o TTS, descarte a saída LLM restante, rearme o ASR. Publique um intervalo `tts_canceled`.
7. Canal lateral da ferramenta: execute chamadas de função simultaneamente; se a latência for > 300 ms, emita um preenchimento de confirmação para que o fluxo de áudio nunca pare.
8. Grave 100 chamadas. Meça o WER em relação a transcrições retidas, taxa de corte falso no benchmark Hamming VAD, primeira saída de áudio p50, NISQA MOS e comportamento abaixo de 3% de queda de pacotes.
9. Teste de carga de 50 chamadas simultâneas em um único g5.xlarge com um chamador sintético; relatório sustentado primeira saída de áudio p95.

Rubrica de avaliação:

| Peso | Critério | Medição |
|:-:|---|---|
| 25 | Latência ponta a ponta | Primeira saída de áudio do p50 em menos de 800 ms em 100 chamadas gravadas |
| 20 | Qualidade de tomada de turno | Taxa de falso corte inferior a 3% no benchmark Hamming VAD |
| 20 | Correção no uso de ferramentas | As chamadas da ferramenta no meio da conversa retornam dados corretos sem interromper o áudio |
| 20 | Confiabilidade sob perda de pacotes | WER e estabilidade na tomada de turnos com 3% de queda de pacotes injetados |
| 15 | Avaliação da integridade do chicote | Medições reproduzíveis com configuração pública |

Rejeições difíceis:

- Pipelines que não sejam de streaming (ASR em lote, TTS em lote) não podem atingir a meta de latência.
- Qualquer política de invasão que não cancele o buffer TTS imediatamente. O cancelamento tardio produz as piores regressões na experiência do usuário.
- Chamadas de ferramentas que bloqueiam de forma síncrona o fluxo LLM. Eles devem funcionar em um canal lateral.

Regras de recusa:

- Recuse-se a implantar sem um VAD ou detector de mudança de direção. A tomada de turno com tempo limite fixo produz taxas de corte inaceitáveis.
- Recusar-se a reportar MOS sem documentar se é classificado por humanos ou por proxy NISQA.
- Recuse-se a relatar "latência p50 sob X" sem pelo menos 100 chamadas gravadas e sem publicar os rastreamentos de chamadas.

Saída: um repositório contendo o trabalhador do agente LiveKit, a configuração do gateway PSTN, o chicote de avaliação de 100 chamadas, um painel de voz Langfuse público, uma comparação lado a lado com um concorrente hospedado (Retell, Vapi ou OpenAI Realtime API diretamente) e um artigo sobre as três maiores falhas de tomada de turno que você observou e o ajuste do detector que corrigiu cada uma.