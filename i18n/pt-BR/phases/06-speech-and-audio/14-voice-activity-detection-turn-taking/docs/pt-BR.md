# Detecção e tomada de viradas de atividade vocal Silero, Cobra e o truque Flush

> Cada agente de voz vive ou morre por duas decisões: o usuário está falando agora e eles terminaram? VAD responde ao primeiro. Detecção de viradas (VAD + silêncio-hangover + modelo de ponto final semântico) responde ao segundo.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 11 (Real-Time Audio), Phase 6 · 12 (Voice Assistant)
**Time:** ~45 minutes

## O problema

Três decisões distintas que um agente de voz toma a cada 20 ms:

1. **Is this frame speech?**Binário, por quadro.
2. **Has the user started a new utterance?** detecção de início.
3. **Has the user finished?** apontamento final (torno final).

A resposta ingênua (ponto de energia) falha em qualquer ruído  tráfego, teclados, babilhões da multidão. A resposta de 2026: Silero VAD (aberto, profundamente aprendido) + um modelo de detecção de virada (indicação semântica final) + uma ressaca de silêncio calibrada por VAD.

## O conceito

![VAD cascade: energy → Silero → turn-detector → flush trick](../assets/vad-turn-taking.svg)

### A cascata de três níveis VAD

**Tier 1: energy gate.**O limite RMS é de -40 dBFS, filtra o silêncio óbvio, mas dispara em qualquer ruído acima do limite.

**Tier 2: Silero VAD**(2020-2026, MIT). 1M parâmetros. Treinado em mais de 6000 idiomas. Executa em ~1 ms por 30 ms por peça em um único fio de CPU. 87,7% TPR em 5% FPR. O código aberto padrão.

**Tier 3: semantic turn detector.**O modelo de detecção de turnos do LiveKit (2024-2026) ou seu próprio pequeno classificador.

### Parâmetros-chave e suas definições padrão

- **Threshold.**Silero produz uma probabilidade; classifique a fala em &gt; 0,5 (default) ou &gt; 0,3 (sensível). limiar inferior = menos clips de primeira palavra, mais falsos positivos.
- **Minimum speech duration.**Rejeitar a fala menor que 250 ms  geralmente tosse ou ruído de cadeira.
- **Silence hangover (end-pointing).**Depois que o VAD retornar a 0, espere 500-800 ms antes de declarar o fim da rotação.
- **Pre-roll buffer.**Mantenha 300-500 ms de áudio antes de disparar o VAD.

### O truque de flush (Kyutai 2025)

Os modelos STT em streaming têm um atraso de olhar para a frente (500 ms para Kyutai STT-1B, 2,5 segundos para STT-2.6B). Normalmente você esperaria tanto tempo após o fim da fala para a transcrição.**send a flush signal to the STT**O STT processa em 4× em tempo real, então o buffer de 500 ms termina em 125 ms.

End-to-end: 125 ms VAD + flush STT = latência de conversação.

### Comparador de ADV 2026

| VAD | TPR @ 5% FPR | Latency | License |
|-----|--------------|---------|---------|
| WebRTC VAD (Google, 2013) | 50.0% | 30 ms | BSD |
| Silero VAD (2020-2026) | 87.7% | ~1 ms | MIT |
| Cobra VAD (Picovoice) | 98.9% | ~1 ms | commercial |
| pyannote segmentation | 95% | ~10 ms | MIT-ish |

Silero é o padrão certo. Cobra é a atualização de conformidade / precisão.

```figure
sp-vad-cascade
```

## Construí-lo

### Passo 1: o portal de energia

```python
def energy_vad(chunk, threshold_dbfs=-40.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    dbfs = 20.0 * math.log10(max(rms, 1e-10))
    return dbfs > threshold_dbfs
```

### Passo 2: Silero VAD em Python

```python
from silero_vad import load_silero_vad, get_speech_timestamps

vad = load_silero_vad()
audio = torch.tensor(waveform_16k, dtype=torch.float32)
segments = get_speech_timestamps(
    audio, vad, sampling_rate=16000,
    threshold=0.5,
    min_speech_duration_ms=250,
    min_silence_duration_ms=500,
    speech_pad_ms=300,
)
for s in segments:
    print(f"{s['start']/16000:.2f}s - {s['end']/16000:.2f}s")
```

### Passo 3: máquina de estado de turno

```python
class TurnDetector:
    def __init__(self, silence_hangover_ms=500, min_speech_ms=250):
        self.state = "idle"
        self.speech_ms = 0
        self.silence_ms = 0
        self.silence_hangover_ms = silence_hangover_ms
        self.min_speech_ms = min_speech_ms

    def update(self, is_speech, chunk_ms=20):
        if is_speech:
            self.speech_ms += chunk_ms
            self.silence_ms = 0
            if self.state == "idle" and self.speech_ms >= self.min_speech_ms:
                self.state = "speaking"
                return "START"
        else:
            self.silence_ms += chunk_ms
            if self.state == "speaking" and self.silence_ms >= self.silence_hangover_ms:
                self.state = "idle"
                self.speech_ms = 0
                return "END"
        return None
```

### Passo 4: o esqueleto do truque de flush

```python
def flush_on_end(stt_client, audio_buffer):
    stt_client.send_audio(audio_buffer)
    stt_client.send_flush()
    return stt_client.recv_transcript(timeout_ms=150)
```

STT (Kyutai, Deepgram, AssemblyAI) deve suportar flush para que isso funcione.

## Usá-lo

| Situation | VAD choice |
|-----------|-----------|
| Open, fast, general | Silero VAD |
| Commercial call center | Cobra VAD |
| On-device (phone) | Silero VAD ONNX |
| Research / diarization | pyannote segmentation |
| Zero-dependency fallback | WebRTC VAD (legacy) |
| Need turn-ending quality | Silero + LiveKit turn-detector layered |

Regra geral: nunca envie VADs exclusivamente energéticos, a menos que realmente não tenha outra opção.

## Encurralagens

- **Fixed threshold.**Funciona em silêncio, falha em barulho, calibra no dispositivo ou passa para Silero.
- **Too-short silence hangover.**O agente interrompe a metade da frase. 500-800 ms é o ponto ideal para conversação.
- **Too-long hangover.**Teste A/B com usuários alvo.
- **No pre-roll buffer.**Os primeiros 200-300 ms de áudio do usuário perdidos.
- **Ignoring semantic endpointing.**"Hmm, deixe-me pensar"... contém longas pausas. Os usuários odeiam ser cortados no meio do pensamento.

## Envia-o

Salva como`outputs/skill-vad-tuner.md`Escolha o modelo VAD, o limiar, a ressaca, a estratégia de pré-rol e de detecção de voltas para uma carga de trabalho.

## Exercícios

1. **Easy.**Corra .`code/main.py`Simula uma sequência de fala + silêncio + fala + tosse e testa três níveis de VAD.
2. **Medium.**Instalação`silero-vad`, processar uma gravação de 5 minutos, ajustar o limiar para minimizar os clips de primeira palavra e os desencadeadores falsos.
3. **Hard.**Construir um mini-detector de viradas: Silero VAD + um MLP de 3 camadas em embutidos das últimas 10 palavras (use transformadores de frases). Treinar em um conjunto de dados de viradas rotulados a mão. Bater Silero apenas em 10% F1.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| VAD | Voice detector | Binary per-frame: is this speech? |
| Turn detection | End-pointing | VAD + silence-hangover + semantic endpoint. |
| Silence hangover | Wait-after-speech | Time to wait before declaring turn end; 500-800 ms. |
| Pre-roll | Pre-speech buffer | Keep 300-500 ms audio before VAD fires. |
| Flush trick | Kyutai hack | VAD → flush-STT → 125 ms instead of 500 ms delay. |
| Semantic endpoint | "Did they mean to stop?" | ML classifier that looks at words, not just silence. |
| TPR @ FPR 5% | ROC point | Standard VAD benchmark; 87.7% for Silero, 50% WebRTC. |

## Mais leitura

- [Silero VAD](https://github.com/snakers4/silero-vad) o VAD aberto de referência.
- [Picovoice Cobra VAD](https://picovoice.ai/products/voice/voice-activity-detection/) líder em precisão comercial.
- [Kyutai — Unmute + flush trick](https://kyutai.org/stt)O truque de engenharia de sub-200 ms.
- [LiveKit — turn detection](https://docs.livekit.io/agents/logic/turns/) endpointing semântico na produção.
- [WebRTC VAD](https://webrtc.googlesource.com/src/) a linha de base herdada.
- [pyannote segmentation](https://github.com/pyannote/pyannote-audio) Segmentação de nível de diarização.
