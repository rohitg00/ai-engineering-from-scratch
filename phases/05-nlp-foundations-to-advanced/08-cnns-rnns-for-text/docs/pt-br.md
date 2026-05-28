# CNNs e RNNs pra Texto

> Convoluções aprendem n-gramas. Recorrências lembram. Ambos foram superados por attention. Ambos ainda importam em hardware restrito.

**Tipo:** Construção
**Linguagens:** Python
**Pré-requisitos:** Fase 3 · 11 (Introdução ao PyTorch), Fase 5 · 03 (Word Embeddings), Fase 4 · 02 (Convoluções do Zero)
**Tempo:** ~75 minutos

## O Problema

TF-IDF e Word2Vec produziram vetores planos que ignoravam ordem de palavras. Um classificador construído sobre eles não conseguia diferenciar `dog bites man` de `man bites dog`. Ordem de palavras às vezes carrega o sinal.

Duas famílias de arquiteturas preencheram essa lacuna antes de transformers chegarem.

**Redes convolucionais pra texto (TextCNN).** Aplica convoluções 1D sobre sequências de embeddings de palavras. Um filtro de largura 3 é um detector de trigramas aprendível: percorre três palavras e gera um score. Empilha larguras diferentes (2, 3, 4, 5) pra detectar padrões multiescala. Max-pool pra uma representação de tamanho fixo. Plano, paralelo, rápido.

**Redes recorrentes (RNN, LSTM, GRU).** Processam tokens um de cada vez, mantendo um estado oculto que leva informação adiante. Sequenciais, com memória, comprimentos de entrada flexíveis. Dominaram modelagem de sequência de 2014 a 2017, depois attention aconteceu.

Essa lição constrói ambas, depois nomeia a falha que motivou attention.

## O Conceito

**TextCNN** (Kim, 2014). Tokens são embedados. Uma convolução 1D de largura `k` desliza um filtro sobre `k`-gramas consecutivos de embeddings, produzindo um feature map. Max-pooling global sobre esse mapa escolhe a ativação mais forte. Concatena saídas de max-pool de várias larguras de filtro. Alimenta uma cabeça de classificação.

Por que funciona. Um filtro é um n-grama aprendível. Max-pooling é invariante de posição, então "not good" ativa a mesma feature no início ou no meio de uma resenha. Três larguras de filtro com 100 filtros cada dão 300 detectores de n-grama aprendidos. Treino é paralelo; sem dependência sequencial.

**RNN.** Em cada passo de tempo `t`, o estado oculto `h_t = f(W * x_t + U * h_{t-1} + b)`. Compartilha `W`, `U`, `b` no tempo. O estado oculto no tempo `T` é um resumo de todo o prefixo. Pra classificação, faz pool sobre `h_1 ... h_T` (máximo, médio ou último).

RNNs simples sofrem de gradientes que desaparecem. A **LSTM** adiciona gates que decidem o que esquecer, o que armazenar e o que sair, estabilizando gradientes através de longas sequências. A **GRU** simplifica a LSTM pra dois gates; performa similarmente com menos parâmetros.

**RNNs bidirecionais** rodam uma RNN pra frente e outra pra trás, concatenando estados ocultos. A representação de cada token vê o contexto de ambos os lados. Essencial pra tarefas de tagging.

## Construindo

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

O `transpose(1, 2)` remodela `[batch, seq_len, embed_dim]` pra `[batch, embed_dim, seq_len]` porque `nn.Conv1d` trata o eixo do meio como canais. A saída de pooling é de tamanho fixo independente do comprimento de entrada.

### Passo 2: classificador LSTM

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

Max-pool sobre a sequência, não pooling do último estado. Pra classificação, max-pooling geralmente ganha de pegar o último estado oculto porque informação no final de uma sequência longa tende a dominar o último estado.

### Passo 3: a demonstração do gradiente que desaparece (intuição)

Uma RNN simples sem gating não consegue aprender dependências de longo alcance. Considere uma tarefa de brinquedo: prever se o token `A` apareceu em algum lugar numa sequência. Se `A` está na posição 1 e a sequência tem 100 tokens, o gradiente do loss tem que voltar por 99 multiplicações do peso recorrente. Se o peso é menor que 1, o gradiente desaparece. Se maior que 1, explode.

```python
def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    import math
    return math.pow(recurrent_weight, seq_len)


# Com peso=0.9 em 100 passos:
#   0.9 ^ 100 ≈ 2.7e-5
# O gradiente do passo 100 ao passo 1 é efetivamente zero.
```

LSTMs corrigem isso com um **estado de célula** que percorre a rede com apenas interações aditivas (o gate de esquecimento escala multiplicativamente, mas gradientes ainda fluem pela "estrada"). GRUs fazem algo similar com menos parâmetros. Ambos dão treino estável através de sequências de 100+ passos.

### Passo 4: por que isso ainda não bastava

Três problemas persistiram mesmo com LSTMs.

1. **Gargalo sequencial.** Treinar uma RNN numa sequência de comprimento 1000 requer 1000 passos sequenciais forward/backward. Não paraleliza no tempo.
2. **Vetor de contexto de tamanho fixo em setups encoder-decoder.** O decoder vê apenas o último estado oculto do encoder, comprimido sobre toda a entrada. Entradas longas perdem detalhe. Lição 09 cobre isso diretamente.
3. **Teto de acurácia em dependências distantes.** LSTMs superam RNNs simples mas ainda lutam pra propagar informação específica por 200+ passos.

Attention resolveu tudo. Transformers eliminaram recorrência. Lição 10 é a virada.

## Usando

`nn.LSTM`, `nn.GRU`, e `nn.Conv1d` do PyTorch são prontos pra produção. Código de treino é padrão.

Hugging Face traz embeddings pré-treinados que você pluga como camada de entrada:

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

Lista de verificação "quando se encaixa na restrição":

- **Inferência em borda/dispositivo.** TextCNN com embeddings GloVe é 10-100x menor que um transformer. Se seu alvo de deploy é um celular, essa é a stack.
- **Classificação em streaming/online.** RNN processa um token por vez; transformers precisam da sequência completa. Pra texto em tempo real, LSTMs ainda ganham.
- **Modelos pequenos pra baselines.** Iteração rápida em tarefa nova. Treina um TextCNN em 5 minutos num CPU.
- **Rotulação de sequência com dados limitados.** BiLSTM-CRF (lição 06) ainda é uma arquitetura NER de grau de produção pra 1k-10k frases rotuladas.

Tudo o mais vai pra um transformer.

## Entregando

Salve como `outputs/prompt-text-encoder-picker.md`:

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

1. **Fácil.** Treine um TextCNN num dataset de brinquedo de 3 classes (você inventa os dados). Verifique que larguras de filtro (2, 3, 4) superam largura única (3) em F1 médio.
2. **Médio.** Implemente max-pool, mean-pool e pooling de último estado pro classificador LSTM. Compare num dataset pequeno; documente qual pooling ganha e hipotetize por quê.
3. **Difícil.** Construa um tagger NER BiLSTM-CRF (combine lição 06 e essa). Treine em CoNLL-2003. Compare com o baseline CRF-sozinho da lição 06 e com um fine-tune de BERT. Reporte tempo de treino, memória e F1.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|------|-----------------|-----------------------|
| TextCNN | CNN pra texto | Pilha de convoluções 1D sobre embeddings de palavras com max-pool global. Kim (2014). |
| RNN | Rede recorrente | Estado oculto atualizado a cada passo de tempo: `h_t = f(W x_t + U h_{t-1})`. |
| LSTM | RNN com gates | Adiciona gates de entrada/esquecimento/saída + estado de célula. Treina estavelmente em sequências longas. |
| GRU | LSTM simplificada | Dois gates em vez de três. Precisão similar, menos parâmetros. |
| Bidirecional | Ambas direções | RNN forward + backward concatenada. Cada token vê ambos os lados de seu contexto. |
| Gradiente que desaparece | Sinal de treino morre | Multiplicação repetida por pesos <1 em RNNs simples torna gradientes de passos iniciais efetivamente zero. |

## Leitura Complementar

- [Kim, Y. (2014). Convolutional Neural Networks for Sentence Classification](https://arxiv.org/abs/1408.5882) — o paper TextCNN. Oito páginas. Legível.
- [Hochreiter, S. and Schmidhuber, J. (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf) — o paper LSTM. Surpreendentemente claro.
- [Olah, C. (2015). Understanding LSTM Networks](https://colah.github.io/posts/2015-08-Understanding-LSTMs/) — os diagramas que tornaram LSTMs acessíveis pra todo mundo.
