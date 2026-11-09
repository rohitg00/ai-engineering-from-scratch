# Red-Teaming: PAIR y ataques automatizados

> El gobierno de China ha adoptado una nueva política de control de la población de la región. PAIR  Rapid Automatic Iterative Refinement  es el jailbreak automático canónico de caja negra. Un LLM atacante con un sistema de red-team prompt propone iterativamente jailbreaks para un LLM objetivo, acumulando intentos y respuestas en su propio historial de chat como retroalimentación en contexto. PAIR suele tener éxito dentro de 20 consultas, órdenes de magnitud más eficientes que GCG (la búsqueda de gradientes a nivel de tokens de Zou et al.) y sin requerir acceso a caja blanca. PAIR es ahora una línea de base estándar en JailbreakBench (arXiv:2404.01318) y HarmBench, junto con GCG, AutoDAN, TAP y Prompt Adversarial Persuasive.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, mock PAIR loop against a toy target)
**Prerequisites:** Phase 18 · 01 (instruction-following), Phase 14 (agent engineering)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Describa el algoritmo PAIR: el sistema de ataque rápido, la refinamiento iterativo, la retroalimentación en contexto.
- Explica por qué PAIR es estrictamente más eficiente que GCG cuando el objetivo es la caja negra.
- Nombre de otras cuatro líneas de base de ataque automatizado (GCG, AutoDAN, TAP, PAP) y indicar una característica distintiva de cada una.
- Describa los protocolos de evaluación de JailbreakBench y HarmBench y qué significa "tipo de éxito de ataque" en cada uno.

## El problema

El red-teaming solía ser una actividad manual. Un pequeño número de expertos probadores construyeron las instrucciones adversarias y rastrearon las que funcionaron. Esto no se escala: la tasa de éxito del ataque necesita una muestra estadística, y el objetivo es un objetivo en movimiento con cada lanzamiento de un modelo. PAIR operacionaliza el red-teaming como un problema de optimización con un objetivo de caja negra.

## El concepto

### Algorithm de la pareja

Las entradas:
- Objetivo LLM T (el modelo que estamos atacando).
- El juez LLM J (ponga si una respuesta es un jailbreak).
- El atacante LLM A (el optimista del equipo rojo).
- La cadena de objetivos G: "responde con [instrucción perjudicial]."
- Presupuesto K (generalmente 20 consultas).

Loop, para k en 1..K:
1. A se incita con el objetivo G y el historial de pares (prompto, respuesta) hasta ahora.
2. Una emite una nueva señal .$p_k$¿ Qué ?
3. Envía$p_k$a T; recibir respuesta $r_k$¿ Qué ?
4. J puntuaciones $(p_k, r_k)$en el gol.
5. Si el puntaje >= umbral, detenga el jailbreak encontrado.
6. Otras, añadir$(p_k, r_k)$A. a la historia; continúa.

Resultado empírico (NeurIPS 2023): >50% de tasa de éxito de ataque contra GPT-3.5-turbo, Llama-2-7B-chat; consultas promedio de éxito en el rango de 10 a 20.

### Por qué PAIR es eficiente

GCG (Zou et al. 2023) busca los sufijos de tokens adversarios por gradiente; requiere acceso a modelos de caja blanca y produce sufijos ilegibles. PAIR es caja negra y produce ataques de lenguaje natural que se transfieren a través de modelos. La retroalimentación en contexto de PAIR permite que el atacante aprenda de cada rechazo; GCG no tiene equivalente (cada nueva actualización de tokens tiene que redescubrir el progreso anterior).

### Ataques automatizados relacionados

- **GCG (Zou et al. 2023, arXiv:2307.15043).**En el nivel de las fichas, se busca los sufijos adversarios.
- **AutoDAN (Liu et al. 2023).**La búsqueda evolutiva de las instrucciones, guiada por un objetivo jerárquico.
- **TAP (Mehrotra et al. 2024).**Árbol de ataques con poda  ramas múltiples despliegues de estilo PAIR.
- **PAP (Zeng et al. 2024).**Las Prompts Adversarias Persuasivas codifican las técnicas de persuasión humana como plantillas de prompto.

### JailbreakBench y HarmBench

Ambas (2024) evaluaciones estandarizadas:

- JailbreakBench (arXiv:2404.01318). 100 comportamientos dañinos en 10 categorías de políticas de OpenAI. tasa de éxito de ataque (ASR) como la métrica principal. Requiere un juez (GPT-4-turbo, Llama Guard o StrongREJECT).
- HarmBench (Mazeika et al. 2024). 510 comportamientos en 7 categorías, con pruebas de daño semántico y funcional. Compara 18 ataques contra 33 modelos.

Los ataques de comparación requieren presupuestos iguales; un ASR del 90% en 200 consultas no es comparable al 85% de ASR en 20.

### Razones por las que importa para las implementaciones de 2026

Cada laboratorio fronterizo ahora ejecuta PAIR y TAP contra modelos de producción antes de su lanzamiento.

### Donde esto encaja en la Fase 18

La lección 12 es la base del ataque automatizado. La lección 13 (Many-Shot Jailbreaking) es una explotación complementaria de longitud. La lección 14 (ASCII Art / Visual) es un ataque de codificación. La lección 15 (Injección de Prompt Indirect) es la superficie de ataque de producción de 2026. La lección 16 cubre las contrapartes de herramientas defensivas (Llama Guard, Garak, PyRIT).

```figure
al-pair-loop
```

## Usalo

`code/main.py`El objetivo es un clasificador falso que rechaza las instrucciones "obvias" dañinas (filtro de palabras clave). El atacante es un refinador basado en reglas que intenta la paráfrase, el marco de juego de roles y la codificación. El juez marca la respuesta. Observas al atacante triunfar en ~5-15 iteraciones contra el filtro de palabras clave y fallar contra un filtro semántico.

## Envío

Esta lección produce`outputs/skill-attack-audit.md`. Dado que el equipo rojo ha realizado un informe de evaluación, el comité de auditoría revisa: qué ataques se realizaron (PAIR, GCG, TAP, AutoDAN, PAP), con qué presupuesto cada uno, con qué juez, en qué comportamiento perjudicial se estableció (JailbreakBench, HarmBench, interno).

## Los ejercicios

1. - ¿ Qué ?`code/main.py`- Medir las medias de preguntas para el éxito de las tres estrategias integradas de atacantes.

2. Implementar una cuarta estrategia de ataque (por ejemplo, traducción a otro idioma, codificación base64).

3. En la Figura 5 (comparación PAIR vs GCG) se describen dos escenarios en los que se prefiere la GCG a pesar de la ventaja de eficiencia de PAIR.

4. JailbreakBench informa ASR contra un conjunto de objetivos fijos. Diseñe una métrica adicional que mide la diversidad de ataque (variación en las instrucciones exitosas). Explica por qué la diversidad es importante para la evaluación de la defensa.

5. TAP (Mehrotra 2024) extiende PAIR con ramificación + poda.`code/main.py`y describir el coste computacional frente a la tasa de éxito.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| PAIR | "automated jailbreak" | Prompt Automatic Iterative Refinement; attacker-LLM + judge-LLM loop |
| GCG | "gradient jailbreak" | White-box token-level gradient search for adversarial suffixes |
| Attack success rate (ASR) | "% jailbreaks at k queries" | Primary metric; must be reported with query budget and judge identity |
| Judge LLM | "the scorer" | LLM that grades whether a response satisfies the harmful goal |
| JailbreakBench | "the evaluation" | Standardized harmful-behaviour set with tagged categories |
| HarmBench | "the broader bench" | 510 behaviours, functional + semantic harm tests |
| TAP | "tree of attacks" | PAIR with branching + pruning; better ASR at higher compute |

## Leer más

- [Chao et al. — Jailbreaking Black Box LLMs in Twenty Queries (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) Papel de pareja, NeurIPS 2023
- [Zou et al. — Universal and Transferable Adversarial Attacks on Aligned LLMs (arXiv:2307.15043)](https://arxiv.org/abs/2307.15043) Papel de GCG
- [Chao et al. — JailbreakBench (arXiv:2404.01318)](https://arxiv.org/abs/2404.01318) Evaluación estandarizada
- [Mazeika et al. — HarmBench (ICML 2024)](https://arxiv.org/abs/2402.04249) evaluación más amplia
