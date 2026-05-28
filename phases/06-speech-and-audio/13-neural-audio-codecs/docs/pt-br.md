# Codecs Neurais de Áudio — EnCodec, SNAC, Mimi, DAC e a Divisão Semântico-Acústica

> A geração de áudio de 2026 é quase toda tokens. EnCodec, SNAC, Mimi e DAC transformam formas de onda contínuas em sequências discretas que um transformer pode prever. A divisão semântico-acústica de tokens — primeiro codebook como semântico, resto como acústico — é a mudança arquitetural mais importante desde o Transformer para áudio.

**Tipo:** Aprender
**Idiomas:** Python
**Pré-requisitos:** Fase 6 · 02 (Eespecificaçãotrogramas), Fase 10 · 11 (Quantização), Fase 5 · 19 (Tokenização Subword)
**Tempo:** ~60 minutos

## O Problema

Modelos de linguagem trabalham com tokens discretos. Áudio é contínuo. Se você quer um modelo estilo LLM para fala/música — MusicGen, Moshi, Sesame CSM, VibeVoice, Orpheus — primeiro precisa de um **codec neural**: um encoder aprendido que discretiza áudio em um vocabulário pequeno de tokens, e um decoder correspondente que reconstrói a forma de onda.

Duas famílias emergiram:

1. **Codecs focados em reconstrução** — EnCodec, DAC. Otimizam qualidade perceptual de áudio. Tokens são "acústicos" — capturam tudo incluindo identidade do falante, timbre, ruído de fundo.
2. **Codecs focados em semântica** — Mimi (Kyutai), SpeechTokenizer. Forçam o primeiro codebook a codificar conteúdo lingüístico/fonético (frequentemente destilando de WavLM). Codebooks subsequentes são detalhe acústico.

O insight de 2024-2026: **um codec puro de reconstrução dá fala borrada quando você tenta gerar a partir de texto.** O LLM sobre tokens de codec tem que aprender tanto estrutura lingüística QUANTO estrutura acústica no mesmo codebook, o que não escala. Separar eles — codebook semântico 0, codebooks acústicos 1-N — é o que faz Moshi e Sesame CSM funcionarem.

## O Conceito

![Quatro codecs: EnCodec, DAC, SNAC (multi-escala), Mimi (semântico+acústico)](../assets/codec-comparison.svg)

### O truque central: Residual Vector Quantization (RVQ)

Em vez de um codebook grande (que precisaria de milhões de códigos para boa qualidade), todos os codecs neurais modernos usam **RVQ**: uma cascata de codebooks pequenos. O primeiro codebook quantiza a saída do encoder; o segundo quantiza o residual; e assim por diante. Cada codebook tem 1024 códigos. 8 codebooks = vocabulário efetivo de 1024^8 = 10^24.

Na inferência, o decoder soma todos os códigos escolhidos por frame para reconstruir.

### Os quatro codecs que importam em 2026

**EnCodec (Meta, 2022).** O baseline. Encoder-decoder sobre forma de onda, gargalo RVQ. 24 kHz, até 32 codebooks, padrão 4 codebooks @ 1,5 kbps. Usa arquitetura `1D conv + transformer + 1D conv`. Usado pelo MusicGen.

**DAC (Descript, 2023).** RVQ com codebooks normalizados L2, funções de ativação periódicas, perdas melhoradas. Maior fidelidade de reconstrução de qualquer codec open — às vezes indistinguível de fala original com 12 codebooks. Banda larga completa 44,1 kHz.

**SNAC (Hubert Siuzdak, 2024).** RVQ multi-escala — os codebooks grossos operam em taxa de frames mais baixa que os finos. Modela áudio hierarquicamente: um "rascunho" grosso a ~12 Hz mais detalhe a 50 Hz. Usado pelo Orpheus-3B porque a estrutura hierárquica se mapeia bem à geração baseada em LM.

**Mimi (Kyutai, 2024).** O disruptor de 2026. Taxa de frames de 12,5 Hz (extremamente baixa), 8 codebooks @ 4,4 kbps. Codebook 0 é **destilado do WavLM** — treinado para prever características de conteúdo de fala do WavLM. Codebooks 1-7 são residuais acústicos. Essa divisão alimenta Moshi (Lição 15) e Sesame CSM.

### Taxas de frames importam para modelagem de linguagem

Taxa de frames menor = sequência menor = LM mais rápido.

| Codec | Taxa de frames | 1 s = N frames | Bom para |
|-------|---------------|----------------|----------|
| EnCodec-24k | 75 Hz | 75 | música, áudio geral |
| DAC-44.1k | 86 Hz | 86 | música de alta fidelidade |
| SNAC-24k (grosso) | ~12 Hz | 12 | AR-LM eficiente |
| Mimi | 12,5 Hz | 12,5 | fala streaming |

A 12,5 Hz, uma utterance de 10 segundos são apenas 125 frames de codec — um transformer consegue prever facilmente.

### Tokens semânticos vs acústicos

```
frame_t → [semantic_token_t, acoustic_token_0_t, acoustic_token_1_t, ..., acoustic_token_6_t]
```

- **Token semântico (codebook 0 no Mimi).** Codifica o que foi dito — fonemas, palavras, conteúdo. Destilado do WavLM via perda auxiliar de predição.
- **Tokens acústicos (codebooks 1-7).** Codificam timbre, identidade do falante, prosódia, ruído de fundo, detalhe fino.

Um LM AR prevê o token semântico primeiro (condicionado em texto), depois prevê tokens acústicos (condicionado em semântico + referência do falante). Essa fatorização é por que TTS moderno pode clonar vozes zero-shot: o modelo semântico lida com conteúdo; o modelo acústico lida com timbre.

### Qualidade de reconstrução 2026 (bits por segundo, bitrate menor é melhor)

| Codec | Bitrate | PESQ | ViSQOL |
|-------|---------|------|--------|
| Opus-20kbps | 20 kbps | 4,0 | 4,3 |
| EnCodec-6kbps | 6 kbps | 3,2 | 3,8 |
| DAC-6kbps | 6 kbps | 3,5 | 4,0 |
| SNAC-3kbps | 3 kbps | 3,3 | 3,8 |
| Mimi-4.4kbps | 4,4 kbps | 3,1 | 3,7 |

Codecs tradicionais como Opus ainda ganham por bit em qualidade perceptual. Codecs neurais ganham em **tokens discretos** (que o Opus não produz) e **qualidade de modelo generativo** (o que o LM faz com esses tokens).

## Construa

### Passo 1: codifique com EnCodec

```python
from encodec import EncodecModel
import torch

model = EncodecModel.encodec_model_24khz()
model.set_target_bandwidth(6.0)

wav = torch.randn(1, 1, 24000)
with torch.no_grad():
    encoded = model.encode(wav)
codes, scale = encoded[0]
# codes: (1, n_codebooks, n_frames), dtype=int64
```

`n_codebooks=8` a 6 kbps. Cada código é 0-1023 (10-bit).

### Passo 2: decodifique e meça reconstrução

```python
with torch.no_grad():
    wav_recon = model.decode([(codes, scale)])

import torch.nn.functional as F
mse = F.mse_loss(wav_recon[:, :, :wav.shape[-1]], wav).item()
```

### Passo 3: a divisão semântico-acústica (estilo Mimi)

```python
from moshi.models import loaders
mimi = loaders.get_mimi()

with torch.no_grad():
    codes = mimi.encode(wav)  # formato (1, 8, frames@12.5Hz)

semantic = codes[:, 0]
acoustic = codes[:, 1:]
```

O codebook semântico 0 é alinhado ao WavLM. Você pode treinar um transformer texto-para-semântico — vocabulário muito menor que ir direto para áudio. Depois um decoder acústico-para-forma-de-onda separado condiciona em uma referência do falante.

### Passo 4: por que AR LM sobre tokens de codec funciona

Para um clipe de 10 s de fala a 12,5 Hz do Mimi × 8 codebooks:

```
N_tokens = 10 * 12.5 * 8 = 1000 tokens
```

1000 tokens é trivial para um transformer. Um transformer de 256M parâmetros consegue gerar 10 segundos de fala em milissegundos numa GPU moderna.

## Use

Mapeie problema → codec:

| Tarefa | Codec |
|--------|-------|
| Geração de música geral | EnCodec-24k |
| Reconstrução de maior fidelidade | DAC-44.1k |
| AR LM sobre fala (TTS) | SNAC ou Mimi |
| Fala full-duplex streaming | Mimi (12,5 Hz) |
| Biblioteca de efeitos sonoros com texto | EnCodec + T5 condicional |
| Edição de áudio refinada | DAC + inpainting |

Regra de ouro: **se você está construindo um modelo generativo, comece com Mimi ou SNAC. Se está construindo uma pipeline de compressão, use Opus.**

## Armadilhas

- **Muitos codebooks.** Adicionar codebooks aumenta fidelidade linearmente mas também comprimento de sequência do LM. Pare em 8-12.
- **Incompatibilidade de taxa de frames.** Treinar LM em 12,5 Hz Mimi e depois ajustar fino em 50 Hz EnCodec falha silenciosamente.
- **Assumir todos codebooks iguais.** No Mimi, codebook 0 carrega conteúdo; perdê-lo destrói inteligibilidade. Perder codebook 7 é quase imperceptível.
- **Usar qualidade de reconstrução como única métrica.** Um codec pode ter ótima reconstrução mas ser inútil para geração baseada em LM se a estrutura semântica for ruim.

## Entregue

Salve como `outputs/skill-codec-picker.md`. Escolha um codec para uma tarefa gerativa ou de compressão.

## Exercícios

1. **Fácil.** Execute `code/main.py`. Implementa um quantizador escalar + residual toy e mede erro de reconstrução conforme você adiciona codebooks.
2. **Médio.** Instale `encodec` e compare 1, 4, 8, 32 codebooks em um clipe de fala de validação. Plote PESQ ou MSE vs bitrate.
3. **Difícil.** Carregue o Mimi. Codifique um clipe. Substitua codebook 0 por inteiros aleatórios; decodifique. Depois substitua codebook 7 similarmente. Compare as duas corrupções — corrupção do codebook 0 deveria destruir inteligibilidade; corrupção do codebook 7 deveria mal mudar qualquer coisa.

## Termos Chave

| Termo | O que a gente diz | O que significa de verdade |
|-------|-------------------|---------------------------|
| RVQ | Quantização residual | Cascata de codebooks pequenos; cada um quantiza o residual do anterior. |
| Taxa de frames | Velocidade do codec | Quantos frames de token por segundo. Menor = LM mais rápido. |
| Codebook semântico | Codebook 0 (Mimi) | Codebook destilado de características SSL; codifica conteúdo. |
| Codebooks acústicos | Todo o resto | Timbre, prosódia, ruído, detalhe fino. |
| PESQ / ViSQOL | Qualidade perceptual | Métricas objetivas que correlacionam com MOS. |
| EnCodec | Codec da Meta | O baseline RVQ; usado pelo MusicGen. |
| Mimi | Codec do Kyutai | Taxa de frames 12,5 Hz; divisão semântico-acústica; alimenta Moshi. |

## Leitura Adicional

- [Défossez et al. (2023). EnCodec](https://arxiv.org/abs/2210.13438) — o baseline RVQ.
- [Kumar et al. (2023). Descript Audio Codec (DAC)](https://arxiv.org/abs/2306.06546) — maior fidelidade open.
- [Siuzdak (2024). SNAC](https://arxiv.org/abs/2410.14411) — RVQ multi-escala.
- [Kyutai (2024). Mimi codec](https://kyutai.org/codec-explainer) — divisão semântico-acústica, destilação WavLM.
- [Borsos et al. (2023). AudioLM](https://arxiv.org/abs/2209.03143) — o paradigma semântico/acústico de dois estágios.
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) — o codec RVQ transmissível original.
