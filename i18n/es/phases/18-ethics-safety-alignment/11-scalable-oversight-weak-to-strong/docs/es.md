# Supervisión escalable y generalización de débil a fuerte

> Burns y otros. (OpenAI Superalignment, "Generalización de débil a fuerte", 2023) propuso un proxy para el problema de superalignamiento: ajustar de forma fina un modelo fuerte utilizando etiquetas producidas por un modelo más débil. Si el modelo fuerte generaliza correctamente de la supervisión débil imperfecta, los métodos actuales de alineación a escala humana pueden extenderse a sistemas sobrehumanos. La supervisión escalable y el W2SG son complementarios. La supervisión escalable (debate, modelado recurrente de la recompensa, descomposición de tareas) aumenta la capacidad efectiva del supervisor para que pueda mantenerse al día con el modelo bajo supervisión. W2SG asegura que el modelo fuerte generaliza correctamente de cualquier supervisión imperfecta que el superintendente provea. Debate Helps W2SG (arXiv:2501.13124, enero 2025) las combina.

**Type:** Learn
**Languages:** Python (stdlib, W2SG gap simulator), TypeScript
**Prerequisites:** Phase 18 · 01 (instruction-following), Phase 18 · 10 (AI Control), Phase 09 (RL foundations)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Definir la supervisión escalable y la generalización de débil a fuerte y explicar cómo son complementarias.
- Describa la configuración experimental de Burns et al. 2023: ajuste fino de GPT-4 utilizando etiquetas de GPT-2.
- Explica la métrica de la brecha de rendimiento recuperada (PGR) y lo que mide.
- En el presente artículo, se especifica el número de unidades de control de las tareas y el número de unidades de control de las tareas.

## El problema

Cada técnica de alineación hasta ahora en la Fase 18 asume que el supervisor puede evaluar el comportamiento del modelo. Cuando el modelo es sobrehumano, el supervisor es el eslabón débil. La pregunta sobre la superalienación: ¿puede un supervisor más débil producir confiablemente un modelo más fuerte y alineado?

Burns et al. reducen esto a una configuración empírica operationalizada: supervisa fuerte con débil, mide cuánto de la capacidad del modelo fuerte sobrevive a la supervisión débil.

## El concepto

### W2SG: la configuración de Burns et al.

- Modelo débil: clase GPT-2.
- Modelo fuerte: clase GPT-4.
- Objetivo: un límite de GPT-4 fuerte en la tarea.

Procedimiento:
1. Obtenga las predicciones de tiro cero de un modelo débil en una tarea.
2. Ajuste el modelo fuerte en datos de etiquetado débil.
3. Medir la precisión del modelo fuerte y ajustado.

Líneas de base: la precisión del modelo débil, el límite supervisionado del modelo fuerte en las etiquetas de oro.

Metrica de brecha: Performance Gap Recovered (PGR) = (finado - débil) / (techo - débil). PGR de 1.0 significa supervisión débil cierra completamente la brecha; PGR de 0 significa supervisión débil no ayudó.

### Burns et al. hallazgos empíricos

En las tareas de PNL, ajedrez y modelo de recompensa, el PGR fue consistentemente positivo: el modelo fuerte se generalizó más allá de los errores del supervisor débil.

Las limitaciones Burns et al. nota:
- La brecha entre débil y fuerte aquí es la capacidad, no la alineación. El modelo débil está alineado; un modelo verdaderamente sobrehumano podría estar alineado por un humano pero con una brecha de capacidad mucho mayor.
- La generalización del modelo fuerte puede ser más sobre las tareas anteriores que sobre la recuperación de la intención de la verdad de fondo.
- El verdadero problema es obtener el conocimiento latente del modelo fuerte; PGR mide una operacionalización específica.

### Supervisión escalable: tres mecanismos

- **Debate (Irving et al. 2018).**Dos ejemplos de U argumentan lados opuestos; el juez débil decide. La suposición: encontrar una respuesta verdadera convincente es más fácil que encontrar una respuesta falsa convincente. El trabajo reciente de 2024-2025 (Khan et al., Michael et al.) muestra que el debate a veces ayuda y a veces no, y si ayuda depende de la estructura de la tarea.
- **Recursive Reward Modeling (Leike et al. 2018).**U ayuda al humano a entrenar el modelo de recompensa para U+1.
- **Task Decomposition (Christiano, Shlegeris, Amodei 2018).**Descompone una tarea difícil en subtareas que el humano puede comprobar, recursivamente.

Cada mecanismo asume algo sobre la estructura de la tarea o la alineación de los componentes intermedios.

### Por qué la supervisión escalable y el W2SG son complementarios

La supervisión escalable aumenta la calidad de la señal efectiva del superintendente.
W2SG cierra la brecha de cualquier señal imperfecta que el superintendente pueda proporcionar.

Lang et al.  Debate Helps Weak-to-Strong Generalization (arXiv:2501.13124) las combina: un protocolo de debate proporciona mejores etiquetas débiles, y el modelo fuerte se entrena en esas etiquetas.

### El drama organizacional

El equipo de Superalignment de OpenAI se disolvió en mayo de 2024 después de la partida de Jan Leike a Anthropic. La agenda (supervisión escalable, W2SG, investigación de alineación automatizada) continuó en Anthropic y en laboratorios académicos  MATS (lección 28), Redwood (lección 10), Apollo (lección 8), METR (lección 28). La estructura organizacional cambió; las preguntas de investigación no lo hicieron.

### Donde esto encaja en la Fase 18

Las lecciones 6-10 describen la amenaza y el paradigma defensivo bajo la suposición de que U es poco confiable. La lección 11 es el paradigma ofensivo: hacer que el supervisor sea lo suficientemente fuerte como para verificar la alineación de U. Las lecciones 12-16 luego se vuelven a la herramienta práctica de evaluación adversarial.

```figure
scalable-oversight
```

## Usalo

`code/main.py`Simula una sintonía de W2SG en una tarea sintética. El etiquetador débil tiene una precisión del 70% con errores estructurados; el modelo fuerte tiene un techo del 95% en las etiquetas de oro.

## Envío

Esta lección produce`outputs/skill-w2sg-pgr.md`. Dado una descripción de la configuración de supervisión, identifica al supervisor débil, al modelo fuerte, a la calidad de la supervisión y calcula (o solicita) la PGR. Indica si la afirmación es "debil puede supervisar fuerte" o "debil + mecanismo de supervisión puede supervisar fuerte".

## Los ejercicios

1. - ¿ Qué ?`code/main.py`.Informe PGR para la precisión débil = 0,60, 0,70, 0,80. Explica la forma de la curva PGR.

2. Modificar el etiquetador débil para que tenga un error estructurado (por ejemplo, siempre equivocado en una clase de entrada específica). ¿Aumenta, disminuye o permanece igual el PGR?

3. Leer Burns et al. 2023 Sección 4.3 (Tascas de NLP). Reproduce la intuición de "pérdida auxiliar de confianza": cuando el modelo fuerte es más seguro que las etiquetas débiles, ¿quién gana?

4. Diseñar un protocolo de supervisión escalable que combine el debate y la descomposición de tareas para una tarea de ingeniería de software. Nombre un modo de falla de cada componente y explique cómo la combinación se dirige o no se dirige a cada uno.

5. Articula lo que falsearía la afirmación de que "la generalización de débil a fuerte es un camino viable hacia la superalienación".

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Scalable oversight | "making the overseer stronger" | Mechanisms that increase an overseer's ability to evaluate a more-capable model |
| W2SG | "weak supervises strong" | Fine-tuning a strong model on weak labels and measuring the capability recovered |
| PGR | "performance gap recovered" | (fine-tuned - weak) / (ceiling - weak); 1.0 = fully closed, 0 = no help |
| Debate | "two U instances argue" | Scalable oversight mechanism where a weak judge picks between two U defenders |
| RRM | "recursive reward modeling" | U helps train the reward model for U+1; overseer capability tracks U |
| Task decomposition | "sub-tasks the human checks" | Break a hard task into sub-tasks the human can verify, recursively |
| Superalignment | "aligning superhuman AI" | The research agenda concerned with aligning models the human cannot directly evaluate |

## Leer más

- [Burns et al. — Weak-to-Strong Generalization (OpenAI 2023)](https://openai.com/index/weak-to-strong-generalization/) el papel W2SG
- [Irving, Christiano, Amodei — AI safety via debate (arXiv:1805.00899)](https://arxiv.org/abs/1805.00899) el mecanismo de debate
- [Leike et al. — Scalable agent alignment via reward modeling (arXiv:1811.07871)](https://arxiv.org/abs/1811.07871) Modelado recurrente de recompensas
- [Khan et al. — Debating with More Persuasive LLMs Leads to More Truthful Answers (arXiv:2402.06782)](https://arxiv.org/abs/2402.06782) 2024 Estudio empírico del debate con debatedores más fuertes
- [Lang et al. — Debate Helps Weak-to-Strong Generalization (arXiv:2501.13124)](https://arxiv.org/abs/2501.13124) 2025 combinación de debates + W2SG
