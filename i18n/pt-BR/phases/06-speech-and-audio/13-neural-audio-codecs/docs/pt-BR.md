# Códigos de áudio neurais  EnCodec, SNAC, Mimi, DAC e a separação semântica-acústica

> A geração de áudio 2026 é quase todos os tokens. EnCodec, SNAC, Mimi e DAC transformam formas de onda contínuas em sequências discretas que um transformador pode prever.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 10 · 11 (Quantization), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## O problema

Os modelos de linguagem funcionam em tokens discretos. O áudio é contínuo. Se você quiser um modelo de estilo LLM para fala / música  MusicGen, Moshi, Sesame CSM, VibeVoice, Orpheus  primeiro precisa de um **neural audio codec**: um codificador aprendido que discretece o áudio em um pequeno vocabulário de tokens, e um decodificador correspondente que reconstrui a forma de onda.

Duas famílias surgiram:

1. **Reconstruction-first codecs** EnCodec, DAC. Optimize a qualidade de áudio perceptual. Tokens são "acousticos"  eles capturam tudo, incluindo a identidade do alto-falante, timbre, ruído de fundo.
2. **Semantic-first codecs**Mimi (Kyutai), SpeechTokenizer. Forçar o primeiro código-book a codificar conteúdo linguístico / fonético (muitas vezes destilar a partir de WavLM).

A perspectiva de 2024-2026: **a pure reconstruction codec gives you blurry speech when you try to generate from text.**O LLM sobre tokens de codec tem que aprender tanto a estrutura de linguagem quanto a estrutura acústica no mesmo livro de código, o que não é escalado.

## O conceito

![Four codec landscape: EnCodec, DAC, SNAC (multi-scale), Mimi (semantic+acoustic)](../assets/codec-comparison.svg)

### O truque principal: Quantização de VECTORES RESIDUALES (RVQ)

Em vez de um grande livro de códigos (que precisaria de milhões de códigos para uma boa qualidade), todos os códigos de áudio modernos usam **RVQ**O primeiro livro quantiza a saída do codificador; o segundo quantiza o residual; etc. Cada livro de códigos é de 1024 códigos.$1024^8 = 10^{24}$- Não .

No momento da inferência, o decodificador soma todos os códigos escolhidos por quadro para reconstruir.

### Os quatro codecs que importam em 2026

**EnCodec (Meta, 2022).**A linha de base. Encoder-decoder sobre a forma de onda, garganta de engarrafamento RVQ. 24 kHz, 32 codesbooks possíveis, padrão 4 codesbooks @ 1,5 kbps. Utilizações `1D conv + transformer + 1D conv`- Usado pela MusicGen.

**DAC (Descript, 2023).**RVQ com livros de código L2-normalizados, funções de ativação periódica, perdas melhoradas. A maior fidelidade de reconstrução de qualquer codec aberto  às vezes indistinguível do discurso original com 12 livros de código. 44,1 kHz banda completa.

**SNAC (Hubert Siuzdak, 2024).**Os livros de código grosseiros operam a uma taxa de quadros mais baixa do que os finos. Modelagem eficazmente o áudio hierárquicamente: um "esquiz" grosseiro a ~ 12 Hz mais detalhes a 50 Hz. Usado por Orpheus-3B porque a estrutura hierárquica mapeia bem a geração baseada em LM.

**Mimi (Kyutai, 2024).**O 2026 game-changer. 12,5 Hz freqüência de quadros (extremamente baixo), 8 codes @ 4,4 kbps.**distilled from WavLM**Os livros de código 1-7 são resíduos acústicos. Esta divisão alimenta Moshi (Lessão 15) e Sesame CSM.

### As frequências de quadros são importantes para a modelagem de linguagem

Taxa de quadros mais baixa = sequência mais curta = LM mais rápido.

| Codec | Frame rate | 1 s = N frames | Good for |
|-------|-----------|----------------|---------|
| EnCodec-24k | 75 Hz | 75 | music, general audio |
| DAC-44.1k | 86 Hz | 86 | high-fidelity music |
| SNAC-24k (coarse) | ~12 Hz | 12 | AR-LM efficient |
| Mimi | 12.5 Hz | 12.5 | streaming speech |

A 12,5 Hz, uma declaração de 10 segundos é apenas 125 quadros de codec  um transformador pode facilmente predizê-los.

### Tokens semânticos versus acústicos

```
frame_t → [semantic_token_t, acoustic_token_0_t, acoustic_token_1_t, ..., acoustic_token_6_t]
```

- **Semantic token (codebook 0 in Mimi).**Encode o que foi dito  fonemas, palavras, conteúdo. Distilado a partir de WavLM através de uma perda de previsão auxiliar.
- **Acoustic tokens (codebooks 1-7).**Timbre de encódigo, identidade do alto-falante, prosodia, ruído de fundo, detalhes finos.

Um LM AR prevê o token semântico primeiro (condicionado em texto), em seguida, prevê tokens acústicos (condicionado em referência semântica + alto-falantes). Esta fatorização é por que o TTS moderno pode clonar vozes de tiro zero: o modelo semântico lida com conteúdo; o modelo acústico lida com timbre.

### 2026 Qualidade de reconstrução (bits por segundo, menor bitrate é melhor)

| Codec | Bitrate | PESQ | ViSQOL |
|-------|---------|------|--------|
| Opus-20kbps | 20 kbps | 4.0 | 4.3 |
| EnCodec-6kbps | 6 kbps | 3.2 | 3.8 |
| DAC-6kbps | 6 kbps | 3.5 | 4.0 |
| SNAC-3kbps | 3 kbps | 3.3 | 3.8 |
| Mimi-4.4kbps | 4.4 kbps | 3.1 | 3.7 |

Os codecs tradicionais como o Opus ainda ganham por bit na qualidade perceptiva.**discrete tokens**(que a Opus não produz) e **generative-model quality**(o que o LM pode fazer com esses tokens).

```figure
rvq-codec-cascade
```

## Construí-lo

### Passo 1: codificar com EnCodec

```python
from encodec import EncodecModel
import torch

model = EncodecModel.encodec_model_24khz()
model.set_target_bandwidth(6.0)  # kbps

wav = torch.randn(1, 1, 24000)
with torch.no_grad():
    encoded = model.encode(wav)
codes, scale = encoded[0]
# codes: (1, n_codebooks, n_frames), dtype=int64
```

`n_codebooks=8`Cada código é 0-1023 (10 bits).

### Passo 2: decodificação e medida da reconstrução

```python
with torch.no_grad():
    wav_recon = model.decode([(codes, scale)])

from torchaudio.functional import compute_deltas
import torch.nn.functional as F

mse = F.mse_loss(wav_recon[:, :, :wav.shape[-1]], wav).item()
```

### Passo 3: a divisão semântica-acústica (estilo Mimi)

```python
from moshi.models import loaders
mimi = loaders.get_mimi()

with torch.no_grad():
    codes = mimi.encode(wav)  # shape (1, 8, frames@12.5Hz)

semantic = codes[:, 0]
acoustic = codes[:, 1:]
```

O livro de código semântico 0 é alinhado com o WavLM. Você pode treinar um transformador de texto para semântica  vocabulário muito menor do que ir diretamente para áudio.

### Passo 4: por que o AR LM sobre tokens de codec funciona

Para um clip de fala de 10 segundos nos livros de códigos de Mimi de 12,5 Hz × 8:

```math
N_{\text{tokens}} = 10 \times 12.5 \times 8 = 1000 \text{ tokens}
```

1000 tokens é um contexto trivial para um transformador. Um transformador de parâmetro de 256M pode gerar 10 segundos de fala em milissegundos em uma GPU moderna.

## Usá-lo

Problema de mapa → codec:

| Task | Codec |
|------|-------|
| General music generation | EnCodec-24k |
| Highest-fidelity reconstruction | DAC-44.1k |
| AR LM over speech (TTS) | SNAC or Mimi |
| Streaming full-duplex speech | Mimi (12.5 Hz) |
| Sound-effect library with text | EnCodec + T5 condition |
| Fine-grained audio editing | DAC + inpainting |

Regra geral: **if you're building a generative model, start with Mimi or SNAC. If you're building a compression pipeline, use Opus.**

## Encurralagens

- **Too many codebooks.**Adicionar cédulos aumenta a fidelidade linearmente mas o comprimento da sequência LM também linearmente.
- **Frame-rate mismatch.**O treinamento LM em 12,5 Hz Mimi, depois o ajuste fino em 50 Hz EnCodec falha silenciosamente.
- **Assuming all codebooks equal.**No Mimi, o código 0 carrega conteúdo; perdê-lo destrói a inteligibilidade.
- **Using reconstruction quality as the only metric.**Um codec pode ter uma grande reconstrução, mas não é útil para a geração baseada em LM se a estrutura semântica for ruim.

## Envia-o

Salva como`outputs/skill-codec-picker.md`Escolha um codec para uma determinada tarefa de geração ou compressão.

## Exercícios

1. **Easy.**Corra .`code/main.py`Implementa um quantificador de brinquedo escalar + residual e mede o erro de reconstrução ao adicionar livros de código.
2. **Medium.**Instalação`encodec`Comparar 1, 4, 8, 32 codesbook em um clip de fala prolongado.
3. **Hard.**Carregar Mimi. Encode um clip. Substitua o código 0 por números inteiros aleatórios; decode. Então substitua o código 7 de forma semelhante. Compare as duas corrupções  Corrupção do código 0 deve destruir a inteligibilidade; Corrupção do código 7 deve apenas mudar nada.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| RVQ | Residual quantization | Cascade of small codebooks; each quantizes the previous residual. |
| Frame rate | Codec speed | How many token-frames per second. Lower = faster LM. |
| Semantic codebook | Codebook 0 (Mimi) | Codebook distilled from SSL features; encodes content. |
| Acoustic codebooks | Everything else | Timbre, prosody, noise, fine detail. |
| PESQ / ViSQOL | Perceptual quality | Objective metrics correlating with MOS. |
| EnCodec | Meta codec | The RVQ baseline; used by MusicGen. |
| Mimi | Kyutai codec | 12.5 Hz frame rate; semantic-acoustic split; powers Moshi. |

## Mais leitura

- [Défossez et al. (2023). EnCodec](https://arxiv.org/abs/2210.13438) a linha de base do RVQ.
- [Kumar et al. (2023). Descript Audio Codec (DAC)](https://arxiv.org/abs/2306.06546)- A mais alta fidelidade aberta.
- [Siuzdak (2024). SNAC](https://arxiv.org/abs/2410.14411) RVQ em larga escala.
- [Kyutai (2024). Mimi codec](https://kyutai.org/codec-explainer) separação semântica-acústica, destilação WavLM.
- [Borsos et al. (2023). AudioLM](https://arxiv.org/abs/2209.03143) o paradigma semântico/acústico de dois estágios.
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) o código RVQ original streamable.
