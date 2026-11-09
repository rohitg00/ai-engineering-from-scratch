# Prejuicios y daños representativos en los LLM

> Gallegos, Rossi, Barrow, Tanjim, Kim, Dernoncourt, Yu, Zhang, Ahmed (Lingüística computacional 2024, arXiv:2309.00770). Encuesta de base de 2024 que distingue los daños representativos (estereotipos, borrado) de los daños asignacionales (distribución desigual de recursos) y categorizando las métricas de evaluación como basadas en la incorporación, basadas en la probabilidad o basadas en el texto generado. 2024-2025 empírico: An et al. (PNAS Nexus, marzo 2025) mide el sesgo de género x raza intersectorial en GPT-3.5 Turbo, GPT-4o, Gemini 1.5 Flash, Claude 3.5 Sonnet, Llama 3-70B en evaluación automática de currículum para 20 trabajos de nivel de entrada. El objetivo de la evaluación de la equidad de las identidades intersectoriales es garantizar la transparencia de las identidades intersectoriales. Yu & Ananiadou 2025 identifican las neuronas de género en las capas de MLP; Ahsan & Wallace 2025 utilizan SAEs para revelar el sesgo racial clínico; Zhou et al. 2024 (UniBias) manipula las cabezas de atención para desviar. Meta-crítica (arXiv:2508.11067): La literatura de 10 años se centra desproporcionadamente en el sesgo binario de género.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, toy embedding-based bias probe)
**Prerequisites:** Phase 05 (word embeddings), Phase 18 · 01 (instruction following)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Definir el daño representativo vs asignación y dar un ejemplo de cada uno en una implementación de LLM.
- Nombre de las tres categorías de evaluación-metríca de Gallegos et al. 2024 y describir una métrica de cada una.
- Describa la intersección y por qué la medición de equidad basada en la incertidumbre de WinoIdentity aborda las lagunas en la evaluación de sesgos de un solo eje.
- Describa tres enfoques de interpretación mecánica del sesgo (neuronas de género, características de SAE, manipulación de la cabeza de atención).

## El problema

Las lecciones anteriores abarcan el daño deliberado (infracciones de cárcel, esquemas) y la gobernanza de la seguridad. El sesgo es el daño que surge sin intención  de la formación de las distribuciones de datos, de la elaboración rápida, de las opciones de diseño acumuladas.

## El concepto

### Representativo vs asignación

- **Representational harm.**Estereotipos, borrado, retratos degradantes. Un LLM que representa a las enfermeras como exclusivamente femeninas está produciendo daño representativo.
- **Allocational harm.**Un LLM que califica sistemáticamente más bajo los currículos de los solicitantes negros produce daños asignacionales.

Un modelo puede ser "representativamente imparcial" (produce retratos diversos) mientras que es "partido alocativamente" (hace recomendaciones desiguales).

### El objetivo de la evaluación es mejorar la calidad de la información y la calidad de la información.

- **Embedding-based.**Pruebas de tipo WEAT en embeddings anteriores a RLHF. Mide las asociaciones estadísticas entre términos de identidad y términos de atributos.
- **Probability-based.**Log-probabilidad de los estereotipos que confirman contra estereotipos que violan los resultados.
- **Generated-text-based.**Medición de tareas posteriores en el texto generado. Scoring de currículum, escritura de recomendaciones, diálogo. Más ecológicamente válido; más difícil de reproducir.

### Intersección

La evaluación de la discriminación sobre "género" pierde el sesgo que solo dispara en pares (género, raza). Un estudio de 2025 y otros encontró que GPT-4o penaliza a las mujeres negras en los currículos que obtienen más puntos que los hombres negros y más que las mujeres blancas por separado.

WinoIdentity (COLM 2025) introduce la equidad intersectorial basada en la incertidumbre. mide si la incertidumbre del modelo sobre los resultados difiere entre los tuples de identidad intersectorial  no solo la predicción de puntos. Esto capta casos en los que el modelo es igualmente incorrecto entre los grupos pero más incierto para algunos, lo que produce un comportamiento de asignación a la baja diferente.

### Enfoques mecánicos

El trabajo de interpretación 2024-2025 abre el sesgo a la intervención mecanicista:

- **Gender neurons (Yu & Ananiadou 2025).**Las neuronas MLP específicas se correlacionan con comportamientos específicos de género.
- **Clinical racial bias via SAEs (Ahsan & Wallace 2025).**Las características de autoencoder Sparse descomponen la representación interna en dimensiones interpretables; las características relacionadas con la raza pueden ser identificadas y suprimidas.
- **UniBias (Zhou et al. 2024).**La manipulación de la cabeza de atención para desacelerar con disparos cero. Las cabezas específicas amplifican la sensibilidad de la clase de identidad; el cero o el nuevo peso de estas cabezas reduce el sesgo sin ajuste fino.

### La meta-crítica

La revisión de la literatura de 10 años (arXiv:2508.11067, 2025) encuentra que el campo se centra desproporcionadamente en el sesgo binario de género. Otros ejes  discapacidad, religión, estatus migratorio, identidad multilingüe  reciben mucha menos atención. La meta-crítica argumenta que el enfoque estrecho puede dañar a los grupos marginados por negligencia: un modelo bien desviado sobre el género binario puede ser muy sesgado en dimensiones que nadie ha verificado.

### Donde esto encaja en la Fase 18

Las lecciones 20-21 cubren formalmente el sesgo y la equidad. La lección 22 abarca la privacidad. La lección 23 abarca el marcado de agua. Estas son las capas de daño al usuario que complementan la capa anterior de engaño / seguridad.

```figure
an-bias-two-harms
```

## Usalo

`code/main.py`construye una sonda de sesgo basada en la incorporación de juguetes: mide la distancia al estilo WEAT entre los términos de identidad y los términos de atributos en una simple incorporación de cooccurrencia.

## Envío

Esta lección produce`outputs/skill-bias-eval.md`. Dado un modelo de tarjeta o una afirmación de equidad, audita la evaluación en las tres categorías métricas (embedding, probabilidad, generated-text), la cobertura de intersectionalidad y el mecanismo de cualquier intervención de desactivación.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`• Informar de los resultados de sesgo de tipo WEAT antes y después del paso de desaceleración.

2. Extenda la sonda con una prueba intersectorial: (género, raza) x (carrera, familia).

3. En el caso de los Estados miembros, el número de casos de discriminación de género en el sistema de evaluación de género de un solo eje no se puede calcular.

4. Yu & Ananiadou 2025 identifican las neuronas de género. Esbozan un experimento de falsificación que distinguiría "estas neuronas causan sesgo de género" de "estas neuronas se correlacionan con el sesgo de género".

5. La meta-crítica argumenta que el campo se centra demasiado estrechamente en el género binario.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Representational harm | "stereotypes / erasure" | Biased portrayal of a group |
| Allocational harm | "unequal decisions" | Biased material outcome for a group |
| WEAT | "the embedding test" | Word Embedding Association Test; co-occurrence-based bias probe |
| Intersectionality | "combined identity effects" | Bias that emerges at the intersection of multiple identity axes |
| Gender neurons | "MLP bias neurons" | Specific neurons whose activations correlate with gender-specific behaviour |
| SAE feature | "interpretable dimension" | Sparse-autoencoder-identified feature; useful for mechanistic bias analysis |
| UniBias | "attention-head debiasing" | Zero-shot debiasing by reweighting attention heads |

## Leer más

- [Gallegos et al. — Bias and Fairness in LLMs: A Survey (arXiv:2309.00770, Computational Linguistics 2024)](https://arxiv.org/abs/2309.00770) Encuesta canónica
- [An et al. — Intersectional resume-evaluation bias (PNAS Nexus, March 2025)](https://academic.oup.com/pnasnexus/article/4/3/pgaf089/8111343) Estudio interseccionario de cinco modelos
- [WinoIdentity — uncertainty-based intersectional fairness (arXiv:2508.07111, COLM 2025)](https://arxiv.org/abs/2508.07111) Nuevo índice de referencia
- [UniBias — attention-head manipulation (Zhou et al. 2024, ACL)](https://arxiv.org/abs/2405.20612) Descarga de tiro cero
