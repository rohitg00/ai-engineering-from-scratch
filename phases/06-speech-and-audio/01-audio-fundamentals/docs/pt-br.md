# Fundamentos de Áudio — Formas de Onda, Amostragem, Transformada de Fourier

> Formas de onda são o sinal bruto. Eespecificaçãotrogramas são a representação. Características Mel são a forma amigável para ML. Toda pipeline moderna de ASR e TTS sobe essa escada, e o primeiro degrau é entender amostragem e Fourier.

**Tipo:** Aprender
**Idiomas:** Python
**Pré-requisitos:** Fase 1 · 06 (Vetores e Matrizes), Fase 1 · 14 (Distribuições de Probabilidade)
**Tempo:** ~45 minutos

## O Problema

Um microfone produz um sinal de pressão-tempo. Sua rede neural consome tensores. Entre eles existe uma pilha de convenções que, quando violadas, produzem bugs silenciosos: o modelo treina tranquilo mas o WER dobra, ou o TTS envia um chiado, ou um sistema de clonagem de voz memoriza o microfone em vez do falante.

Todo bug em sistemas de fala rastreia até uma dessas três perguntas:

1. Com qual taxa de amostragem os dados foram gravados, e o que o modelo espera?
2. O sinal está com aliasing?
3. Você está operando sobre amostras brutas ou sobre uma representação de frequência?

Acerta isso e o resto da Fase 6 é resolvível. Erra e até o Whisper-Large-v4 produz lixo.

## O Conceito

![Forma de onda, amostragem, DFT e bins de frequência visualizados](../assets/audio-fundamentals.svg)

**Forma de onda.** Um array unidimensional de floats em `[-1.0, 1.0]`. Indexado pelo número da amostra. Para converter em segundos, divida pela taxa de amostragem: `t = n / sr`. Um clipe de 10 segundos a 16 kHz é um array de 160.000 floats.

**Taxa de amostragem (sr).** Quantas amostras por segundo. Taxas comuns em 2026:

| Taxa | Uso |
|------|-----|
| 8 kHz | Telefonia, VOIP legado. Nyquist em 4 kHz mata consoantes. Evite para ASR. |
| 16 kHz | Padrão ASR. Whisper, Parakeet, SeamlessM4T v2 todos consomem 16 kHz. |
| 22.05 kHz | Treino de vocoder TTS para modelos antigos. |
| 24 kHz | TTS moderno (Kokoro, F5-TTS, xTTS v2). |
| 44.1 kHz | Áudio CD, música. |
| 48 kHz | Cinema, áudio profissional, TTS de alta fidelidade (VALL-E 2, NaturalSpeech 3). |

**Nyquist-Shannon.** Uma taxa de amostragem `sr` representa sem ambiguidade frequências até `sr/2`. O limite `sr/2` é a *frequência de Nyquist*. Energia acima de Nyquist é *aliased* — dobrada para frequências mais baixas — e corrompe o sinal. Sempre aplique filtro passa-baixa antes de fazer downsampling.

**Profundidade de bits.** 16-bit PCM (int16 com sinal, faixa ±32.767) é o formato universal de troca. 24-bit para música, 32-bit float para DSP interno. Bibliotecas como `soundfile` leem int16 mas expõem arrays float32 em `[-1, 1]`.

**Transformada de Fourier.** Qualquer sinal finito é uma soma de senóides em diferentes frequências. A Transformada Discreta de Fourier (DFT) computa, para `N` amostras, `N` coeficientes complexos — um por bin de frequência. `bin k` mapeia para a frequência `k · sr / N` Hz. Magnitude é a amplitude naquela frequência, ângulo é a fase.

**FFT.** Fast Fourier Transform: um algoritmo `O(N log N)` para a DFT quando `N` é potência de 2. Toda biblioteca de áudio usa FFT por baixo. Uma FFT de 1024 amostras a 16 kHz dá 512 bins de frequência utilizáveis cobrindo 0–8 kHz com resolução de 15,6 Hz.

**Enquadramento + janela.** Não fazemos FFT de um clipe inteiro. Cortamos em *frames* sobrepostos (tipicamente 25 ms com hop de 10 ms), multiplicamos cada frame por uma função de janela (Hann, Hamming) para eliminar descontinuidades nas bordas, depois fazemos FFT em cada frame. Essa é a Short-Time Fourier Transform (STFT). A Lição 02 parte daqui.

## Construa

### Passo 1: leia um clipe e plote a forma de onda

`code/main.py` usa apenas o módulo padrão `wave` para manter a demo sem dependências. Para produção você usará `soundfile` ou `torchaudio.load` (ambos retornam tuplas `(waveform, sr)`):

```python
import soundfile as sf
waveform, sr = sf.read("clip.wav", dtype="float32")  # shape (T,), sr=int
```

### Passo 2: sintetize uma onda senoidal do zero

```python
import math

def sine(freq_hz, sr, seconds, amp=0.5):
    n = int(sr * seconds)
    return [amp * math.sin(2 * math.pi * freq_hz * i / sr) for i in range(n)]
```

Uma senoide de 440 Hz (Lá concertante) a 16 kHz por 1 segundo são 16.000 floats. Grave com `wave.open(..., "wb")` usando codificação PCM de 16-bit.

### Passo 3: compute a DFT à mão

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

`O(N²)` — ok para `N=256` para confirmar correto, inútil para áudio real. Código real chama `numpy.fft.rfft` ou `torch.fft.rfft`.

### Passo 4: encontre a frequência dominante

O índice do pico de magnitude `k_star` mapeia para a frequência `k_star * sr / N`. Rodar na senoide de 440 Hz deveria retornar um pico no bin `440 * N / sr`.

### Passo 5: demonstre aliasing

Amostra uma senoide de 7 kHz a 10 kHz (Nyquist = 5 kHz). O tom de 7 kHz está acima de Nyquist e dobra para `10 − 7 = 3 kHz`. O pico da FFT aparece em 3 kHz. Essa é a demonstração clássica de aliasing e a razão pela qual todo DAC/ADC vem com um filtro passa-baixa brick-wall.

## Use

A pilha que você vai usar de verdade em 2026:

| Tarefa | Biblioteca | Por quê |
|--------|------------|---------|
| Ler/gravar WAV/FLAC/OGG | `soundfile` (wrapper de libsndfile) | Mais rápido, estável, retorna float32. |
| Resample | `torchaudio.transforms.Resample` ou `librosa.resample` | Anti-aliasing correto embutido. |
| STFT / Mel | `torchaudio` ou `librosa` | Amigável a GPU; ecossistema PyTorch. |
| Streaming em tempo real | `sounddevice` ou `pyaudio` | Bindings PortAudio cross-platform. |
| Inespecificaçãoionar arquivo | `ffprobe` ou `soxi` | CLI, rápido, reporta sr/canais/codec. |

Regra de ouro: **igualize a taxa de amostragem antes de qualquer outra coisa**. O Whisper espera 16 kHz mono float32. Passe 44.1 kHz stereo e você terá lixo que parece bug do modelo.

## Entregue

Salve como `outputs/skill-audio-loader.md`. A skill ajuda você a verificar se a entrada de áudio bate com as expectativas do modelo downstream e resample corretamente quando não bate.

## Exercícios

1. **Fácil.** Sintetize uma mix de 1 segundo de 220 Hz + 440 Hz + 880 Hz a 16 kHz. Rode DFT. Confirme três picos nos bins esperados.
2. **Médio.** Grave um WAV de 3 segundos da sua voz a 48 kHz. Faça downsampling para 16 kHz com `torchaudio.transforms.Resample` (com anti-aliasing), depois para 16 kHz com decimação direta (a cada terceira amostra). FFT nos dois. Onde o aliasing aparece?
3. **Difícil.** Construa a STFT do zero usando apenas `math` e a DFT do Passo 3. Tamanho do frame 400, hop 160, janela Hann. Plote magnitudes com `matplotlib.pyplot.imshow`. Esse é o eespecificaçãotrograma da Lição 02.

## Termos Chave

| Termo | O que a gente diz | O que significa de verdade |
|-------|-------------------|---------------------------|
| Taxa de amostragem | Quantas amostras por segundo | Frequência em Hz em que o ADC mede o sinal. |
| Nyquist | A frequência máxima representável | `sr/2`; energia acima dele dobra para baixo. |
| Profundidade de bits | Resolução de cada amostra | `int16` = 65.536 níveis; `float32` = precisão de 24-bit em `[-1, 1]`. |
| DFT | A transformada de Fourier para sequências | `N` amostras → `N` coeficientes de frequência complexos. |
| FFT | A DFT rápida | Algoritmo `O(N log N)` que requer `N` = potência de 2. |
| Bin | Coluna de frequência | `k · sr / N` Hz; resolução = `sr / N`. |
| STFT | Eespecificaçãotrograma por baixo | FFT com enquadramento + janela ao longo do tempo. |
| Aliasing | Fantasmas de frequência estranhos | Energia acima de Nyquist espelhando para bins mais baixos. |

## Leitura Adicional

- [Shannon (1949). Communication in the Presence of Noise](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf) — o paper por trás do teorema de amostragem.
- [Smith — The Scientist and Engineer's Guide to Digital Signal Processing](https://www.dspguide.com/ch8.htm) — livro didático de DSP gratuito e canônico.
- [librosa docs — audio primer](https://librosa.org/doc/latest/tutorial.html) — walkthrough prático com código.
- [Heinrich Kuttruff — Room Acoustics (6th ed.)](https://www.routledge.com/Room-Acoustics/Kuttruff/p/book/9781482260434) — referência de por que o áudio real não é uma senoide limpa.
- [Steve Eddins — FFT Interpretation notebook](https://blogs.mathworks.com/steve/2020/03/30/fft-especificaçãotrum-and-especificaçãotral-densities/) — intuição de bins de frequência esclarecida em 10 minutos.
