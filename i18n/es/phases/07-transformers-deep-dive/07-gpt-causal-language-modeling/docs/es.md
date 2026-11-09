# GPT  Modelado del lenguaje causal

> BERT ve ambos lados. GPT sólo ve el pasado. La máscara triangular es la línea de código más consecuente en la IA moderna.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT)
**Time:** ~75 minutes

## El problema

Un modelo de lenguaje responde a una pregunta: dado el primer `t-1`Tokens, ¿cuál es la distribución de probabilidades sobre token `t`Entrenar en esa señal  predicción de token siguiente  y usted obtiene un modelo que puede generar texto arbitrario un token a la vez.

Para entrenarlo de extremo a extremo en una secuencia completa en paralelo, se necesita que la predicción de cada posición dependa sólo de posiciones anteriores.

La máscara causal hace esto. Es una matriz triangular superior única de`-inf`Los valores añadidos a las puntuaciones de atención antes de softmax. Después de softmax, esas posiciones se convierten en 0. Cada posición puede atender solo a sí misma y a las posiciones anteriores. Y porque se aplica una vez a toda la secuencia, se obtienen N paralelos de pronóstico de token siguiente en un pase hacia adelante.

GPT-1 (2018), GPT-2 (2019), GPT-3 (2020), GPT-4 (2023), GPT-5 (2025), Claude, Llama, Qwen, Mistral, DeepSeek, Kimi  son todos transformadores causales solo para decodificadores con el mismo bucle central. Lo que los separa son la calidad de los datos, la escala y los refinamientos arquitectónicos, y el post-entrenamiento (SFT, RLHF, DPO y sus sucesores).

## El concepto

![Causal mask creates a triangular attention matrix](../assets/causal-attention.svg)

### La máscara

Dado una secuencia de longitud $N$, construir un$N \times N$matriz:

```math
M_{ij} = \begin{cases} 0 & \text{if } j \le i \\ -\infty & \text{if } j > i \end{cases}
```

Añadir`M`a las puntuaciones de atención antes de softmax. $\exp(-\infty) = 0$Cada fila de la matriz de atención es una distribución de probabilidades sobre posiciones anteriores.

Costo de ejecución: uno `torch.tril()`Llamadas, tiempo de cálculo, nanosegundos, impacto en el campo, todo.

### De donde viene el triángulo

La máscara se presenta generalmente como un parche enlazado en la atención. ejecuta la derivación en la otra dirección y deja de ser misteriosa: la atención es el tercer refinamiento de un promedio prefijo, y el triángulo es los límites de bucle de ese promedio, escrito como una matriz.

**Stage 1 — prefix average.**El resumen causal más estúpido de una secuencia: posición .$i$se convierte en el promedio de posiciones $0 \ldots i$Como un bucle, eso es`out[i] = X[:i+1].mean(0)`El mismo cálculo es una matriz multiplicar. Tomar una matriz triangular inferior de uno, dividir cada fila por su conteo, multiplicar:

```python
import numpy as np

A = np.tril(np.ones((n, n)))
A = A / A.sum(axis=1, keepdims=True)
out = A @ X
```

Redacción$i$de $A$¿ Es verdad ?$[1/(i+1), \ldots, 1/(i+1), 0, \ldots, 0]$Los ceros por encima de la diagonal son la causalidad. Nada sobre el futuro fue ocultado; el futuro nunca fue en la suma.

**Stage 2 — learned weights.**Un promedio uniforme trata cada token pasado como igualmente relevante.`S`Ahora las filas ya no suman a uno por construcción, así que normaliza cada fila con softmax en lugar de dividir por el recuento. Softmax nunca saca un cero exacto, lo que rompe la causalidad  a menos que las puntuaciones futuras entren como `-inf`, porque`exp(-inf) = 0`¿Qué es esto ?

```python
def softmax(x, axis):
    e = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return e / e.sum(axis=axis, keepdims=True)

S = S + np.triu(np.full((n, n), -np.inf), k=1)
A = softmax(S, axis=1)
out = A @ X
```

El mismo triángulo, la misma matriz de filasestocásticas, la misma matmul.`-inf`La máscara no es una nueva maquinaria.

**Stage 3 — content-dependent weights.**En la etapa 2, `S`La posición 7 siempre pesa la misma posición 3, sea cual sea el significado de los tokens.`S = Q @ K.T / sqrt(d_k)`No hay nada más que cambie.

Tres etapas, una invariante: una matriz de fila-estocástica triangular inferior por la secuencia. promedio uniforme, pesos estáticos aprendidos, pesos dependientes del contenido. La máscara nunca se añadió a la atención.

```figure
mask-derivation
```

### Formación paralela, inferencia en serie

Formación: adelantar todo `(N, d_model)`Se calcula N pérdidas de entropía cruzada (una por posición), suma, backprop. Paralelas a lo largo de la secuencia.

Inferencia: generas token por token.`[t1, t2, t3]`¿ Qué ?`t4`- Alimentación .`[t1, t2, t3, t4]`¿ Qué ?`t5`- Alimentación .`[t1, t2, t3, t4, t5]`¿ Qué ?`t6`El caché KV (lección 12) guarda los estados ocultos de `t1…tn`Así que no los recompite cada paso. Pero la profundidad en serie en la inferencia = longitud de salida. Ese es el impuesto autoregresivista y por qué la descifrado es el cuello de botella de latencia de cada LLM.

### La pérdida  cambio por uno

Se le dan tokens `[t1, t2, t3, t4]`¿Qué es esto ?

- Entrada: `[t1, t2, t3]`
- Objetivos: `[t2, t3, t4]`

Para cada posición .`i`, computación `-log P(target_i | inputs[:i+1])`Esta es la entropía cruzada de toda la secuencia.

Cada transformador LM que hayas oído hablar de trenes en esta pérdida. Pre-entrenamiento, ajuste fino, SFT  misma pérdida, datos diferentes.

### Estrategias de decodificación

Después de la formación, las opciones de muestreo son más importantes de lo que la gente piensa.

| Method | What it does | When to use |
|--------|--------------|-------------|
| Greedy | Argmax every step | Deterministic tasks, code completion |
| Temperature | Divide logits by T, sample | Creative tasks, higher T = more diversity |
| Top-k | Sample from top-k tokens only | Kills low-probability tails |
| Top-p (nucleus) | Sample from smallest set with cumulative prob ≥ p | 2020+ default; adapts to distribution shape |
| Min-p | Keep tokens with `p > min_p * max_p` | 2024+; better at rejecting long tails than top-p |
| Speculative decoding | Draft model proposes N tokens, big model verifies | 2–3× latency reduction at same quality |

En 2026, min-p + temperatura 0,7 es un defecto razonable para los modelos de pesos abiertos.

### ¿Qué hizo que funcionara la "recepta de GPT"

1. **Decoder-only.**No hay codificador en la carga.
2. **Scaling.**124M → 1.5B → 175B → billones. Las leyes de escala de Chinchilla (lección 13) te dicen cómo gastar computación.
3. **In-context learning.**Surgió alrededor de 6B13B. El modelo puede seguir algunos ejemplos de disparos sin ajuste fino.
4. **RLHF.**La formación posterior sobre las preferencias humanas convirtió el texto crudo pre-entrenado en asistentes de chat.
5. **Pre-norm + RoPE + SwiGLU.**Entrenamiento estable a escala.

La arquitectura central no ha cambiado mucho desde el GPT-2. Todo lo interesante ha sucedido en datos, escala y post-entrenamiento.

```figure
causal-mask
```

## Construye el mismo

### Paso 1: la máscara causal

¿ Qué ?`code/main.py`Un solo en línea:

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

Añade a las puntuaciones de atención antes de la máxima.

### Paso 2: un modelo de GPT de dos capas

Coloque dos bloques de decodificación (autoatención enmascarada + FFN, sin atención cruzada). Agregue una incorporación de token, una codificación posicional y una desincorporación (atado a la matriz de incorporación de token  un truco estándar desde GPT-2).

### Paso 3: Previsión de la próxima señal, de extremo a extremo

En una vocabulario de juguete de 20 tokens, produzca logits en cada posición. Calcule la pérdida de entropía cruzada contra el objetivo de cambio por uno.

### Paso 4: muestreo

Implemente codiciosas, temperatura, top-k, top-p, min-p. ejecuta cada una en un prompt fijo y compara las salidas. Una función de muestreo es de 10 líneas.

## Usalo

PyTorch, 2026 Idioma:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")
tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")

prompt = "Attention is all you need because"
inputs = tok(prompt, return_tensors="pt")
out = model.generate(
    **inputs,
    max_new_tokens=64,
    temperature=0.7,
    top_p=0.9,
    do_sample=True,
)
print(tok.decode(out[0]))
```

Bajo la capucha,`generate()`ejecuta el pase hacia adelante, tira de los logits de posición final, muestra el siguiente token, lo añade y repite. Cada pila de inferencias LLM de producción (vLLM, TensorRT-LLM, llama.cpp, Ollama, MLX) implementa el mismo bucle con gran optimización  preempleo en lote, batch continuo, paging de caché KV, descodificación especulativa.

**GPT vs BERT, one line each:**Las predicciones del GPT $P(x_t \mid x_{<t})$- BERT predice .$P(x_{\text{masked}} \mid x_{\text{unmasked}})$La pérdida determina si el modelo puede generar.

## Envío

¿ Qué ?`outputs/skill-sampling-tuner.md`La habilidad selecciona parámetros de muestreo para una tarea de nueva generación y señala cuando se requiere una decodificación determinista.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`y comprobar que la matriz de atención causal es triangular inferior después de softmax.
2. **Medium.**Compare la perplejidad de la viga 4 con la codicia en 10 preguntas cortas. ¿La viga siempre gana? (sugerencia: generalmente para la traducción, no para el chat abierto).
3. **Hard.**Implemente una descifrado especulativo: utilice un modelo de 2 capas pequeño como el borrador y un modelo de 6 capas como el verificador.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Causal mask | "The triangle" | Upper-triangular `-inf` matrix added to attention scores so position `i` only sees positions `≤ i`. |
| Next-token prediction | "The loss" | Cross-entropy of the model's distribution against the true next token at every position. |
| Autoregressive | "Generate one at a time" | Feed output back as input; parallelism only during training, not during generation. |
| Logits | "Pre-softmax scores" | Raw output of the LM head before softmax; sampling happens on these. |
| Temperature | "Creativity knob" | Divide logits by $T$; $T \to 0$ = greedy, $T \to \infty$ = uniform. |
| Top-p | "Nucleus sampling" | Truncate distribution to smallest set summing to $\ge p$; sample from what remains. |
| Min-p | "Better than top-p" | Keep tokens where `p ≥ min_p × max_p`; adapts cutoff to sharpness of distribution. |
| Speculative decoding | "Draft + verify" | Cheap model proposes N tokens; big model verifies in parallel. |
| Teacher forcing | "Training trick" | During training, feed the true previous token, not the model's prediction. Standard for every seq2seq LM. |

## Leer más

- [Radford et al. (2018). Improving Language Understanding by Generative Pre-Training](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) GPT-1.
- [Radford et al. (2019). Language Models are Unsupervised Multitask Learners](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) GPT-2.
- [Brown et al. (2020). Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165) GPT-3 y aprendizaje en contexto.
- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) Papel de decodificación de especificaciones.
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) código de referencia causal-LM canónico.
