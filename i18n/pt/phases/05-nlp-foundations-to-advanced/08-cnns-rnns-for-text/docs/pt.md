# CNNs e RNNs para texto

> As convulsões aprendem n-gramas, as recorrências lembram-se, ambas são substituídas pela atenção, ambas ainda são importantes em hardware limitado.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 11 (PyTorch Intro), Phase 5 · 03 (Word Embeddings), Phase 4 · 02 (Convolutions from Scratch)
**Time:** ~75 minutes

## O problema

O TF-IDF e o Word2Vec produziram vetores planos que ignoraram a ordem das palavras.`dog bites man`de`man bites dog`A ordem das palavras às vezes carrega o sinal.

Duas famílias de arquiteturas preencheram essa lacuna antes que os transformadores chegassem.

**Convolutional nets for text (TextCNN).**Aplique convulsões 1D sobre sequências de incorporações de palavras. Um filtro de largura 3 é um detector de trigramas aprendizagem: ele abrange três palavras e produz uma pontuação. Estacle diferentes largura (2, 3, 4, 5) para detectar padrões em várias escalas. Max-pool para uma representação de tamanho fixo. plano, paralelo, rápido.

**Recurrent nets (RNN, LSTM, GRU).**Processar tokens um a cada vez, mantendo um estado oculto que transporta informações para a frente. Sequenciais, portadores de memória, comprimentos de entrada flexíveis. Modelagem de sequência dominada de 2014 a 2017, então a atenção aconteceu.

Esta lição constrói ambos, e depois nomeia o fracasso que motivou a atenção.

## O conceito

**TextCNN**Os tokens são incorporados.`k`A convolução 1D desliza um filtro em sequência `k`-gramas de embebimentos, produzindo um mapa de características. A max-pooling global sobre esse mapa escolhe a ativação mais forte.

Por que funciona. Um filtro é um n-gram aprendizagem. Max-pooling é invariable de posição, por isso "não bom" dispara a mesma característica no início ou no meio de uma revisão. Três largura de filtro com 100 filtros cada dá-lhe 300 n-gram detetores aprendidos.

**RNN.**A cada passo .`t`, o estado oculto .`h_t = f(W * x_t + U * h_{t-1} + b)`Compartilhar .`W`- Não .`U`- Não .`b`O estado oculto no tempo.`T`Para classificação, pool across `h_1 ... h_T`(máximo, médio ou último).

Os RNNs comuns sofrem de gradientes desaparecendo.**LSTM**Adiciona portões que decidem o que esquecer, o que armazenar e o que produzir, estabilizando gradientes através de longas sequências.**GRU**simplifica o LSTM para dois portões; desempenha de forma semelhante com menos parâmetros.

**Bidirectional RNNs**executar um RNN para frente e outro para trás, concatenando estados ocultos. a representação de cada token vê o contexto esquerdo e direito. essencial para etiquetar tarefas.

```figure
rnn-unroll
```

## Construí-lo

### Passo 1: TextCNN em PyTorch

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

O `transpose(1, 2)`transformações`[batch, seq_len, embed_dim]`- Não .`[batch, embed_dim, seq_len]`Porque ...`nn.Conv1d`O resultado agregado é de tamanho fixo, independentemente da comprimento da entrada.

### Passo 2: Classificador LSTM

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

Para classificação, o max-pooling geralmente supera a tomada do último estado oculto porque a informação no final de uma longa sequência tende a dominar o último estado.

### Passo 3: a demonstração do gradiente de desaparecimento (intuição)

Uma RNN simples sem gating não pode aprender dependências de longo alcance.`A`apareceu em qualquer lugar numa sequência.`A`Se o gradiente for inferior a 1, o gradiente desaparece, se for superior a 1, ele explode.

```python
def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    import math
    return math.pow(recurrent_weight, seq_len)


# At weight=0.9 over 100 steps:
#   0.9 ^ 100 ≈ 2.7e-5
# The gradient from step 100 to step 1 is effectively zero.
```

Os LSTMs corrigem isto com um **cell state**O GRU é um sistema de treinamento que funciona através da rede com apenas interações adicionais (o gate esquece-o multiplicativamente, mas os gradientes ainda fluem ao longo da "autopista").

### Passo 4: por que isso ainda não foi suficiente

Três problemas persistiam mesmo com os LSTMs.

1. **Sequential bottleneck.**O treinamento de um RNN numa sequência de comprimento 1000 requer 1000 passos em série para frente/para trás.
2. **Fixed-size context vector in encoder-decoder setups.**O decodificador vê apenas o estado oculto final do codificador, comprimido sobre toda a entrada. As entradas longas perdem detalhes. A lição 09 abrange isso diretamente.
3. **Distant-dependency accuracy ceiling.**Os LSTMs superam as RNNs comuns, mas ainda têm dificuldade em propagar informações específicas em mais de 200 passos.

A atenção resolveu os três, os transformadores reduziram completamente a recorrência, a lição 10 é o pivô.

## Usá-lo

O PyTorch's `nn.LSTM`- Não .`nn.GRU`, e `nn.Conv1d`O código de formação é padrão.

Embrace Face navios pre-entrenados embutidos que você conectar como a camada de entrada:

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

Lista de verificação de restrições de uso quando se adequar.

- **Edge / on-device inference.**TextCNN com GloVe embutidos é 10-100 vezes menor do que um transformador.
- **Streaming / online classification.**RNN processa um token por vez; transformadores precisam da sequência completa. Para o texto recebido em tempo real, LSTMs ainda ganham.
- **Tiny models for baselines.**Iteração rápida em uma nova tarefa.
- **Sequence labeling with limited data.**BiLSTM-CRF (leção 06) ainda é uma arquitetura NER de nível de produção para frases com rótulos de 1k-10k.

O resto vai para um transformador.

## Envia-o

Salva como`outputs/prompt-text-encoder-picker.md`- Não .

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

## Exercícios

1. **Easy.**Treinar um TextCNN em um conjunto de dados de brinquedos de 3 classes (você invente os dados). Verifique se as largura dos filtros (2, 3, 4) superam uma única largura (3) em média F1.
2. **Medium.**Implementar pool max, pool mean e pool de último estado para o classificador LSTM. Comparar em um pequeno conjunto de dados; documento que o pooling ganha e hipotetizar por quê.
3. **Hard.**Construa um tagger BiLSTM-CRF NER (combine a lição 06 e esta). Treine no CoNLL-2003. Compare com a linha de base CRF-solo da lição 06 e com um ajuste fino do BERT. Relate o tempo de treinamento, a memória e a F1.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| TextCNN | CNN for text | Stack of 1D convolutions over word embeddings with global max-pool. Kim (2014). |
| RNN | Recurrent net | Hidden state updated at each time step: `h_t = f(W x_t + U h_{t-1})`. |
| LSTM | Gated RNN | Adds input / forget / output gates + a cell state. Trains stably through long sequences. |
| GRU | Simpler LSTM | Two gates instead of three. Similar accuracy, fewer parameters. |
| Bidirectional | Both directions | Forward + backward RNN concatenated. Every token sees both sides of its context. |
| Vanishing gradient | Training signal dies | Repeated multiplication by <1 weights in plain RNNs makes early-step gradients effectively zero. |

## Mais leitura

- [Kim, Y. (2014). Convolutional Neural Networks for Sentence Classification](https://arxiv.org/abs/1408.5882)O jornal TextCNN, oito páginas, legível.
- [Hochreiter, S. and Schmidhuber, J. (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf)O papel da LSTM, inesperadamente lúcido.
- [Olah, C. (2015). Understanding LSTM Networks](https://colah.github.io/posts/2015-08-Understanding-LSTMs/) os diagramas que tornaram os LSTMs acessíveis a todos.
