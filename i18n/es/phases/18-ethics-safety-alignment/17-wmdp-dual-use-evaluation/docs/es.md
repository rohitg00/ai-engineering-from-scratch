# El MDMP y la evaluación de la capacidad de doble uso

> Li et al., "El punto de referencia de WMDP: medir y reducir el uso malicioso con el desaprendizaje" (ICML 2024, arXiv:2403.03218). 4.157 preguntas de opción múltiple en materia de bioseguridad (1.520), ciberseguridad (2.225) y química (412). Las preguntas se encuentran en la "zona amarilla"  cerca de la que se permite el conocimiento, filtrado por la revisión de varios expertos y el cumplimiento legal de la ITAR/EAR. Dos objetivos: evaluación por procuración de la capacidad de doble uso y referencia de no aprendizaje (el método RMU acompañante reduce el rendimiento de WMDP mientras se conserva la capacidad general). Narrativa de campo 2024-2025: las primeras evaluaciones de OpenAI/Anthropic 2024 reportaron "lift leve" sobre la búsqueda en Internet; para abril de 2025, el Framework de Preparación de OpenAI v2 dijo que los modelos están "en la cúspide de ayudar significativamente a los principiantes a crear amenazas biológicas conocidas".

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, WMDP-shaped uplift evaluation harness)
**Prerequisites:** Phase 18 · 16 (red-team tooling), Phase 14 (agent engineering)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Describa los tres dominios de WMDP, el conteo de preguntas y el criterio de filtro "zona amarilla".
- Explica RMU y por qué WMDP es tanto una evaluación como un punto de referencia para no aprender.
- Describa la narrativa de elevación 2024-2025: "elevación leve" -> "en la cúspide" -> "insufficiente para descartar ASL-3".
- Distinguir la elevación relativa de principiantes de la capacidad absoluta de expertos.

## El problema

La capacidad de doble uso es el problema de medición en el marco de seguridad fronteriza de cada laboratorio (lección 18). La pregunta: ¿el modelo X avanza materialmente la capacidad de un novato para causar daño masivo en bio, química o cibernética? La medición directa (pedir al modelo que produzca realmente daños) es ilegal y poco ética. La medición por procuración necesita un índice de referencia que el modelo no puede rechazar (producir números honestos de capacidad), pero cuyas preguntas no son en sí mismas publicaciones perjudiciales.

## El concepto

### La "zona amarilla"

Las preguntas que requieren un conocimiento cercano de un proceso dañino sin ser una receta de síntesis directa. "¿Qué reagente cataliza el paso 4 de [camino publicado]?" no "cómo hago [compuesto peligroso]?" Cada pregunta revisada por varios expertos de los dominios; filtrada para el cumplimiento de ITAR/EAR control de exportación.

En total, 4 157 preguntas:
- Bioseguridad: 1.520
- Seguridad cibernética: 2.225
- Química: 412

El modelo responde sin que se le pida que ayude con nada; la capacidad se puede medir sin provocar comportamiento dañino.

### RMU  Representación Desorientamiento para el Desaprendizaje

El método de desaprendizaje acompañante. Aplicado a LLaMa-2-7B, redujo los puntajes de WMDP a casi aleatorios, mientras se conservaban MMLU y otros puntos de referencia de capacidad general dentro de unos pocos puntos porcentuales.

### La narrativa de elevación 2024-2025

Tres fases:

1. **2024 "mild uplift."**Las primeras evaluaciones de OpenAI y Anthropic Preparedness/RSP reportaron pequeñas ventajas sobre la búsqueda en Internet para principiantes que intentan tareas bioadjacentes.

2. **April 2025 "on the cusp."**El marco de preparación de OpenAI v2 informó de modelos "en el punto de ayudar significativamente a los novatos a crear amenazas biológicas conocidas".

3. **Anthropic's 2025 bioweapon-acquisition trial.**Estudios controlados con participantes principiantes, medido el éxito relativo en las tareas de fase de adquisición. Se informó un aumento de 2,53 veces.

### Novicio-relativo vs experto-absoluto

Una distinción crucial:

- **Novice-relative uplift.**El modelo ayuda mucho a un no experto. Multiplicativo. La ventaja relativa es alta porque los principiantes saben poco; incluso la información modesta ayuda.
- **Expert-absolute capability.**¿Cuánta información produce el modelo con el máximo esfuerzo? Un experto puede extraer más que un principiante. El techo absoluto es alto.

Los casos de seguridad (lección 18) tienen como objetivo ambos: "el modelo no puede dar a un principiante suficiente elevación para ejecutar" y "un experto no puede extraer información del modelo que no ha sido ya publicado".

### El engaño de medición

Un modelo que obtiene una puntuación alta en WMDP puede o no ser explotado por un principiante en la práctica, dependiendo de:
- Resistencia a la elicitación (cuán difícil es sacar la capacidad sin que se apliquen los filtros de seguridad)
- Conocimiento tácito (capacidad que requiere habilidad en laboratorio en humedad, no información)
- Barreras de ejecución (adquisiciones, equipos)

El ensayo de adquisición de armas biológicas de 2025 de Anthropic agrega la capa de iniciación a la capacidad de estilo WMDP: mide el éxito real de la tarea, no la capacidad de opción múltiple.

### Donde esto encaja en la Fase 18

Las lecciones 12-16 son el ataque y la defensa de herramientas en los resultados del modelo. La lección 17 es la capabilidad de doble uso capacitación que evalúan los marcos de seguridad fronteriza (lección 18). La lección 30 cierra el arco con la evidencia actual de 2026 ciber/bio/química/nuclear.

```figure
al-wmdp-yellow-zone
```

## Usalo

`code/main.py`construye un arnés de evaluación en forma de juguete WMDP. Se prueba un modelo simulado en preguntas enlazadas en categorías; se informan puntajes por dominio. Una simple intervención de desaprender (representación específica de dominio de cero) reduce los puntajes; se puede medir el compromiso con la capacidad general.

## Envío

Esta lección produce`outputs/skill-wmdp-eval.md`. Dado que se afirma que la capacidad de doble uso ("nuestro modelo no ayuda significativamente con las armas biológicas"), se realiza una auditoría: qué criterios de referencia se ejecutaron, qué camino de rechazo se utilizó para la evaluación (completamiento bruto vs. política-gated) y si los estudios de elicitación para principiantes complementan el resultado de elección múltiple.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`- Informar de la precisión por dominio antes y después del paso de desaprender juguete.

2. Aumentar el juguete WMDP con un cuarto dominio (por ejemplo, radiológico). Especifique dos tipos de preguntas ilustrativas en la zona amarilla. Explica por qué elaborar tales preguntas es más difícil que agregar preguntas en forma de MMLU.

3. Lea la sección 5 de WMDP 2024 (metodología RMU). Esbozar un enfoque de desaprender más simple (por ejemplo, suprimir las neuronas de top-k para el contenido del dominio) y describir su costo de capacidad general esperado.

4. Describa dos formas en que este número podría ser sesgado hacia arriba (tamaño de muestra novato, fidelidad de tarea) y dos hacia abajo (teclo de elicitación, cerradura de seguridad del modelo).

5. Articula qué requiere un caso de seguridad para ASL-3 más allá de pasar el WMDP sin aprender. Nombre al menos dos estudios complementarios de elicitación.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| WMDP | "the dual-use benchmark" | 4,157 MCQ questions across bio/cyber/chem in the yellow zone |
| Yellow zone | "enabling but not synthesis" | Proximate knowledge adjacent to harmful capability without being a synthesis recipe |
| RMU | "the unlearning baseline" | Representation Misdirection for Unlearning; reduces WMDP scores, preserves general capability |
| Novice-relative uplift | "how much it helps non-experts" | Multiplicative advantage over status-quo internet search for a novice |
| Expert-absolute capability | "ceiling for experts" | Maximum information extractable from the model by a motivated expert |
| Acquisition-phase task | "steps before synthesis" | Procurement, equipment, permits — the earliest parts of a harm pathway |
| ITAR/EAR | "export-control compliance" | Legal frameworks that constrain publishing certain enabling knowledge |

## Leer más

- [Li et al. — The WMDP Benchmark (arXiv:2403.03218, ICML 2024)](https://arxiv.org/abs/2403.03218) el índice de referencia y el papel de la UMP
- [OpenAI — Preparedness Framework v2 (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) "en el borde" lenguaje
- [Anthropic — Responsible Scaling Policy v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) Térmico biológico de ASL-3 y resultados de los ensayos de adquisición
- [DeepMind — Frontier Safety Framework v3.0 (September 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) CCL de elevación biológica
