# Pruebas A/B de LLM características  GrowthBook, Statsig y el problema de Vibes

> Las pruebas A/B tradicionales no se construyeron para LLM no deterministas. La distinción crítica: evaluaciones de respuesta "¿puede el modelo hacer el trabajo?" pruebas A/B responder "¿cuidan los usuarios?" ambos son necesarios; envío en vibe controles se terminó. Qué probar en 2026: ingeniería rápida (formulación), selección de modelos (GPT-4 vs GPT-3.5 vs OSS; precisión vs costo vs latencia), parámetros de generación (temperatura, top-p). Casos reales: una variante del modelo de recompensa de chatbot proporcionó +70% de duración de la conversación y +30% de retención; experimentos de línea de asunto de Nextdoor AI proporcionaron +1% de CTR después de refinar la función de recompensa; Khan Academy Khanmigo iteró en un eje de latencia frente a la precisión matemática. División de la plataforma: **Statsig**(adquirido por OpenAI por $1.1 mil millones en septiembre de 2025)  pruebas secuenciales, CUPED, todo en uno. **GrowthBook** código abierto, nativo de almacén, motores bayesianos + frecuentistas + secuenciales, CUPED, controles SRM, correcciones Benjamini-Hochberg + Bonferroni.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy sequential test simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 20 (Progressive Deployment)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Distinguir evaluaciones ("puede el modelo hacer el trabajo") de pruebas A/B ("el usuario se preocupa").
- Enumera tres ejes testables (prompt, modelo, parámetros) y seleccione la métrica para cada uno.
- Explica CUPED, pruebas secuenciales y correcciones de comparación múltiple de Benjamini-Hochberg.
- Elija Statsig o GrowthBook basado en la postura de almacenamiento-SQL y la postura de adquisición corporativa.

## El problema

Ha sintonizado manualmente un mensaje de sistema. Se siente mejor. Lo envías. Cambios de conversión por ruido. Culpa a la métrica. O envió un nuevo modelo y la conversión no se movió. ¿El modelo se degradó o el cambio fue demasiado pequeño para detectar? No lo sabes, porque envió sin un A / B.

Los Evals responden si el modelo puede realizar una tarea en un conjunto etiquetado. No responden si los usuarios prefieren la salida. Sólo un experimento en línea controlado responde a eso, y solo si el experimento tiene suficiente poder, controla el no determinismo y corrige para múltiples comparaciones.

## El concepto

### Evals vs pruebas A/B

**Evals** fuera de línea, conjunto etiquetado, juez (rubrica o LLM-as-judge o humano). Respuesta: "¿Es la salida correcta / útil / segura en esta distribución fija?"

**A/B test**Respuesta: ¿La nueva variante mueve la métrica de nivel de usuario que importa?

Los valores de Evals comproban regresiones antes de la exposición; A/B confirma el impacto del producto después.

### Qué probar

1. **Prompt engineering** formulación, estructura de la solicitud del sistema, ejemplos.
2. **Model selection** GPT-4 vs GPT-3.5-Turbo vs Llama-OSS. Métrica: precisión (tarea) + costo/solicitud + latencia P99.
3. **Generation parameters** temperatura, top-p, max_tokens. Metrica: específica de la tarea (diversidad de salida vs determinismo).

### CUPED  reducción de la variación

Experimentos controlados utilizando datos pre-experimentales. Retrocede la variación pre-periódica antes de comparar el post-periodo. Reducción típica de la variación: 30-70%.

Implementación: tanto Statsig como GrowthBook se implementan.

### Pruebas secuenciales

El A/B clásico asume un tamaño de muestra fijo. Las pruebas secuenciales ("peek-and-decide") controlan la tasa de falsos positivos bajo miradas repetidas.

### Correcciones de comparación múltiple

El funcionamiento de 20 pruebas A/B con una confianza del 95% produce un falso positivo por casualidad.

### Desajuste de la relación de muestras SRM 

El hash de asignación aleatoriza a los usuarios a variantes. Si la división 50/50 entrega 47/53, algo está roto.

### Statsig vs GrowthBook

**Statsig**¿Qué es esto ?
- Adquirido por OpenAI por $1.1B (septiembre 2025).
- Pruebas secuenciales, CUPED, poblaciones sostenidas.
- Todo en uno: banderas de características + experimentación + observabilidad.
- Mejor ajuste: el equipo ya quiere un producto en paquete, no le importa la propiedad de OpenAI.

**GrowthBook**¿Qué es esto ?
- código abierto (MIT); nativo de almacén (se lee directamente de Snowflake/BigQuery/Redshift).
- Múltiples motores: Bayesiano, Frequentista, Secuencial.
- CUPED, SRM, Bonferroni, correcciones de la BH.
- Auto-host o en la nube gestionada.
- Lo mejor: almacén de SQL, equipo de datos controla la capa métrica, quiere OSS.

### El no-determinismo complica el poder

El mismo prompt produce diferentes resultados. Los cálculos tradicionales de potencia asumen observaciones de IID. Con el no determinismo LLM, el tamaño de muestra efectivo es menor que nominal. Multiplica el tamaño de muestra requerido por ~1.3-1.5x como margen de seguridad.

### Resultados reales de los casos

- Variante del modelo de recompensa de chatbot: +70% de duración de la conversación, +30% de retención.
- Líneas de temas de la puerta siguiente: +1% CTR después de refinar la función de recompensa.
- Khan Academy Khanmigo: comercio iterativo de latencia frente a la precisión matemática.

### El antipatrón: envío en vibraciones

Cada ingeniero senior puede nombrar una característica que se envió porque "se siente mejor" sin A / B. La mayoría de ellos retrocedía métricas de producto que el equipo no notó durante meses. A / B es la función de fuerza.

### Números que debes recordar

- Statsig adquirida por OpenAI: $1.1B, septiembre de 2025.
- GrowthBook: MIT de código abierto; Bayesiano + Frequentista + Secuencial.
- Reducción de la varianza de la CUPED: 30-70%.
- No-determinismo de LLM → +30-50% de tamaño de muestra.

```figure
mx-sequential-test
```

## Usalo

`code/main.py`Simula una prueba A/B secuencial con límites fijos y secuenciales. Muestra cómo secuencial le permite detenerse temprano.

## Envío

Esta lección produce`outputs/skill-ab-plan.md`. Dado el cambio de características, la carga de trabajo, la línea de base, las opciones de plataforma, puertas, tamaño de muestra.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Para un aumento esperado del 5% con conversión del 3% de referencia, ¿qué tamaño de muestra para el 80% de potencia?
2. Elija Statsig o GrowthBook para un cliente en el lugar regulado por la atención médica.
3. Diseñar una A/B que teste GPT-4 vs GPT-3.5 en el costo por boleto resuelto. ¿Cuál es la métrica primaria, métrica de barandillas, secundaria?
4. Su canario pasa pero A/B muestra una conversión de -1,2%. ¿Se envía?
5. Aplicar CUPED con una covariante preperiódica que explique el 60% de la variación postperiódica (correlación cuadrada 0,6).

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Eval | "offline test" | Labeled-set evaluation of model capability |
| A/B test | "experiment" | Live randomized comparison on users |
| CUPED | "variance reduction" | Pre-period regression to reduce variance |
| Sequential test | "peek-ok test" | Always-valid procedure allowing early stop |
| Multiple comparison | "the family error" | Running many tests inflates false positives |
| Bonferroni | "tight correction" | Divide α by number of tests |
| Benjamini-Hochberg | "BH FDR" | False-discovery-rate control, less conservative |
| SRM | "bad split" | Sample ratio mismatch; assignment bug |
| Statsig | "OpenAI owned" | Commercial all-in-one, acquired 2025 |
| GrowthBook | "the OSS one" | MIT warehouse-native platform |
| mSPRT | "sequential probability ratio test" | Classical sequential procedure |

## Leer más

- [GrowthBook — How to A/B Test AI](https://blog.growthbook.io/how-to-a-b-test-ai-a-practical-guide/)
- [Statsig — Beyond Prompts: Data-Driven LLM Optimization](https://www.statsig.com/blog/llm-optimization-online-experimentation)
- [Statsig vs GrowthBook comparison](https://www.statsig.com/perspectives/ab-testing-feature-flags-comparison-tools)
- [Deng et al. — CUPED](https://www.exp-platform.com/Documents/2013-02-CUPED-ImprovingSensitivityOfControlledExperiments.pdf)
- [Howard — Confidence Sequences](https://arxiv.org/abs/1810.08240)
