# Auto-refinado y crítico: mejora iterativa de la producción

> Self-Refine (Madaan et al., 2023) utiliza un LLM en tres roles  generar, retroalimentación, refinar  en un bucle. La ganancia promedio: +20 absoluta en 7 tareas. CRITIC (Gou et al., 2023) endurece el paso de retroalimentación mediante la verificación de enrutamiento a través de herramientas externas. En 2026 este patrón se envía en cada marco como "evaluador-optimizador" (Antropic) o un bucle de barandillas (OpenAI Agents SDK).

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 03 (Reflexion)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Las tres instrucciones de Auto-Refinación del Estado (generar, retroalimentación, refinar) y explicar por qué la historia es importante para el instante de refinar.
- Explica la visión crítica de CRITIC: Los LLM no son confiables en la autoverificación sin fundamento externo.
- Implemente un bucle de auto-refinado stdlib con historial y un verificador externo opcional.
- Mapa de este patrón al flujo de trabajo "evaluador-optimizador" de Anthropic y los barrancos de salida de OpenAI Agents SDK.

## El problema

Un agente produce una respuesta que es casi correcta. Tal vez una línea de código tiene un error de sintaxis. Tal vez un resumen es demasiado largo. Tal vez un plan pierde un caso de borde. Lo que quieres es: el agente critica su propia salida, luego lo arregla.

Self-Refine muestra que esto funciona con un solo modelo, sin datos de capacitación, sin RL. Pero hay una trampa: los LLM son malos en la auto-verificación sobre hechos duros. CRITIC llama la solución  ruta el paso de verificación a través de herramientas externas (búsqueda, intérprete de código, calculadora, ejecutor de pruebas).

Juntos estos dos documentos definen el estándar 2026 para la mejora iterativa: generar, verificar (externamente cuando sea posible), refinar, detener cuando el verificador pasa.

## El concepto

### Auto-refinado (Madaan et al., NeurIPS 2023)

Un LLM, tres funciones:

```
generate(task)            -> output_0
feedback(task, output_0)  -> critique_0
refine(task, output_0, critique_0, history) -> output_1
feedback(task, output_1)  -> critique_1
refine(task, output_1, critique_1, history) -> output_2
...
stop when feedback says "no issues" or budget exhausted.
```

Detalle clave:`refine`El documento abla esto: el historial de caída y la calidad caen drásticamente.

Título: +20 mejoras absolutas promediadas en 7 tareas (matemáticas, código, acrónimo, diálogo) incluido el GPT-4.

### CRITA (Gou et al., arXiv:2305.11738, v4 feb 2024)

La debilidad de Self-Refine: el paso de retroalimentación es un LLM que se califica. Para las afirmaciones factuales esto es poco fiable (una alucinación a menudo parece convincente para el modelo que la produjo).`feedback(task, output)`con`verify(task, output, tools)`donde`tools`incluye:

- Un motor de búsqueda de afirmaciones de hecho.
- Un intérprete de código para la corrección del código.
- Una calculadora para la aritmética.
- Verificadores específicos de dominio (probas unitarias, controles de tipo, linters).

El verificador produce una crítica estructurada basada en los resultados de las herramientas.

Título: CRITIC supera a Auto-Refine en tareas de hecho porque la crítica está basada en tierra.

### La condición de parada

Dos formas comunes:

1. **Verifier passes.**Prueba externa que da resultados satisfactorios. Preferible cuando esté disponible (pruebas de unidad, comprobador de tipo, afirmación de barandillas).
2. **No feedback issued.**El modelo dice "la salida está bien". Más barato pero poco fiable; empareja con un límite máximo de iteración.

2026 por defecto: combinarlos. "Detener si el verificador pasa OR modelo dice bien Y iteraciones >= 2 OR iteraciones >= max_iterations".

### El valor de la inversión de la empresa se calcula en el valor de la inversión de la empresa.

En el post de Anthropic de diciembre de 2024, se menciona esto como uno de los cinco patrones de flujo de trabajo.

- Evaluador: califica la producción y produce una crítica.
- Optimizador: revisa la salida dada la crítica.

El equipo de evaluación de la información de la empresa de análisis de datos de la empresa de análisis de datos de datos de la compañía de investigación de la compañía de investigación de datos de la compañía de investigación de investigación de la compañía de investigación de datos de la compañía de investigación de investigación de la compañía de investigación de investigación de la compañía de investigación de la compañía de investigación de investigación de la compañía de investigación de la compañía de investigación de investigación de la compañía de investigación de la compañía de investigación de la compañía de investigación de la compañía de investigación de la compañía de investigación de la compañía de investigación de la compañía de investigación de la compañía de investigación de la marca de investigación de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca

### Protectores de salida de OpenAI Agents SDK

OpenAI Agents SDK envía este patrón como "gardales de salida".`OutputGuardrailTripwireTriggered`Los guardrails pueden llamar a herramientas (estilo CRITIC) o ser funciones puras (estilo Auto-Refine).

### 2026 trampas

- **Rubber-stamp loops.**El mismo modelo que hace generación y crítica con el mismo estilo de rapidez converge en "me parece bien". Utilice raposas estructuralmente diferentes, o un modelo más pequeño barato para la crítica.
- **Over-refinement.**Cada paso de refinamiento añade latencia y tokens. Pases de presupuesto 1-3; después de eso, escala a revisión humana.
- **CRITIC on trivial tasks.**Si no hay un verificador externo, CRITIC se degenera a Auto-Refine; no pague la latencia por un verificador de estubes.

```figure
self-refine
```

## Construye el mismo

`code/main.py`El verificador verifica el formato (3 balas, cada una de menos de 60 caras). CRITIC agrega un "verificador de hechos" externo que penaliza alucinaciones conocidas.

Componentes:

- `generate`Producente de guión.
- `feedback` Autocrítica de estilo LLM.
- `verify_external` Verificador basado en el estilo CRITIC.
- `refine` reescribe la salida dada historia.
- Condición de parada  pasa de verificador o max 4 iteraciones.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

Comparar las carreras de Auto-Refinación vs CRITIC. CRITIC detecta un error de hecho Auto-Refinación omitida porque el verificador externo ha aterrizado el auto-crítica no lo hace.

## Usalo

El evaluador-optimizador de Anthropic es este patrón en lenguaje amigable con Claude. Los barandillas de salida de OpenAI Agents SDK tienen forma CRITIC (los barandillas pueden llamar herramientas). LangGraph envía un nodo de reflexión que se lee como Auto-Refine. Gemini 2.5 Computer Use de Google agrega un evaluador de seguridad por paso que es una variante CRITIC: cada acción se verifica antes de comprometerse.

## Envío

`outputs/skill-refine-loop.md`Configura un bucle de evaluador-optimizador dado la forma de la tarea, la disponibilidad del verificador y el presupuesto de iteración. Emite instrucciones para el generador, evaluador/verificador y optimizador, además de una política de parada.

## Los ejercicios

1. Ejecutar el juguete con max_iterations=1. ¿Critic todavía ayuda?
2. Replace el verificador externo por uno ruidoso (políticos falsos al azar del 30%). ¿Qué hace el bucle? Esta es la realidad de 2026 de la mayoría de las pilas de barandillas.
3. Implementar una variante de "crítica del generador en diferentes modelos": generaciones de modelos grandes, críticas de modelos pequeños. ¿Vale más que el mismo modelo?
4. Lea la sección 3 de CRITIC (arXiv:2305.11738 v4). Nombre las tres categorías de herramientas de verificación y dé un ejemplo para cada una.
5. Mapa de los agentes OpenAI SDK `output_guardrails`¿Qué es lo que el SDK se equivoca y qué es lo que se correcta?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Self-Refine | "LLM that fixes itself" | Generate -> feedback -> refine loop in one model, with history |
| CRITIC | "Tool-grounded verification" | Replace feedback with an external verifier (search, code, calc, tests) |
| Evaluator-Optimizer | "Anthropic workflow pattern" | Two roles — evaluator scores, optimizer revises — looped to convergence |
| Output guardrail | "Post-hoc check" | OpenAI Agents SDK validator that runs after an agent produces output |
| Verify step | "Critique phase" | The load-bearing decision: grounded or self-rated |
| Refine history | "What the model already tried" | Prior outputs + critiques prepended to refine prompt; drop and quality collapses |
| Rubber-stamp loop | "Self-agreement failure" | Same-prompt critique returns "looks good"; fix with structurally different prompts |
| Stop condition | "Convergence test" | Verifier passes OR no feedback AND iteration cap; never single-condition |

## Leer más

- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) el papel canónico
- [Gou et al., CRITIC (arXiv:2305.11738)](https://arxiv.org/abs/2305.11738) Verificación basada en herramientas
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) Modelo de flujo de trabajo de evaluador-optimizador
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) barandillas de salida como verificadores en forma de CRITIC
