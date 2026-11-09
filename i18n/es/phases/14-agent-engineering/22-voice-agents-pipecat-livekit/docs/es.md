# Agentes de voz: Pipecat y LiveKit

> Los agentes de voz son una categoría de producción de primera clase en 2026. Pipecat le ofrece un pipeline basado en Python (VAD → STT → LLM → TTS → transporte). LiveKit Agents conecta modelos de IA con los usuarios a través de WebRTC.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Describa la tubería basada en el marco de Pipecat: DOWNSTREAM (fuente→sink) y UPSTREAM (control).
- Nombre de las etapas de la tubería de voz canónica y que transportan los soportes de Pipecat.
- Explica las dos clases de agentes de voz de LiveKit Agents (MultimodalAgent, VoicePipelineAgent) y cuándo cada una se ajusta.
- Resumen las expectativas de latencia de producción 2026 y cómo impulsan las opciones de arquitectura.

## El problema

Los agentes de voz no son un bucle de texto con TTS encendido. Los presupuestos de latencia son brutales (~ 600 ms), el audio parcial es el predeterminado, la detección de giras es un modelo, y los transportes van desde la telefonía SIP a WebRTC.

## El concepto

### El producto se clasifica en el anexo II del Reglamento (UE) n.o 1069/2013.

- Marco de tuberías basado en marco Python.
- `Frame`¿ Qué es esto ?`FrameProcessor`- ¿Qué es eso?
- Dos direcciones de flujo:
  - **DOWNSTREAM** fuente → fregadero (audio en, TTS fuera).
  - **UPSTREAM** retroalimentación y control (cancelación, métricas, barge-in).
- `PipelineTask`gestiona el ciclo de vida con eventos (`on_pipeline_started`¿ Qué ?`on_pipeline_finished`¿ Qué ?`on_idle_timeout`) y observadores de métricas/trazaje/RTVI.

Tipico de tubería:

```
VAD (Silero) → STT → LLM (context alternates user/assistant) → TTS → transport
```

Transporte: diario, LiveKit, SmallWebRTCTransport, FastAPI WebSocket, WhatsApp.

Pipecat Fluxes añade conversaciones estructuradas (máquinas de estado). Pipecat Cloud es el tiempo de ejecución administrado.

### Los agentes de LiveKit (livekit/agentes)

- Se conectan modelos de IA a los usuarios a través de WebRTC.
- Conceptos clave: `Agent`¿ Qué ?`AgentSession`¿ Qué ?`entrypoint`¿ Qué ?`AgentServer`¿ Qué ?
- Dos clases de agentes de voz:
  - **MultimodalAgent** audio directo a través de OpenAI en tiempo real o equivalente.
  - **VoicePipelineAgent** STT → LLM → TTS cascada; da control a nivel de texto.
- Detección semántica de la vuelta a través de un modelo transformador.
- Integración de MCP nativo.
- Telefono por SIP.
- 50+ modelos sin claves de API a través de LiveKit Inference; 200+ más a través de plugins.

### Plataformas comerciales

Vapi (~ 450600ms en una pila premium optimizada) y Retell (~ 600ms de extremo a extremo en 180 llamadas de prueba) se basan en esto.

### Cuando este patrón va mal

- **No barge-in handling.**El usuario interrumpe; el agente sigue hablando. Requiere UPSTREAM cancelar los cuadros en Pipecat, equivalente en LiveKit.
- **STT confidence ignored.**Transcripciones de baja confianza alimentadas al LLM como si fueran un evangelio.
- **TTS mid-sentence cutoff.**Cuando la tubería cancela la emisión en medio, TTS necesita saber o cortar el audio.
- **Latency budget ignored.**Cada componente añade 50200ms. Sumar su cadena antes de enviar.

### Las latencias típicas para 2026

- VAD: 2060ms
- TPS parcial: 100250ms
- LLM primer token: 150400ms
- TTS primer audio: 100200ms
- RTT de transporte: 3080ms

El tiempo de entrega de 450 a 600 ms es de primera calidad. 800 a 1200 ms es común. Cualquier cosa > 1500 ms se siente rota.

```figure
voice-pipeline
```

## Construye el mismo

`code/main.py`es un tubo de juguete basado en un marco con:

- `Frame`tipos (audio, transcripción, texto, tts_audio, control).
- `Processor`interfaz con `process(frame)`¿ Qué ?
- Un oleoducto de cinco etapas (VAD → STT → LLM → TTS → transporte) como procesadores con guión.
- Un marco de cancelación UPSTREAM para demostrar el barrido.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

El rastro muestra flujo normal y una cancelación de barga que detiene el TTS en medio de la pronunciación.

## Usalo

- **Pipecat**para el control total  procesadores personalizados, proveedores de Python-first, enchufables.
- **LiveKit Agents**para las primeras implementaciones y telefonía de WebRTC.
- **Vapi / Retell**para agentes de voz alojados sin un equipo WebRTC.
- **OpenAI Realtime / Gemini Live**para la entrada/salida directa de audio (MultimodalAgent).

## Envío

`outputs/skill-voice-pipeline.md`Esta plataforma tiene una tubería de voz en forma de Pipecat con VAD + STT + LLM + TTS + transporte más manejo de barcazas.

## Los ejercicios

1. Añadir un observador de métricas a su pipeline de juguetes: contar cuadros por etapa por segundo. ¿Dónde se acumula la latencia?
2. Implementar STT con puertas de confianza: por debajo del umbral, pedir "puedes repetir eso?"
3. Añadir detección semántica de giro: regla simple  si la transcripción termina con "?", final de giro.
4. Lea los documentos de transporte de Pipecat. Cambiar el transporte stdlib por la configuración de SmallWebRTCTransport (stub).
5. Mide una cascada OpenAI en tiempo real vs STT+LLM+TTS en la misma consulta. ¿Qué costo de latencia tiene el control a nivel de texto?

## Términos clave

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

## Leer más

- [Pipecat docs](https://docs.pipecat.ai/getting-started/introduction) tuberías basadas en marcos, procesadores, transportes
- [LiveKit Agents docs](https://docs.livekit.io/agents/) WebRTC + primitiva de voz
- [Vapi](https://vapi.ai/) Plataforma de voz gestionada
- [Retell AI](https://www.retellai.com/) voz gestionada, con marcador de latencia
