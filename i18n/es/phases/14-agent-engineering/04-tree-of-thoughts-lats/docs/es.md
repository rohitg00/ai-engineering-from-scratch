# Árbol de pensamientos y LATS: búsqueda deliberada

> Una única trayectoria de cadena de pensamiento no tiene espacio para retroceder. ToT (Yao et al., 2023) convierte el razonamiento en un árbol con autoevaluación en cada nodo. LATS (Zhou et al., 2024) unifica ToT con ReAct y Reflexion bajo Monte Carlo Tree Search.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 03 (Reflexion)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Razonamiento de marco como búsqueda: los nodos son "pensamientos", los bordes son "expansiones", el valor es "qué prometedor".
- Implementar una búsqueda de árbol BFS de estilo stdlib ToT con puntuación de autoevaluación.
- Extensión a un bucle de juguete LATS MCTS con selecciona / expande / simula / retropropaga.
- Decide cuándo la búsqueda vale el multiplicador de tokens (juego de 24, generación de código) y cuándo una sola trayectoria es suficiente (P&A simple).

## El problema

La cadena de pensamiento es una caminata lineal. Si el primer paso es incorrecto, cada paso posterior funciona en una mala premisa. En el juego de 24 (use cuatro dígitos con + − × ÷ para hacer 24), GPT-4 CoT alcanza una precisión del 4%. El modelo elige la subexpresión incorrecta temprano y no puede recuperarse.

El razonamiento necesita la capacidad de proponer múltiples candidatos, evaluarlos, elegir los prometedores y retroceder cuando aparecen puntos sin salida.

## El concepto

### Árbol de pensamientos (Yao et al., NeurIPS 2023)

Cada nodo es un paso intermedio coherente ("un pensamiento"). Cada nodo puede expandirse a pensamientos de K. El LLM autoevalúa cada nodo con un prompt de puntuación.

```
                     (root: "find 24 from 4 6 4 1")
                    /               |            \
           ("6 - 4 = 2")    ("4 + 1 = 5")    ("4 * 6 = 24")  <- Score: HIGH
              /   \              |                  |
          ...    ...          ...                finish
```

La autoevaluación es la pieza de carga.`sure / likely / impossible`la clasificación, `1..10`Los tres superaron sustancialmente a CoT en el Juego de 24 (4% -> 74% con GPT-4).

### LATS (Zhou et al., ICML 2024)

El LLM desempeña tres funciones:

- **Policy**: proponer candidato a las próximas acciones (estilo ReAct).
- **Value function**: obtener una trayectoria parcial (autoevaluación de estilo ToT).
- **Self-reflector**En caso de fallo, escriba una reflexión en lenguaje natural (estilo de reflexión) y usala para revisar futuras implementaciones.

El feedback ambiental (observaciones) se mezcla en la función de valor para que la búsqueda se informe por resultados reales de herramientas, no sólo opiniones de modelos.

### MCTS, mínimo

Cuatro fases por iteración:

1. **Select** caminar de raíz a hoja utilizando UCT (confianza superior ligada a los árboles).
2. **Expand** generar hijos K a través de la póliza.
3. **Simulate** el despliegue de un niño utilizando la póliza, puntuar la hoja con la función de valor (o recompensa ambiental).
4. **Backpropagate** actualizar los recuentos de visitas y las estimaciones de valor de la ruta.

Formula de TCC: `Q(s, a) + c * sqrt(ln N(s) / N(s, a))`El primer término es explotación, el segundo es exploración.`c`por tarea.

### La realidad de los costes

La búsqueda explota tokens. ToT en Juego de 24 utiliza 1001000x los tokens de CoT. LATS es similar. Esto no es gratuito; reserva búsqueda para:

- Tarea en la que una sola trayectoria sea demostrablemente insuficiente (juego de 24, código complejo).
- tareas donde el reloj de pared es menos importante que la corrección.
- tareas con una función de valor barata y confiable (teses unitarios para código, objetivo explícito para matemáticas).

Si su tarea tiene una sola respuesta correcta y un evaluador ruidoso, la búsqueda a menudo empeora las cosas  encuentra una respuesta incorrecta "buena puntuación".

### Posicionamiento 2026

La mayoría de los agentes de producción no ejecutan LATS. Ejecutan ReAct con verificación basada en herramientas (CRITIC, Lección 05).

- Los agentes de codificación que ejecutan pruebas como función de valor (estilo HumanEval).
- Agentes de investigación profunda que exploran múltiples vías de consulta.
- Flujos de trabajo pesados de planificación dentro de los subgrafos de LangGraph.

AlphaEvolve (Lección 11) es el extremo de 2025: búsqueda evolutiva sobre código, aptitud verificada por máquina, ganancias fronterizas (primera mejora en 4x4 matmul en 56 años).

```figure
tree-of-thoughts
```

## Construye el mismo

`code/main.py`los instrumentos:

- Un pequeño ToT BFS en una tarea estilizada "pick arithmetic ops".
- Un bucle de juguete LATS MCTS en la misma tarea (Select / Expand / Simulate / Backpropagate) con la selección de UCT.
- Una función de valor que compone una puntuación simbólica más una puntuación autoevaluación.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

El rastro muestra que ToT expande tres candidatos por nodo con BFS, en comparación con LATS convergiendo en el mejor despliegue a través de MCTS.

## Usalo

LangGraph envía la exploración en estilo ToT como patrones de subgrafos; el blog del equipo de LangChain en LATS (mayo 2024) es el tutorial de referencia.`TreeOfThoughts`Para la mayoría de los agentes de producción de 2026 este patrón vive detrás de un`if task_complexity > threshold: use_search()`gate  ver el patrón evaluador-optimizador en la Lección 05.

## Envío

`outputs/skill-search-policy.md`selecciona entre ReAct lineal, ToT, LATS y búsqueda evolutiva dada la forma de la tarea, el presupuesto y la fidelidad del evaluador.

## Los ejercicios

1. Ejecutar el juguete LATS con UCT c=0.1 vs c=2.0. ¿Qué cambios en la pista?
2. ¿MACTS todavía encuentra la mejor hoja? ¿Cuál es el mínimo de señal-ruido que tolera?
3. Implementar la búsqueda de rayos de ToT (mantener el top-k en cada nivel) y comparar con BFS. ¿Cuál es mejor con un presupuesto de tokens ajustado?
4. Leer LATS Sección 5.1. Reproduce el recuento de trayectoria de HumanEval: ¿cuántas implementaciones se necesitan para alcanzar el paso@1 reportado?
5. Lea el artículo de LATS sobre "cuando LATS ayuda menos". Escriba una regla de decisión de un párrafo que mapee la forma de la tarea para la estrategia de búsqueda.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Tree of Thoughts | "Branching CoT" | Yao et al. — tree of thought nodes with self-evaluation |
| LATS | "MCTS for LLMs" | Zhou et al. — unifies ToT + ReAct + Reflexion under MCTS |
| UCT | "Upper confidence bound" | Select formula balancing exploitation (Q) and exploration (ln N / n) |
| Value function | "How good is this state" | Prompted LLM score or environment reward; feeds backprop |
| Policy | "Action proposer" | ReAct-style generator; emits candidate next thoughts/actions |
| Rollout | "Simulated trajectory" | Walk from a node to a leaf using policy, score with value |
| Backpropagate | "Update ancestors" | Push the leaf's reward up the path, updating visit counts and Q |
| Search cost | "Token explosion" | 100-1000x CoT on Game of 24; budget before you adopt |

## Leer más

- [Yao et al., Tree of Thoughts (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) el papel canónico
- [Zhou et al., LATS (arXiv:2310.04406)](https://arxiv.org/abs/2310.04406) MCTS con retroalimentación de reflexión
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) patrones de subgrafo para la búsqueda
- [AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) búsqueda evolutiva con evaluadores programáticos
