# Classificação de áudio  De k-NN em MFCCs para AST e BEATs

> Tudo, desde "barbão de cão vs sirena" até "que idioma é este" é classificação de áudio. As características são mels. A arquitetura muda a cada década. A avaliação permanece AUC, F1, e recall por classe.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 3 · 06 (CNNs), Phase 5 · 08 (CNNs & RNNs for Text)
**Time:** ~75 minutes

## O problema

Você recebe um clipe de 10 segundos. Você quer saber: "o que é isso?" Som urbano (sirena, perfuração, cão), comando de fala (sim/não/stop), ID de idioma (en/es/ar), emoção do alto-falante (nervosos/neutros), ou som ambiental (interior/exterior, babble). Todos estes são *audioclassificação*, e em 2026 a arquitetura de base está madura: log-mel → CNN ou Transformer → softmax.

O problema principal não é a rede. São dados. Os conjuntos de dados de áudio têm desequilíbrio de classe brutal, forte mudança de domínio (limpo vs barulhento) e ruído de rótulo (quem decidiu "barulho urbano" vs "ruído de restaurante"?).

## O conceito

![Audio classification ladder: k-NN on MFCCs to AST to BEATs](../assets/audio-classification.svg)

**k-NN on MFCCs (the 1990s baseline).**MFCCs planos por clipe, computa a semelhança cosina com um banco rotulado, devolve a maioria do voto do topo K. Surpreendentemente forte em conjuntos de dados limpos e pequenos (Comandos de fala, ESC-50).

**2D CNN on log-mels (2015-2019).**Tratar o`(T, n_mels)`O sistema de log-mail é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de log-mail, que é um sistema de-mail, ou de-mail, ou de-mail, ou de-mail, e que é um sistema de-mail, e-mail, e-mail, e-mail, e-mail, e-mail, e-mail, e-mail, e-mail, e-mail.

**Audio Spectrogram Transformer, AST (2021-2024).**Parchear o log-mail (por exemplo, 16×16 parches), adicionar inserções de posição, alimentar um ViT. O estado da técnica no AudioSet (mAP 0.485) para aprendizagem supervisionada.

**BEATs and WavLM-base (2024-2026).**Pre-treinamento auto-supervisionado em milhões de horas. Ajuste a sua tarefa com 1-10% dos dados supervisionados que você precisaria. Em 2026 este é o ponto de partida padrão para áudio não- fala. BEATs-iter3 bate o AST em 1-2 mAP no AudioSet enquanto usa 1/4 da computação.

**Whisper-encoder as a frozen backbone (2024).**Pegue o codificador do Whisper, deixe cair o decodificador, anexe um classificador linear.

### O desequilíbrio de classes é o verdadeiro desafio

ESC-50: 50 classes, 40 clips cada  equilibrado, fácil. UrbanSound8K: 10 classes, desequilibrado 10:1. AudioSet: 632 classes com uma cauda longa de 100.000:1. Técnicas que funcionam:

- Amostragem equilibrada durante a formação (não na avaliação).
- Mistura: interpolar linearmente dois clips (e as suas etiquetas) como aumento.
- SpecAugment: mascarar as bandas de tempo e frequência aleatórias.

### Avaliação

- Exclusividade multiclasse (Comando de fala): precisão superior a 1, precisão superior a 5.
- Multiclasse multi-etiqueta (AudioSet, UrbanSound-style): média de precisão média (mAP).
- Gravemente desequilibrado: recall por classe + macro F1.

Números 2026 que você deve saber:

| Benchmark | Baseline | SOTA 2026 | Source |
|-----------|----------|-----------|--------|
| ESC-50 | 82% (AST) | 97.0% (BEATs-iter3) | BEATs paper (2024) |
| AudioSet mAP | 0.485 (AST) | 0.548 (BEATs-iter3) | HEAR leaderboard 2026 |
| Speech Commands v2 | 98% (CNN) | 99.0% (Audio-MAE) | HEAR v2 results |

```figure
mfcc-pipeline
```

## Construí-lo

### Passo 1: featurizar

```python
def featurize_mfcc(signal, sr, n_mfcc=13, n_mels=40, frame_len=400, hop=160):
    mag = stft_magnitude(signal, frame_len, hop)
    fb = mel_filterbank(n_mels, frame_len, sr)
    mels = apply_filterbank(mag, fb)
    log = log_transform(mels)
    return [dct_ii(frame, n_mfcc) for frame in log]
```

### Passo 2: resumo de duração fixa

```python
def summarize(mfcc_frames):
    n = len(mfcc_frames[0])
    mean = [sum(f[i] for f in mfcc_frames) / len(mfcc_frames) for i in range(n)]
    var = [
        sum((f[i] - mean[i]) ** 2 for f in mfcc_frames) / len(mfcc_frames) for i in range(n)
    ]
    return mean + var
```

Simples mas fortes: média + variância através do tempo dá uma incorporação fixa de 26 dimensões para um MFCC de 13 covas. Funciona instantaneamente.

### Passo 3: k-NN

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1e-12
    nb = math.sqrt(sum(x * x for x in b)) or 1e-12
    return dot / (na * nb)

def knn_classify(q, bank, labels, k=5):
    sims = sorted(range(len(bank)), key=lambda i: -cosine(q, bank[i]))[:k]
    votes = Counter(labels[i] for i in sims)
    return votes.most_common(1)[0][0]
```

### Passo 4: atualização para a CNN em log-mels

Em PyTorch:

```python
import torch.nn as nn

class AudioCNN(nn.Module):
    def __init__(self, n_mels=80, n_classes=50):
        super().__init__()
        self.body = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1), nn.ReLU(),
            nn.AdaptiveAvgPool2d(1),
        )
        self.head = nn.Linear(128, n_classes)

    def forward(self, x):  # x: (B, 1, T, n_mels)
        return self.head(self.body(x).flatten(1))
```

Parâmetros 3M. Trens em ~ 10 min no ESC-50 com uma única RTX 4090.

### Passo 5: ajustar de forma fina um transformador de áudio pré-treinado (AST mostrado)

```python
from transformers import ASTFeatureExtractor, ASTForAudioClassification

ext = ASTFeatureExtractor.from_pretrained("MIT/ast-finetuned-audioset-10-10-0.4593")
model = ASTForAudioClassification.from_pretrained(
    "MIT/ast-finetuned-audioset-10-10-0.4593",
    num_labels=50,
    ignore_mismatched_sizes=True,
)

inputs = ext(audio, sampling_rate=16000, return_tensors="pt")
logits = model(**inputs).logits
```

O exemplo de sintonização fina AST do Hub. BEATs, o padrão de 2026, não está no Hugging Face Hub: baixar um checkpoint do [BEATs release in microsoft/unilm](https://github.com/microsoft/unilm/tree/master/beats)E carregá-lo com o repo.`BEATs`E ...`BEATsConfig`classes; o ciclo de ajuste fino mantém a mesma forma.

## Usá-lo

A pilha de 2026:

| Situation | Start with |
|-----------|-----------|
| Tiny dataset (<1000 clips) | k-NN on MFCC means (your baseline) + audio augmentation |
| Medium dataset (1K–100K) | BEATs or AST fine-tune |
| Large dataset (>100K) | Train from scratch or fine-tune Whisper-encoder |
| Real-time, edge | 40-MFCC CNN, quantized to int8 (KWS-style) |
| Multi-label (AudioSet) | BEATs-iter3 with BCE loss + mixup + SpecAugment |
| Language ID | MMS-LID, SpeechBrain VoxLingua107 baseline |

Regra de decisão: **start with a frozen backbone, not a fresh model**A ponta de uma cabeça da BEATs dá-lhe 95% de SOTA em horas, não semanas.

## Envia-o

Salva como`outputs/skill-classifier-designer.md`Selecionar arquitetura, aumentos, estratégia de equilíbrio de classes e métricas de avaliação para uma determinada tarefa de classificação de áudio.

## Exercícios

1. **Easy.**Corra .`code/main.py`. Ele treina a linha de base do K-NN MFCC em um conjunto de dados sintéticos de 4 classes (tons puros em diferentes tons).
2. **Medium.**Substitui`summarize`A agregação de 4 momentos bate a média + var no mesmo conjunto de dados sintéticos?
3. **Hard.**Usando`torchaudio`, treinar uma CNN 2D no ESC-50 de dobrar 1. relatar a precisão de validação cruzada 5 vezes. Adicionar SpecAugment (mascaras de tempo = 20, mascaras de freqüência = 10) e relatar o delta.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| AudioSet | The ImageNet of audio | Google's 2M-clip, 632-class weakly-labeled YouTube dataset. |
| ESC-50 | Small classification benchmark | 50 classes × 40 clips of environmental sounds. |
| AST | Audio Spectrogram Transformer | ViT on log-mel patches; 2021 SOTA. |
| BEATs | Self-supervised audio | Microsoft model, iter3 leads AudioSet as of 2026. |
| Mixup | Pair augmentation | `x = λ·x1 + (1-λ)·x2; y = λ·y1 + (1-λ)·y2`. |
| SpecAugment | Mask-based augmentation | Zero-out random time and frequency bands of the spectrogram. |
| mAP | Main multi-label metric | Mean average precision across classes and thresholds. |

## Mais leitura

- [Gong, Chung, Glass (2021). AST: Audio Spectrogram Transformer](https://arxiv.org/abs/2104.01778) a arquitetura de registro de 20212024.
- [Chen et al. (2022, rev. 2024). BEATs: Audio Pre-Training with Acoustic Tokenizers](https://arxiv.org/abs/2212.09058) o padrão de 2024+.
- [Park et al. (2019). SpecAugment](https://arxiv.org/abs/1904.08779) o aumento de áudio dominante.
- [Piczak (2015). ESC-50 dataset](https://github.com/karolpiczak/ESC-50) 50 classes de referência que vive.
- [Gemmeke et al. (2017). AudioSet](https://research.google.com/audioset/)Taxonomia do YouTube de classe 632; ainda o padrão de ouro.
