# Especialización de la función  Planificador, crítico, ejecutor, verificador

> La descomposición multi-agente más común en 2026: un agente planea, ejecuta, critica o verifica. MetaGPT (arXiv:2308.00352) formaliza esto como SOP codificados en instrucciones de rol  Gerente de producto, arquitecto, gerente de proyecto, ingeniero, ingeniero de calificación  siguiente `Code = SOP(Team)`¿ Qué ? ChatDev (arXiv:2307.07924) en cadena diseñador, programador, revisor, probador a través de una "cadena de chat" con "deshallucinación comunicativa" (los agentes solicitan explícitamente detalles faltantes). El verificador es resistente a la carga: Cemri et al. (MAST, arXiv:2503.13657) muestran que cada falla multi-agente puede ser rastreada a la verificación faltante o rotura. PwC informó una ganancia de precisión de 7 veces (10% → 70%) a partir de los bucles de validación estructurados en CrewAI.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 05 (Supervisor)
**Time:** ~60 minutes

## El problema

Los sistemas multi-agentes genéricos producen una salida genérica. Tres codificadores en un chat de grupo escriben tres sabores del mismo código mediocre. Puedes agregar más agentes, agregar más rondas y aún así no cruzar el umbral de calidad.

La solución no es más agentes  son * diferentes * agentes. asignar funciones distintas. Dar a las herramientas críticas que el planificador no tiene. Dar al verificador una suite de prueba objetiva. Ahora el sistema tiene desacuerdo interno con la corrección basada en tierra, no sólo adivinar paralelo.

## Concepto

### Los cuatro papeles canónicos

**Planner.**Leer el objetivo, producir una lista de pasos o una especificación herramientas: recuperación de conocimientos, documentos. salida: plan estructurado.

**Executor.**Lea un plan paso a paso, produce el artefacto. herramientas: las herramientas de trabajo reales (compilador de código, shell, cliente API). salida: el artefacto.

**Critic.**Leer la salida del ejecutor contra la intención del planificador. herramientas: acceso solo para lectura al artefacto, análisis estático. salida: aceptar/rechazar con razones.

**Verifier.**Leer el artefacto y ejecutar una verificación determinista. herramientas: test runner, verificador de tipo, validador de esquema. salida: pasar / fallar con evidencia.

El crítico es subjetivo, opinado, a menudo basado en el LLM. El verificador es objetivo, determinista, a menudo basado en código.

### El patrón de SOP de MetaGPT

MetaGPT (arXiv:2308.00352) codifica los SOP de ingeniería de software como instrucciones de rol:

- **Product Manager**escribe el PRD.
- **Architect**produce el diseño del sistema.
- **Project Manager**Se dividen las tareas.
- **Engineer**los instrumentos.
- **QA Engineer**hace pruebas.

Cada rol tiene un estricto esquema de entrada/salida.El mensaje de rol indica cuál es el rol y qué debe producir.`Code = SOP(Team)`La formulación  SOP deterministas convierte a un equipo de LLM en una línea de tuberías predecible.

### La deshallucinación comunicativa de ChatDev

ChatDev agrega un movimiento clave: cuando un ejecutor necesita un detalle específico que no estaba en el plan, le pide explícitamente al diseñador antes de continuar. Esto evita el fracaso clásico de la LLM de inventar plausiblemente el detalle.

Implementación: el aviso de rol incluye "cuando necesita información específica que no se le dio, pregunte por nombre al papel relevante antes de producir la salida".

### Por qué el verificador es más importante

Cemri et al. (MAST) rastreó 1642 fallas de ejecución de múltiples agentes. 21.3% eran lagunas de verificación  el sistema envió una respuesta que nadie había verificado. El 79% restante a menudo se remonta a "había un cheque que falló silenciosamente o nunca se ejecutó".

PwC informó (CrewAI deployments, 2025) que agregar un bucle de validación estructurado movió la precisión del 10% al 70%.

### Critico frente a verificador

- Un crítico es un magistrado que revisa un artefacto por calidad.
- Un verificador es un programa determinista que se ejecuta en el artefacto. Objetivo.

Utilice ambos. El crítico capta los problemas de sabor que el verificador no puede articular. El verificador capta errores que el crítico no puede ver porque sólo aparecen en el tiempo de ejecución.

### El antipatrón

Cada rol en su sistema es un LLM y cada rol de salida es "me parece bien". Modo de falla MAST clásico. Agregue al menos un verificador cuyo pase / fracaso se decide por código, no por un LLM.

### Mapas de marco

- **CrewAI**¿ Qué es esto ?`Agent(role, goal, backstory)`es la superficie de especialización de libros de texto.
- **LangGraph** los nodos pueden tener instrucciones especializadas; los bordes forzan la tubería.
- **AutoGen** Agentes conversables específicos de rol con nombres de una palabra en un Chat de grupo.
- **OpenAI Agents SDK** herramientas de intercambio entre agentes especializados en funciones.

```figure
swarm-roles
```

## Construye el mismo

`code/main.py`Implementa una línea de 4 funciones que construye una función Python simple:

- **Planner**produce una especificación.
- **Executor**genera una cadena de código.
- **Critic**(SIMULACIÓN de LLM) señala problemas obvios.
- **Verifier**ejecuta el código generado en una caja de arena (`exec`) contra un caso de ensayo.

Demo se ejecuta dos veces: una vez cuando el ejecutor produce código correcto (crítico + verificador ambos pasan), una vez cuando el ejecutor produce código fuera de especificación (el crítico pierde el error porque parece plausible, el verificador lo captura porque la prueba falla).

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

## Usalo

`outputs/skill-role-designer.md`toma una tarea y produce la lista de roles (3-5 roles), el esquema de entrada/salida por función y la verificación del verificador.

## Envío

Lista de control:

- **At least one deterministic verifier.**Nunca todo-LLM.
- **Explicit I/O schema per role.**El planificador devuelve una especificación, no una prosa; el ejecutor lee ese esquema.
- **Communicative dehallucination.**El ejecutor debe preguntar al planificador cuándo falta información; nunca la invente.
- **Critic/verifier ordering.**ejecuta primero el crítico (barato, detecta problemas de diseño), el verificador segundo (lento, detecta errores).
- **Loop budget.**Max 2 rondas de revisión de crítico ejecutor antes de escalar a humano.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`y observar cómo el verificador detecta el error que el crítico no ha observado.`return`¿Qué detecta si el test de tiempo de ejecución se pierde?
2. Añadir un quinto papel: "analista de requisitos" que traduce el deseo del usuario en especificación lista para planificar. ¿Qué solicitudes de deshallucinación comunicativa deberían fluir hasta él?
3. Lea la sección 3 de MetaGPT ("Agentes"). Enumera el esquema de entrada/salida de cada uno de los 5 roles de MetaGPT.
4. Lea el diagrama de la cadena de chat de ChatDev (arXiv:2307.07924 Figura 3). Identifique dónde la deshallucinación comunicativa rompe un bucle que de otro modo sería infinito.
5. La ganancia de precisión de PwC 7x proviene de los bucles de verificación. Suponga tres tareas en las que agregar un verificador no ayudaría  donde la verificación determinista de la corrección es imposible o prohibitivamente costosa.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Role specialization | "Different agents, different jobs" | Distinct system prompts tuned for planner/executor/critic/verifier roles. |
| SOP pattern | "Encoded standard operating procedure" | MetaGPT's framing: strict I/O schemas per role turn a team into a pipeline. |
| Communicative dehallucination | "Ask before inventing" | ChatDev pattern: executor asks planner when a detail is missing rather than making one up. |
| Critic | "LLM reviewer" | Subjective, opinionated reviewer. Catches taste issues. Can be fooled by plausible prose. |
| Verifier | "Deterministic check" | Code-based pass/fail. Test runner, type checker, schema validator. Cannot be fooled. |
| Verification gap | "No one checked" | 21.3% of MAST failures. Answer shipped without a check that would have caught the bug. |
| Revision loop | "Critic sends it back" | Critic rejection triggers executor re-run with feedback. Needs a budget. |
| All-LLM anti-pattern | "Looks good to me" | Every role is an LLM, no deterministic check. Classic MAST failure. |

## Leer más

- [Hong et al. — MetaGPT: Meta Programming for Multi-Agent Collaboration](https://arxiv.org/abs/2308.00352) el documento de referencia de la POP-as-role-prompt
- [Qian et al. — Communicative Agents for Software Development (ChatDev)](https://arxiv.org/abs/2307.07924) cadena de chat + deshallucinación comunicativa
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) Taxonomía MAST; las brechas de verificación representan el 21,3% de las fallas
- [CrewAI docs — Agent roles](https://docs.crewai.com/en/introduction) Superficie de especificación de rol de producción
