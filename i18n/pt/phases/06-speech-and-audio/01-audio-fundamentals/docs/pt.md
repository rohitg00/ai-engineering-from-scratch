# Fundamentos de áudio  Forma de onda, amostragem, transformação de Fourier

> As ondas são o sinal bruto. Os espectrogramas são a representação. As características Mel são a forma amigável ao ML. Cada moderno ASR e TTS caminha nesta escada, e o primeiro passo é entender a amostragem e Fourier.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 · 06 (Vectors & Matrices), Phase 1 · 14 (Probability Distributions)
**Time:** ~45 minutes

## O problema

Um microfone produz um sinal de pressão contra tempo. Sua rede neural consome tensores. Entre eles fica uma pilha de convenções que, quando violadas, produz bugs silenciosos: o modelo se prepara bem, mas o WER duplica, ou o TTS envia um silbido, ou um sistema de clonagem de voz memoriza o microfone em vez do alto-falante.

Cada bug nos sistemas de fala remonta a uma das três perguntas:

1. Em que taxa de amostragem foram registados os dados, e o que o modelo espera?
2. O sinal é alias?
3. Está a operar com amostras brutas ou com uma representação de frequência?

Se as fizerem bem, o resto da Fase 6 é fácil de tratar, e até o Whisper-Large-v4 produz lixo.

## O conceito

![Waveform, sampling, DFT, and frequency bins visualized](../assets/audio-fundamentals.svg)

**Waveform.**Uma matriz unidimensional de flutuantes em `[-1.0, 1.0]`Para converter em segundos, divide pela taxa de amostragem:`t = n / sr`Um clip de 10 segundos a 16 kHz é uma matriz de 160.000 floats.

**Sampling rate (sr).**Quantas amostras por segundo.

| Rate | Use |
|------|-----|
| 8 kHz | Telephony, legacy VOIP. Nyquist at 4 kHz kills consonants. Avoid for ASR. |
| 16 kHz | ASR standard. Whisper, Parakeet, SeamlessM4T v2 all consume 16 kHz. |
| 22.05 kHz | TTS vocoder training for older models. |
| 24 kHz | Modern TTS (Kokoro, F5-TTS, xTTS v2). |
| 44.1 kHz | CD audio, music. |
| 48 kHz | Film, pro audio, high-fidelity TTS (VALL-E 2, NaturalSpeech 3). |

**Nyquist-Shannon.**Uma taxa de amostragem de `sr`pode representar de forma inequívoca frequências de até `sr/2`- O .`sr/2`O limite é a frequência de Nyquist. A energia acima de Nyquist fica * alias *  dobrado para baixo em frequências mais baixas  e corrompe o sinal.

**Bit depth.**O PCM de 16 bits (assinado int16, intervalo ±32.767) é o formato de troca universal.`soundfile`ler int16 mas expor float32 matrizes em `[-1, 1]`- Não .

**Fourier Transform.**Qualquer sinal finito é uma soma de sinusoides em diferentes frequências.`N`amostras, `N`coeficientes complexos  um por caixa de frequências. `bin k`mapas de frequência `k · sr / N`Magnitude é amplitude nessa frequência, ângulo é fase.

**FFT.**Transformação rápida de Fourier: um `O(N log N)`Algoritmo para o DFT quando `N`Uma FFT de 1024-sampla em 16 kHz dá 512 canhões de frequência utilizáveis que abrangem 08 kHz em resolução de 15,6 Hz.

**Framing + window.**Não FFT um clip inteiro. Nós o cortamos em *frames* sobrepostos (normalmente 25 ms com 10 ms hop), multiplicamos cada quadro por uma função de janela (Hann, Hamming) para matar discontinuidades de borda, então FFT cada quadro.

```figure
mel-scale
```

## Construí-lo

### Passo 1: ler um clip e traçar a forma de onda

`code/main.py`utiliza apenas o stdlib `wave`O módulo para manter a demonstração livre de dependência.`soundfile`ou `torchaudio.load`(ambos retornam `(waveform, sr)`- Tópicos:

```python
import soundfile as sf
waveform, sr = sf.read("clip.wav", dtype="float32")  # shape (T,), sr=int
```

### Passo 2: sintetizar uma onda sinusal a partir dos primeiros princípios

```python
import math

def sine(freq_hz, sr, seconds, amp=0.5):
    n = int(sr * seconds)
    return [amp * math.sin(2 * math.pi * freq_hz * i / sr) for i in range(n)]
```

Um sinusoide de 440 Hz (concerto A) a 16 kHz por 1 segundo é 16 000 flutuantes.`wave.open(..., "wb")`usando codificação PCM de 16 bits.

### Passo 3: calcular a DFT à mão

```python
def dft(x):
    N = len(x)
    out = []
    for k in range(N):
        re = sum(x[n] * math.cos(-2 * math.pi * k * n / N) for n in range(N))
        im = sum(x[n] * math.sin(-2 * math.pi * k * n / N) for n in range(N))
        out.append((re, im))
    return out
```

`O(N²)`- Muito bem.`N=256`Para confirmar a corretão, inútil para áudio real.`numpy.fft.rfft`ou `torch.fft.rfft`- Não .

### Passo 4: encontrar a frequência dominante

Indice de pico de magnitude `k_star`mapas de frequência `k_star * sr / N`Se executarmos isto no seno de 440 Hz , devemos retornar um pico no bin .`440 * N / sr`- Não .

### Passo 5: demonstrar o aliasing

Amostra de um sinusoide de 7 kHz a 10 kHz (Nyquist = 5 kHz).`10 − 7 = 3 kHz`O pico da FFT aparece em 3 kHz. Esta é a demonstração clássica de alias e a razão de todos os navios DAC/ADC terem um filtro de baixa passagem de parede de tijolo.

## Usá-lo

A pilha que enviará em 2026:

| Task | Library | Why |
|------|---------|-----|
| Read/write WAV/FLAC/OGG | `soundfile` (libsndfile wrapper) | Fastest, stable, returns float32. |
| Resample | `torchaudio.transforms.Resample` or `librosa.resample` | Correct anti-aliasing built in. |
| STFT / Mel | `torchaudio` or `librosa` | GPU-friendly; PyTorch ecosystem. |
| Real-time streaming | `sounddevice` or `pyaudio` | Cross-platform PortAudio bindings. |
| Inspect a file | `ffprobe` or `soxi` | CLI, fast, reports sr/channels/codec. |

Regra de decisão: **match sample rate before you match anything else**O Whisper espera 16 kHz mono float32. Passa-o com um estéreo de 44,1 kHz e vai ter lixo que parece um bug modelo.

## Envia-o

Salva como`outputs/skill-audio-loader.md`A habilidade ajuda a verificar se a entrada de áudio corresponde às expectativas do modelo a jusante e a repetição correta quando não o faz.

## Exercícios

1. **Easy.**Sintetize uma mistura de 1 segundo de 220 Hz + 440 Hz + 880 Hz a 16 kHz. Execute DFT. Confirme três picos nos contentores esperados.
2. **Medium.**Grave um WAV de 3 segundos da sua voz a 48 kHz.`torchaudio.transforms.Resample`(com anti-aliasing), em seguida, para 16 kHz usando uma decimação ingênua (cada terceira amostra).
3. **Hard.**Construir o STFT a partir do zero usando apenas `math`E o DFT do passo 3. tamanho do quadro 400, hop 160, janela Hann.`matplotlib.pyplot.imshow`Este é o espectrograma da lição 02.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Sample rate | How many samples per second | Frequency in Hz at which the ADC measures the signal. |
| Nyquist | The max frequency you can represent | `sr/2`; energy above it aliases back down. |
| Bit depth | Resolution of each sample | `int16` = 65,536 levels; `float32` = 24-bit precision in `[-1, 1]`. |
| DFT | The Fourier transform for sequences | `N` samples → `N` complex frequency coefficients. |
| FFT | The fast DFT | `O(N log N)` algorithm requiring `N` = power of 2. |
| Bin | Frequency column | `k · sr / N` Hz; resolution = `sr / N`. |
| STFT | Spectrogram under the hood | Framed + windowed FFT over time. |
| Aliasing | Weird frequency ghosts | Energy above Nyquist mirroring down to lower bins. |

## Mais leitura

- [Shannon (1949). Communication in the Presence of Noise](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf) o papel por trás do teorema de amostragem.
- [Smith — The Scientist and Engineer's Guide to Digital Signal Processing](https://www.dspguide.com/ch8.htm)Livro de texto livre e canônico de DSP.
- [librosa docs — audio primer](https://librosa.org/doc/latest/auto_tutorials/index.html) Passagem prática com código.
- [Heinrich Kuttruff — Room Acoustics (6th ed.)](https://www.taylorfrancis.com/books/mono/10.1201/9781315372150/room-acoustics-heinrich-kuttruff) referência para o motivo pelo qual o áudio do mundo real não é um sinusoide limpo.
- [Steve Eddins — FFT Interpretation notebook](https://blogs.mathworks.com/steve/2020/03/30/fft-spectrum-and-spectral-densities/)Intuição do bin de frequência resolvido em 10 minutos.
