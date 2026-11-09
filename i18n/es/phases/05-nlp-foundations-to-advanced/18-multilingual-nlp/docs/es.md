# PNL multilingüe

> Un modelo, más de 100 idiomas, cero datos de capacitación para la mayoría de ellos. La transferencia translingüística es el milagro práctico de la década de 2020.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 04 (GloVe, FastText, Subword), Phase 5 · 11 (Machine Translation)
**Time:** ~45 minutes

## El problema

El inglés tiene miles de millones de ejemplos etiquetados. El urdu tiene miles. El maithili casi no tiene ninguno. Cualquier sistema práctico de NLP que sirva a un público global tiene que trabajar en la larga cola de idiomas donde no existen datos de capacitación específicos de tareas.

Los modelos multilingües resuelven esto entrenando a un modelo en muchos idiomas simultáneamente. La representación compartida permite que el modelo transfiera las habilidades aprendidas en lenguas de alto recurso a las de bajo recurso. Al ajustar el modelo en el análisis de sentimiento inglés, produce sorprendentemente buenas predicciones de sentimiento en urdu fuera de la caja. Eso es transferencia interlingual de tiro cero, y ha remodelado la forma en que la PNL se transmite al mundo.

Esta lección menciona los compromisos, los modelos canónicos y la única decisión que hace que los equipos nuevos a la labor multilingüe: elegir un idioma fuente para la transferencia.

## El concepto

![Cross-lingual transfer via shared multilingual embedding space](../assets/multilingual.svg)

**Shared vocabulary.**Los modelos multilingües utilizan un tokenizador SentencePiece o WordPiece entrenado en texto de todos los idiomas objetivo. El vocabulario es compartido: la misma unidad de subpalabra representa el mismo morfema en todos los idiomas relacionados. `anti-`en inglés e italiano obtiene la misma señal.

**Shared representation.**Un transformador preentrenado en el modelado de lenguaje enmascarado en muchos idiomas aprende que oraciones semánticamente similares en diferentes idiomas producen estados ocultos similares. mBERT, XLM-R y NLLB todos lo muestran.

**Zero-shot transfer.**La etiqueta de la lengua de destino no es necesaria. Los resultados son fuertes para idiomas tipológicamente relacionados y más débiles para los distantes.

**Few-shot fine-tuning.**Añadir 100-500 ejemplos etiquetados en el idioma objetivo. La precisión salta al 95-98% de la línea de base en inglés en las tareas de clasificación. Esta es la palanca más rentable en la PNL multilingüe.

## Los modelos

| Model | Year | Coverage | Notes |
|-------|------|----------|-------|
| mBERT | 2018 | 104 languages | Trained on Wikipedia. First practical multilingual LM. Weak on low-resource. |
| XLM-R | 2019 | 100 languages | Trained on CommonCrawl (much larger than Wikipedia). Sets the cross-lingual baseline. Base 270M, Large 550M. |
| XLM-V | 2023 | 100 languages | XLM-R with 1M-token vocabulary (vs 250k). Better on low-resource. |
| mT5 | 2020 | 101 languages | T5 architecture for multilingual generation. |
| NLLB-200 | 2022 | 200 languages | Meta's translation model; includes 55 low-resource languages. |
| BLOOM | 2022 | 46 languages + 13 programming | Open 176B LLM trained multilingually. |
| Aya-23 | 2024 | 23 languages | Cohere's multilingual LLM. Strong on Arabic, Hindi, Swahili. |

Seleccionar por caso de uso. La clasificación funciona bien con la base XLM-R como el predeterminado razonable. Las tareas de generación requieren mT5 o NLLB dependiendo de la traducción vs generación abierta. Los pares de trabajo de estilo LLM con Aya-23 o Claude utilizando una solicitud multilingüe explícita.

## La decisión sobre el lenguaje fuente (2026 investigación)

La mayoría de los equipos usan por defecto el inglés como fuente de ajuste fino.

La similitud lingüística predice la calidad de transferencia mejor que el tamaño del cuerpo crudo. Para los objetivos eslavos, el alemán o el ruso a menudo vencen al inglés.**qWALS**La métrica de similitud (2026, basada en las características del Atlas Mundial de Estructuras Lingüísticas) cuantifica esto. **LANGRANK**(Lin et al., ACL 2019) es un método separado y anterior que clasifica a los idiomas fuente candidatos a partir de una combinación de similitud lingüística, tamaño del cuerpo y relación genética.

Regla práctica: si tu idioma objetivo tiene un tipo de parente de alto recurso, intenta ajustarlo primero, y luego compártale con el inglés.

```figure
n5-crosslingual-bridge
```

## Construye el mismo

### Paso 1: Clasificación interlingüística de vuelo cero

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

tok = AutoTokenizer.from_pretrained("joeddav/xlm-roberta-large-xnli")
model = AutoModelForSequenceClassification.from_pretrained("joeddav/xlm-roberta-large-xnli")


def classify(text, candidate_labels, hypothesis_template="This text is about {}."):
    scores = {}
    for label in candidate_labels:
        hypothesis = hypothesis_template.format(label)
        inputs = tok(text, hypothesis, return_tensors="pt", truncation=True)
        with torch.no_grad():
            logits = model(**inputs).logits[0]
        entail_score = torch.softmax(logits, dim=-1)[2].item()
        scores[label] = entail_score
    return dict(sorted(scores.items(), key=lambda x: -x[1]))


print(classify("I love this product!", ["positive", "negative", "neutral"]))
print(classify("मुझे यह उत्पाद पसंद है!", ["positive", "negative", "neutral"]))
print(classify("J'adore ce produit !", ["positive", "negative", "neutral"]))
```

Un modelo, tres idiomas, la misma API. XLM-R entrenado en NLI transferen datos bien a la clasificación a través del truco de implicación.

### Paso 2: espacio de incorporación multilingüe

```python
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

pairs = [
    ("The cat is sleeping.", "Le chat dort."),
    ("The cat is sleeping.", "El gato está durmiendo."),
    ("The cat is sleeping.", "Die Katze schläft."),
    ("The cat is sleeping.", "The dog is barking."),
]

for eng, other in pairs:
    emb_eng = model.encode([eng], normalize_embeddings=True)[0]
    emb_other = model.encode([other], normalize_embeddings=True)[0]
    sim = float(np.dot(emb_eng, emb_other))
    print(f"  {eng!r} <-> {other!r}: cos={sim:.3f}")
```

Las traducciones se acercan en el espacio de incorporación. Una oración en inglés diferente se ubica más lejos. Esto es lo que hace que la recuperación, agrupamiento y similitud interlingual funcionen.

### Paso 3: Estrategia de ajuste fino de pocos disparos

```python
from transformers import TrainingArguments, Trainer
from datasets import Dataset


def few_shot_finetune(base_model, base_tokenizer, examples):
    ds = Dataset.from_list(examples)

    def tokenize_fn(ex):
        out = base_tokenizer(ex["text"], truncation=True, max_length=128)
        out["labels"] = ex["label"]
        return out

    ds = ds.map(tokenize_fn)
    args = TrainingArguments(
        output_dir="out",
        per_device_train_batch_size=8,
        num_train_epochs=5,
        learning_rate=2e-5,
        save_strategy="no",
    )
    trainer = Trainer(model=base_model, args=args, train_dataset=ds)
    trainer.train()
    return base_model
```

Para 100-500 ejemplos de idiomas objetivo, `num_train_epochs=5`y `learning_rate=2e-5`Las tasas de aprendizaje más altas causan que la alineación multilingüe colapse y obtienes un modelo solo en inglés.

## Evaluación que realmente funcione

- **Per-language accuracy on held-out sets.**No agregado, el agregado esconde la cola larga.
- **Benchmark against monolingual baseline.**Para los idiomas con suficientes datos, un modelo monolingüe entrenado desde cero a veces supera al multilingüe.
- **Entity-level tests.**Las entidades denominadas en el idioma objetivo. Los modelos multilingües a menudo tienen una débil tokenización para escrituras lejos del latín.
- **Cross-lingual consistency.**El mismo significado en dos idiomas debería producir la misma predicción.

## Usalo

La pila de 2026:

| Task | Recommended |
|-----|-------------|
| Classification, 100 languages | XLM-R-base (~270M) fine-tuned |
| Zero-shot text classification | `joeddav/xlm-roberta-large-xnli` |
| Multilingual sentence embeddings | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| Translation, 200 languages | `facebook/nllb-200-distilled-600M` (see lesson 11) |
| Generative multilingual | Claude, GPT-4, Aya-23, mT5-XXL |
| Low-resource language NLP | XLM-V or a domain-specific fine-tune on related high-resource language |

Siempre presupuestemos para ajustar el idioma objetivo si el rendimiento es importante.

### El impuesto a la tokenización (qué va mal para los idiomas de bajos recursos)

Los modelos multilingües comparten un tokenizer en todos sus idiomas. Ese vocabulario se entrena en un corpus dominado por inglés, francés, español, chino, alemán. Para cualquier lengua fuera del conjunto dominante, tres impuestos se componen silenciosamente:

- **Fertility tax.**Un texto de lenguaje de bajo recurso se traduce en mucho más tokens por palabra que en inglés. Una frase en hindi puede necesitar 3-5 veces los tokens de una frase en inglés equivalente.
- **Variant recovery tax.**Cada error de tipografía, variante diacrítica, desajuste de normalización de Unicode o variación de caso se convierte en una secuencia no relacionada a frío en el espacio de incorporación.
- **Capacity spillover tax.**Los impuestos 1 y 2 consumen posiciones de contexto, profundidad de capa y dimensiones de incorporación. Lo que queda para el razonamiento real es sistemáticamente más pequeño que lo que un lenguaje de alto recurso obtiene del mismo modelo.

El síntoma práctico: su modelo se entrena normalmente en hindi, la curva de pérdida se ve correcta, la perplejidad de evaluación se ve razonable, y los resultados de producción son sutilmente incorrectos. La morfología se derrumba a mediados de la oración. Las inflexiones raras permanecen irrecuperables. **You cannot data-scale your way out of a broken tokenizer.**

Mitigación: elegir un tokenizer con buena cobertura para su lenguaje objetivo (el vocabulario de tokens 1M de XLM-V es una solución directa); verificar la fertilidad de la tokenización en el texto objetivo retenido antes del entrenamiento; utilizar fallback a nivel de byte (SentencePiece `byte_fallback=True`, GPT-2-style byte-level BPE) para scripts de verdadera cola larga, así que nada es OOV.

## Envío

Salvo como`outputs/skill-multilingual-picker.md`¿Qué es esto ?

```markdown
---
name: multilingual-picker
description: Pick source language, target model, and evaluation plan for a multilingual NLP task.
version: 1.0.0
phase: 5
lesson: 18
tags: [nlp, multilingual, cross-lingual]
---

Given requirements (target languages, task type, available labeled data per language), output:

1. Source language for fine-tuning. Default English; check LANGRANK or qWALS if target language has a typologically close high-resource language.
2. Base model. XLM-R (classification), mT5 (generation), NLLB (translation), Aya-23 (generative LLM).
3. Few-shot budget. Start with 100-500 target-language examples if available. Zero-shot only if labeling is infeasible.
4. Evaluation plan. Per-language accuracy (not aggregate), cross-lingual consistency, entity-level F1 on non-Latin scripts.

Refuse to ship a multilingual model without per-language evaluation — aggregate metrics hide long-tail failures. Flag scripts with low tokenization coverage (Amharic, Tigrinya, many African languages) as needing a model with byte-fallback (SentencePiece with byte_fallback=True, or byte-level tokenizer like GPT-2).
```

## Los ejercicios

1. **Easy.**Ejecutar la línea de clasificación de disparos cero en 10 frases por idioma en inglés, francés, hindi y árabe. Informar la precisión en cada uno. Usted debe ver fuerte francés, hindi decente, árabe variable.
2. **Medium.**Usar`paraphrase-multilingual-MiniLM-L12-v2`Para obtener información sobre los datos de los usuarios, se debe utilizar el código de acceso de los usuarios para crear un retriever interlingual sobre un pequeño corpus de idiomas mixtos.
3. **Hard.**Comparar el ajuste de fuente de inglés y fuente de hindi para una tarea de clasificación de hindi. Utilice 500 ejemplos de idioma objetivo para ajuste de pocas tomas bajo ambos regímenes. Reporte qué fuente produce una mejor precisión de hindi y en cuánto. Esta es la tesis LANGRANK en miniatura.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Multilingual model | One model, many languages | Shared vocabulary and parameters across languages. |
| Cross-lingual transfer | Train on one language, run on another | Fine-tune on source, evaluate on target without target-language labels. |
| Zero-shot | No target-language labels | Transfer without fine-tuning on the target language. |
| Few-shot | Small target labels | 100-500 target-language examples used for fine-tuning. |
| mBERT | First multilingual LM | 104-language BERT pretrained on Wikipedia. |
| XLM-R | Standard cross-lingual baseline | 100-language RoBERTa pretrained on CommonCrawl. |
| NLLB | Meta's 200-language MT | No Language Left Behind. Includes 55 low-resource languages. |

## Leer más

- [Conneau et al. (2019). Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116) el papel XLM-R.
- [Pires, Schlinger, Garrette (2019). How Multilingual is Multilingual BERT?](https://arxiv.org/abs/1906.01502) el documento de análisis que inició la línea de investigación sobre transferencias translinguinas.
- [Costa-jussà et al. (2022). No Language Left Behind](https://arxiv.org/abs/2207.04672) Documento de la NLLB-200.
- [Üstün et al. (2024). Aya Model: An Instruction Finetuned Open-Access Multilingual Language Model](https://arxiv.org/abs/2402.07827)Aya, el LLM multilingüe de Cohere.
- [Language Similarity Predicts Cross-Lingual Transfer Learning Performance (2026)](https://www.mdpi.com/2504-4990/8/3/65) el documento de lenguaje fuente QWALS / LANGRANK.
