# Transformadores de áudio  Arquitetura de sussurros

> O áudio é uma imagem de frequência ao longo do tempo.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 08 (Encoder-Decoder), Phase 7 · 09 (ViT)
**Time:** ~45 minutes

## O problema

Antes do Whisper (OpenAI, Radford et al. 2022), o reconhecimento automático de voz (ASR) de última geração significava wav2vec 2.0 e HuBERT  extractores de recursos auto-supervisionados além de uma cabeça afinada.

O Whisper fez três apostas:

1. **Train on everything.**680.000 horas de áudio com etiqueta fraca, arrancadas da Internet em 97 idiomas, sem corpus acadêmico limpo, sem etiquetas fonéticas.
2. **Multi-task single model.**Um decodificador treinado em conjunto em transcrição, tradução, detecção de atividade de voz, ID de idioma e timestamping através de tokens de tarefa.
3. **Standard encoder-decoder transformer.**O codificador consome espectrogramas log-mail. O decodificador produz tokens de texto autoregressivamente.

O resultado: Whisper big-v3 é robusto em acentos, ruído e linguagens que têm dados com rótulo limpo zero. É o front-end de fala padrão para todos os assistentes de voz de código aberto e a maioria dos comerciais em 2026.

## O conceito

![Whisper pipeline: audio → mel → encoder → decoder → text](../assets/whisper.svg)

### Passo 1  Re-sampula + janela

Áudio em 16 kHz. Clip/pad para 30 segundos. Computação log-mel espectrograma: 80 mel bin, 10 ms passo → ~ 3.000 quadros × 80 recursos. Esta é a "imagem de entrada" que Whisper vê.

### Passo 2  tronco convolucional

Duas camadas Conv1D com kernel 3 e passo 2 reduzem os 3.000 quadros para 1.500.

### Passo 3  codificador

Um codificador de transformador de 24 camadas (para grandes) em 1.500 etapas de tempo. codificação posicional sinusoidal, auto-atenção, GELU FFN. Produz estados ocultos de 1.500 × 1.280 .

### Passo 4  decodificador

Um decodificador de transformador de 24 camadas. Ele produz automaticamente tokens a partir de um vocabulário BPE que é um superconjunto de GPT-2s com alguns tokens especiais específicos de áudio.

### Passo 5  Tokens de tarefa

O prompt do decodificador começa com tokens de controle que dizem ao modelo o que fazer:

```
<|startoftranscript|>  <|en|>  <|transcribe|>  <|0.00|>
```

ou

```
<|startoftranscript|>  <|fr|>  <|translate|>   <|0.00|>
```

O modelo foi treinado nesta convenção. Você controla tarefa por prefixo. O equivalente a 2026 instrução-ajuste, mas aplicado à fala.

### Passo 6  saída

Busca de feixe (largura 5) com um limiar de log-prob.`<|notimestamps|>`O token está ausente.

### Dimensões de sussurros

| Model | Params | Layers | d_model | Heads | VRAM (fp16) |
|-------|--------|--------|---------|-------|-------------|
| Tiny | 39M | 4 | 384 | 6 | ~1 GB |
| Base | 74M | 6 | 512 | 8 | ~1 GB |
| Small | 244M | 12 | 768 | 12 | ~2 GB |
| Medium | 769M | 24 | 1024 | 16 | ~5 GB |
| Large | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3 | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3-turbo | 809M | 32 | 1280 | 20 | ~6 GB (4-layer decoder) |

O Large-v3-turbo (2024) cortou o decodificador de 32 camadas para 4.8× mais rápido decodificando com regressão de <1 ponto WER. Essa velocidade de desbloqueio de decodificação é a razão pela qual o Whisper-turbo é o padrão para agentes de voz em tempo real em 2026.

### O que o sussurro não faz

- Não há diário, para isso, é um par com o pyannote.
- Não há transmissão em tempo real em modo nativo  a janela de 30 segundos está fixa.`faster-whisper`- Não .`WhisperX`) para o streaming através de superposições VAD +.
- Não há contexto de longa forma além de 30 segundos sem fragmentação externa. Funciona bem na prática porque a fala humana raramente precisa de contexto de longo alcance para transcrição.

### 2026 paisagem

| Task | Model | Notes |
|------|-------|-------|
| English ASR | Whisper-turbo, Moonshine | Moonshine is 4× faster on edge |
| Multilingual ASR | Whisper-large-v3 | 97 languages |
| Streaming ASR | faster-whisper + VAD | 150 ms latency targets achievable |
| TTS | Piper, XTTS-v2, Kokoro | Encoder-decoder pattern, but Whisper-shaped |
| Audio + language | AudioLM, SeamlessM4T | Text tokens + audio tokens in one transformer |

```figure
n5-mel-decode
```

## Construí-lo

Veja .`code/main.py`Não treinamos o Whisper, construímos o log-mail espectrogram pipeline + task-token prompt formator.

### Passo 1: sintetizar áudio

Gerar uma onda sinusal de 1 segundo a 440 Hz, amostragem a 16 kHz. 16.000 amostras.

### Passo 2: Espectograma log-mel (simplificado)

O espectro mel completo precisa de FFT. Fazemos uma estrutura simplificada + versão de energia por quadro que mostra o oleoduto sem exigir `librosa`- Não .

```python
def frame_signal(x, frame_size=400, hop=160):
    frames = []
    for start in range(0, len(x) - frame_size + 1, hop):
        frames.append(x[start:start + frame_size])
    return frames
```

O quadro = 25 ms, o hop = 10 ms. Correspondem à janela do Whisper.

### Passo 3: pad para 30 s

O Whisper sempre processa pedaços de 30 segundos. Pad (ou clip) o espectrograma para 3.000 quadros.

### Passo 4: criar os tokens de prompt

```python
def whisper_prompt(lang="en", task="transcribe", timestamps=True):
    tokens = ["<|startoftranscript|>", f"<|{lang}|>", f"<|{task}|>"]
    if not timestamps:
        tokens.append("<|notimestamps|>")
    return tokens
```

É toda a superfície de controlo de tarefas.

## Usá-lo

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("meeting.wav", language="en", task="transcribe")
print(result["text"])
print(result["segments"][0]["start"], result["segments"][0]["end"])
```

Mais rápido, compatível com o OpenAI:

```python
from faster_whisper import WhisperModel
model = WhisperModel("large-v3-turbo", compute_type="int8_float16")
segments, info = model.transcribe("meeting.wav", vad_filter=True)
for s in segments:
    print(f"{s.start:.2f} - {s.end:.2f}: {s.text}")
```

**When to pick Whisper in 2026:**

- ASR multilingue com um modelo.
- Uma transcrição robusta de áudio barulhento e diversificado.
- Pesquisa / protótipo ASR  ponto de partida mais rápido.

**When to pick something else:**

- Ultra-baixo streaming de latência em borda  Moonshine bate Whisper em qualidade correspondente.
- IA de conversação em tempo real que precisa de < 200 ms  ASR de streaming dedicado.
- Diário de alto-falantes  Whisper não faz isso; paralelo em pyannote.

## Envia-o

Veja .`outputs/skill-asr-configurator.md`A habilidade escolhe um modelo ASR, parâmetros de decodificação e pipeline de pré-processamento para uma nova aplicação de fala.

## Exercícios

1. **Easy.**Corra .`code/main.py`Confirme a contagem de quadros para um sinal de 1 segundo em 16 kHz com 10 ms salt é ~ 100 quadros.
2. **Medium.**Construir o espectro completo do log-mail usando `numpy.fft`Verifique 80 millatos de correspondência .`librosa.feature.melspectrogram(n_mels=80)`dentro do erro numérico.
3. **Hard.**Implemente inferência de streaming: fragmento de áudio em janelas de 10 segundos com sobreposição de 2 segundos, execute Whisper em cada fragmento, misture transcrições. Messa a taxa de erro de palavra versus passagem única em uma amostra de podcast de 5 minutos.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mel spectrogram | "Audio image" | 2D representation: frequency bins on one axis, time frames on the other; log-scaled energy per cell. |
| Log-mel | "What Whisper sees" | Mel spectrogram passed through log; approximates human perception of loudness. |
| Frame | "One time slice" | A 25 ms window of samples; overlapping at 10 ms stride. |
| Task token | "Prompt prefix for speech" | Special tokens like `<\|transcribe\|>` / `<\|translate\|>` in the decoder prompt. |
| Voice activity detection (VAD) | "Find the speech" | Gate that removes silence before ASR; cuts cost massively. |
| CTC | "Connectionist Temporal Classification" | Classic ASR loss for alignment-free training; Whisper does NOT use it. |
| Whisper-turbo | "Small decoder, full encoder" | large-v3 encoder + 4-layer decoder; 8× faster decoding. |
| Faster-whisper | "The production wrapper" | CTranslate2 reimplementation; int8 quantization; 4× faster than OpenAI's reference. |

## Mais leitura

- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356)Papel de sussurro.
- [OpenAI Whisper repo](https://github.com/openai/whisper) código de referência + peso do modelo.`whisper/model.py`Para ver o código de base Conv1D + codificador + decodificador de cima para baixo em ~ 400 linhas.
- [OpenAI Whisper — `whisper/decoding.py`](https://github.com/openai/whisper/blob/main/whisper/decoding.py) a lógica de busca de feixe + sinal de tarefa descrita nas etapas 56 está aqui; 500 linhas, totalmente legíveis.
- [Baevski et al. (2020). wav2vec 2.0: A Framework for Self-Supervised Learning of Speech Representations](https://arxiv.org/abs/2006.11477) precursor; ainda funcionalidades SOTA em algumas configurações.
- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) embalagem de produção, 4x mais rápida do que a de referência.
- [Jia et al. (2024). Moonshine: Speech Recognition for Live Transcription and Voice Commands](https://arxiv.org/abs/2410.15608) 2024 ASR amigável para bordas, em forma de sussurro, mas menor.
- [HuggingFace blog — "Fine-Tune Whisper For Multilingual ASR with 🤗 Transformers"](https://huggingface.co/blog/fine-tune-whisper) receita de ajuste fino canônico, incluindo pré-processador do espectrograma mel e manuseio de timestamps de tokens.
- [HuggingFace `modeling_whisper.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/whisper/modeling_whisper.py) implementação completa (encodeador, decodeador, atenção cruzada, geração) que reflita o diagrama de arquitetura da lição.
