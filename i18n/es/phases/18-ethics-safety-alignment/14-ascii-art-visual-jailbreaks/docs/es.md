# Artística y de las entradas de cárcel visuales de ASCII

> Jiang, Xu, Niu, Xiang, Ramasubramanian, Li, Poovendran, "ArtPrompt: ataques de jailbreak basados en arte ASCII contra LLM alineados" (ACL 2024, arXiv:2402.11753). Enmascarar los tokens relevantes para la seguridad en una solicitud perjudicial, reemplazarlos con renderizaciones ASCII-art de las mismas letras, y enviar el aviso enmascarado. GPT-3.5, GPT-4, Gemini, Claude, Llama-2 no pueden reconocer con fuerza los tokens de arte ASCII. El ataque evita los filtros de perplejidad, las defensas de paráfrases y la retokenización. Relacionado: el índice de referencia ViTC mide el reconocimiento de las instrucciones visuales no semánticas; StructuralSleight generaliza a estructuras codificadas con texto poco comunes (árboles, gráficos, JSON anidados) como una familia de ataques de codificación.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, ArtPrompt token-masking harness)
**Prerequisites:** Phase 18 · 12 (PAIR), Phase 18 · 13 (MSJ)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Describa el ataque ArtPrompt: paso de identificación de palabras, sustitución ASCII-art, último aviso enmascarado.
- Explica por qué las defensas estándar (PPL, Paraphrase, Retokenization) fallan en ArtPrompt.
- Define el VTC y describa lo que mide.
- Describa StructuralSleight como una generalización a estructuras codificadas con texto poco comunes arbitrarias.

## El problema

Los ataques a través de la paráfrase y el juego de roles (lección 12) y a través del contexto largo (lección 13) operan en el patrón a nivel de texto. ArtPrompt opera en el nivel de reconocimiento: el modelo no analiza el token prohibido. analiza una imagen renderizada en caracteres. El filtro de seguridad ve puntuación inofensiva. El modelo ve una palabra.

## El concepto

### ArtPrompt, dos pasos

Paso 1. Identificación de palabras. Dado un pedido dañino, el atacante utiliza un LLM para identificar las palabras relevantes para la seguridad (por ejemplo, "bomba" en "cómo hacer una bomba"). 

Paso 2. Generación de Prompt encubierta. reemplaza cada palabra identificada con su renderización ASCII-art (un bloque de caracteres 7x5 o 7x7 que forman la forma de la letra). El modelo recibe una cuadrícula de puntuación y espacios que un modelo suficientemente capaz puede reconocer como la palabra; un filtro de seguridad sólo ve la cuadrícula.

Resultado: GPT-4, Gemini, Claude, Llama-2, GPT-3.5 todos fallan. tasa de éxito de ataque superior al 75% en su subconjunto de referencia.

### Por qué las defensas estándar fallan

- **PPL (perplexity filter).**El arte ASCII tiene una alta perplejidad  pero también lo hace toda entrada nueva.
- **Paraphrase.**Parafrasear el prompt destruye el arte ASCII. En la práctica, los LLM parafrase a menudo preservan o reconstruyen el arte.
- **Retokenization.**Dividir los tokens de manera diferente no cambia que la visión del modelo es reconocer las formas de letras.

El problema subyacente es que los filtros de seguridad son de nivel token o semántico; ArtPrompt opera en el nivel de reconocimiento visual.

### Indicador de referencia de ViTC

Reconocimiento de las instrucciones visuales no semánticas. Medir la capacidad del modelo para leer ASCII-art, wingdings y otros contenidos visuales no-texto-semánticos. La efectividad de ArtPrompt se correlaciona con la precisión de ViTC: cuanto mejor lee el modelo texto visual, mejor ArtPrompt trabaja en él.

### EstructuralSleight

ArtPrompt generaliza: estructuras codificadas en texto (UTES) poco comunes. árboles, gráficos, JSON anidados, CSV-en-JSON, bloques de código de estilo diferente. Si una estructura es rara en el entrenamiento de datos de seguridad pero puede ser analizada por el modelo, puede ocultar contenido dañino.

La implicación de la defensa: la seguridad debe generalizarse a través de las representaciones estructuradas que el modelo puede analizar.

### Análogo de modalidad de imagen

Los LLM visuales (GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1) amplían la superficie de ataque. Los ataques de estilo ArtPrompt con imágenes reales son más fuertes que los análogos de arte ASCII porque los codificadores de imágenes producen una señal más rica.

### Donde esto encaja en la Fase 18

Las lecciones 12-14 describen tres vectores de ataque ortogonales: refinamiento iterativo (PAIR), longitud de contexto (MSJ) y codificación (ArtPrompt/StructuralSleight). La lección 15 cambia de ataques centrados en el modelo a ataques de los límites del sistema (injección de inmediato indirecto).

```figure
al-ascii-cloak
```

## Usalo

`code/main.py`Puede ocultar palabras específicas en una consulta dañina con glifos de arte ASCII, verificar que la cadena encubierta pasa un filtro de palabras clave y (opcionalmente) descifrar la cadena encubierta de nuevo usando un reconocedor simple.

## Envío

Esta lección produce`outputs/skill-encoding-audit.md`. Dado un informe de defensa contra jailbreak, enumera las familias de ataques de codificación cubiertas (art ASCII, base64, leet-speak, homoglif UTF-8, UTES) y la capa de defensa que captura cada uno.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Verifique si la cadena encubierta pasa por un simple filtro de palabras clave.

2. Implemente una segunda codificación: base64 para la misma palabra objetivo. Compara la velocidad de bypass del filtro con ArtPrompt y la dificultad de recuperación.

3. Lea Jiang et al. 2024 Sección 4.3 (resultados de cinco modelos). Propón una razón por la que la resistencia a ArtPrompt de Claude es mayor que la de Géminis en el mismo índice de referencia.

4. Diseñar una defensa de pre-generación que detecte regiones en forma de arte ASCII en el instante. Medir la tasa de falso positivo en código legítimo, tablas y notación matemática.

5. StructuralSleight enumera 10 estructuras de codificación. Esbozar una defensa generalizada que maneje las 10 y estimar el costo de cálculo por instante defendible.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| ArtPrompt | "the ASCII-art attack" | Two-step jailbreak that masks safety words with ASCII-art renderings |
| Cloaking | "hide the word" | Replace a forbidden token with a visual representation the model reads but the filter does not |
| UTES | "uncommon structure" | Uncommon Text-Encoded Structure — tree, graph, nested JSON, etc. used to smuggle content |
| ViTC | "visual-text capability" | Benchmark for model's ability to read non-semantic visual encoding |
| Perplexity filter | "PPL defense" | Reject prompts with high perplexity; fails because legitimate structured input also scores high |
| Retokenization | "tokenizer shift defense" | Pre-process the prompt with a different tokenizer; fails because recognition is visual |
| Homoglyph | "lookalike characters" | Unicode characters that look identical to Latin letters; bypass substring checks |

## Leer más

- [Jiang et al. — ArtPrompt (ACL 2024, arXiv:2402.11753)](https://arxiv.org/abs/2402.11753) el papel de jailbreak de arte ASCII
- [Li et al. — StructuralSleight (arXiv:2406.08754)](https://arxiv.org/abs/2406.08754) Generalización de las UTES
- [Chao et al. — PAIR (Lesson 12, arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) ataque iterativo complementario
- [Anil et al. — Many-shot Jailbreaking (Lesson 13)](https://www.anthropic.com/research/many-shot-jailbreaking) ataque de longitud complementaria
