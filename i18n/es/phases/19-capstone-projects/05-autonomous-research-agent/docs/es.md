# Capstone 05  Agente de investigación autónomo (clase de IA-científico)

> El científico de IA de Sakana-v2 publicó artículos completos. El Laboratorio de Agentes realizó los experimentos. Allen AI compartió rastros. La forma 2026 es la búsqueda de árboles de planes ejecutados-verificados sobre experimentos, costo presupuestado, ejecución de código sandboxed, un escritor de visión-feedback LaTeX y un conjunto de revisores automatizado de estilo NeurIPS. La piedra angular es construir una, ejecutarla de un extremo a otro dentro de los 30 dólares por papel, y sobrevivir al equipo rojo que Sakana documentó.

**Type:** Capstone
**Languages:** Python (agent + sandbox), TypeScript, LaTeX (output)
**Prerequisites:** Phase 2 (ML), Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 18 (safety)
**Phases exercised:**P0 · P2 · P3 · P7 · P10 · P14 · P15 · P16 · P18
**Time:** 40 hours

## El problema

Los agentes de investigación autónomos cruzaron un umbral en 2026. El AI-Scientist-v2 de Sakana AI fue publicado en Nature con artículos generados que permitieron la revisión por pares del taller. ShinkaEvolve (ICLR 2026) amplió la línea a las hipótesis en evolución. El Laboratorio de Agentes de AMD envió rastros reproducibles. Los agentes no son mágicos son un bucle de verificación de proyectos ejecutados que se ejecuta sobre un árbol de experimentos candidatos, con límites de costo, cajas de arena ligadas a semillas y revisión automática. La nave está en el ciclo, el presupuesto, y la historia de seguridad.

Aprendes el bucle implementando uno contra una idea de semilla en un dominio estrecho (por ejemplo, ablaciones de la disparidad de atención en un transformador de parámetro de 100M). El valor no está en descubrir algo nuevo en la primera vuelta. El valor está en la infraestructura: la búsqueda de árboles, la caja de arena de experimento, el bucle de escritor-revisor, el informe del equipo rojo. El equipo de Sakana documentó fallas en la escapada de la caja de arena. Tu agente debe pasar por el mismo equipo rojo.

## Concepto

El agente es un mejor buscador de árboles. Los nodos son especificaciones del experimento: (hipótesis, configuración, código, resultado esperado). Un paso de expansión propone a los niños con pequeñas modificaciones (optimizador de intercambio, tamaño de lote de cambio, ablate un componente). Cada niño corre en una caja de arena fresca con una tapa de recursos duros. Los resultados se transmiten a una función de puntuación que clasifica los nodos por (novedad × calidad × presupuesto restante). El árbol crece hasta que el presupuesto se agota, luego se escribe la mejor rama.

El escritor es multimodal. Generará un borrador de LaTeX, lo compilará, renderizará cifras y enviará el PDF renderizado de nuevo al modo de visión de Claude Opus 4.7 para la crítica del diseño, la legibilidad de las figuras y la alineación de la evidencia de reclamación. Un conjunto de revisores de cinco jueces de LLM emite puntuaciones de estilo NeurIPS (novedad, rigor, claridad, reproducibilidad, impacto); si el promedio cae por debajo del umbral, el artículo regresa al escritor con crítica.

La seguridad es soportada. Cada experimento se ejecuta en una caja de arena E2B o Daytona sin salida de red, sin reloj de pared limitado y sin límites de recursos fijados. El paso de generación de código del agente pasa a través de una capa de política que bloquea las llamadas de sistema que escapan de la caja de arena. El informe del equipo rojo reproduce la superficie de ataque documentada por Sakana (bombas forjadas, escapes del sistema de archivos, llamadas de red escritas por LLM).

## Arquitectura

```
seed idea + domain
      |
      v
  literature search (Semantic Scholar + OpenAlex + FAISS cache)
      |
      v
  LangGraph plan-execute-verify tree
      |
      v
  +--- expand node ----+      per-node sandbox
  |                    |      (E2B / Daytona)
  v                    v      resource caps
  child_1           child_k   no network egress
  |                    |      deterministic seeds
  v                    v
  run experiment       run experiment
  |                    |
  v                    v
  score nodes by (novelty, quality, budget)
      |
      v
  best branch -> LaTeX writer
      |
      v
  compile + vision critique (Opus 4.7 vision)
      |
      v
  reviewer ensemble (5 LLM judges, NeurIPS rubric)
      |
      v
  paper.pdf + review.md + trace.json
```

## El establo

- Orquestación: LangGraph con puertas de control y aprobación humana
- Busca en árboles: mejor personalizado primero sobre los nodos de experimento (estilo AB-MCTS de Sakana v2)
- Sandbox: E2B por experimento, Docker-in-Docker fallback; límites de recursos a través de grupos
- Literatura: API de gráfico de académicos semánticos + OpenAlex + caché local de resúmenes FAISS
- Escritor: plantilla LaTeX + Claude Opus 4.7 (modo de visión) para la crítica y el diseño de las figuras
- Recendiente: conjunto de 5 jueces (Opus 4.7, GPT-5.4, Gemini 3 Pro, DeepSeek R1, Qwen3-Max) con agregación ponderada
- Marco de experimentación: PyTorch 2.5 para los experimentos físicos, W&B para la tala
- Observabilidad: Langfuse para rastrear agentes, presupuesto duro de $30 por papel

```figure
ce-experiment-tree
```

## Construye el mismo

1. **Seed and domain scoping.**Tomemos una idea de semilla (por ejemplo, "investigar patrones de esparcia en mapas de atención de transformadores sub-1B"). Define el espacio de búsqueda: modelos, conjuntos de datos, presupuesto de cálculo.

2. **Literature pass.**Consultar a un estudioso semántico + OpenAlex para 50 artículos relevantes más citados; resúmenes de caché localmente; generar un digesto de dominio de 1 página.

3. **Tree scaffolding.**Inicializa la raíz con la hipótesis de la semilla.`expand(node) -> children`con propuestas de edición pequeña (un cambio de configuración por niño).`score(node)`como novedad ponderada × calidad × plazo presupuestario.

4. **Sandbox wrapping.**Cada experimento se ejecuta .`docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only`Las semillas se escriben en la caja de arena; las salidas se montan para leer sólo hacia atrás.

5. **Plan-execute-verify loop.** `plan`propone hijos. `execute`ejecuta la caja de arena, captura registros y métricas. `verify`Los nodos fallidos obtienen una razón de fallo almacenada en el árbol.

6. **Writer.**Después del presupuesto, seleccione la mejor rama. Render figuras con matplotlib. Generar un borrador de LaTeX a través de Claude Opus 4.7 con el rastro de la rama en contexto. Compila. Alimenta el PDF compilado de nuevo a Opus 4.7 visión para la crítica. Iterar.

7. **Reviewer ensemble.**Cinco jueces califican el borrador en (novedad, rigor, claridad, reproductibilidad, impacto) con rúbricas de estilo NeurIPS. Si la media <4,0/5, vuelve al escritor con crítica.

8. **Red team.**Construir o integrar un conjunto de tareas adversarias dirigidas a la caja de arena: bombas de tenedor, intentos de exfiltración de red, escapes del sistema de archivos, metacaracteres de cáscara escritos en LLM. Confirmar que todos están bloqueados. Escribir los hallazgos.

9. **Reproducibility.**Cada papel se envía con su búsqueda de árboles de rastreo JSON, semillas, enlaces de ejecución W & B, configuraciones de sandbox, y un README que lo reproduce de extremo a extremo.

## Usalo

```
$ ai-scientist run --seed "attention sparsity in sub-1B transformers" --budget 30
[lit]    50 papers, digest in 12s
[tree]   expanded 8 nodes, budget 12/30
[exec]   node #3 sparsity=top-8, loss=2.83 (best so far)
[exec]   node #6 sparsity=top-4, loss=3.12 (worse)
[exec]   ...
[tree]   chose branch rooted at node #3 (novelty 0.62, quality 0.81)
[write]  LaTeX draft v1 complete
[vision] critique: figure 2 legend too small, claim-evidence ok
[write]  draft v2 after 3 edits
[review] mean 4.2/5 (novelty 3.9, rigor 4.3, clarity 4.1, repro 4.5, impact 4.2)
[done]   paper.pdf + review.md + trace.json     $28.40 spent
```

## Envío

`outputs/skill-ai-scientist.md`Dado una idea de semilla + un dominio + un presupuesto de $ 30, ejecuta la línea completa y emite un papel revisable más un paquete de reproducibilidad.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Paper quality | Blind rubric review against published workshop papers |
| 20 | Experimental rigor | Baselines, seeds, ablations; every claim backed by a cell in the results table |
| 20 | Cost and compute discipline | $30/paper ceiling enforced, Langfuse-traced |
| 20 | Safety | Sandbox red team passes; network policy and kill-switch verified |
| 15 | Reproducibility | One-command rerun with identical seeds reproduces the paper |
| **100** | | |

## Los ejercicios

1. Compare las partes de la búsqueda de árboles que se superponen, identifique la computación duplicada y desperdicia.

2. Añadir una puerta de entrada humana antes de ejecutar el experimento para nodos estimados por encima de $5.

3. Cambiar el conjunto de críticos por un solo juez, medir la tasa de aceptación falsa en un conjunto de papeles conocidos de mala calidad.

4. Introduzca una prueba de equipo rojo de exfiltración de red: el agente escribe código que intenta `curl`Una dirección externa.`--network=none`La política lo bloquea.

5. Comparar la búsqueda en árboles con una línea de base aleatoria plana (el mismo presupuesto, sin estrategia de expansión).

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Tree search | "AB-MCTS-style expansion" | Best-first exploration over experiment nodes with a novelty×quality×budget score |
| Sandbox | "Experiment isolation" | Container with no network, bounded CPU/memory, pinned seeds, read-only inputs |
| Vision critique | "Render-then-read" | Compile the paper to PDF, feed the PDF back to a VLM for layout and claim-evidence critique |
| Reviewer ensemble | "Automated peer review" | Multiple LLM judges scoring the paper with a NeurIPS rubric; weighted aggregate gates the pipeline |
| Novelty score | "Is this new?" | Heuristic that penalizes proximity to the 50-paper literature cache |
| Cost ceiling | "$ budget" | Hard cap on total spend per paper; Langfuse counters + pre-run estimates |
| Red team | "Sandbox-escape audit" | Adversarial tasks that would escape the sandbox if the policy is wrong |

## Leer más

- [Sakana AI-Scientist-v2 repository](https://github.com/SakanaAI/AI-Scientist-v2) el agente de investigación de producción de referencia
- [Sakana AI-Scientist-v1 paper (arXiv:2408.06292)](https://arxiv.org/abs/2408.06292) la metodología original
- [ShinkaEvolve (Sakana ICLR 2026)](https://sakana.ai) Extensión evolutiva
- [Agent Laboratory (AMD)](https://github.com/SamuelSchmidgall/AgentLaboratory) marco de laboratorio de investigación multifunción
- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) capa de orquestación de referencia
- [Semantic Scholar Graph API](https://api.semanticscholar.org/) Buscar literatura
- [E2B sandboxes](https://e2b.dev) aislamiento de experimentos de referencia
- [NeurIPS reviewer guidelines](https://neurips.cc/Conferences/2026/ReviewerGuidelines) la rúbrica que el conjunto de revisores codifica
