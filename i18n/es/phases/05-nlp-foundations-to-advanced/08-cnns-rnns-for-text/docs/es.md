# CNNs y RNNs para texto

> Las convoluciones aprenden n-gramos. las repeticiones recuerdan. ambas son reemplazadas por la atención. ambas siguen siendo importantes en hardware limitado.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 11 (PyTorch Intro), Phase 5 · 03 (Word Embeddings), Phase 4 · 02 (Convolutions from Scratch)
**Time:** ~75 minutes

## El problema

TF-IDF y Word2Vec producen vectores planos que ignoran el orden de palabras.`dog bites man`de la`man bites dog`El orden de palabras a veces lleva la señal.

Dos familias de arquitecturas llenaron ese vacío antes de que llegaran los transformadores.

**Convolutional nets for text (TextCNN).**Aplicar convulsiones 1D sobre secuencias de incorporaciones de palabras. Un filtro de ancho 3 es un detector de trigramas aprendizable: abarca tres palabras y saca una puntuación. Apila diferentes anchos (2, 3, 4, 5) para detectar patrones de múltiples escalas.

**Recurrent nets (RNN, LSTM, GRU).**Procesar tokens uno a la vez, manteniendo un estado oculto que transporta la información hacia adelante. Secuenciales, con capacidad de memoria, comprimentos de entrada flexibles.

Esta lección construye ambos, y luego nombra el fracaso que motivó la atención.

## El concepto

**TextCNN**Los tokens se incorporan.`k`La convolución 1D desliza un filtro en forma consecutiva `k`-gramos de embebidos, que producen un mapa de características. Global max-pooling sobre ese mapa elige la activación más fuerte. Concatenate max-pooled salidas de varios filtros anchos. alimentación a una cabeza de clasificador.

Por qué funciona. Un filtro es un n-gram aprendible. El max-pooling es invariable en posición, por lo que "no bueno" dispara la misma característica al comienzo o a mediados de una revisión. Tres anchos de filtro con 100 filtros cada uno te da 300 detectores de n-gram aprendices. El entrenamiento es paralelo; no hay dependencia secuencial.

**RNN.**En cada paso .`t`, el estado oculto .`h_t = f(W * x_t + U * h_{t-1} + b)`- Compartir .`W`¿ Qué ?`U`¿ Qué ?`b`El estado oculto en el tiempo.`T`Es un resumen de todo el prefijo.`h_1 ... h_T`(máximo, medio o último).

Las RNN simples sufren de desvanecimiento de los gradientes.**LSTM**añade puertas que deciden qué olvidar, qué almacenar y qué sacar, estabilizando los gradientes a través de largas secuencias.**GRU**simplifica el LSTM a dos puertas; funciona de manera similar con menos parámetros.

**Bidirectional RNNs**ejecutar un RNN hacia adelante y otro hacia atrás, concatenando estados ocultos. la representación de cada token ve tanto el contexto izquierdo como el derecho. Es esencial para etiquetar tareas.

```figure
rnn-unroll
```

## Construye el mismo

### Paso 1: TextCNN en PyTorch

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

El `transpose(1, 2)`reformulaciones `[batch, seq_len, embed_dim]`¿ Qué ?`[batch, embed_dim, seq_len]`Porque ...`nn.Conv1d`El eje medio se trata de canales.

### Paso 2: Clasificador LSTM

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

Para la clasificación, el max-pooling suele superar el tomar el último estado oculto porque la información al final de una larga secuencia tiende a dominar el último estado.

### Paso 3: la demostración de gradiente de desaparición (intucción)

Un RNN simple sin gate no puede aprender dependencias a largo alcance.`A`apareció en cualquier parte de una secuencia.`A`Si el gradiente de la pérdida tiene que fluir de nuevo a través de 99 multiplicidades del peso recurrente. si el peso es menor a 1, el gradiente desaparece. si más de 1, explota.

```python
def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    import math
    return math.pow(recurrent_weight, seq_len)


# At weight=0.9 over 100 steps:
#   0.9 ^ 100 ≈ 2.7e-5
# The gradient from step 100 to step 1 is effectively zero.
```

Los LSTMs arreglan esto con un**cell state**Las GRU hacen algo similar con menos parámetros. Ambos te dan un entrenamiento estable a través de 100+ secuencias de pasos.

### Paso 4: por qué esto todavía no era suficiente

Tres problemas persistieron incluso con los LSTM.

1. **Sequential bottleneck.**El entrenamiento de un RNN en una secuencia de longitud 1000 requiere 1000 pasos en serie hacia adelante/hacia atrás.
2. **Fixed-size context vector in encoder-decoder setups.**El decodificador sólo ve el estado oculto final del codificador, comprimido sobre toda la entrada. Las entradas largas pierden detalles. La lección 09 cubre esto directamente.
3. **Distant-dependency accuracy ceiling.**Los LSTM superan a los RNNs comunes pero aún luchan por propagar información específica a través de más de 200 pasos.

La atención resolvió las tres. los transformadores han dejado de recurrir.

## Usalo

El de PyTorch.`nn.LSTM`¿ Qué ?`nn.GRU`, y `nn.Conv1d`El código de entrenamiento es estándar.

Embracing Face naves preentrenadas embeddings que se conecta como la capa de entrada:

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

Lista de control de uso cuando se ajuste a las restricciones.

- **Edge / on-device inference.**TextCNN con GloVe embedded es 10-100 veces más pequeño que un transformador. Si tu objetivo de despliegue es un teléfono, esta es la pila.
- **Streaming / online classification.**RNN procesa un token a la vez; los transformadores necesitan la secuencia completa. Para el texto entrante en tiempo real, los LSTMs aún ganan.
- **Tiny models for baselines.**Una nueva tarea es rápida, entrenar un TextCNN en 5 minutos en una CPU.
- **Sequence labeling with limited data.**BiLSTM-CRF (lección 06) es todavía una arquitectura NER de grado de producción para oraciones etiquetadas 1k-10k.

Todo lo demás va a un transformador.

## Envío

Salvo como`outputs/prompt-text-encoder-picker.md`¿Qué es esto ?

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

## Los ejercicios

1. **Easy.**Entrenar a un TextCNN en un conjunto de datos de juguete de 3 clases (inventas los datos). Verifique que los anchos de filtro (2, 3, 4) superen un solo ancho (3) en promedio a F1.
2. **Medium.**Implemente el pool máximo, el pool medio y el pool de último estado para el clasificador LSTM. Compara en un conjunto de datos pequeño; documento que gana el pool y hipotese por qué.
3. **Hard.**Construye un etiquetado BiLSTM-CRF NER (combina la lección 06 y esta). Entrenar en CoNLL-2003. Compara con la línea de base de CRF sola de la lección 06 y con un ajuste fino de BERT. Informar el tiempo de entrenamiento, la memoria y la F1.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| TextCNN | CNN for text | Stack of 1D convolutions over word embeddings with global max-pool. Kim (2014). |
| RNN | Recurrent net | Hidden state updated at each time step: `h_t = f(W x_t + U h_{t-1})`. |
| LSTM | Gated RNN | Adds input / forget / output gates + a cell state. Trains stably through long sequences. |
| GRU | Simpler LSTM | Two gates instead of three. Similar accuracy, fewer parameters. |
| Bidirectional | Both directions | Forward + backward RNN concatenated. Every token sees both sides of its context. |
| Vanishing gradient | Training signal dies | Repeated multiplication by <1 weights in plain RNNs makes early-step gradients effectively zero. |

## Leer más

- [Kim, Y. (2014). Convolutional Neural Networks for Sentence Classification](https://arxiv.org/abs/1408.5882)El periódico TextCNN, ocho páginas, legible.
- [Hochreiter, S. and Schmidhuber, J. (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf) el papel de LSTM.
- [Olah, C. (2015). Understanding LSTM Networks](https://colah.github.io/posts/2015-08-Understanding-LSTMs/) los diagramas que hicieron que los LSTM fueran accesibles a todos.
