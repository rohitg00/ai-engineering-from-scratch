# Indicadores de evaluación y coordinación

> Cinco puntos de referencia 2025-2026 abarcan el espacio de evaluación multiagente. **MultiAgentBench / MARBLE**(ACL 2025, arXiv:2503.01935) evalúa las topologías de estrellas/cadena/árbol/gráfico con indicadores clave; **graph is best for research**, la planificación cognitiva añade ~3% de logros históricos. **COMMA**evalúa la coordinación multimodal de información asimétrica; los modelos de vanguardia, incluida la lucha de GPT-4o para superar una línea de base aleatoria. **MedAgentBoard**(arXiv:2505.12371) cubre cuatro categorías de tareas médicas y a menudo encuentra que el multi-agente no domina el LLM único. **AgentArch**(arXiv:2509.10769) se basan en arquitecturas de agentes empresariales que combinan uso de herramientas + memoria + orquestación. **SWE-bench Pro**(El artículo[arXiv:2509.16941](https://arxiv.org/abs/2509.16941)El modelo fronterizo tiene un puntaje de ~23% en Pro vs. 70% + en Verified  una verificación de realidad sobre la contaminación. Claude Opus 4.7 (abril 2026) se informa en **64.3%**En Pro con coordinación explícita de agentes-équipos (no se ha publicado ninguna fuente primaria de Anthropic todavía  tratar como preliminar); Verdent (establo de agentes) golpes **76.1% pass@1**sobre Verificado ([Verdent technical report](https://www.verdent.ai/blog/swe-bench-verified-technical-report)¿ Qué es esto ?**AAAI 2026 Bridge Program WMAC**(El artículohttps://multiagents.org/2026/Esta lección se basa en las métricas de MARBLE, realiza un barrido topológico-metrico y pone la regla "simplemente pasar por el banco SWE Verificado no es evidencia de generalización".

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 15 (Voting and Debate Topology), Phase 16 · 23 (Failure Modes)
**Time:** ~75 minutes

## El problema

Cuando un documento afirma que "nuestro sistema multiagente es mejor", la pregunta es: mejor que qué, en qué, medido cómo? La era de evaluación multiagente de 2023-2024 fue un caos.

Sin benchmarks comparados, no se puede comparar dos sistemas multi-agentes de manera significativa. Peor aún, sin benchmarks de retención, los modelos fronterizos pueden contaminar. SWE-bench Verified se contaminó parcialmente en los corporales de entrenamiento a mediados de 2025; puntajes fronterizos inflados; Pro fue diseñado como una verificación de realidad no contaminada.

Esta lección enumera los cinco criterios de referencia canónicos de 2026, nombra lo que cada uno mide, y te enseña a leer los reclamos de referencia con escepticismo.

## Concepto

### MultiAgentBench (MARBLE)  ACL 2025

ArXiv:2503.01935. Evalúa cuatro topologías de coordinación (estrella, cadena, árbol, gráfico) en tareas de investigación, codificación y planificación.

Resultados medidos:

- **Graph**La mejor topología para escenarios de investigación; apoya cualquier crítica.
- **Chain**mejor para la codificación de refinamiento gradual.
- **Star**mejor para una consolidación rápida y real.
- **Coordination tax**aparece más allá de ~4 agentes en el gráfico.
- **Cognitive planning**añade ~3% logro de hitos en todas las topologías.

Utilice cuando: desea comparar topologías de coordinación manzanas a manzanas.https://github.com/ulab-uiuc/MARBLE) es el evaluador.

### COMMA  Información asimétrica multimodal

Las actividades de la GPT-4o se desarrollan en el marco de la investigación de la información y de la información, y se desarrollan en el marco de la investigación de la GPT-4o.**random baseline**La Comisión ha puesto de manifiesto que la cooperación entre agentes y agentes en COMMA es una señal de que las modalidades de múltiples agentes están poco capacitadas y poco evaluadas.

Utilice cuando: su sistema tiene una coordinación multimodal o asimétrica de información.

### MedAgentBoard  prueba de estrés de dominio

ArXiv: 2505.12371. Cuatro categorías de tareas médicas: diagnóstico, planificación del tratamiento, generación de informes, comunicación con el paciente. Comparación de sistemas basados en reglas convencionales con múltiples agentes vs. LLM único.

En el caso de las tareas de gestión de los sistemas de gestión de datos, la diferencia entre los sistemas de gestión de datos y los sistemas de gestión de datos es que el sistema de gestión de datos de datos de datos de los sistemas de gestión de datos de datos de los sistemas de gestión de datos de datos de los sistemas de gestión de datos de datos de datos de los sistemas de gestión de datos de datos de los sistemas de gestión de datos de datos de los sistemas de gestión de datos de datos de los sistemas de gestión de datos de datos de los sistemas de gestión de datos de datos de datos de los sistemas de gestión de datos de datos de datos de los sistemas de gestión de datos de datos de datos de datos de los sistemas de gestión de datos de datos de datos de datos de datos de datos de los sistemas de gestión de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de

Utilice cuando: su dominio tiene líneas de base claras de un solo LLM. Si la lección de MedAgentBoard generaliza, muchos sistemas multi-agentes propuestos son sobre-ingenieros.

### AgentArch  Arquitecturas empresariales

ArXiv:2509.10769. Configuraciones empresariales con uso de herramientas, memoria y orquestación en capas juntas.

Utilice cuando: está diseñando una pila de agentes empresariales y necesita justificar cada capa. AgentArch ayuda a evitar comprar características de las que no puede medir el valor.

### SWE-bench Pro  la verificación de la realidad

1865 problemas en 41 repositorios que abarcan aplicaciones de negocios, servicios B2B y herramientas de desarrollo.**uncontaminated**Los modelos fronterizos obtienen un puntaje de ~23% en Pro vs. 70% + en Verified.

Resultados de abril de 2026:
- Claude Opus 4.7 en Pro: **64.3%**(reportado con coordinación explícita entre agentes y equipos; ninguna fuente primaria de Anthropic publicada todavía  tratada como preliminar).
- Verdent (establo de agentes) en Verificado: **76.1% pass@1**(El artículo[technical report](https://www.verdent.ai/blog/swe-bench-verified-technical-report)¿Qué es lo que se hace?
- Puntos en bruto fronterizos en Pro sin andamios de agentes: ~23-35% ([SWE-bench Pro paper](https://arxiv.org/abs/2509.16941)¿Qué es lo que se hace?

El resultado: "batemos a la banca SWE Verified" ya no es evidencia de capacidad. Pro es la prueba de gating actual. El andamio de equipo de agentes produce ganancias medibles en Pro (~ 30-40 puntos delta), que es uno de los argumentos empíricos más fuertes para la coordinación multi-agente en 2026.

### AAAI 2026 WMAC

Programa de puentes de la AAAI 2026  Taller sobre la coordinación entre múltiples agentes (https://multiagents.org/2026/El objetivo de la investigación de IA multiagente es el 2026 (en inglés). Los trabajos y los talleres aceptados son el lugar canónico para evaluar nuevos métodos; se dejan de hacer las afirmaciones aceptadas por el WMAC sobre las preprints de arXiv para las decisiones de producción.

### Lea con escepticismo las afirmaciones de referencia  la lista de verificación de 2026

Cuando alguien reclama un resultado multi-agente:

1. **Which benchmark, which split?**El banco SWE Verified vs Pro es muy importante.
2. **Contamination check.**¿Se liberó el índice de referencia después de la interrupción de entrenamiento del modelo?
3. **Baseline comparison.**Contra el trabajo de base de un solo LLM, contra el aleatorio, contra el trabajo anterior de varios agentes.
4. **Statistical significance.**Los modelos fronterizos son de alta variabilidad; las carreras individuales engañan.
5. **Task diversity.**¿Una tarea o muchas? La generalización es importante para la producción.
6. **Cost disclosure.**Un 90% de solución a 20 veces el costo es una decisión de negocio, no una reclamación de capacidad.

### Lo que ninguno de los indicadores de referencia mide bien

- **Long-horizon coordination.**Días de interacción entre el reloj de la pared.
- **Adversarial resilience.**¿Qué sucede cuando un agente es malicioso o comprometido?
- **Drift under deployment.**Los puntos de referencia son estáticos; las distribuciones de producción cambian.
- **Cost-normalized performance.**La mayoría de los índices de referencia informan precisión bruta, no precisión por dólar.

Construir su propio punto de referencia interno para el eje que realmente le importa es a menudo el movimiento correcto.

```figure
a5-bench-gap
```

## Construye el mismo

`code/main.py`es un paseo no interactivo:

- Simula 3 sistemas multi-agentes en una tarea de juguete.
- Computa métricas de hitos de estilo MARBLE para cada uno.
- Realiza un control de contaminación reteniendo tareas de un conjunto de "entrenamiento".
- Se compara con una línea de base aleatoria explícitamente.
- Imprime una tarjeta de calificación de las reclamaciones de referencia.

- ¿Qué quieres decir ?

```bash
python3 code/main.py
npx tsx code/main.ts
```

Resultados esperados: tarjeta de puntuación del sistema con precisión en bruto, logro de hitos, costo por tarea, delta de referencia frente al al azar, y nota de verificación de contaminación.

## Usalo

`outputs/skill-benchmark-reader.md`Se le a las empresas que se encuentran en el mercado de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de

## Envío

Disciplina de evaluación de la producción:

- **Build an internal benchmark**Los índices de referencia públicos informan, pero no sustituyen.
- **Include a random baseline**Si no puedes superar al azar con un gran margen en una tarea de coordinación, la tarea puede estar mal posicionada.
- **Report cost alongside accuracy.**El costo de los tokens y el reloj de la pared.
- **Rebuild the benchmark quarterly.**Cambios en la distribución de la producción; valores de referencia obsoletos engañosos.
- **Avoid published-benchmark overfitting.**Si su equipo está optimizando específicamente para números de SWE-bench Pro, regresará a la producción.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Identificar cuál de los tres sistemas simulados tiene el mejor coste por hito. ¿Combina con el sistema de precisión en bruto más alto?
2. Leer MultiAgentBench (arXiv:2503.01935). Para su propio dominio de tareas, decida cuál de las cuatro topologías MARBLE recomendaría.
3. ¿Qué es lo que hace que sea resistente a la contaminación? ¿Podría aplicarse la misma técnica a otros puntos de referencia que le importan?
4. Leer el hallazgo de COMMA sobre la coordinación multimodal. Diseñar una tarea de coordinación multimodal simple que pueda agregar a su referencia interna. ¿Qué contaría como una señal útil?
5. Aplicar la lista de verificación de las reclamaciones de referencia al resultado principal de un reciente artículo de múltiples agentes. ¿Qué calificación daría usted a la reclamación?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MARBLE | "MultiAgentBench" | ACL 2025; star/chain/tree/graph topologies with milestone KPIs. |
| COMMA | "Multimodal benchmark" | Multimodal asymmetric-info coordination; frontier models struggle vs random. |
| MedAgentBoard | "Domain stress test" | Four medical categories; often finds multi-agent does not dominate single-LLM. |
| AgentArch | "Enterprise benchmark" | Tools + memory + orchestration layered. |
| SWE-bench Pro | "Contamination-resistant" | 1865 problems, 41 repos; ~23% vs 70%+ on Verified (the contamination signal). |
| Milestone achievement | "Partial credit" | Benchmarks that reward progress, not only final success. |
| Contamination | "Benchmark leaked into training" | Post-release, benchmarks drift into training corpora; scores inflate. |
| WMAC | "AAAI 2026 Bridge Program" | Workshop on Multi-Agent Coordination; community focal point. |

## Leer más

- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) Indicadores de referencia de topología con indicadores clave
- [MARBLE repository](https://github.com/ulab-uiuc/MARBLE) Implementación de referencia
- [MedAgentBoard](https://arxiv.org/abs/2505.12371) prueba de estrés de dominio; a menudo no domina el multiagente
- [AgentArch](https://arxiv.org/abs/2509.10769) Arquitecturas de agentes empresariales
- [SWE-bench leaderboards](https://www.swebench.com/) Resultados verificados y Pro para modelos fronterizos
- [AAAI 2026 WMAC](https://multiagents.org/2026/) el punto focal comunitario de 2026
