# Capstone 03  Asistente de voz en tiempo real (ASR a LLM a TTS)

> Un agente de voz que se sienta bien tiene latencia de extremo a extremo de menos de 800 ms, sabe cuándo has dejado de hablar, maneja el barge-in y puede llamar a una herramienta sin retrasar. Retell, Vapi, LiveKit Agents y Pipecat llegaron a este bar en 2026. Lo hacen con la misma forma: un ASR de transmisión, un detector de turnos, un LLM de transmisión y un TTS de transmisión, todo cableado a través de WebRTC con presupuestos de latencia agresivos en cada salto. Construye uno, mide WER y MOS y tasa de corte falso, y ejecuta bajo pérdida de paquete.

**Type:** Capstone
**Languages:** Python (agent + pipeline), TypeScript (web client, scheduler scaffold)
**Prerequisites:** Phase 6 (speech and audio), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 17 (infrastructure)
**Phases exercised:**P6 · P7 · P11 · P13 · P14 · P17
**Time:** 30 hours

## El problema

La voz ha sido la categoría de UX de IA de más rápido movimiento de 2025-2026. El techo técnico cayó cada cuarto. OpenAI Realtime API, Gemini 2.5 Live, Cartesia Sonic-2, ElevenLabs Flash v3, LiveKit Agents 1.0, y Pipecat 0.0.70 todos pusieron al alcance el primer audio de sub-800ms. El bar no es sólo la latencia. Es la sensación de interacción: no cortar al usuario, no cortarse, recuperarse de una interrupción a mitad de la oración, llamar a una herramienta a mitad de la conversación sin detener el audio, sobrevivir a las redes móviles nerviosas.

No se puede llegar a él coser tres llamadas REST. La arquitectura es pipelineado de transmisión de extremo a extremo. Construirlo y los modos de falla se vuelven visibles: un VAD sintonizado para la grabación de audio del teléfono en TV de fondo, un detector de turno esperando por puntuación que nunca viene, un TTS que amortiza 400ms antes de emitir.

## Concepto

El oleoducto tiene cinco etapas de transmisión: **audio in**(WebRTC desde el navegador o PSTN), **ASR**(transcripciones parciales de Deepgram Nova-3 o más rápido-susurro), **turn detection**(VAD más un pequeño modelo de detector de vueltas que lee transcripciones parciales para señales de finalización), **LLM**(transmitir tokens tan pronto como se juzgue que el turno está completo), **TTS**(transmitir audio en ~ 200 ms del primer token LLM).

Tres preocupaciones transversales.**Barge-in**Cuando el usuario comienza a hablar mientras el agente habla, el TTS se cancela y el ASR se pone a hablar inmediatamente. **Tool use**: las llamadas de la función de conversación (temporario, calendario) deben ejecutarse en un canal lateral sin detener el audio; el agente pre-rellenar un token de reconocimiento ("un segundo...") si la latencia supera los 300 ms. **Backpressure**: bajo pérdida de paquetes, se mantienen transcripciones parciales, el VAD eleva el umbral de la puerta de habla y el agente evita hablar sobre un mensaje no reconocido.

La barra de medición es cuantitativa. WER inferior al 8% en el Hamming VAD benchmark a 15 dB SNR. Primera salida de audio p50 inferior a 800 ms en 100 llamadas medidas. tasa de corte falso inferior a 3%. MOS superior a 4.2 en TTS. 50 llamadas simultáneas en un solo g5.xlarge. Estos números son los entregables.

## Arquitectura

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

## El establo

- Transporte: LiveKit Agents 1.0 (WebRTC) más Twilio PSTN gateway; Pipecat 0.0.70 como el marco alternativo
- ASR: Deepgram Nova-3 (streaming, sub-300ms primero parcial) o más rápido susurro Whisper-v3-turbo auto-hosted
- VAD: Silero VAD v5 más el detector de giras LiveKit (pequeño transformador que lee transcripciones parciales)
- LLM: OpenAI GPT-4o en tiempo real para integración estrecha, Gemini 2.5 Flash Live, o Claude Haiku 4.5 en cascada (completos de transmisión, ruta de audio separada)
- TTS: Cartesia Sonic-2 (bajo primer byte), ElevenLabs Flash v3, o Orpheus de código abierto para auto-host
- Herramientas: canal lateral FastMCP para el clima/calendario/reserva; relleno de emisores preliminares de agentes si la herramienta tarda más de 300 ms
- Observabilidad: OpenTelemetry, rastros de voz de Langfuse con reproducción de audio
- Despliegue: single g5.xlarge (24GB VRAM) para Whisper + Orpheus alojado en sí mismo; API alojadas para la menor latencia

```figure
ce-voice-latency
```

## Construye el mismo

1. **WebRTC session.**Coloque una sala de LiveKit y un cliente web que transmita audio del micrófono. En el servidor, adjunta un agente que trabaje que se une a la sala.

2. **ASR streaming.**Envía los fotogramas de 20 ms a Deepgram Nova-3 (o susurra más rápido en GPU). Suscribirse a las transcripciones parciales y finales.

3. **VAD and turn detector.**ejecuta Silero VAD v5 en la transmisión de fotogramas. En el evento de final de voz, dispara el detector de giras de LiveKit contra la última transcripción parcial. Sólo compromete a "turn complete" cuando el VAD diga silencio durante 500 ms y el detector de giras obtiene puntuaciones de completamiento > 0.6.

4. **LLM stream.**Al final, comience la llamada de LLM con la conversación en ejecución más la transcripción final.

5. **TTS stream.**Cartesia Sonic-2 transmite los fragmentos de audio de vuelta. La primera pieza debe salir del servidor dentro de 200 ms del primer token LLM. Emite los fragmentos a la sala LiveKit; el cliente juega a través del tampón de jitter WebRTC.

6. **Barge-in.**Cuando VAD detecta un nuevo discurso de usuario mientras TTS está tocando, cancele la corriente TTS inmediatamente, deje de usar el resultado restante de LLM y rearme el ASR.`tts_canceled`- ¿Qué?

7. **Tool side channel.**Registre el tiempo y el calendario como herramientas de llamada de función. Cuando se invoque, dispara la llamada simultáneamente; si no se resuelve dentro de 300 ms, haga que el LLM emita "un segundo, déjame comprobar" como un relleno; retoma una vez que la herramienta regrese.

8. **Eval harness.**Grabar 100 llamadas: calcular WER (en contra de una transcripción prolongada), tasa de interrupción falsa (TTS cancelado mientras el usuario estaba a mitad de la oración), primera salida de audio p50, TTS MOS (humano o NISQA) y una prueba de pérdida de nerviosismo (tirar 3% de los paquetes).

9. **Load test.**Realice 50 llamadas simultáneas en una sola g5.xlarge con una llamada sintética.

## Usalo

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

## Envío

`outputs/skill-voice-agent.md`Se trata de un servicio de entregable. Dado un dominio (suporte al cliente, programación o quiosco), se encuentra un agente de LiveKit con el pipeline ASR/VAD/LLM/TTS sintonizado con la barra de medición.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | End-to-end latency | p50 first-audio-out under 800ms across 100 recorded calls |
| 20 | Turn-taking quality | False-cutoff rate under 3% on the Hamming VAD benchmark |
| 20 | Tool-use correctness | Mid-conversation tool calls that return the right data without stalling audio |
| 20 | Reliability under packet loss | WER and turn-taking stability with 3% packet drop injected |
| 15 | Eval harness completeness | Reproducible measurements with public config |
| **100** | | |

## Los ejercicios

1. Cambiar Deepgram Nova-3 para un turbo de v3 de susurro más rápido en un g5.xlarge. Medir la latencia y la brecha WER. Identificar dónde las decisiones CPU-vs-GPU importan.

2. Añadir una política de interrupción-arbitro: ¿qué hace el agente cuando el usuario entra durante una llamada de herramienta? Compare tres políticas (cancelar duro, terminar herramienta-entonces-stop, hacer cola a la siguiente vuelta).

3. Realice una prueba de detección de vueltas adversaria: dé al usuario largas pausas a mediados de la oración.

4. Despliegue el mismo agente en la PSTN a través de Twilio. Compara la primera salida de audio de la PSTN con WebRTC. Explica las diferencias entre el buffer de nerviosismo y el códec.

5. Añadir detección de actividad de voz para idiomas no ingleses (japoneses, españoles). Mide la tasa de desencadenamiento falso de Silero VAD v5 frente a las melodías finas específicas del idioma.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Turn detection | "End of utterance" | Classifier that, given VAD silence and a partial transcript, decides the user is done speaking |
| Barge-in | "Interruption handling" | Canceling TTS mid-playback when VAD detects new user speech |
| First-audio-out | "Latency" | Time from user stops speaking to the first audio packet leaving the server |
| VAD | "Speech gate" | Model classifying audio frames as speech vs silence; Silero VAD v5 is the 2026 default |
| Jitter buffer | "Audio smoothing" | Client-side buffer that holds packets briefly to absorb network variance |
| Filler | "Acknowledgment token" | Short phrase the agent emits to avoid silence when a tool is slow |
| MOS | "Mean opinion score" | Perceptual speech quality rating; NISQA is the automated proxy |

## Leer más

- [LiveKit Agents 1.0](https://github.com/livekit/agents) marco de referencia de agentes WebRTC
- [Pipecat](https://github.com/pipecat-ai/pipecat) marco de agente de transmisión de Python-first alternativo
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) referencia para modelos integrados de habla
- [Deepgram Nova-3 documentation](https://developers.deepgram.com/docs) Referencia de ASR en streaming
- [Silero VAD v5](https://github.com/snakers4/silero-vad) Modelo de referencia del VAD
- [Cartesia Sonic-2](https://docs.cartesia.ai) Referencia de TTS de baja latencia
- [Retell AI architecture](https://docs.retellai.com) arquitectura de agentes de voz de producción
- [Vapi.ai production stack](https://docs.vapi.ai) Referencia de producción alternativa
