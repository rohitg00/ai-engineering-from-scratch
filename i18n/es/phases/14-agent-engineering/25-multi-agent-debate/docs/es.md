# Debate y colaboración entre varios agentes

> Du et al. (ICML 2024, "Sociedad de Mentes") ejecuta instâncias de modelo N que proponen respuestas independientemente, luego se critican iterativamente entre sí en rondas R para converger. Mejora la factualidad, el seguimiento de reglas, el razonamiento.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 05 (Self-Refine and CRITIC)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Explicar el protocolo de debate: N propuestas, R rondas, convergen en una respuesta compartida.
- Describa por qué el debate mejora la realidad, el cumplimiento de las reglas y el razonamiento.
- Explica una topología escasa: no todos los debatedores necesitan verse entre sí.
- Implementar un debate sobre un LLM con guión con variantes de red completa y escasas; medir el costo de los tokens frente a la precisión.

## El problema

El auto-refinamiento (lección 05) es un modelo que se critica a sí mismo  riesgo de pensamiento grupal. CRITIC (lección 05) justifica la crítica en herramientas externas  no siempre disponibles. El debate introduce un tercer modo: múltiples instancias, crítica cruzada, convergencia por desacuerdo.

## El concepto

### Sociedad de las Mentes (Du et al., ICML 2024)

- N ejemplos modelo proponen de forma independiente respuestas a la misma pregunta.
- Durante las rondas R, cada modelo lee las propuestas de los demás y las critica.
- Los modelos actualizan sus respuestas basándose en las críticas.
- Después de las rondas R, devuelva la respuesta convergente.

Los experimentos originales utilizaron N=3, R=2 debido al costo. La precisión mejora con más agentes y más rondas en problemas difíciles (MMLU, GSM8K, Valididad de movimiento de ajedrez, generación de biografía).

Las combinaciones de modelos cruzados superan los debates de modelos únicos: ChatGPT + Bard juntos > cualquiera solo.

### Topología de la escasa

"Mejorar el debate multi-agente con la topología de comunicación de Sparse" (arXiv:2406.11776, 2024-2025) mostró que el debate de red completa no siempre es óptimo. Las topologías de Sparse (estrella, anillo, centro y voz) pueden igualar la precisión a un menor costo de token. Cada debater ve solo un subconjunto de pares.

Las implicaciones:

- N=5, R=3 = 5 × 3 = 15 propuestas, cada una leyendo 4 pares = 60 opciones de crítica.
- Estrella N=5, R=3 (un centro + 4 bocinos) = 15 propuestas, bocinos sólo leen el centro = 12 operaciones de crítica.

### Cuando el debate ayuda

- **Factuality.**En las propuestas independientes, el control cruzado reduce las alucinaciones.
- **Rule-following.**Validez de movimiento de ajedrez  un modelo pierde una regla, otros la atrapan.
- **Open-ended reasoning.**Muchos marcos se limitan a la respuesta correcta.

### Cuando el debate duele

- **Latency-sensitive UX.**Las rondas en serie N × R es la latencia que tal vez no tengas.
- **Cost-sensitive scale.**N × R tokens por pregunta.
- **Simple factual lookups.**Una búsqueda es más barata que cinco debates.

### 2026 instancias prácticas

- **Anthropic orchestrator-workers**(Lección 12)  una variante del debate con un paso de síntesis.
- **LangGraph supervisor**(Lección 13)  Router central + agentes especializados pueden implementar el debate como un nodo.
- **OpenAI Agents SDK**(Lección 16)  Los agentes se entregan para la crítica iterativa.
- **Multi-agent evals** debate en pareja + evaluador-optimizador para la señal de evaluación.

### Cuando este patrón va mal

- **Convergence collapse.**Todos los agentes convergen en la primera respuesta equivocada, y se mitigan con las rondas de desacuerdo requeridas.
- **Hub failure.**En una topología estelar, un mal centro corrompe a todos.
- **Prompt homogenization.**Todos los agentes utilizan el mismo tipo de instrucciones, producen las mismas respuestas, utilizan diferentes instrucciones y/o modelos.

```figure
debate-converge
```

## Construye el mismo

`code/main.py`Implementa el debate de la Sdlib:

- `Debater`clase (Mestre de Derecho escrito con derivación de opinión por debatedor).
- `FullMeshDebate`y `SparseDebate`Los corredores.
- Tres preguntas: una factual, una basada en reglas, una razonamiento.
- Metricas: respuesta convergente, rondas a convergencia, operaciones de crítica total.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

Resultado: exactitud y coste por protocolo; coincidencias escasas en 2/3 de las preguntas a un coste menor.

## Usalo

- **Anthropic orchestrator-workers**Para debates simples de dos o tres trabajadores.
- **LangGraph**El Parlamento Europeo ha aprobado el informe de la Comisión en el marco del debate sobre el tema.
- **Custom**para investigaciones o garantías de corrección especializadas.

## Envío

`outputs/skill-debate.md`El programa de trabajo de la Comisión de Investigación y Desarrollo de la Información sobre la información sobre la información y la información sobre la información sobre la información y la información sobre la información y la información sobre la información y la información sobre la información y la información sobre la información y la información sobre la información y la información sobre la información.

## Los ejercicios

1. Implementar una regla de "desacordo forzado": en la primera ronda, cada debater debe presentar una propuesta distinta.
2. Añadir una agregación ponderada por confianza: los debatedores regresan (respuesta, confianza); el agregador pesa por confianza. ¿Ayudan?
3. ¿Es la heterogeneidad que mejora la precisión?
4. Medir el costo de los tokens para la malla completa vs. escaso en sus 3 preguntas.
5. Lea el artículo de la Sociedad de Mentes.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Debate | "Multi-agent critique" | N proposers, R rounds of cross-critique, converge |
| Full mesh | "Everyone reads everyone" | Every debater reads every peer each round |
| Sparse topology | "Limited peer view" | Debaters read only a subset of peers |
| Hub-and-spoke | "Star topology" | One central debater, N-1 spokes read only the hub |
| Convergence | "Agreement" | Debaters converge on a shared answer |
| Society of Minds | "Du et al. debate paper" | ICML 2024 multi-agent debate method |

## Leer más

- [Du et al., Improving Factuality and Reasoning in Language Models through Multiagent Debate (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) debate canónico multi-agente
- [Sparse Communication Topology (arXiv:2406.11776)](https://arxiv.org/abs/2406.11776) resultados topológicos escasos
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) los trabajadores orquesta­doros como variante de debate
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) contraparte de autocrítica de modelo único
