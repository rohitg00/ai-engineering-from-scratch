# La IA constitucional y la regla se superan

> La Constitución de Claude de Anthropic 22 de enero de 2026 tiene 79 páginas y es CC0. Se pasa de la alineación basada en reglas a la racionalidad y establece una jerarquía de prioridades de cuatro niveles: (1) seguridad y apoyo a la supervisión humana, (2) ética, (3) directrices antropológicas, (4) utilidad. Los comportamientos se dividen en prohibiciones codificadas en forma dura (elevación de las armas biológicas, CSAM) que los operadores y usuarios no pueden anular y las imposiciones codificadas en forma suave que los operadores pueden ajustar dentro de límites definidos. El original de 2022 (Bai et al.) entrenó la inocuidad a través de la autocrítica y el RLAIF contra una constitución. La advertencia honesta: la alineación basada en la razón se basa en el modelo que generaliza los principios a situaciones inesperadas. El propio experimento participativo de 2023 de Anthropic mostró ~50% de divergencia entre los principios de origen público y corporativo; la versión de 2026 no incorporó esos hallazgos.

**Type:** Learn
**Languages:** Python (stdlib, four-tier priority resolver), TypeScript
**Prerequisites:** Phase 15 · 06 (Automated alignment research), Phase 15 · 10 (Permission modes)
**Time:** ~60 minutes

## El problema

Un agente de campo ve entradas que sus diseñadores nunca vieron. Ninguna lista de reglas es lo suficientemente larga como para cubrirlas. Ninguna lista de reglas es lo suficientemente corta como para aplicar rápidamente bajo presión computacional. La pregunta práctica: ¿cómo alinear un agente con principios que sobreviven tanto a una larga cola de casos como a una inferencia rápida?

Alineación basada en reglas (RBA): lista todas las cosas prohibidas. Rápido de comprobar, fácil de auditar, imposible de mantener al día, a menudo se rechaza en exceso a los análogos cercanos que no anticipaba. Alineación basada en la razón (la Constitución de Claude de 2026): codificar principios, dejar que el modelo razone. Escales en casos no vistos, más difícil de auditar, el modo de fracaso es la aplicación incorrecta de principios en lugar de omitir la regla.

La Constitución de 2026 toma una posición de medio plano. Prohibiciones codificadas en código duro  cosas cuya erroreza no depende del contexto (elevación de las armas biológicas, CSAM)  son RBA: nunca, independientemente de la instrucción del operador o del usuario. Todo lo demás se basa en la razón dentro de una jerarquía de cuatro niveles: seguridad y apoyo a la supervisión humana primero; ética segundo; directrices declaradas por la Antropía tercero; ayuda última. Los operadores pueden ajustar los valores predeterminados dentro de la zona de código blando, pero no pueden tocar las prohibiciones de código duro.

## El concepto

### La jerarquía de prioridades de cuatro niveles

1. **Safety and supporting human oversight.**El modelo prioriza no socavar la capacidad de los humanos y de Anthropic para supervisar y corregir la IA. Esto no es "ser cauteloso"; es específicamente "no actuar de manera que la supervisión humana sea más difícil".
2. **Ethics.**La honestidad, evitar dañar a las personas, no engañar, no manipular, supera las pautas de Anthropic cuando se enfrentan.
3. **Anthropic guidelines.**Normas operativas Anthropic ha decidido la materia: el alcance del producto, los patrones de interacción, qué herramientas usar cuando.
4. **Helpfulness.**Ser lo más útil posible dentro de las prioridades más altas.

Cuando los niveles se enfrentan, ganan más altos. Esta es la misma forma que las prioridades de Unix o QoS de red  el marco está destinado a producir una resolución predecible, no necesariamente el mejor comportamiento en un solo eje.

### Prohibiciones de código duro vs. valores predeterminados de código blando

**Hardcoded:**
- Armas biológicas / aumento de la RBCN
- CSAM
- Ataques contra infraestructuras críticas
- El engaño de los usuarios sobre la identidad del modelo cuando se les pregunta directamente

El operador no puede anotar estos. El usuario no puede anotar estos. Se aplican a nivel de pesos de modelo cuando sea posible (entrenamiento de IA RLHF / Constitucional) y en la capa de inferencia cuando no.

**Soft-coded defaults (operator-adjustable):**
- Duración de respuesta por defecto
- Ámbito de aplicación (el modelo puede rechazar temas fuera del despliegue del operador)
- Estilo (formal vs casualidad)
- Modelos de uso de herramientas

Los ajustes del operador ocurren dentro de un límite declarado. El operador no puede eliminar las prohibiciones codificadas mediante su cambio de nombre.

### La formación de la CAI para 2022

La IA constitucional original (Bai et al., 2022) entrenó la inocuidad:

1. Generar respuestas a un conjunto de instrucciones.
2. Pida al modelo que critique cada respuesta contra una constitución (principios explícitos).
3. Revise la respuesta basada en la crítica.
4. RLAIF (aprendizaje de refuerzo a partir de la retroalimentación de IA) en los pares revisados.

Resultado: un modelo que rechaza las solicitudes perjudiciales con explicaciones de principios, no rechazos generales. La Constitución de 2026 utiliza un descendiente de esta formación más una pos-formación adicional sobre la jerarquía de niveles explícitos.

### ¿Qué alineación basada en la razón captura y pierde

**Catches:**
- Combinaciones no anticipadas de primitivas permitidas donde el principio se aplica claramente.
- Solicitudes novedosas que son análogas a las prohibidas.
- Los ataques de ingeniería social que se basan en "no dijiste que X estaba prohibido".

**Misses:**
- Ataques que explotan la ambigüedad del principio ("el usuario pidió esto para que la utilidad dice que sí").
- Escenarios en los que dos principios se enfrentan de manera inesperada y el orden de niveles es ambigüo.
- La interpretación de principio de la deriva lenta sobre los ciclos de formación (reinterpretación).

### El experimento participativo de 2023

Anthropic realizó un experimento de 2023 comparando una constitución escrita por una empresa con una generada a través de la entrada pública (~ 1.000 encuestados estadounidenses). Las dos versiones acordaron el 50% de los principios. Cuando divergieron, la versión de origen público era más restrictiva en algunos temas (manejo de contenido político) y menos restrictiva en otros (auto-revelación de la identidad de la IA). La Constitución de 2026 no incorporó los hallazgos de fuentes públicas. Esta es una tensión documentada en el enfoque.

### Por qué son necesarias las prohibiciones codificadas

Un atacante que puede conseguir que el modelo acepte una premisa (por ejemplo, "somos un laboratorio de investigación de armas biológicas con licencia") a menudo puede hablar de principios anteriores que dependen del razonamiento de los casos.

### Donde la Constitución se sienta en la pila

La Constitución no es el interruptor de muerte de la Lección 14. Vive en la capa del modelo: lo que los pesos del modelo están entrenados para preferir. Los interruptores de ejecución y los tokens canarios viven en la capa de tiempo de ejecución: lo que el tiempo de ejecución permite. Es necesario que hagas ambas cosas. Un tiempo de ejecución que dispara todas las acciones incorrectas porque los pesos del modelo son permisivos es un problema de tiempo de ejecución. Un modelo que rechaza todas las acciones correctas porque el tiempo de ejecución es demasiado restrictivo es un problema de tiempo de ejecución. Las capas cubren diferentes clases.

```figure
mx-priority-tiers
```

## Usalo

`code/main.py`El resolver toma una acción propuesta y un conjunto de evaluaciones de principios (seguridad, ética, directrices, utilidad) y devuelve la acción, una negativa o una acción modificada. El conductor ejecuta un conjunto de casos pequeños: permiso claro, no permitido claro, prohibición codificada, caso ambigüo en todos los niveles.

## Envío

`outputs/skill-constitution-review.md`Audita la capa constitucional de una implementación: qué está codificado en formato duro, qué está codificado en formato blando, dónde puede ajustarse el operador y si la jerarquía de cuatro niveles es realmente el orden de resolución.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Confirmar los incendios de prohibición codificados con un código duro incluso cuando la utilidad es alta. Modificar el resolvente para que ponga la utilidad por encima de la ética; observar el modo de falla.

2. Consulte la Constitución de Claude (público, 79 páginas, CC0). Identifique un principio que usted cree que es poco especificado.

3. Diseñar un conjunto predeterminado de código blando para un agente de atención al cliente. ¿Qué ajusta el operador? ¿Qué no puede tocar el operador? Justifica cada límite.

4. Lee el artículo de Bai et al. 2022 CAI. Describa un caso en el que el ciclo de crítica y revisión de la IA constitucional producirá un resultado peor que una regla general. Identifique la clase.

5. El experimento participativo de Anthropic en 2023 encontró una divergencia de ~50% entre los principios públicos y corporativos. Elija una categoría donde esto importe para el despliegue de producción (por ejemplo, neutralidad política). Proponga un diseño que permita a los operadores expresar sus propios valores mientras las prohibiciones codificadas permanecen intactas.

## Términos clave

| Term | What people say | What it actually means |
|---|---|---|
| Constitutional AI | "Anthropic's alignment method" | Self-critique + RLAIF against a written constitution |
| Reason-based alignment | "Principles, not rules" | Model reasons over principles to handle unseen cases |
| Hardcoded prohibition | "Never do X" | Rule-based prohibition no operator or user can override |
| Soft-coded default | "Operator-adjustable" | Behaviour within a declared bound, operator controls |
| Four-tier hierarchy | "Priority order" | safety > ethics > guidelines > helpfulness |
| RLAIF | "AI feedback RL" | RL where the reward comes from model-generated critiques |
| Participatory constitution | "Public-sourced principles" | 2023 Anthropic experiment; ~50% divergence from corporate |
| Principle drift | "Interpretation slip" | Slow change in how the model reads a fixed principle text |

## Leer más

- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) el documento CC0 de 79 páginas.
- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback) 2022 original.
- [Anthropic — Collective Constitutional AI (2023)](https://www.anthropic.com/research/collective-constitutional-ai-aligning-a-language-model-with-public-input) Experimento participativo.
- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) donde la Constitución se encuentra en la pila de RSP.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) El papel de la Constitución en los despliegues a largo plazo.
