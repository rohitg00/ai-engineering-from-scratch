# Modelos de secuencia a secuencia

> Dos RNNs que pretenden ser traductores, el cuello de botella que se encuentran es la razón por la que existe la atención.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 08 (CNNs + RNNs for Text), Phase 3 · 11 (PyTorch Intro)
**Time:** ~75 minutes

## El problema

La clasificación mapea una secuencia de longitud variable a una sola etiqueta. La traducción mapea una secuencia de longitud variable a otra secuencia de longitud variable. La entrada y salida viven en diferentes vocabularios, posiblemente en diferentes idiomas, sin garantía de paridad de longitud.

La arquitectura seq2seq (Sutskever, Vinyals, Le, 2014) rompió esto con una receta deliberadamente simple. Dos RNNs. Uno lee la oración fuente y produce un vector de contexto de tamaño fijo. El otro lee ese vector y genera el token de la oración objetivo por token.

Esto vale la pena estudiar por dos razones. Primero, el cuello de botella del vector contextual es el fracaso pedagógicamente más útil en la PNL. Motiva todo lo que la atención y los transformadores son buenos en. Segundo, la receta de entrenamiento (el profesor forzado, muestreo programado, búsqueda de haces a la inferencia) todavía se aplica a todos los sistemas modernos de generación, incluidos los LLM.

## El concepto

**Encoder.**Un RNN que lee la frase fuente.**context vector** un resumen de tamaño fijo de toda la entrada.

**Decoder.**Otro RNN iniciado desde el vector de contexto. En cada paso toma el token generado previamente como entrada y produce una distribución sobre el vocabulario objetivo. muestra o argmax para elegir el siguiente token.`<EOS>`se produce el token o se alcanza la longitud máxima.

**Training:**Perdida de entropía cruzada en cada paso del decodificador, sumada a través de la secuencia.

**Teacher forcing.**Durante el entrenamiento, la entrada del decodificador en paso `t`es el símbolo de la verdad de la base en posición`t-1`En el caso de los modelos de los sistemas de cálculo, el método de cálculo de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los cuentas de los valores de los cuentas**exposure bias**¿ Qué ?

**The bottleneck.**Todo lo que el codificador aprendió sobre la fuente debe ser comprimido en ese vector de contexto. Las oraciones largas pierden detalles. Las palabras raras se borran.

La atención (lección 10) corrige esto dejando que el decodificador vea * cada * estado oculto del codificador, no sólo el último.

```figure
lstm-gates
```

## Construye el mismo

### Paso 1: un codificador

```python
import torch
import torch.nn as nn


class Encoder(nn.Module):
    def __init__(self, src_vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embed = nn.Embedding(src_vocab_size, embed_dim, padding_idx=0)
        self.gru = nn.GRU(embed_dim, hidden_dim, batch_first=True)

    def forward(self, src):
        e = self.embed(src)
        outputs, hidden = self.gru(e)
        return outputs, hidden
```

`outputs`tiene forma`[batch, seq_len, hidden_dim]` un estado oculto por posición de entrada. `hidden`tiene forma`[1, batch, hidden_dim]` el paso final. La lección 08 dijo "reunir las salidas para la clasificación". Aquí mantenemos el último estado oculto como el vector de contexto, e ignoramos las salidas por paso.

### Paso 2: un decodificador

```python
class Decoder(nn.Module):
    def __init__(self, tgt_vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embed = nn.Embedding(tgt_vocab_size, embed_dim, padding_idx=0)
        self.gru = nn.GRU(embed_dim, hidden_dim, batch_first=True)
        self.fc = nn.Linear(hidden_dim, tgt_vocab_size)

    def forward(self, token, hidden):
        e = self.embed(token)
        out, hidden = self.gru(e, hidden)
        logits = self.fc(out)
        return logits, hidden
```

El decodificador se llama un paso a la vez. Entrada: un lote de tokens individuales y el estado oculto actual. salida: logs vocabulario para el siguiente token y el estado oculto actualizado.

### Paso 3: ciclo de formación con el profesor forzador

```python
def train_batch(encoder, decoder, src, tgt, bos_id, optimizer, teacher_forcing_ratio=0.9):
    optimizer.zero_grad()
    _, hidden = encoder(src)
    batch_size, tgt_len = tgt.shape
    input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long)
    loss = 0.0
    loss_fn = nn.CrossEntropyLoss(ignore_index=0)

    for t in range(tgt_len):
        logits, hidden = decoder(input_token, hidden)
        step_loss = loss_fn(logits.squeeze(1), tgt[:, t])
        loss += step_loss
        use_teacher = torch.rand(1).item() < teacher_forcing_ratio
        if use_teacher:
            input_token = tgt[:, t].unsqueeze(1)
        else:
            input_token = logits.argmax(dim=-1)

    loss.backward()
    optimizer.step()
    return loss.item() / tgt_len
```

Dos botones que vale la pena nombrar.`ignore_index=0`Salta pérdida en tokens de relleno. `teacher_forcing_ratio`Es la probabilidad de usar el token verdadero frente a la predicción del modelo en cada paso. Comience en 1.0 (forzar al maestro completo) y aneal hacia abajo a ~0.5 durante el entrenamiento para cerrar la brecha de vicio de exposición.

### Paso 4: bucle de inferencia (compulsivo)

```python
@torch.no_grad()
def greedy_decode(encoder, decoder, src, bos_id, eos_id, max_len=50):
    _, hidden = encoder(src)
    batch_size = src.shape[0]
    input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long)
    output_ids = []
    for _ in range(max_len):
        logits, hidden = decoder(input_token, hidden)
        next_token = logits.argmax(dim=-1)
        output_ids.append(next_token)
        input_token = next_token
        if (next_token == eos_id).all():
            break
    return torch.cat(output_ids, dim=1)
```

La codificación codificada elige el token de mayor probabilidad en cada paso. Puede alejarse: una vez que se compromete a un token, no se puede desactivar. **Beam search**Mantendrá el primer...`k`Sequencias parciales vivas y elige el más alto puntaje completo al final.

### Paso 5: el cuello de botella, demostrado

Entrenamiento del modelo en una tarea de copia de juguete: fuente `[a, b, c, d, e]`, objetivo`[a, b, c, d, e]`Aumentar la longitud de la secuencia.

```
seq_len=5   copy accuracy: 98%
seq_len=10  copy accuracy: 91%
seq_len=20  copy accuracy: 62%
seq_len=40  copy accuracy: 23%
```

Un solo estado oculto de GRU no puede memorizar sin pérdidas una entrada de 40 tokens. La información está allí en cada paso del codificador, pero el decodificador solo ve el último estado.

## Usalo

PyTorch tiene `nn.Transformer`y `nn.LSTM`- basado en plantillas de seguimiento.`transformers`La biblioteca de los barcos de modelos de codificación y decodificación completos (BART, T5, mBART, NLLB) entrenados en miles de millones de tokens.

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("facebook/bart-base")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")

src = tok("Translate this to French: Hello, how are you?", return_tensors="pt")
out = model.generate(**src, max_new_tokens=50, num_beams=4)
print(tok.decode(out[0], skip_special_tokens=True))
```

Los codificadores modernos descodificadores dejaron caer RNN para transformadores. La forma de alto nivel (encodificador, decodificador, generar-token-por-token) es idéntica al papel de 2014 seq2seq. El mecanismo dentro de cada bloque es diferente.

### Cuando todavía se puede alcanzar el seq2seq basado en RNN

Casi nunca, para nuevos proyectos.

- Traducción de transmisión donde consumes entrada un token a la vez con memoria limitada.
- Generación de texto en el dispositivo donde el costo de la memoria del transformador es prohibitivo.
- Comprender el cuello de botella del codificador y el decodificador es el camino más rápido para entender por qué ganaron los transformadores.

### El sesgo de exposición y sus mitigantes

- **Scheduled sampling.**La proporción de fuerza del profesor durante la formación para que el modelo aprenda a recuperarse de sus propios errores.
- **Minimum risk training.**Entrenando en la puntuación BLEU de nivel de oración en lugar de la entropía cruzada de nivel de token.
- **Reinforcement learning fine-tuning.**Recompensar el generador de secuencias con una métrica.

Los tres todavía se aplican a la generación basada en transformadores.

## Envío

Salvo como`outputs/prompt-seq2seq-design.md`¿Qué es esto ?

```markdown
---
name: seq2seq-design
description: Design a sequence-to-sequence pipeline for a given task.
phase: 5
lesson: 09
---

Given a task (translation, summarization, paraphrase, question rewrite), output:

1. Architecture. Pretrained transformer encoder-decoder (BART, T5, mBART, NLLB) is the default. RNN-based seq2seq only for specific constraints.
2. Starting checkpoint. Name it (`facebook/bart-base`, `google/flan-t5-base`, `facebook/nllb-200-distilled-600M`). Match the checkpoint to task and language coverage.
3. Decoding strategy. Greedy for deterministic output, beam search (width 4-5) for quality, sampling with temperature for diversity. One sentence justification.
4. One failure mode to verify before shipping. Exposure bias manifests as generation drift on longer outputs; sample 20 outputs at the 90th-percentile length and eyeball.

Refuse to recommend training a seq2seq from scratch for under a million parallel examples. Flag any pipeline that uses greedy decoding for user-facing content as fragile (greedy repeats and loops).
```

## Los ejercicios

1. **Easy.**Implemente la tarea de copia de juguete. Entrenar un GRU seq2seq en pares de entrada y salida donde el objetivo es igual a la fuente. Medir la precisión en longitudes 5, 10, 20. Reproduce el cuello de botella.
2. **Medium.**Añadir la decodificación de búsqueda de haces con ancho de haces 3. Medir el color azul en un corpus paralelo pequeño contra la codicia.
3. **Hard.**- No . - ¿ Qué ?`facebook/bart-base`comparar la salida de haz-4 del modelo ajustado con la del modelo base en entradas retenidas.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder | Input RNN | Reads source. Produces per-step hidden states and a final context vector. |
| Decoder | Output RNN | Initialized from context vector. Generates target tokens one at a time. |
| Context vector | The summary | Final encoder hidden state. Fixed size. The bottleneck attention solves. |
| Teacher forcing | Use true tokens | Feed the ground-truth previous token at training time. Stabilizes learning. |
| Exposure bias | Train/test gap | Model trained on true tokens never practiced recovering from its own mistakes. |
| Beam search | Better decoding | Keep top-k partial sequences alive at each step instead of committing greedily. |

## Leer más

- [Sutskever, Vinyals, Le (2014). Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) el papel original de la secuencia.
- [Cho et al. (2014). Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation](https://arxiv.org/abs/1406.1078) introdujo el GRU y el marco de codificación y decodificación.
- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473)- el papel de atención. Lea inmediatamente después de esta lección.
- [PyTorch NLP from Scratch tutorial](https://pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html) Seq2seq + código de atención.
