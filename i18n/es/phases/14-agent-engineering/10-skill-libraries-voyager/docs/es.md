# Bibliotécas de habilidades y aprendizaje permanente (Voyager)

> Voyager (Wang et al., TMLR 2024) trata el código ejecutable como una habilidad. Las habilidades se nombran, se pueden recuperar, se componen y se refinan por retroalimentación ambiental. Esta es la arquitectura de referencia para las habilidades de Claude Agent SDK, el kit de habilidades y el patrón de biblioteca de habilidades 2026.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 07 (MemGPT), Phase 14 · 08 (Letta Blocks)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Nombre de los tres componentes de Voyager  currículo automático, biblioteca de habilidades, incitación iterativa  y el papel de cada uno.
- Explica por qué Voyager hace el código del espacio de acción, no comandos primitivos.
- Implementar una biblioteca de habilidades stdlib con registro, recuperación, composición y refinamiento impulsado por fallos.
- Mapa el patrón de Voyager en las habilidades de 2026 de Claude Agent SDK y el ecosistema de skillkit.

## El problema

Los agentes que reconstruyen todas las capacidades desde cero en cada sesión hacen tres cosas mal:

1. **Waste tokens.**Cada tarea re-evoca el mismo razonamiento.
2. **Lose progress.**Una corrección aprendida en la sesión A no se transfiere a la sesión B.
3. **Fail on long-horizon composition.**Las tareas complejas requieren jerarquías de capacidad; las instrucciones de un solo tiro no pueden expresarlas.

La respuesta de Voyager: tratar cada capacidad reutilizable como un trozo de código almacenado en una biblioteca, recuperable por similitud, composible con otras habilidades, y refinado por retroalimentación de ejecución.

## El concepto

### Tres componentes

Voyager (arXiv:2305.16291) estructura un agente alrededor de:

1. **Automatic curriculum.**Un proponente impulsado por la curiosidad elige la siguiente tarea en función del conjunto de habilidades y el estado del entorno del agente.
2. **Skill library.**Cada habilidad es un código ejecutable. Nuevas habilidades se añaden cuando una tarea tiene éxito.
3. **Iterative prompting mechanism.**En caso de fallo, el agente recibe errores de ejecución, retroalimentación ambiental y salida de auto-verificación, luego refina la habilidad.

La evaluación de Minecraft (Wang et al., 2024): 3.3 veces más elementos únicos, 8.5 veces más rápidas herramientas de piedra, 6.4 veces más rápidas herramientas de hierro, 2.3 veces más largo cruce de mapas frente a líneas de base.

### Espacio de acción = código

La mayoría de los agentes emiten comandos primitivos.

```
async function craftIronPickaxe(bot) {
  await mineIron(bot, 3);
  await mineStick(bot, 2);
  await placeCraftingTable(bot);
  await craft(bot, 'iron_pickaxe');
}
```

Compuesto de subcompetencias, almacenado con teclas en la descripción y la incorporación, recuperado como un programa, no como una solicitud.

Esta es la habilidad de 2026 Claude Agent SDK: un nombre, un trozo de código extraíble más instrucciones que el agente carga a pedido.

### Recuperación de habilidades

La nueva tarea es hacer una piceta de diamante.

1. Incluye la descripción de tarea.
2. Hacer consultas en la biblioteca de habilidades para obtener habilidades similares.
3. Recuperaciones `craftIronPickaxe`¿ Qué ?`mineDiamond`¿ Qué ?`placeCraftingTable`y otros.
4. Componen la nueva habilidad de primitivos recuperados + nueva lógica.

Este es el patrón de recursos de MCP (fase 13) y de habilidades de SDK de agentes implementados: recuperación sobre una superficie de conocimiento/código, enfocada a la tarea actual.

### Refinamiento iterable

El bucle de retroalimentación del Voyager:

1. El agente escribe una habilidad.
2. La habilidad se opone al medio ambiente.
3. Una de las tres señales regresa:`success`¿ Qué ?`error`(con rastro de pila), `self-verification failure`¿ Qué ?
4. El agente reescribe la habilidad usando la señal como contexto.
5. Loop hasta el éxito o rondas máximas.

Esto es Auto-Refine (Ley 05) aplicado a la generación de código con verificación basada en el entorno. CRITIC (Ley 05) es el mismo patrón con herramientas externas que el verificador.

### Currículo y exploración

El módulo de currículo de Voyager propone tareas como "construir un refugio cerca del lago" basándose en lo que el agente tiene y lo que aún no ha hecho. El proponente utiliza el estado ambiental + inventario de habilidades para elegir una tarea justo por encima de la capacidad actual  el punto dulce de exploración.

Para los agentes de producción esto se traduce en un operador de "lo que falta": dada la biblioteca de habilidades actual y un dominio, ¿qué habilidades aún no estamos cubriendo?

### Cuando este patrón va mal

- **Skill library rot.**La misma habilidad se añade 10 veces con descripciones ligeramente diferentes.
- **Composed-skill drift.**Las habilidades de los padres dependen de un niño que haya sido refinado.
- **Retrieval quality.**La extracción de vectores sobre las descripciones de habilidades se degrada a medida que la biblioteca crece más allá de unos cientos.`category=tooling`").

```figure
voyager-skills
```

## Construye el mismo

`code/main.py`Implementa una biblioteca de habilidades de STDlib:

- `Skill` nombre, descripción, código (como cadena), versión, etiquetas, dependencias.
- `SkillLibrary` registrar, buscar (superposición de tokens), componer (tipo topológico de deps) y refinar (versión de golpe en actualización).
- Un agente con guión que registra tres habilidades primitivas, compone una cuarta, golpea un fracaso y refinará.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

El rastro muestra escritos de la biblioteca, recuperación, composición, una ejecución fallida y un refinamiento de v2  ciclo de Voyager de extremo a extremo.

## Usalo

- **Claude Agent SDK skills**(Antropico)  la referencia 2026: cada habilidad tiene una descripción, código e instrucciones; cargado a pedido durante una sesión de agente.
- **skillkit**(npm: skillkit)  Gestión de habilidades entre agentes para 32+ agentes de codificación de IA.
- **Custom skill libraries** Específico de dominio (habilidades SQL para agentes de datos, habilidades Terraform para infra agentes).
- **OpenAI Agents SDK `tools`** en el extremo inferior; cada herramienta es una habilidad ligera.

## Envío

`outputs/skill-skill-library.md`genera una biblioteca de habilidades en forma de Voyager con registro, recuperación, versión y refinamiento conectados para cualquier tiempo de ejecución objetivo.

## Los ejercicios

1. Añadir un detector de ciclo de dependencia a `compose()`¿Qué sucede cuando la habilidad A depende de B que depende de A?
2. Implementar la versión por habilidad. Cuando una habilidad de padre compone a un niño`crafting@1`, un refinamiento a `crafting@2`no debe actualizar silenciosamente al padre.
3. Reemplazar la recuperación de tokens superpuestos con embeddings de transformadores de oraciones (o una impl stdlib BM25).
4. Añadir un agente de "curriculum": dada la biblioteca actual y una descripción de dominio, proponga 5 habilidades faltantes.
5. Lea los documentos de habilidades de Claude Agent SDK de Anthropic.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Skill | "Reusable capability" | Named chunk of code + description, retrievable by similarity |
| Skill library | "Agent memory of how-to" | Persistent store of skills, searchable and composable |
| Curriculum | "Task proposer" | Bottom-up goal generator driven by current capability gap |
| Composition | "Skill DAG" | Skills invoking skills; topologically sorted on execution |
| Iterative refinement | "Self-correcting loop" | Env feedback + errors + self-verification fold back into the next version |
| Action-space-as-code | "Programmatic actions" | Emit functions, not primitive commands, for temporally extended behavior |
| Dedup on write | "Skill collapse" | Near-duplicate descriptions collapse to one canonical skill |

## Leer más

- [Wang et al., Voyager (arXiv:2305.16291)](https://arxiv.org/abs/2305.16291) el papel original de la biblioteca de habilidades
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) las capacidades de producción para 2026
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) habilidades y sub-gentes en la práctica
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) el bucle de refinamiento debajo de Voyager
