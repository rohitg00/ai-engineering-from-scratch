# Processamento de Áudio em Tempo Real

> Pipelines batch processam um arquivo. Pipelines em tempo real processam os próximos 20 milissegundos antes que os 20 seguintes cheguem. Toda IA conversacional, estúdio de broadcast e bot de telefonia vive ou morre por esse orçamento de latência.

**Tipo:** Construir
**Idiomas:** Python
**Pré-requisitos:** Fase 6 · 02 (Eespecificaçãotrogramas), Fase 6 · 04 (ASR), Fase 6 · 07 (TTS)
**Tempo:** ~75 minutos

## O Problema

Você quer um assistente de voz que pareça vivo. A latência de turn-taking conversacional humana é ~230 ms (silêncio-até-resposta). Acima de 500 ms parece robótico; acima de 1500 ms parece quebrado. O orçamento para um loop completo de **ouvir → entender → responder → falar** em 2026 é:

| Estágio | Orçamento |
|---------|-----------|
| Microfone → buffer | 20 ms |
| VAD | 10 ms |
| ASR (streaming) | 150 ms |
| LLM (primeiro token) | 100 ms |
| TTS (primeiro chunk) | 100 ms |
| Render → alto-falante | 20 ms |
| **Total** | **~400 ms** |

Moshi (Kyutai, 2024) bateu 200 ms full-duplex. GPT-4o-realtime (2024) bate ~320 ms. Pipelines cascata em 2022 rodavam a 2500 ms. A melhoria 10× veio de três técnicas: (1) streaming em todo lugar, (2) pipeline assíncrono com resultados parciais, (3) geração interrompível.

## O Conceito

![Pipeline de áudio streaming com ring buffer, gate VAD, interrupção](../assets/real-time.svg)

**Frame / chunk / janela.** Áudio em tempo real flui como blocos de tamanho fixo. Escolha comum: 20 ms (320 amostras a 16 kHz). Tudo downstream deve acompanhar esse ritmo.

**Ring buffer.** Buffer circular de tamanho fixo. Thread produtora escreve frames novos, thread consumidora lê. Previne alocações no hot path. Tamanho ≈ latência-máxima × taxa-de-amostragem; um ring de 16 kHz por 2 segundos = 32.000 amostras.

**VAD (Voice Activity Detection).** Gate do trabalho downstream quando ninguém está falando. Silero VAD 4.0 (2024) roda <1 ms por frame de 30 ms em CPU. `webrtcvad` é a alternativa mais antiga.

**ASR streaming.** Modelos que emitem transcrições parciais conforme o áudio chega. Parakeet-CTC-0.6B em modo streaming (NeMo, 2024) faz 2–5% WER com latência de 320 ms. Whisper-Streaming (Macháček et al., 2023) fatia o Whisper para quasi-streaming com latência de ~2 s.

**Interrupção.** Quando o usuário fala enquanto o assistente está falando, você deve (a) detectar a intromissão, (b) parar o TTS, (c) descartar a saída restante do LLM. Tudo dentro de 100 ms, ou o usuário percebe um assistente surdo.

**Transporte WebRTC Opus.** Frames de 20 ms, 48 kHz, bitrate adaptativo 8–128 kbps. Padrão para navegador e mobile. LiveKit, Daily.co, Pion são as pilhas de 2026 para construir apps de voz.

**Jitter buffer.** Pacotes de rede chegam fora de ordem / atrasados. O jitter buffer reordena e suaviza; pequeno demais → gaps audíveis, grande demais → latência. 60–80 ms típico.

### Armadilhas comuns

- **Contenção de threads.** O GIL do Python + modelos pesados podem sufocar a thread de áudio. Use uma biblioteca de áudio com callback C (sounddevice, PortAudio) e mantenha Python fora do hot path.
- **Latência de conversão de taxa de amostragem.** Resampling dentro da pipeline adiciona 5–20 ms. Ou resample antecipadamente ou use um resampler de latência zero (PolyPhase, `soxr_hq`).
- **Priming do TTS.** Mesmo TTS rápido como Kokoro tem aquecimento de 100–200 ms na primeira requisição. Cache o modelo e aqueça com uma execução fictícia antes do primeiro turno real.
- **Cancelamento de eco.** Sem AEC, a saída do TTS volta ao microfone e dispara ASR na voz do próprio bot. WebRTC AEC3 é o padrão open-source.

## Construa

### Passo 1: ring buffer

```python
import collections

class RingBuffer:
    def __init__(self, capacity):
        self.buf = collections.deque(maxlen=capacity)
    def write(self, frame):
        self.buf.extend(frame)
    def read(self, n):
        return [self.buf.popleft() for _ in range(min(n, len(self.buf)))]
    def level(self):
        return len(self.buf)
```

Capacidade determina a latência máxima de buffering. 32.000 amostras a 16 kHz = 2 s.

### Passo 2: gate VAD

```python
def simple_energy_vad(frame, threshold=0.01):
    return sum(x * x for x in frame) / len(frame) > threshold ** 2
```

Substitua por Silero VAD em produção:

```python
import torch
vad, _ = torch.hub.load("snakers4/silero-vad", "silero_vad")
is_speech = vad(torch.tensor(frame), 16000).item() > 0.5
```

### Passo 3: ASR streaming

```python
from nemo.collections.asr.models import EncDecCTCModelBPE
asr = EncDecCTCModelBPE.from_pretrained("nvidia/parakeet-ctc-0.6b")
for chunk in audio_stream():
    partial_text = asr.transcribe_streaming(chunk)
    print(partial_text, end="\r")
```

### Passo 4: handler de interrupção

```python
class Dialog:
    def __init__(self):
        self.tts_task = None

    def on_user_speech(self, frame):
        if self.tts_task and not self.tts_task.done():
            self.tts_task.cancel()
        # depois alimenta o ASR streaming

    def on_final_user_utterance(self, text):
        self.tts_task = asyncio.create_task(self.reply(text))

    async def reply(self, text):
        async for tts_chunk in llm_then_tts(text):
            speaker.write(tts_chunk)
```

Depende de async I/O e TTS streaming cancelável. `peerconnection.stop()` WebRTC na track de áudio é o caminho canônico.

## Use

A pilha de 2026:

| Camada | Escolha |
|--------|---------|
| Transporte | LiveKit (WebRTC) ou Pion (Go) |
| VAD | Silero VAD 4.0 |
| ASR streaming | Parakeet-CTC-0.6B ou Whisper-Streaming |
| Primeiro token LLM | Groq, Cerebras, vLLM-streaming |
| TTS streaming | Kokoro ou ElevenLabs Turbo v2.5 |
| Cancelamento de eco | WebRTC AEC3 |
| Nativo de ponta a ponta | OpenAI Realtime API ou Moshi |

## Armadilhas

- **Buffer de 500 ms "por segurança".** O buffer *é* seu piso de latência. Encurte.
- **Não fixar threads.** Callback de áudio em thread com prioridade abaixo da UI = glitches sob carga.
- **Chunks TTS pequenos demais.** Chunks <200 ms tornam artefatos de vocoder audíveis. Chunks de 320 ms são o sweet spot.
- **Sem jitter buffer.** Redes reais são instáveis; sem suavização você tem estalos.
- **Tratamento de erros single-shot.** Pipelines de áudio devem ser à prova de crashes. Uma exceção mata a sessão.

## Entregue

Salve como `outputs/skill-realtime-designer.md`. Projete uma pipeline de áudio em tempo real com orçamentos de latência concretos por estágio.

## Exercícios

1. **Fácil.** Execute `code/main.py`. Simula um ring buffer + VAD por energia; imprime latências de cada estágio para um stream fictício de 10 segundos.
2. **Médio.** Usando `sounddevice`, construa um loop de passagem direta que processa seu microfone em frames de 20 ms e imprime o estado VAD a cada frame.
3. **Difícil.** Construa um teste de eco full-duplex com `aiortc`: navegador → WebRTC → Python → WebRTC → navegador. Meça a latência de ponta a ponta com um pulso de 1 kHz.

## Termos Chave

| Termo | O que a gente diz | O que significa de verdade |
|-------|-------------------|---------------------------|
| Ring buffer | A fila circular | FIFO de tamanho fixo, lock-free (ou SPSC-locked) para frames de áudio. |
| VAD | Gate de silêncio | Modelo ou heurística que marca fala vs não-fala. |
| ASR streaming | STT em tempo real | Emite texto parcial conforme áudio chega; lookahead limitado. |
| Jitter buffer | Suavizador de rede | Fila que reordena pacotes fora de ordem; 60–80 ms típico. |
| AEC | Cancelamento de eco | Subtrai caminho de feedback do alto-falante para o microfone. |
| Barge-in | Interrupção do usuário | Sistema detecta fala do usuário no meio do TTS; precisa cancelar playback. |
| Full duplex | Simultâneo nos dois sentidos | Usuário e bot podem falar ao mesmo tempo; Moshi é full-duplex. |

## Leitura Adicional

- [Macháček et al. (2023). Whisper-Streaming](https://arxiv.org/abs/2307.14743) — Whisper chunked quasi-streaming.
- [Kyutai (2024). Moshi](https://kyutai.org/Moshi.pdf) — full-duplex 200 ms latência.
- [LiveKit Agents framework (2024)](https://docs.livekit.io/agents/) — orquestração de agentes de áudio em produção.
- [Repo do Silero VAD](https://github.com/snakers4/silero-vad) — VAD <1 ms, Apache 2.0.
- [Paper WebRTC AEC3](https://webrtc.googlesource.com/src/+/main/modules/audio_processing/aec3/) — cancelamento de eco sob open-source.
