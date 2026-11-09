# Evaluación  FID, CLIP Score, Preferencia humana

> Cada tabla de clasificación de modelos generacionales cita el FID, el puntaje CLIP y una tasa de ganancias de una arena de preferencia humana. Cada número tiene un modo de fracaso que un investigador determinado puede jugar. Si no conoces los modos de fracaso, no puedes saber una mejora real de una carrera de juego.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 01 (Taxonomy), Phase 2 · 04 (Evaluation Metrics)
**Time:** ~45 minutes

## El problema

Un modelo generativo se juzga por *la calidad de la muestra* y *la adhesión de los condicionamientos*. Ninguno de ellos tiene una medida de forma cerrada. Su modelo tiene que renderizar 10.000 imágenes; algo tiene que asignarles números; usted tiene que confiar en los números a través de las familias de modelos, a través de resoluciones, a través de arquitecturas. Tres métricas sobrevivieron al guante 2014-2026.

- **FID (Fréchet Inception Distance).**La distancia entre dos distribuciones  reales y generadas  en el espacio de características de una red de inicio.
- **CLIP score.**Cosiña similaridad entre la incorporación de imagen CLIP de una imagen generada y la incorporación de texto CLIP de un prompt.
- **Human preference.**Ponte dos modelos cara a cara en el mismo prompt, que los humanos (o un modelo de clase GPT-4) elijan el mejor, agregado a una puntuación Elo.

También verá: IS (puntuación de inicio, en gran parte retirado), KID, CMMD, ImageReward, PickScore, HPSv2, MJHQ-30k. Cada uno corrige por un fallo del anterior.

## El concepto

![FID, CLIP, and preference: three axes, different failure modes](../assets/evaluation.svg)

### FID  calidad de la muestra

Heusel et al. (2017).

1. Extraer las características de Inception-v3 (2048-D) para N imágenes reales y N generadas.
2. Encaja un gaussiano en cada piscina: media de cálculo $\mu_r, \mu_g$y la covarianza $\Sigma_r, \Sigma_g$¿ Qué ?
3. $\text{FID} = \lVert \mu_r - \mu_g \rVert^2 + \mathop{\mathrm{Tr}}\left(\Sigma_r + \Sigma_g - 2 \cdot (\Sigma_r \cdot \Sigma_g)^{0.5}\right)$¿ Qué ?

Interpretación: distancia de Fréchet entre dos Gaussianos multivariados en el espacio de características.

Modo de falla:
- **Biased on small N.**FID es el cuadrado medio sobre la distribución de características  pequeño N subestima la covarianza, da falsamente bajo FID. Siempre use $N \ge 10{,}000$¿ Qué ?
- **Inception-dependent.**Inception-v3 fue entrenado en ImageNet. Los dominios lejos de ImageNet (cara, arte, imágenes de texto) producen FID sin sentido.
- **Gaming.**El sobreajuste al previo de inicio da un bajo FID sin mejoría de la calidad visual.

### Punto CLIP  Pronto cumplimiento

Radford et al. (2021). Para una imagen generada + prompt:

```
clip_score = cos_sim( CLIP_image(x_gen), CLIP_text(prompt) )
```

Medio en 30k imágenes generadas → una escala comparable entre modelos.

Modo de falla:
- **CLIP's own blind spots.**CLIP tiene un razonamiento de composición débil ("un cubo rojo en una esfera azul" a menudo falla).
- **Short prompt bias.**Las instrucciones cortas tienen más coincidencias de imágenes CLIP en la naturaleza. Las instrucciones más largas tienen puntuaciones CLIP más bajas mecánicamente.
- **Prompt gaming.**Incluir "alta calidad, 4k, obra maestra" en el prompt infla la puntuación CLIP sin mejorar la vinculación de imagen-texto.

CMMD (Jayasumana et al., 2024) corrige algunas de estas características: utiliza características CLIP en lugar de Inception, discrepancia máxima media en lugar de Fréchet. Mejor en la detección de diferencias sutiles de calidad.

### La preferencia humana  la verdad de fondo

Seleccione un conjunto de instrucciones. Generar con el modelo A y el modelo B. Muestre pares a los humanos (o un juez LLM fuerte).

- **PartiPrompts (Google)**: 1.600 diferentes instrucciones, 12 categorías.
- **HPSv2**: 107k anotaciones humanas, ampliamente utilizadas como proxy automatizado.
- **ImageReward**: 137k pares de preferencias de imágenes instantáneas, con licencia MIT.
- **PickScore**: entrenados en preferencias de Pick-a-Pic 2.6M.
- **Chatbot-Arena-style image arenas**¿ Qué es esto ?https://imagearena.ai/y otros.

Modo de falla:
- **Judge variance.**Los no expertos tienen preferencias diferentes a las expertas.
- **Prompt distribution.**Las instrucciones de cereza favorecen a una familia.
- **LLM-judge reward hacking.**El juez de GPT-4 se engaña con resultados bonitos pero equivocados.

## Uso conjunto

Un informe de evaluación de la producción debe incluir:

1. FID en muestras de 10 a 30 mil en comparación con una distribución real prolongada (calidad de la muestra).
2. Punto CLIP / CMMD en las mismas muestras frente a sus indicaciones (adherencia).
3. Taxa de ganancias en una arena ciega frente al modelo anterior (preferencia general).
4. Análisis de modo de falla: 50 salidas muestranadas al azar, marcadas por problemas conocidos (anatomía de la mano, renderización de texto, recuento de objetos consistente).

Cualquier métrica es una mentira. Tres métricas corroboradoras + revisión cualitativa son una afirmación.

```figure
gx-fid-distributions
```

## Construye el mismo

`code/main.py`Implementa la agregación de FID, CLIP-score-like, y Elo en "vectores de características" sintéticos (usamos vectores 4D como alternativos para las características de Inception).

- El cálculo de FID en un pequeño N y en un grande N  el sesgo.
- "Colocación CLIP" como similitud cosina entre las pools de características.
- Regla de actualización de Elo de un flujo de preferencias sintéticas.

### Paso 1: FID en cuatro líneas

```python
def fid(real_features, gen_features):
    mu_r, cov_r = mean_and_cov(real_features)
    mu_g, cov_g = mean_and_cov(gen_features)
    mean_diff = sum((a - b) ** 2 for a, b in zip(mu_r, mu_g))
    trace_term = trace(cov_r) + trace(cov_g) - 2 * sqrt_cov_product(cov_r, cov_g)
    return mean_diff + trace_term
```

### Paso 2: similitud cosinosa de estilo CLIP

```python
def clip_like(image_feat, text_feat):
    dot = sum(a * b for a, b in zip(image_feat, text_feat))
    norm = math.sqrt(dot_self(image_feat) * dot_self(text_feat))
    return dot / max(norm, 1e-8)
```

### Paso 3: Agregación de Elo

```python
def elo_update(r_a, r_b, winner, k=32):
    expected_a = 1 / (1 + 10 ** ((r_b - r_a) / 400))
    actual_a = 1.0 if winner == "a" else 0.0
    r_a_new = r_a + k * (actual_a - expected_a)
    r_b_new = r_b - k * (actual_a - expected_a)
    return r_a_new, r_b_new
```

## Las trampas

- **FID at N=1000.**La heurística es poco confiable bajo N=10k. Los documentos que informan de bajo N FID están jugando.
- **Comparing FID across resolutions.**El tamaño de 299×299 de Inception cambia la distribución de características.
- **Reporting one seed.**Ejecutar 3 semillas como mínimo.
- **CLIP score inflation via negative prompts.**Algunos conductos aumentan el CLIP al montar demasiado el aviso.
- **Elo bias from prompt overlap.**Si ambos modelos vieron un punto de referencia durante el entrenamiento, Elo no tiene sentido.
- **Human eval paid-crowd skew.**Los anotadores MTurk prolíficos son más jóvenes / amigables con la tecnología.

## Usalo

Protocolo de evaluación de la producción en 2026:

| Pillar | Minimum | Recommended |
|--------|---------|-------------|
| Sample quality | FID on 10k vs held-out real | + CMMD on 5k + FID on subset per category |
| Prompt adherence | CLIP score on 30k | + HPSv2 + ImageReward + VQA-style question answering |
| Preference | 200 blinded pairs vs baseline | + 2000 paired human + LLM-judge + Chatbot Arena |
| Failure analysis | 50 hand-flagged | 500 hand-flagged + automated safety classifier |

Los cuatro pilares en un informe = reclamo.

## Envío

Salva .`outputs/skill-eval-report.md`. Skill toma un nuevo punto de control de modelo + línea de base y produce un plan de evaluación completo: tamaños de muestra, métricas, sondas de modo de falla, criterios de firma.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`. Comparar el FID en N=100 vs N=1000 en las mismas distribuciones sintéticas.
2. **Medium.**Implementar CMMD a partir de características sintéticas de estilo CLIP (ver Jayasumana et al., 2024 para la fórmula). Comparar la sensibilidad a las diferencias de calidad con FID.
3. **Hard.**Replicar la configuración HPSv2: tomar 1000 pares de imágenes de un subconjunto de Pick-a-Pic, ajustar a un pequeño puntero basado en CLIP en las preferencias, y medir su conformidad con un conjunto prolongado.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| FID | "Fréchet Inception Distance" | Fréchet distance of Gaussian fits to real vs gen Inception features. |
| CLIP score | "Text-image similarity" | Cosine similarity between CLIP image and text embeddings. |
| CMMD | "FID's replacement" | CLIP-feature MMD; less biased, no Gaussian assumption. |
| IS | "Inception score" | Exp KL(p(y|x) || p(y)); correlates poorly on modern models, retired. |
| HPSv2 / ImageReward / PickScore | "Learned preference proxies" | Small models trained on human preferences; used as automatic judges. |
| Elo | "Chess rating" | Bradley-Terry aggregation of pairwise wins. |
| PartiPrompts | "The benchmark prompt set" | 1,600 Google-curated prompts across 12 categories. |
| FD-DINO | "Self-sup replacement" | FD using DINOv2 features; better for out-of-ImageNet domains. |

## Nota de producción: la evaluación es también una carga de trabajo de inferencia

Para una base SDXL de 50 pasos en 10242 en un solo L4, es decir ~11 horas de inferencia de una sola solicitud. Los presupuestos de evaluación son reales, y el marco es exactamente el escenario de inferencia fuera de línea (máxima rendimiento, ignora TTFT):

- **Batch hard, forget latency.**Evaluación fuera de línea = lotes estáticos en el tamaño más grande que se adapte a la memoria. `pipe(...).images`con`num_images_per_prompt=8`en un H100 de 80 GB funciona 4-6 veces más rápido que el reloj de pared de una sola solicitud.
- **Cache the real features.**La extracción de la función de inicio (FID) o CLIP (CLIP-score, CMMD) sobre el conjunto de referencia real se ejecuta *once*, almacenada como una`.npz`No recompite por evaluación.

Para las puertas de CI / regresión: ejecuta la puntuación FID + CLIP en un subconjunto de 500 muestras por PR (~ 30 min); ejecuta la puntuación completa 10k FID + HPSv2 + Elo por noche.

## Leer más

- [Heusel et al. (2017). GANs Trained by a Two Time-Scale Update Rule Converge to a Local Nash Equilibrium (FID)](https://arxiv.org/abs/1706.08500) Papel de la FID.
- [Jayasumana et al. (2024). Rethinking FID: Towards a Better Evaluation Metric for Image Generation (CMMD)](https://arxiv.org/abs/2401.09603) CMMD.
- [Radford et al. (2021). Learning Transferable Visual Models from Natural Language Supervision (CLIP)](https://arxiv.org/abs/2103.00020) CLIP.
- [Wu et al. (2023). HPSv2: A Comprehensive Human Preference Score](https://arxiv.org/abs/2306.09341) HPSv2.
- [Xu et al. (2023). ImageReward: Learning and Evaluating Human Preferences for Text-to-Image Generation](https://arxiv.org/abs/2304.05977) ImageReward.
- [Yu et al. (2023). Scaling Autoregressive Models for Content-Rich Text-to-Image Generation (Parti + PartiPrompts)](https://arxiv.org/abs/2206.10789) PartiPrompts.
- [Stein et al. (2023). Exposing flaws of generative model evaluation metrics](https://arxiv.org/abs/2306.04675) Encuesta de modo de falla.
