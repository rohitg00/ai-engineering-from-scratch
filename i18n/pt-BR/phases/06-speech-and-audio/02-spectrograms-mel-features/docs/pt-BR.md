# Espectogramas, Mel Scale e Funções de Áudio

> As redes neurais não consomem bem as formas de onda crudas. Consomem espectrogramas. Consomem espectrogramas mel ainda melhor. Cada classificador de áudio ASR, TTS e em 2026 vive ou morre por esta única escolha de pré-processamento.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 01 (Audio Fundamentals)
**Time:** ~45 minutes

## O problema

Tome um clip de 10 segundos a 16 kHz, isto é 160.000 floats, tudo em`[-1, 1]`A forma de onda crua possui as informações, mas em uma forma que o modelo não pode extrair facilmente.

Um espectrograma corrige isso. Ele desmorona o detalhe temporal onde a percepção humana ignora (microsecondiário jitter) e preserva a estrutura onde a percepção atende (que frequências são energéticas, sobre janelas de tempo de ~ 1025 ms).

Os espectrogramas mel empurram mais longe. Os seres humanos percebem o pitch logaritmicamente: 100 Hz vs 200 Hz soam "a mesma distância entre si" que 1000 Hz vs 2000 Hz. A escala mel distorce o eixo de frequência para corresponder. Um espectrograma mel-escalado é a característica mais importante do discurso ML de 2010 a 2026.

## O conceito

![Waveform to STFT to mel spectrogram to MFCC ladder](../assets/mel-features.svg)

**STFT (Short-Time Fourier Transform).**Corte a forma de onda em quadros sobrepostos (típico: 25 ms janela, 10 ms hop = 400 amostras / 160 amostras em 16 kHz). Multiplicar cada quadro por uma função de janela (Hann é o padrão; Hamming com troca ligeiramente diferente). FFT cada quadro. Apila os espectros de magnitude em uma matriz de forma `(n_frames, n_freq_bins)`É o teu espectrograma.

**Log-magnitude.**Grandes dimensões cruas variam entre 5 e 6 ordens de magnitude.`log(|X| + 1e-6)`ou `20 * log10(|X|)`Cada linha de produção usa magnitude de log, não magnitude bruta.

**Mel scale.**Frequência`f`em mapas Hz para mel `m`Por$m = 2595 \cdot \log_{10}(1 + f / 700)$O mapeamento é aproximadamente linear abaixo de 1 kHz e aproximadamente logarítmico acima. 80 melbins cobrindo 08 kHz é a entrada ASR padrão.

**Mel filterbank.**Um conjunto de filtros triangulares espaçados igualmente na escala mel. Cada filtro é uma soma ponderada de contenedores FFT adjacentes. Multiplicando a magnitude STFT pela matriz filterbank dá o espectrograma mel em um matmul.

**Log-mel spectrogram.** `log(mel_spec + 1e-10)`A entrada do Whisper, a entrada do Parakeet, a entrada do SeamlessM4T, a entrada do frontend de áudio universal de 2026.

**MFCCs.**Pegue o espectrograma log-mel, aplique um DCT (tipo II), mantenha os primeiros 13 coeficientes. Decorrela as características e comprime mais. Figura dominante até cerca de 2015, quando as CNNs/Transformers em log-mels crues foram capturadas. Ainda é usada no reconhecimento de alto-falantes (vectores x, ECAPA).

**Resolution trade.**Maior FFT = melhor resolução de frequência, mas pior resolução de tempo. 25 ms / 10 ms é o padrão de áudio-ML; 50 ms / 12,5 ms para música; 5 ms / 2 ms para detecção transitória (bateria, plosivos).

```figure
spectrogram-window
```

## Construí-lo

### Passo 1: enquadrar a forma de onda

```python
def frame(signal, frame_len, hop):
    n = 1 + (len(signal) - frame_len) // hop
    return [signal[i * hop : i * hop + frame_len] for i in range(n)]
```

Um clip de 10 segundos de 16 kHz com `frame_len=400, hop=160`- E dá 998 quadros.

### Passo 2: Janela Hann

```python
import math

def hann(N):
    return [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]
```

Multiplicar com elementos antes do FFT. Elimina vazamento espectral causado por truncar em pontos finais não-zero.

### Passo 3: Magnitude STFT

```python
def stft_magnitude(signal, frame_len=400, hop=160):
    win = hann(frame_len)
    frames = frame(signal, frame_len, hop)
    return [magnitudes(dft([w * s for w, s in zip(win, f)])) for f in frames]
```

Utilizações de produção `torch.stft`ou `librosa.stft`O ciclo aqui é pedagógico; ele é executado em clips curtos em`code/main.py`- Não .

### Passo 4: Mel filterbank

```python
def hz_to_mel(f):
    return 2595.0 * math.log10(1.0 + f / 700.0)

def mel_to_hz(m):
    return 700.0 * (10 ** (m / 2595.0) - 1)

def mel_filterbank(n_mels, n_fft, sr, fmin=0, fmax=None):
    fmax = fmax or sr / 2
    mels = [hz_to_mel(fmin) + (hz_to_mel(fmax) - hz_to_mel(fmin)) * i / (n_mels + 1)
            for i in range(n_mels + 2)]
    hzs = [mel_to_hz(m) for m in mels]
    bins = [int(h * n_fft / sr) for h in hzs]
    fb = [[0.0] * (n_fft // 2 + 1) for _ in range(n_mels)]
    for m in range(n_mels):
        for k in range(bins[m], bins[m + 1]):
            fb[m][k] = (k - bins[m]) / max(1, bins[m + 1] - bins[m])
        for k in range(bins[m + 1], bins[m + 2]):
            fb[m][k] = (bins[m + 2] - k) / max(1, bins[m + 2] - bins[m + 1])
    return fb
```

80 mels cobrindo 08 kHz com `n_fft=400`dá um `(80, 201)`Matriz. Multiplica o `(n_frames, 201)`A magnitude da STFT pela transposição para obter `(n_frames, 80)`Espectograma de mel.

### Passo 5: log-mail

```python
def log_mel(mel_spec, eps=1e-10):
    return [[math.log(max(v, eps)) for v in frame] for frame in mel_spec]
```

Alternativas comuns: `librosa.power_to_db`(dB normalizado em referência), `10 * log10(power + eps)`O Whisper usa um clip mais envolvido + normaliza a rotina (ver Whisper's `log_mel_spectrogram`)).

### Passo 6: CFPM

```python
def dct_ii(x, n_coeffs):
    N = len(x)
    return [
        sum(x[n] * math.cos(math.pi * k * (2 * n + 1) / (2 * N)) for n in range(N))
        for k in range(n_coeffs)
    ]
```

Aplique DCT a cada quadro log-mel, mantenha os primeiros 13 coeficientes. Essa é a sua matriz MFCC. O primeiro coeficiente é geralmente caído (ela codifica a energia total).

## Usá-lo

A pilha de 2026:

| Task | Features |
|------|----------|
| ASR (Whisper, Parakeet, SeamlessM4T) | 80 log-mels, 10 ms hop, 25 ms window |
| TTS acoustic model (VITS, F5-TTS, Kokoro) | 80 mels, 5–12 ms hop for fine temporal control |
| Audio classification (AST, PANNs, BEATs) | 128 log-mels, 10 ms hop |
| Speaker embedding (ECAPA-TDNN, WavLM) | 80 log-mels or raw-waveform SSL |
| Music (MusicGen, Stable Audio 2) | EnCodec discrete tokens (not mels) |
| Keyword spotting | 40 MFCCs for tiny devices |

Regra geral: **if you are not working on music, start with 80 log-mels.**O fardo da prova está em qualquer desvio.

## Encurralagens que ainda se lançam em 2026

- **Mel count mismatch.**Treinamento com 80 mels, inferência com 128 mels, falha silenciosa, registro da forma de característica em ambas as extremidades.
- **Sample-rate mismatch upstream.**Mels computados a 22,05 kHz parecem diferentes de 16 kHz.
- **dB vs log.**O Whisper espera o log-mel, não o dB-mel.
- **Normalization drift.**Normalização de per-utterance durante o treinamento, normalização global durante a inferência.
- **Leakage from padding.**O pad zero na extremidade de um clip produz um espectro plano nos quadros traseiros.

## Envia-o

Salva como`outputs/skill-feature-extractor.md`A habilidade seleciona o tipo de característica, a contagem de mel, o quadro/sopa e a normalização para um determinado alvo modelo.

## Exercícios

1. **Easy.**Corra .`code/main.py`- Sintetiza um chirp (frequência varrida 200 → 4000 Hz) e imprime o argmax mel bin por quadro.
2. **Medium.**Repete com `n_mels`em `{40, 80, 128}`E ...`frame_len`em `{200, 400, 800}`- Medir a largura de banda de pico acentuado através do eixo do tempo.
3. **Hard.**Implementação `power_to_db`e comparar a precisão ASR de um pequeno classificador CNN no AudioMNIST usando (a) log-mel bruto, (b) dB-mel com `ref=max`, (c) MFCC-13 + delta + delta-delta.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Frame | A slice | 25 ms chunk of waveform fed to one FFT. |
| Hop | Stride | Samples between consecutive frames; 10 ms is ASR default. |
| Window | Hann/Hamming thing | Point-wise multiplier that tapers the frame edges to zero. |
| STFT | Spectrogram generator | Framed + windowed FFT; yields time × frequency matrix. |
| Mel | Warped frequency | Log-perception scale; `m = 2595·log10(1 + f/700)`. |
| Filterbank | The matrix | Triangular filters that project STFT onto mel bins. |
| Log-mel | Whisper's input | `log(mel_spec + eps)`; standardized in 2026. |
| MFCC | Old-school feature | DCT of log-mel; 13 coeffs, decorrelated. |

## Mais leitura

- [Davis, Mermelstein (1980). Comparison of parametric representations for monosyllabic word recognition](https://ieeexplore.ieee.org/document/1163420) o documento do MFCC.
- [Stevens, Volkmann, Newman (1937). A Scale for the Measurement of the Psychological Magnitude Pitch](https://pubs.aip.org/asa/jasa/article-abstract/8/3/185/735757/)- A escala mel original.
- [OpenAI — Whisper source, log_mel_spectrogram](https://github.com/openai/whisper/blob/main/whisper/audio.py) ler a aplicação de referência.
- [librosa feature extraction docs](https://librosa.org/doc/latest/api/feature.html) referência para `mfcc`- Não .`melspectrogram`, e salto/janela.
- [NVIDIA NeMo — audio preprocessing](https://docs.nvidia.com/deeplearning/nemo/user-guide/docs/en/main/asr/asr_all.html#featurizers) Pipeline em escala de produção para os modelos Parakeet + Canary.
