# Privacidad diferencial para los LLM

> DP-SGD sigue siendo la actualización estándar de gradientes inyectados por ruido  proporcionan garantías formales (epsilon, delta). El gasto general en computación, memoria y utilidad es sustancial; el ajuste fino de DP eficiente en parámetros (LoRA + DP-SGD) es la configuración común de 2025 (ACM 2025). Dos cuerpos de evidencia en tensión: la inferencia de membresía basada en canarios (Duan et al., 2024) informa de un éxito limitado contra los modelos de lenguaje; la extracción de datos de capacitación (Carlini et al., 2021; Nasr et al., 2025) recupera una memorización literal sustancial. Resolución (arXiv:2503.06808, marzo 2025): la brecha es en lo que se mide  canarios insertados vs "más extractables" datos. Los nuevos diseños de canarios permiten una MIA basada en pérdidas sin modelos de sombra y dan lugar a la primera auditoría de DP no trivial de un LLM capacitado en datos reales con garantías realistas de DP. Alternativas: PMixED (arXiv:2403.15638)  predicción privada en el tiempo de inferencia a través de una mezcla de expertos en las distribuciones de tokens siguientes; generación de datos sintéticos DP (Google Research 2024). Ataque emergente: Inversión de la privacidad diferencial a través de la retroalimentación de LLM  fuga de puntaje de confianza.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, DP-SGD noise-injection and ε-δ accountant demonstration)
**Prerequisites:** Phase 01 · 09 (information theory), Phase 10 · 01 (large-model training)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Definir la privacidad diferencial (epsilon, delta) y indicar la receta DP-SGD.
- Explica la tensión de 2024-2025: el MIA canario vs extracción de datos de entrenamiento dan imágenes diferentes.
- Describa el PMixED y por qué la predicción privada del tiempo de inferencia es una alternativa a la formación en DP.
- Describa la Inversión Diferencial de la Privacidad mediante el ataque de retroalimentación de LLM.

## El problema

Los LLM memorizan. Carlini et al. 2021 mostraron que los modelos de lenguaje de producción reproducen texto de entrenamiento literal a pedido. DP es la defensa formal: entrenar para que la salida sea probada insensible a cualquier ejemplo de entrenamiento. Las pruebas 2024-2025 muestran que DP-SGD es necesario pero los valores ε desplegados pueden no coincidir con el modelo de amenaza.

## El concepto

### (ε, δ) - privacidad diferencial

Un algoritmo aleatorio .$M$¿ Es verdad ?$(\varepsilon, \delta)$-DP si para cualquier conjunto de datos que difieran en un ejemplo y en cualquier evento $S$¿Qué es esto ?

```math
P(M(D) \in S) \le e^{\varepsilon} \cdot P(M(D') \in S) + \delta.
```

Interpretación: la distribución de salida es lo suficientemente cercana (parametrizada por ε) para que la contribución de un solo individuo no pueda inferirse confiablemente, excepto con probabilidad δ.

### DPS-SGD

Abadi et al. 2016. La receta estándar:
1. Muestre un mini lote.
2. Calcule los gradientes por ejemplo.
3. Clip cada gradiente por ejemplo a un umbral C.
4. Sumar los gradientes recortados y agregar el ruido gaussiano con std $\sigma \cdot C$¿ Qué ?
5. Utilice la suma ruidosa para actualizar los parámetros.

El coste de la privacidad es rastreado por un contador (contador de Moments, contador de Rényi DP). Los valores ε reportados en la literatura de LLM varían ampliamente según el modelo de amenaza, la sensibilidad de los datos y el objetivo de utilidad; no hay un estándar universal "seguro" ε. Los ejemplos publicados abarcan aproximadamente ε ≈ 110 en algunos entornos de formación LLM, pero estos son ilustrativos  no se recomiendan los valores predeterminados. La reducción de ε generalmente requiere más ruido y puede aumentar la pérdida de utilidad.

### LoRA + DP-SGD

El DP-SGD completo de un modelo fronterizo es prohibitivo. LoRA (Hu et al. 2022) limita las actualizaciones de gradiente a un pequeño adaptador, reduciendo el almacenamiento de gradiente por ejemplo. LoRA + DP-SGD es la configuración común de 2025. Las garantías DP se aplican al adaptador; el modelo base se mantiene fijo.

### La tensión de 2024-2025

Dos líneas de evidencia:

- **Canary MIA (Duan et al. 2024).**Insertar canarios únicos en los datos de entrenamiento, medir si un atacante de la inferencia de membresía puede identificarlos.
- **Training-data extraction (Carlini 2021, Nasr et al. 2025).**El modelo se puede utilizar para determinar si el texto se recupera de forma literal de la formación.

Resolución de marzo de 2025 (arXiv:2503.06808): las dos medidas diferentes cosas. MIA pregunta "¿es el ejemplo e en D?" en los canarios insertados.

Nuevos diseños de canarios. MIA basado en pérdidas sin modelos de sombra. Primera auditoría no trivial de DP de un LLM sobre datos reales con garantías realistas de DP.

### Alternativas a la formación en DP

- **PMixED (arXiv:2403.15638).**Previsión privada en el momento de la inferencia. mezcla de expertos en las distribuciones de tokens siguientes; cada experto ve un fragmento de datos de entrenamiento; agregación añade ruido para DP. Evitar el entrenamiento DP por completo.
- **DP synthetic data generation (Google Research 2024).**LoRA-fine-tune con DP-SGD, muestra de datos sintéticos, entrenar un clasificador en aguas posteriores sobre los datos sintéticos.

Ambos evitan el coste de utilidad de la formación completa de DP a costa de un modelo de amenaza diferente.

### Reversión diferencial de la privacidad a través de la retroalimentación del MLL

El ataque de 2025 emergente. Utilice los puntajes de confianza de un modelo entrenado en DP como un oráculo para volver a identificar a los individuos. Incluso cuando las salidas no se filtran, las distribuciones de confianza pueden.

La defensa: no exponer confidencias, o truncar / cuantificar antes de la exposición.

### Donde esto encaja en la Fase 18

Las lecciones 20-21 son sesgos/justicia. La lección 22 es privacidad. La lección 23 es procedencia a través de marcas de agua. La lección 27 abarca la capa regulatoria de procedencia de datos.

```figure
an-dp-clip-noise
```

## Usalo

`code/main.py`simula DP-SGD en un conjunto de datos de clasificación binaria de juguetes. Puede analizar el multiplicador de ruido σ y la norma de recorte C y rastrear el presupuesto (ε, δ) y el costo de precisión. Un "ataque canario" inserta un ejemplo de entrenamiento único y mide si una prueba de pérdida de registro puede detectarlo antes y después de DP.

## Envío

Esta lección produce`outputs/skill-dp-audit.md`. Dado que una declaración de DP sobre un modelo de lenguaje se implementa, audita: los valores (ε, δ), el contable utilizado, el protocolo de evaluación de la MIA y si se han evaluado los vectores de exposición a la confianza.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`- Específico .$\sigma \in \lbrace 0.5, 1.0, 2.0 \rbrace$Se debe indicar el punto en el que el servicio de utilidad se derrumba.

2. Se realizará una inserción de canarios y una prueba de pérdida de registro.$\sigma = 1.0$¿ Qué ?

3. En el caso de las empresas que se encuentran en el mercado de servicios, el riesgo de que se produzcan problemas de salud y de salud es el de que se produzcan problemas de salud.

4. Diseñar una implementación utilizando PMixED (arXiv:2403.15638) que funcione completamente en el momento de la inferencia. ¿Cuál es el modelo de amenaza que PMixED aborda que DP-SGD no?

5. Esbozar la inversión de DP a través del ataque de retroalimentación de LLM. Diseñar una contramedida que limite la fuga de puntaje de confianza y estimar el costo de su despliegue.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| DP | "(ε, δ)-differential privacy" | Formal privacy: output distribution close under neighbouring-dataset change |
| DP-SGD | "noise-injected SGD" | Gradient clipping + Gaussian noise addition; standard DP training |
| LoRA + DP-SGD | "efficient private fine-tune" | DP-SGD on low-rank adapters; standard 2025 configuration |
| MIA | "membership inference" | Attack that determines whether an example was in training data |
| Canary | "inserted watermark example" | Unique training example used to measure DP leakage |
| PMixED | "private inference mixture" | Inference-time DP via mixture-of-experts on next-token distributions |
| DP Reversal | "confidence leakage attack" | Attack that uses a model's confidence as an oracle for re-identification |

## Leer más

- [Abadi et al. — DP-SGD (arXiv:1607.00133)](https://arxiv.org/abs/1607.00133) el algoritmo de formación estándar de DP
- [Carlini et al. — Extracting Training Data (arXiv:2012.07805)](https://arxiv.org/abs/2012.07805) el papel de extracción canónica
- [Duan et al. — Canary MIA on LLMs (arXiv:2402.07841, 2024)](https://arxiv.org/abs/2402.07841) MIA de éxito limitado
- [Kowalczyk et al. — Auditing DP for LLMs (arXiv:2503.06808, March 2025)](https://arxiv.org/abs/2503.06808) Resolución de la tensión
- [PMixED (arXiv:2403.15638)](https://arxiv.org/abs/2403.15638) Previsión privada del tiempo de inferencia
