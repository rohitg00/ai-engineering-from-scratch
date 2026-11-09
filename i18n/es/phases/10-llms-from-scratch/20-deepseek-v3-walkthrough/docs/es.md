# Profundización de la arquitectura de DeepSeek-V3

> Fase 10 · Lección 14 nombró los seis botones arquitectónicos que cada modelo abierto gira. DeepSeek-V3 (diciembre de 2024, 671B parámetros totales, 37B activos) vuelve a los seis y añade cuatro más: Atención Latente Multi-Head, equilibrio de carga auxiliar sin pérdida, Predicción Multi-Token y entrenamiento DualPipe. Esta lección lee la arquitectura de DeepSeek-V3 de arriba a abajo y deriva cada número de parámetros de la configuración publicada. Al final, puede explicar por qué la relación 671B/37B es la apuesta correcta y por qué MLA + MoE juntos vencen a uno solo en la frontera.

**Type:** Learn
**Languages:** Python (stdlib, parameter calculator), Rust
**Prerequisites:** Phase 10 · 14 (open-model walkthroughs), Phase 10 · 17 (NSA), Phase 10 · 18 (MTP), Phase 10 · 19 (DualPipe)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Lea la configuración de DeepSeek-V3 de arriba a abajo y explique cada campo en términos de los seis botones GPT-2 más cuatro adiciones específicas de DeepSeek.
- Derivar el conteo total de parámetros (671B), el conteo de parámetros activos (37B) y los componentes que contribuyen a cada uno.
- Computa la huella de caché KV de MLA en un contexto de 128k y compara con lo que pagaría un modelo densamente activo con GQA.
- Indique las cuatro innovaciones específicas de DeepSeek (MLA, MTP, enrutamiento auxiliar sin pérdidas, DualPipe) y nombre qué parte de la pila de arquitectura/entrenamiento se destina a cada una.

## El problema

DeepSeek-V3 es el primer modelo abierto de frontera cuya arquitectura es significativamente diferente de la familia Llama. Llama 3 405B es "GPT-2 con seis botones girados". DeepSeek-V3 es GPT-2 con los seis botones más cuatro más. La lectura de la configuración de Llama 3 es una calienta para leer la configuración de DeepSeek, pero la estructura profunda  la forma del bloque de atención, la lógica de enrutamiento, el objetivo del tiempo de entrenamiento  es lo suficientemente diferente como para que necesites un paso por separado.

La arquitectura es el modelo que muchas carreras de entrenamiento 2026 están copiando. Comprenderlo es una apuesta de mesa para cualquier papel que toque el entrenamiento de LLM fronterizo o la inferencia.

## El concepto

### El núcleo invariante, otra vez

DeepSeek-V3 sigue siendo autorregresista. Aún apila bloques de decodificación. Cada bloque todavía tiene atención más MLP más dos RMSNorms. Aún utiliza SwiGLU en el MLP. Aún utiliza RoPE. Pre-norma. Embedings ligados por peso. La misma línea de base que cada Llama o Mistral.

### El giro: MLA en lugar de GQA

Desde la Fase 10 · 14 se sabe que GQA reduce la caché KV compartiendo K y V entre grupos de cabezas Q. La Atención Latente Multi-Capa (MLA) va más allá: K y V se comprimen en una representación latente compartida de bajo rango (la `kv_lora_rank`La caché KV almacena sólo el latente  típicamente 512 floats por token por capa, no 8 x 128 = 1024 floats.

En el contexto de 128k, DeepSeek-V3 con MLA (una latencia compartida `c^{KV}`por token por capa; K y V son ambos derivados de este latente a través de proyecciones ascendentes que pueden ser absorbidas en el matmul subsecuente):

```
kv_cache = num_layers * kv_lora_rank * max_seq_len * bytes_per_element
         = 61 * 512 * 131072 * 2
         = 7.6 GB
```

Un hipotético nivel de base de GQA (forma de Llama 3 70B, cabezas de 8 KV, cabeza de 128) pagaría:

```
kv_cache = 2 * 61 * 8 * 128 * 131072 * 2
         = 30.5 GB
```

MLA es 4 veces más pequeño que un caché GQA estilo Llama-3-70B en contexto de 128k.

El compromiso: MLA agrega un paso de descompresión por cálculo de atención (por cabeza). El cálculo adicional es pequeño en comparación con el ancho de banda guardado.

### El enrutamiento: equilibrio de carga sin pérdidas auxiliares

Los routers de MoE deciden qué expertos top-k procesan cada token. Un router ingenuo concentra demasiado trabajo en unos pocos expertos, dejando a otros en marcha.

DeepSeek-V3 introduce un esquema auxiliar sin pérdidas.`e`se sobrecarga, disminuye `bias_e`Si está subcargado, aumenta. No hay tiempo extra de pérdida. El entrenamiento se mantiene limpio.

Efecto en la pérdida principal: ninguna medible. Efecto en la arquitectura de MoE: limpiador, sin hiperparámetro de pérdida auxiliar para ajustar.

### El MTP: formación más densa + plan libre

Desde la Fase 10 · 18 se sabe que DeepSeek-V3 agrega el módulo D=1 MTP que predice las dos posiciones del token hacia adelante. En la inferencia, el módulo entrenado se reutiliza como un borrador de descifrado especulativo con una aceptación de 80% +. En el entrenamiento, cada estado oculto se supervisa en objetivos D+1 = 2, proporcionando una señal más densa.

Parámetros: 14B en la parte superior del 671B principal.

### El entrenamiento: DualPipe

Desde la Fase 10 · 19 sabes que DualPipe es un tubo bidireccional que se superpone hacia adelante y hacia atrás con trozos de comunicaciones transversales todo a todo. En la escala de 2,048-H800 de DeepSeek-V3, recupera aproximadamente 245k horas de GPU que 1F1B habría perdido a las burbujas de tubería.

### El config, campo por campo

Aquí está la configuración de DeepSeek-V3 (simplificada):

```
hidden_size: 7168
intermediate_size: 18432   (dense MLP hidden size, used on first few layers)
moe_intermediate_size: 2048 (expert MLP hidden size)
num_hidden_layers: 61
first_k_dense_layers: 3    (first 3 layers use dense MLP)
num_attention_heads: 128
num_key_value_heads: 128   (formally equal to num_heads under MLA, but
                           the real compression is in kv_lora_rank)
kv_lora_rank: 512          (MLA latent dimension)
num_experts: 256            (MoE expert count per block)
num_experts_per_tok: 8      (top-8 routing)
shared_experts: 1           (always-on shared expert per block)
max_position_embeddings: 163840
rope_theta: 10000.0
vocab_size: 129280
mtp_module: 1               (1 MTP module at depth 1)
```

- ¿Qué quieres decir ?

- `hidden_size=7168`: dimensiones de incorporación.
- `num_hidden_layers=61`: profundidad total del bloque.
- `first_k_dense_layers=3`Los primeros 3 bloques utilizan un MLP denso de tamaño 18432.
- `num_attention_heads=128`: 128 cabezas de consulta.
- `kv_lora_rank=512`: K y V se comprimen hasta esta dimensión latente y se descomprimen por cabeza.
- `num_experts=256, num_experts_per_tok=8`Cada bloque de MoE cuenta con 256 expertos, rutas de los 8 primeros.
- `shared_experts=1`En el caso de los 256, cada token tiene un "planche denso" que garantiza que cada token obtenga algo confiable.
- `moe_intermediate_size=2048`El tamaño oculto de cada experto en MLP es menor que el denso MLP porque hay 256 de ellos.

### Contabilidad de parámetros

El cálculo completo se realiza en`code/main.py`El titular:

- Incluir: `vocab * hidden = 129280 * 7168 = ~0.93B`¿ Qué ?
- Los primeros 3 bloques densos: atención con MLA (~84M por bloque en el recuento simplificado de la calculadora) + MLP SwiGLU denso (`3 * 7168 * 18432 = ~396M`El número de personas que han recibido las ayudas de la Comisión es de 1,4% en el total.
- 58 bloques de la MOE: atención con MLA (~84M) + 256 expertos enrutados (`3 * 7168 * 2048 = ~44M`El proyecto de investigación de la Comisión de Investigación y Tecnología (EIT) se ha desarrollado en el marco de la investigación de la investigación de la investigación y de la investigación de la investigación de la tecnología de la información.
- Modulo MTP: el módulo publicado es 14B. La calculadora utiliza un stand-in denso de ~0,8B.

El punto de control de Hugging Face es 685B porque agrega el módulo 14B MTP en la parte superior del 671B. La brecha restante del 1% proviene de simplificaciones: la calculadora omite las dimensiones RoPE descopladas en MLA, la cabeza de salida desatada y algunos pequeños tensores.

Parámetros activos por prospecto:

- Atención: 84M por capa * 61 = ~5,1B (todas las capas se incendian).
- Actividad de la PLM: las primeras 3 capas densas (`3 * 396M = ~1.2B`), 58 capas de EMS cada una activa con 8 enrutados + 1 experto compartido (`9 * 44M = ~396M`Por capa, ~23B total.
- Incluir + normas: ~ 0,9B.
- Total activo: ~30B desde la calculadora frente al 37B publicado. La mayor parte de la brecha es la atención: MLA completo, con sus dimensiones RoPE y más amplias consultas y cabezas de llave, es mayor que el conteo simplificado.

### La relación 671B / 37B

El modelo DeepSeek-V3 es el modelo de MoE de frontera más escasa que ha enviado pesos abiertos. Mixtral 8x7B en la relación 13/47 (28%) es mucho más denso. Llama 4 Maverick en la relación 17B/400B (4.25%) es comparable. La apuesta de DeepSeek: en la escala de frontera, más expertos con menor índice de activación produce una mejor calidad por FLOP activo.

### Donde se encuentra DeepSeek-V3

| Model | Total | Active | Ratio | Attention | Novel ideas |
|-------|------|-------|-------|-----------|-------------|
| Llama 3 70B | 70B | 70B | 100% | GQA 64/8 | — |
| Llama 4 Maverick | 400B | 17B | 4.25% | GQA | — |
| Mixtral 8x22B | 141B | 39B | 27% | GQA | — |
| DeepSeek V3 | 671B | 37B | 5.5% | MLA 512 | MLA + MTP + aux-free + DualPipe |
| Qwen 2.5 72B | 72B | 72B | 100% | GQA 64/8 | YaRN extension |

### El seguimiento: R1, V4

DeepSeek-R1 (2025) es una carrera de entrenamiento de razonamiento en la columna vertebral V3. R1 utiliza la misma arquitectura. Lo que cambió fue la receta post-entrenamiento (RL a gran escala en tareas verificables), no la arquitectura pre-entrenamiento.

Se espera que DeepSeek-V4 (si se envía) mantenga MLA + MoE + MTP y agregue DSA (DeepSeek Sparse Attention), el sucesor de la NSA desde la Fase 10 · 17. El linaje es estable: se acumulan innovaciones a nivel de arquitectura; cada versión gira botones adicionales.

```figure
moe-routing
```

## Usalo

`code/main.py`Es la calculadora de parámetros especializada en la forma de DeepSeek-V3. ejecutarla, compararla con los números del papel y usarla en variantes hipotéticas (256 expertos vs. 512, top-8 vs. top-16, MLA rank 512 vs. 1024).

Qué ver:

- Conto total de parámetros vs. 671B publicado.
- Conto de parámetros activos vs. publicado 37B.
- El caché KV en contexto 128k  la comparación MLA vs GQA.
- Desglose por capa para ver dónde va el presupuesto de parámetros en realidad.

## Envío

Esta lección produce`outputs/skill-deepseek-v3-reader.md`. Dado un modelo de la familia DeepSeek (V3, R1 o cualquier variante futura), produce una lectura de arquitectura componente por componente que nombra cada campo de la configuración, deriva los recuentos de parámetros por componente e identifica cuál de las cuatro innovaciones específicas de DeepSeek utiliza el modelo.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`- Compare la estimación del parámetro total de la calculadora con la 671B publicada y identifique de dónde proviene el delta.

2. Modifique la configuración para usar el rango de MLA 256 en lugar de 512. Compute el tamaño de caché KV resultante en un contexto de 128k. ¿Qué porcentaje de reducción compra, y a qué costo para la expresividad por cabeza?

3. Comparar el enrutamiento de DeepSeek-V3 (256 expertos, top-8) con una variante hipotética (512 expertos, top-8). Los parámetros totales crecen; los parámetros activos permanecen iguales. ¿Qué compra la capacidad de expertos extra en teoría, y cuánto cuesta en la inferencia?

4. Lea la sección 2.1 del informe técnico de DeepSeek-V3 (arXiv:2412.19437) sobre MLA. Explique en tres frases por qué las matrices de descompresión K y V pueden ser "absorbidas" en el matmul posterior para la eficiencia del tiempo de inferencia.

5. DeepSeek-V3 utiliza el entrenamiento FP8 para la mayoría de las operaciones. Calcule el ahorro de memoria de FP8 vs BF16 para almacenar los pesos de 671B. ¿Cómo se intersecta esto con el presupuesto de entrenamiento de tokens 14.8T?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MLA | "Multi-Head Latent Attention" | Compress K and V into a shared low-rank latent (kv_lora_rank, typically 512), decompress per head on-the-fly; KV cache stores only the latent |
| kv_lora_rank | "MLA compression dim" | The size of the shared latent for K and V; DeepSeek-V3 uses 512 |
| First k dense layers | "Early layers stay dense" | The first few MoE-model layers skip the MoE router and run a dense MLP for stability |
| num_experts_per_tok | "Top-k routing" | How many routed experts fire per token; DeepSeek-V3 uses 8 |
| Shared experts | "Always-on experts" | Experts that process every token regardless of routing; DeepSeek-V3 uses 1 |
| Auxiliary-loss-free routing | "Bias-adjusted load balance" | Per-expert bias terms adjusted during training to keep expert load balanced without adding a loss term |
| MTP module | "Extra prediction head" | Transformer block predicting $t+2$ from $h^{(1)}$ and $E(t+1)$; denser training, free speculative-decoding draft |
| DualPipe | "Bidirectional pipeline" | Training schedule that overlaps forward/backward compute with cross-node all-to-all |
| Active parameter ratio | "Sparsity" | active_params / total_params; DeepSeek-V3 hits 5.5% |
| FP8 training | "8-bit training" | Training storage and many compute ops in FP8; roughly halves memory vs BF16 at a small quality cost |

## Leer más

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) el documento completo de arquitectura, formación y resultados
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) archivos de configuración y notas de implementación
- [DeepSeek-V2 paper (arXiv:2405.04434)](https://arxiv.org/abs/2405.04434) el predecesor que introdujo MLA
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) el sucesor de la formación en razonamiento sobre la arquitectura de V3
- [Native Sparse Attention (arXiv:2502.11089)](https://arxiv.org/abs/2502.11089) la dirección futura de la atención familiar de DeepSeek
- [DualPipe repository](https://github.com/deepseek-ai/DualPipe) la referencia del programa de formación
