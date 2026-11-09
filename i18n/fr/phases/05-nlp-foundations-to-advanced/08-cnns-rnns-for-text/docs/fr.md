# Les CNN et les RNN pour le texte

> Les convolutions apprennent n-grammes, les récurrents se souviennent, les deux sont remplacés par l'attention, les deux sont encore importants sur un matériel restreint.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 11 (PyTorch Intro), Phase 5 · 03 (Word Embeddings), Phase 4 · 02 (Convolutions from Scratch)
**Time:** ~75 minutes

## Le problème

TF-IDF et Word2Vec ont produit des vecteurs plats qui ignorent l'ordre des mots.`dog bites man`de `man bites dog`L'ordre des mots porte parfois le signal.

Deux familles d'architectes ont comblé ce vide avant l'arrivée des transformateurs.

**Convolutional nets for text (TextCNN).**Appliquer des convolutions 1D sur des séquences d'embedding de mots. Un filtre de largeur 3 est un détecteur de trigrammes apprenable: il couvre trois mots et donne un score. Ampiler différentes largeurs (2, 3, 4, 5) pour détecter des motifs à grande échelle. Max-pool à une représentation de taille fixe. Plat, parallèle, rapide.

**Recurrent nets (RNN, LSTM, GRU).**Les jetons de traitement un à la fois, en maintenant un état caché qui transmet l'information. Sequentielle, porteuse de mémoire, longueur d'entrée flexible. Modélisation de séquence dominée de 2014 à 2017, puis l'attention est venue.

Cette leçon construit les deux, puis nomme l'échec qui a motivé l'attention.

## Le concept

**TextCNN**Les jetons sont intégrés.`k`La convolutions 1D glissent un filtre sur une suite `k`-grammes d'embeddings, produisant une carte de fonctionnalités. le maximum global de pooling sur cette carte choisit l'activation la plus forte.

Pourquoi cela fonctionne-t-il ? un filtre est un n-gramme apprenable. le max-pooling est position-invariant, donc " pas bon " déclenche la même fonction au début ou au milieu d'un examen. trois largeurs de filtre avec 100 filtres chacun vous donne 300 détecteurs de n-gramme apprises.

**RNN.**À chaque étape .`t`, l' état caché `h_t = f(W * x_t + U * h_{t-1} + b)`Partager`W`- Je suis là .`U`- Je suis là .`b`L'état caché dans le temps.`T`est un résumé de l'ensemble du préfixe.`h_1 ... h_T`(maximum, moyen ou dernier).

Les RNN simples souffrent de dégradations qui disparaissent.**LSTM**Il ajoute des portes qui décident de ce qu'il faut oublier, de ce qu'il faut stocker et de ce qu'il faut sortir, stabilisant les gradients à travers de longues séquences.**GRU**simplifie le LSTM à deux portes; fonctionne de manière similaire avec moins de paramètres.

**Bidirectional RNNs**chaque token voit à la fois le contexte gauche et droit. essentiel pour l'étiquetage des tâches.

```figure
rnn-unroll
```

## Faites-le

### Étape 1: TextCNN en pyTorch

```python
import torch
import torch.nn as nn
import torch.nn.functional as F


class TextCNN(nn.Module):
    def __init__(self, vocab_size, embed_dim, n_classes, filter_widths=(2, 3, 4), n_filters=64, dropout=0.3):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.convs = nn.ModuleList([
            nn.Conv1d(embed_dim, n_filters, kernel_size=k)
            for k in filter_widths
        ])
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(n_filters * len(filter_widths), n_classes)

    def forward(self, token_ids):
        x = self.embed(token_ids).transpose(1, 2)
        pooled = []
        for conv in self.convs:
            c = F.relu(conv(x))
            p = F.max_pool1d(c, c.size(2)).squeeze(2)
            pooled.append(p)
        h = torch.cat(pooled, dim=1)
        return self.fc(self.dropout(h))
```

Le `transpose(1, 2)`réformations `[batch, seq_len, embed_dim]`à `[batch, embed_dim, seq_len]`Parce que`nn.Conv1d`Les données de sortie sont de taille fixe, quelle que soit la longueur de l'entrée.

### Étape 2: Classificateur LSTM

```python
class LSTMClassifier(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, n_classes, bidirectional=True, dropout=0.3):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, batch_first=True, bidirectional=bidirectional)
        factor = 2 if bidirectional else 1
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(hidden_dim * factor, n_classes)

    def forward(self, token_ids):
        x = self.embed(token_ids)
        out, _ = self.lstm(x)
        pooled = out.max(dim=1).values
        return self.fc(self.dropout(pooled))
```

Pour la classification, le maximum-pooling est généralement supérieur à prendre l'ultime état caché parce que les informations à la fin d'une longue séquence ont tendance à dominer l'ultime état.

### Étape 3: la démo du gradient de disparition (intuition)

Un RNN simple sans gate ne peut pas apprendre les dépendances à long terme.`A`Il est apparu n'importe où dans une séquence.`A`Si la position 1 est à la position 1 et que la séquence est de 100 jetons, le gradient de la perte doit se dérouler à travers 99 multiplications du poids récurrent. Si le poids est inférieur à 1, le gradient disparaît.

```python
def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    import math
    return math.pow(recurrent_weight, seq_len)


# At weight=0.9 over 100 steps:
#   0.9 ^ 100 ≈ 2.7e-5
# The gradient from step 100 to step 1 is effectively zero.
```

Les LSTMs la corrigent avec un **cell state**Les GRU font quelque chose de similaire avec moins de paramètres. Les deux vous donnent une formation stable à travers 100+ séquences d'étapes.

### Étape 4: pourquoi cela n'était pas suffisant

Trois problèmes persistaient même avec les LSTM.

1. **Sequential bottleneck.**La formation d'un RNN sur une séquence de longueur 1000 nécessite 1000 étapes en série vers l'avant/retour.
2. **Fixed-size context vector in encoder-decoder setups.**Le décodeur ne voit que l'état caché final de l'encodeur, comprimé sur l'ensemble de l'entrée. Les entrées longues perdent les détails.
3. **Distant-dependency accuracy ceiling.**Les LSTM dépassent les RNN simples mais ont encore du mal à propager des informations spécifiques sur plus de 200 étapes.

L'attention a résolu les trois transformateurs ont complètement abandonné la récurrence leçon 10 est le pivot

## Utilisez-le

Le PyTorch's `nn.LSTM`- Je suis là .`nn.GRU`, et `nn.Conv1d`Le code de formation est standard.

Embracer les navires face intégrations prétrainées que vous branchez comme la couche d'entrée:

```python
from transformers import AutoModel

encoder = AutoModel.from_pretrained("bert-base-uncased")
for param in encoder.parameters():
    param.requires_grad = False


class BertCNN(nn.Module):
    def __init__(self, n_classes, filter_widths=(2, 3, 4), n_filters=64):
        super().__init__()
        self.encoder = encoder
        self.convs = nn.ModuleList([nn.Conv1d(768, n_filters, kernel_size=k) for k in filter_widths])
        self.fc = nn.Linear(n_filters * len(filter_widths), n_classes)

    def forward(self, input_ids, attention_mask):
        with torch.no_grad():
            out = self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        x = out.transpose(1, 2)
        pooled = [F.max_pool1d(F.relu(conv(x)), kernel_size=conv(x).size(2)).squeeze(2) for conv in self.convs]
        return self.fc(torch.cat(pooled, dim=1))
```

Liste de contrôle de l'utilisation quand il convient.

- **Edge / on-device inference.**TextCNN avec GloVe est 10 à 100 fois plus petit qu'un transformateur.
- **Streaming / online classification.**RNN traite un jeton à la fois; les transformateurs ont besoin de la séquence complète. Pour le texte entrant en temps réel, les LSTM gagnent toujours.
- **Tiny models for baselines.**Une nouvelle tâche est rapide, entraînez un TextCNN en 5 minutes sur un processeur.
- **Sequence labeling with limited data.**BiLSTM-CRF (leçon 06) est toujours une architecture NER de qualité de production pour les phrases étiquetées 1k-10k.

Tout le reste va à un transformateur.

## La faire partir

- Je ne sais pas .`outputs/prompt-text-encoder-picker.md`- Le numéro de la liste:

```markdown
---
name: text-encoder-picker
description: Pick a text encoder architecture for a given constraint set.
phase: 5
lesson: 08
---

Given constraints (task, data volume, latency budget, deploy target, compute budget), output:

1. Encoder architecture: TextCNN, BiLSTM, BiLSTM-CRF, transformer fine-tune, or "use a pretrained transformer as a frozen encoder + small head".
2. Embedding input: random init, GloVe / fastText frozen, or contextualized transformer embeddings.
3. Training recipe in 5 lines: optimizer, learning rate, batch size, epochs, regularization.
4. One monitoring signal. For RNN/CNN models: attention mechanism absence means they miss long-range deps; check per-length accuracy. For transformers: fine-tuning collapse if LR too high; check train loss.

Refuse to recommend fine-tuning a transformer when data is under ~500 labeled examples without showing that a TextCNN / BiLSTM baseline has plateaued. Flag edge deployment as needing architecture-before-everything.
```

## Exercices

1. **Easy.**Exercer un TextCNN sur un ensemble de données de jouets de 3 classes (vous inventez les données). Vérifiez que les largesses du filtre (2, 3, 4) dépassent en moyenne une largeur unique (3) de F1.
2. **Medium.**Implémenter le pool max, le pool moyen et le pool de dernier état pour le classifiateur LSTM. Comparer sur un petit ensemble de données; document qui gagne le pooling et hypothésier pourquoi.
3. **Hard.**Construisez un tagger NER BiLSTM-CRF (combine la leçon 06 et celle-ci).

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| TextCNN | CNN for text | Stack of 1D convolutions over word embeddings with global max-pool. Kim (2014). |
| RNN | Recurrent net | Hidden state updated at each time step: `h_t = f(W x_t + U h_{t-1})`. |
| LSTM | Gated RNN | Adds input / forget / output gates + a cell state. Trains stably through long sequences. |
| GRU | Simpler LSTM | Two gates instead of three. Similar accuracy, fewer parameters. |
| Bidirectional | Both directions | Forward + backward RNN concatenated. Every token sees both sides of its context. |
| Vanishing gradient | Training signal dies | Repeated multiplication by <1 weights in plain RNNs makes early-step gradients effectively zero. |

## Pour en savoir plus

- [Kim, Y. (2014). Convolutional Neural Networks for Sentence Classification](https://arxiv.org/abs/1408.5882)Le journal TextCNN, 8 pages, lisible.
- [Hochreiter, S. and Schmidhuber, J. (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf)Le papier LSTM, une lueur inattendue.
- [Olah, C. (2015). Understanding LSTM Networks](https://colah.github.io/posts/2015-08-Understanding-LSTMs/) les diagrammes qui ont rendu les LSTM accessibles à tous.
