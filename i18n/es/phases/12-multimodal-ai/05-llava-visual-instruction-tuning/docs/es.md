# LLaVA y ajuste de instrucciones visuales

> La LAVA (abril 2023) es la arquitectura multimodal más copiada del planeta. Remplazó el Q-Former de BLIP-2 con un MLP de 2 capas, reemplazó la atención cruzada cerrada de Flamingo con una concatenation token ingenua y entrenó en 158k giros de instrucción visual generados por GPT-4 a partir de títulos de texto. Cualquier practicante que construyó un VLM entre 2023 y 2026 construyó alguna variante de LLaVA. LLaVA-1.5 cambió en un proyector MLP y un codificador de 336px. LLaVA-NeXT añadió un revestimiento AnyRes para la entrada de alta resolución. LLaVA-OneVision imagen unificada, multi-imagen y video en una sola receta. Esta lección lee la receta, aplica el proyector y explica por qué "el más simple ganó".

**Type:** Build
**Languages:** Python, TypeScript (stdlib, projector + instruction-template builder)
**Prerequisites:** Phase 12 · 02 (CLIP), Phase 11 (LLM Engineering — instruction tuning)
**Time:** ~180 minutes

## Objetivos de aprendizaje

- Construir un proyector MLP de 2 capas que mapee las incorporaciones de parches ViT (dim 1024) a las incorporaciones de un LLM (dim 4096).
- Siga la receta de dos etapas de LLaVA: (1) alineación del proyector en 558k pares de captura, (2) sintonización de instrucciones visuales en 158k giros generados por GPT-4.
- Construye un prompt en formato LLaVA con el marcador de lugar de la imagen, el prompt del sistema y los giros de usuario/asistente.
- Explica por qué la comunidad se trasladó de Q-Former a MLP a pesar de la victoria de Q-Former en el presupuesto de tokens.

## El problema

El Q-Former de BLIP-2 (Lección 12.03) comprime una imagen a 32 tokens. Limpio, eficiente, bueno para los puntos de referencia. Pero tiene dos problemas.

En primer lugar, el Q-Former es entrenable pero su pérdida no es la tarea final. La etapa 1 entrena a ITC+ITM+ITG. La etapa 2 entrena a la pérdida de LM. Las consultas aprenden alguna representación intermedia que el LLM luego tiene que descifrar.

En segundo lugar, el Q-Former toma 188 millones de parámetros, y en la escala de 2023 de LLaVA tuviste que co-diseñarlo con tu LLM objetivo. Cambia el LLM, retraina el Q-Former. Cambia el codificador de visión, retraina. Cada combinación fue un proyecto de I + D separado.

La respuesta de LLaVA fue embarazosa en su simplicidad: tomar los 576 tokens de parches del ViT, pasar cada uno a través de una MLP de 2 capas (`1024 → 4096 → 4096`No hay cuello de botella, no hay etapa 1 de preentrenamiento en objetivos extraños, sólo entrenar al MLP en una pérdida directa de LM.

¿De dónde provienen los datos? La segunda visión de LLaVA: utilizar GPT-4 (solo texto) para generar datos de instrucciones.

El resultado: un VLM que corrió en 8 A100 durante un día, venció a Flamingo en MMMU, y envió un puesto de control abierto que la comunidad podría extender. A finales de 2023 había engendrado más de 50 tenedores.

## El concepto

### La arquitectura

LLaVA-1.5 en 7B:
- Encodrador de visión: CLIP ViT-L/14 @ 336 (congelado durante la etapa 1, opcionalmente descongelado en la etapa 2).
- Proyector: MLP de 2 capas con activación GELU, `1024 → 4096 → 4096`¿ Qué ?
- LLM: Vicuna-7B v1.5 (una variante 13B utiliza Vicuna-13B; más tarde las tenedores se trasladaron a Llama-3.1-8B).

Pasar hacia adelante una imagen + texto de la solicitud:

```
img -> ViT -> 576 patches of dim 1024
patches -> MLP -> 576 tokens of dim 4096
prompt: system + "<image>" placeholder + user question
replace <image> token with the 576 projected tokens
feed the full sequence to the LLM
decode response
```

La imagen ocupa 576 tokens del contexto LLM. En 2048 contexto, eso deja 1472 tokens para el texto.

### Etapa 1: Alineación del proyector

Freeze ViT. Freeze LLM. Entrenar sólo el MLP de 2 capas. Dataset: 558k pares de imagen-capción (LAION-CC-SBU).

En una sola época en lote 128 esto se hace en unas pocas horas. El proyector aprende a mapear el espacio ViT al espacio LLM.

### Etapa 2: ajuste de instrucciones visuales

Deshielo del proyector (todavía se puede entrenar). Deshielo del LLM (generalmente completamente, a veces LoRA). Entrenamiento en 158k vueltas de instrucción visual.

Los datos de instrucciones son el truco.
1. Toma una imagen de COCO.
2. Extraer la descripción del texto (5 subtítulos humanos + lista de cuadro de límite).
3. Envía a GPT-4 con tres plantillas de solicitud:
   - Conversación: "Generar un diálogo entre un usuario y un asistente sobre esta imagen".
   - Descripción detallada: "Dá una descripción rica y detallada de la imagen".
   - Razonamiento complejo: "Pregúntale una pregunta que requiera razonamiento sobre la imagen, y luego contestela".
4. Parse la salida de GPT-4 en pares (instrucción, respuesta).

Nada de esto toca directamente a la imagen  sólo la descripción del texto. GPT-4 alucina el contenido de imagen plausible.

### ¿Por qué la comunidad copió esto?

- No hay pérdidas específicas de la etapa 1, pérdida de LM en todo.
- El proyector se pone en horas, no días.
- El LLM puede ser intercambiado (LLaVA-Llama2, LLaVA-Mistral, LLaVA-Llama3) mediante la reeducación del proyector.
- La tubería de datos de instrucción visual utiliza GPT-4 y es barata para regenerarse para un nuevo dominio.

### LLaVA-1.5 y LLaVA-NeXT

El artículo 1 del Reglamento (UE) n.o 1095/2013 se modifica en el anexo I del Reglamento (UE) n.o 1095/2013.
- Datos de tareas académicas (VQA, OKVQA, RefCOCO) mezclados en la sintonización de instrucciones.
- Mejor sistema de inmediato.
- Un proyector MLP de 2 capas en lugar de la capa lineal original, y CLIP ViT-L/14 en 336px (576 tokens) en lugar de 224px (256 tokens).
- Una variante de HD que divide la rejilla en el periódico, que LLaVA-NeXT envió más tarde como AnyRes.

El proyecto LLaVA-NeXT (enero 2024) añadió:
- AnyRes: dividir imágenes de alta resolución en una cuadrícula de 2x2 o 1x3 de 336x336 cultivos, más una miniatura global de baja resolución. Cada cultivo se convierte en 576 tokens. Una cuadrícula de 2x2 más la miniatura da aproximadamente 2880 tokens visuales por imagen. Una cuadrícula de 1x3 tiene menos cultivos, por lo que cuesta menos tokens.
- Mejor mezcla de datos de instrucciones con ShareGPT4V (capciones GPT-4V de alta calidad).
- Métodos de formación en base más sólida (Mistral-7B, Yi-34B).

### LLaVA-OneVision

Lección 12.08 cubre OneVision en profundidad. versión corta: el mismo proyector, pero entrenado con un plan de estudios que cubre una sola imagen, una imagen múltiple y un video en un modelo con un presupuesto compartido de tokens visuales.

### La comparación con Q-Former

| | Q-Former (BLIP-2) | MLP (LLaVA) |
|---|---|---|
| Visual tokens per image | 32 | 576 (base) or about 2880 (AnyRes, 2x2 grid) |
| Trainable params | 188M + LM | ~22M (7B) + LM |
| Stage 1 loss | ITC+ITM+ITG | LM only |
| LLM drop-in | Requires retrain | Swap with minimal retrain |
| Multi-image | Awkward | Natural (concat) |
| Video | Awkward | Natural (per-frame concat) |
| Token budget | Small | Large |

MLP gana en la simplicidad y la flexibilidad de tokens. Q-Former gana en el presupuesto de tokens. A finales de 2023 el presupuesto de tokens ya no era la restricción vinculante (los contextos LLM crecieron a 32k-128k +) y la simplicidad dominó.

### El formato de la solicitud

```
A chat between a curious human and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the human's questions. USER: <image> Describe this image in detail. ASSISTANT: The image shows ...
```

`<image>`El Tokenizer ve una secuencia ligeramente más larga de la que se entrenó, pero el LLM maneja la entrada nueva porque la etapa 1 la enseñó a hacerlo.

### Economía de parámetros

Desglose de LLaVA-1.5-7B:
- CLIP ViT-L/14 @ 336: 303M (estadio 1 congelado, a menudo no congelado, etapa 2).
- Proyector (2x lineal): ~ 22M de trainabilidad.
- Llama-7B: 7B.
- Total: 7,3B parámetros. Ejercibles durante la etapa 2: proyector completo 7B + 22M.

El costo de entrenamiento para la etapa 2: ~ 20 horas en 8xA100. Este es el número clave  un día, un nodo, reproducible.

```figure
mm-llava-projector
```

## Usalo

`code/main.py`los instrumentos:

1. El proyector MLP de 2 capas (dim 16 → 32 → 32 para la escala de juguete) en Python puro.
2. El sistema de construcción rápida: sistema rápido + `<image>`sustituidos por N tokens proyectados + turno de usuario + marcador de generación de asistentes.
3. Un visualizador de cómo se ve el bloque visual de 576 tokens en el contexto de LLM (porcentaje de 2k / 32k / 128k contexto consumido).

## Envío

Esta lección produce`outputs/skill-llava-vibes-eval.md`. Dado que el punto de control de la familia LLaVA, se ejecuta una suite de vibraciones de 10 pulsaciones (3 subtítulos, 3 VQA, 2 razonamientos, 2 rechazos) y se informa de una tarjeta de puntuación legible por el ser humano.

## Los ejercicios

1. Calcule el recuento de parámetros de formación para el proyector MLP de 2 capas en `1024 → 4096 → 4096`Con GELU y sesgo, ¿qué fracción de LLaVA-13B representa?

2. Construir una solicitud de LLaVA para un caso de "rechazo"  la imagen contiene un individuo privado. Escribir la respuesta de asistente esperada. ¿Por qué debería LLaVA rechazar este tiro cero y qué datos de capacitación se necesitarían para reforzar la negativa?

3. Lea la sección AnyRes del blog LLaVA-NeXT. Compute el recuento de tokens visuales para una imagen de 1344x672 en AnyRes. Compara con 576 tokens de base en 336x336.

4. El proyector LLaVA etapa 1 está entrenado con pérdida de LM en los títulos. ¿Qué sucede si se salta la etapa 1 y se va directamente a la etapa 2 (la sintonización de instrucciones visuales)?

5. LLaVA-Instruct-150k utiliza GPT-4 con capciones COCO para generar instrucciones. Para un nuevo dominio (rayos X médicos, imágenes satelitales), describa la tubería de datos de cuatro pasos para generar instrucciones de dominio. ¿Qué podría salir mal en cada paso?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Projector | "MLP bridge" | 2-layer MLP with GELU mapping ViT dim to LLM dim |
| Image token | "<image> placeholder" | Prompt marker replaced by N projected visual tokens before inference |
| Visual instruction tuning | "LLaVA stage 2" | Training on GPT-4-generated (image, instruction, response) triplets |
| Stage 1 alignment | "Projector pretraining" | Freeze ViT and LLM, train projector with LM loss on captions |
| AnyRes | "Multi-crop tiling" | Split high-res image into a tile grid and concatenate each tile's visual tokens |
| LLaVA-Instruct | "GPT-4-generated" | 158k instruction-response pairs synthesized from COCO captions + GPT-4 |
| Vision encoder freeze | "Backbone locked" | CLIP weights do not update in stage 1, sometimes not in stage 2 either |
| ShareGPT4V | "Better captions" | 1M dense captions generated by GPT-4V, used for higher-quality alignment |
| VQA | "Visual question answering" | Task of answering a free-form question about an image |
| Prismatic VLMs | "Design-space paper" | Karamcheti 2024 ablation systematically testing projector and data choices |

## Leer más

- [Liu et al. — Visual Instruction Tuning (arXiv:2304.08485)](https://arxiv.org/abs/2304.08485) el papel LLaVA.
- [Liu et al. — Improved Baselines with Visual Instruction Tuning (arXiv:2310.03744)](https://arxiv.org/abs/2310.03744) LLaVA-1.5.
- [Chen et al. — ShareGPT4V (arXiv:2311.12793)](https://arxiv.org/abs/2311.12793) conjunto de datos de encabezados densos.
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865) Ablaciones de diseño y espacio.
- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326) Unificado de una sola imagen, de varias imágenes, de vídeo.
