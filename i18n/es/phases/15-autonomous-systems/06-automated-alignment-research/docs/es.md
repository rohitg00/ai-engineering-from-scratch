# Investigación de Alineación Automática (AAR antropológica)

> Anthropic dirigió equipos paralelos de Claude Opus 4.6 Autonomous Alignment Researchers en cajas de arena independientes, coordinándose a través de un foro compartido cuyos registros viven fuera de cualquier caja de arena (así que los agentes no pueden eliminar sus propios registros). En el problema de la formación de débil a fuerte, los AAR superaron a los investigadores humanos. Las propias señales de resumen de Anthropic que prescriben flujos de trabajo a menudo limitan la flexibilidad de AAR y degradan el rendimiento. La investigación de alineación automatizada comprime la línea de tiempo, y lo hace sobre los mismos riesgos de desalinamiento que el SPR tiene que detectar.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, parallel-research-forum simulator)
**Prerequisites:** Phase 15 · 05 (AI Scientist v2), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## El problema

La investigación de alineación es costosa en el tiempo del investigador humano. Problemas como supervisión escalable, especificación de la recompensa o entrenamiento de débil a fuerte requieren experimentos que tardan semanas por iteración. A medida que avanza la capacidad fronteriza, la carga de trabajo de alineación crece más rápido que el suministro de investigadores calificados.

La investigación de alineación automatizada (AAR) pregunta si los mismos modelos fronterizos cuya capacidad es superior a la alineación pueden contribuir a cerrar la brecha. El informe 2026 de Anthropic sobre un estudio de entrenamiento de débil a fuerte dirigido por AAR (alignment.anthropic.com/2026/automated-w2s-researcher/) es uno de los primeros resultados públicos de un sistema desplegado de esta clase.

El resultado es realmente positivo: los AR resolvieron un problema de investigación mejor que la línea de base humana. El resultado también concentra, en un solo sistema, todas las preocupaciones que esta fase ha desarrollado. Si la investigación de alineación puede ser automatizada, también pueden ser las partes que comprometen las salvaguardias. Los umbrales del RSP para la capacidad de I+D de IA están escritos teniendo en cuenta este bucle.

## El concepto

### La arquitectura (como se describe públicamente)

- **Parallel agents.**Múltiples instancias de Claude Opus 4.6 se ejecutan como AAR, cada una en una caja de arena independiente.
- **Shared forum.**Los resultados se publican en un foro compartido cuyo almacenamiento de fondo se encuentra fuera de cada caja de arena. Los agentes pueden leer el foro; los agentes no pueden eliminar o editar los registros del foro desde dentro de su propia caja de arena.
- **Task allocation.**Una cola de tareas diseñada por el hombre asigna problemas de investigación a los AAR.
- **Weak-to-strong training focus.**El estudio publicado abordó la formación de débil a fuerte  utilizando un modelo de supervisor más débil para capacitar a un modelo de estudiante más fuerte.

### Por qué es importante el registro de la caja de arena

La propiedad de integridad de registro es la diferencia entre un experimento controlado y uno potencialmente comprometido. Si los AAR pudieran editar sus propios registros, podrían encubrir experimentos fallidos o dudosos.

El analógico en términos de infraestructura son los registros de apéndice solo con escritura a través de almacenamiento externo (por ejemplo, bloqueo de objetos S3, registros Datadog inmutables). El agente no tiene credenciales para modificar registros pasados. Este es el mismo patrón que los equipos de seguridad corporativos 2026 utilizan para hacer rastros de auditoría resistentes a ransomware.

### El desafío de flujo de trabajo prescrito

El informe de Anthropic señala que los flujos de trabajo prescritos a menudo limitan la flexibilidad de AAR y degradan el rendimiento. En otras palabras: si el diseñador humano escribe el plan de investigación paso a paso, los AARs hacen peor que si se les dan objetivos de alto nivel y libertad para descomponerse. Esto es consistente con los resultados en toda la investigación agencial (LangGraph, el Marco de Agentes de Microsoft)  andamios demasiado especificados perjudican a los agentes capaces.

La flexibilidad que mejora el rendimiento de AAR es también la flexibilidad que permite la descomposición sin sanción, el uso de herramientas nuevas y la derivación de objetivos. La compensación es una decisión del espacio de diseño: ¿cuánta flexibilidad compra suficiente capacidad para vencer a los humanos, sin entregar el espacio de agente para generalizar objetivos fuera de la distribución?

### El riesgo de compresión

RSP v3.0 (Lección 19) introduce un umbral de capacidad de I+D de IA: la capacidad de automatizar completamente la tubería de I+D de IA a un costo competitivo frente a herramientas de IA + humanos. FSF v3 de DeepMind incluye un nivel de autonomía de I+D de ML análogo. Ambos marcos tratan este umbral como el desencadenante para controles elevados.

AAR está un paso por debajo del umbral: automatiza parte de la línea de trabajo (investigación de alineación sobre tareas específicas y bien ampliadas), pero no el ciclo de desarrollo de capacidades de extremo a extremo.

Los plazos comprimidos son la preocupación por la falla de la composición. Si la investigación de alineación y la investigación de capacidad se componen a tasas similares, la superficie de riesgo de desalinamiento crece al menos tan rápido como la capacidad. Si la capacidad se compone más rápido (la tendencia histórica), la brecha se amplía. Este es el argumento de que el AAR es un bien calificado: cada resultado adicional de alineación reduce la brecha si y sólo si el proceso de investigación es confiable.

### Lo que no sustituye el AAR

Los investigadores humanos establecen la cola de tareas, revisan los resultados y mantienen la autoridad constitucional. Los AAR aceleran la mitad del pipeline, no los fines. Los resultados publicados de Anthropic incluyen tanto las contribuciones AAR como el juicio humano-investigador sobre qué publicar, qué retractar y qué refinar.

Esto coincide con el patrón de proponer y luego comprometerse de la Lección 15 aplicada a la investigación misma: AARs proponen; humanos se comprometen.

```figure
aar-forum
```

## Usalo

`code/main.py`La aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la aplicación de la ley de la ley de la ley de la ley de la ley de 30 de 30 de 30 de junio de junio de julio de julio de de de julio de de de de de de de de de de de de de de de julio de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de de

- ¿Qué quieres ?

- Cómo la extracción de madera fuera de la caja de arena captura los intentos de manipulación de madera.
- Cómo la asignación de tareas con descomposición libre supera los flujos de trabajo fijos en problemas más difíciles.
- Cómo una sola AAR comprometida puede contaminar la señal del foro si el registro no es evidente.

## Envío

`outputs/skill-aar-deployment-review.md`es una revisión previa a la implementación de una línea de investigación de alineación automatizada.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`. Comparar la configuración de "flujo de trabajo fijo" con la de "descomposición libre". ¿Gana siempre la descomposición libre, o existen clases de problemas en las que el flujo de trabajo fijo es competitivo?

2. Modifique el simulador para que un agente intente manipular el registro. Confirme que el registro de apéndice lo detecta. Escriba un párrafo que describa exactamente cómo se ve la firma de detección en el registro.

3. Lea el informe de AAR de Anthropic de débil a fuerte. Identifique la subtarefa específica en la que los AAR superaron a los investigadores humanos. ¿Qué lo hizo susceptible a la automatización?

4. Diseñar una política de asignación de tareas en la cola que equilibre la flexibilidad de AAR (mejores resultados) con las restricciones del flujo de trabajo prescritas (auditoria más fácil). Describir cómo se analizaría A/B los dos.

5. Lea el umbral de I+D-4 de la IA de RSP v3.0. En un párrafo, describa lo que cree que cruzaría que AAR actualmente no.

## Términos clave

| Term | What people say | What it actually means |
|---|---|---|
| AAR | "Automated Alignment Researcher" | Claude Opus 4.6 instance operated autonomously on alignment problems |
| Weak-to-strong training | "Training a stronger model with a weaker supervisor" | Classic scalable-oversight benchmark AARs outperformed humans on |
| Shared forum | "Where agents publish findings" | Append-only, out-of-sandbox storage |
| Out-of-sandbox log | "Agent cannot edit its own record" | Tamper-evident write-through to external storage |
| Prescribed workflow | "Step-by-step plan from human designer" | Constrains AAR; often degrades performance vs free decomposition |
| Free decomposition | "Agent decides how to break the task" | More capable, harder to audit |
| AI R&D threshold | "RSP/FSF capability level" | Full automation of R&D pipeline at competitive cost |
| Compressed timeline | "Alignment vs capability race" | If capability compounds faster than alignment, misalignment risk grows |

## Leer más

- [Anthropic — Automated Weak-to-Strong Researcher](https://alignment.anthropic.com/2026/automated-w2s-researcher/) fuente primaria.
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) Enmarcamiento del umbral de I+D de la IA.
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) un marco más amplio de la autonomía de los agentes.
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) ML niveles de autonomía en I+D paralelos a los de RSP.
- [Burns et al. (2023). Weak-to-Strong Generalization (OpenAI)](https://openai.com/index/weak-to-strong-generalization/) el problema subyacente atacado por los AAR.
