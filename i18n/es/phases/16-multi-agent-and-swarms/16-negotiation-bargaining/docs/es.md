# Negociación y negociación

> Los agentes negocian recursos, precios, asignaciones de tareas y términos. El conjunto de puntos de referencia 2026 es claro: NegotiationArena (arXiv:2402.05863) muestra que los LLM pueden mejorar los beneficios ~20% a través de la manipulación de persona ("desesperación"); "Medición de las habilidades de negociación" (arXiv:2402.15813) muestra que el comprador es más difícil que el vendedor y la escala no ayuda  su **OG-Narrator**(generador de ofertas deterministas + narrador de LLM) empujó la tasa de transacciones del 26,67% al 88.88%; la Competencia de Negociación Autónoma a Gran escala (arXiv:2503.06416) llevó a cabo cerca de 180 mil negociaciones y encontró que**chain-of-thought-concealing**Bhattacharya et al. 2025 en Harvard Negotiation Project metrics clasificó a Llama-3 como más eficaz, Claude-3 agresivo, GPT-4 más justo. Esta lección implementa el Protocolo de Contratación Net (el antepasado de FIPA, Lección 02), conecta un comprador/vendedor de estilo LLM, ejecuta una descomposición de estilo OG-Narrador y mide cómo cambia la tasa de transacción con cada elección estructural.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 02 (FIPA-ACL Heritage), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## El problema

Los dos agentes deben acordar un precio. Dejo a sí mismos con las instrucciones de lenguaje puro, las LLM 2024-2026 cierran acuerdos a tasas sorprendentemente bajas (~27% en las ofertas estrictamente parametrizadas en arXiv:2402.15813).

El problema principal es que los LLM confluyen dos trabajos: decidir la oferta y narrarla. OG-Narrator los separó: un generador de ofertas determinista calcula los movimientos numéricos; el LLM solo narra.

Esto refleja un hallazgo clásico de múltiples agentes: descoplar el mecanismo de la capa de comunicación gana. El Protocolo de Red de Contratos (FIPA, 1996; Smith, 1980) es el mecanismo de referencia del mercado de tareas.

## Concepto

### En un párrafo, la red de contratos

El Protocolo Net de Contratos de Smith de 1980: un **manager**transmite a **call for proposals (cfp)**¿ Qué es ?**bidders**Responder con **propose**mensajes que contienen sus ofertas; el gerente elige un ganador y envía **accept-proposal**al ganador y **reject-proposal**El ganador realiza el trabajo.**refuse**La FIPA codificó esto como `fipa-contract-net`protocolo de interacción.

### Por qué gana el narrador de OG

"Medición de las habilidades de negociación de los modelos de lenguaje" (arXiv:2402.15813) observó que:

- Los LLM suelen infringir las reglas de negociación (ofrecer a precios sin sentido, ignorar el ZOPA de la otra parte).
- Se anclan mal (aceptan malas ofertas iniciales; contraofertas en cantidades simbólicas en lugar de estratégicas).
- Los modelos más grandes hacen que el lenguaje sea más plausible con un error estratégico similar.

La descomposición del narrador OG:

```
           ┌──────────────────┐        ┌──────────────────┐
  state  → │ offer generator  │ price → │  LLM narrator    │ → message
           │  (deterministic) │        │  (writes the     │
           │                  │        │   human-style    │
           └──────────────────┘        │   accompaniment) │
                                       └──────────────────┘
```

El generador de ofertas es una estrategia de negociación clásica: un modelo de negociación de Rubinstein, una estrategia de Zeuthen o un simple precio de venta por precio.

La tasa de negocio se eleva porque:
- Los precios se mantienen en la zona de negociación.
- Los anclajes son estratégicos, no emocionales.
- El LLM hace lo que es bueno: escribir.

### NegociaciónConclusiones de Arena

El estudio de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la ciencia de la ciencia de los ciencias de los ciencias de los ciencias de la ciencia de la ciencia de los Estados Unidos de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de los Estados Unidos de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de los Estados de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de los Estados de la ciencia de los Estados de la ciencia de la ciencia de los Estados de la ciencia de los Estados de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la

- Las LLM pueden mejorar los pagos ~20% adoptando personas ("Estoy desesperado por vender esto para el viernes")  La manipulación de persona es una táctica real.
- Los agentes justos/cooperativos son explotados por los adversarios; la defensa requiere una contraposición explícita.
- Los pares simétricos convergen en resultados inequitados en aproximadamente el 40% de los escenarios de referencia.

Esto no es "los LLM son malos negociadores". Es "los LLM negocian demasiado como los humanos, incluyendo las partes explotables".

### El ocultamiento de la cadena del pensamiento

La Gran Competencia de Negociación Autónoma (arXiv:2503.06416) realizó aproximadamente 180 mil negociaciones en muchas estrategias de LLM. Los ganadores ocultaron su razonamiento a sus contrapartes:

- Si un agente imprime "Sólo voy a$75; my reservation price is $70" en un rascacielos visible al público, el oponente lo lee.
- Los ganadores computaban la estrategia en privado; el canal de salida contiene solo la oferta y la narración mínima requerida.

Este es un eco de 2026 de la teoría clásica del juego (Aumann 1976 sobre racionalidad e información): revelar su valoración privada costos de pago. LLM no intuyen esto y felizmente escriben sus reservas en rastros de razonamiento que se vuelven visibles para la contraparte.

Ingeniería de toma: separar el contexto privado de la plancha de raspado del contexto público de los mensajes. No es opcional.

### Bhattacharya et al. 2025  clasificaciones de modelos

En relación con las métricas del proyecto de negociación de Harvard (negociación en principio, respeto de la BATNA, reciprocidad de intereses):

- **Llama-3**fue más eficaz en las negociaciones (taxa de transacción + pago).
- **Claude-3**El Consejo de Ministros de la Unión Europea ha adoptado una decisión en el marco de la cual se ha adoptado un nuevo reglamento.
- **GPT-4**fue la más justa (la menor variación en la remuneración entre los emparejamientos).

Este es un instantáneo de 2025. El punto no es qué modelo gana en abril de 2026  es que los diferentes modelos base tienen estilos de negociación persistentes.

### Alocamiento de tareas a través de contrato Net + LLM

El uso moderno de Contract Net para LLM multi-agente:

1. El agente gerente descompone una tarea en unidades.
2. Las emisiones `cfp`con descripción de tareas a los agentes de los trabajadores.
3. Cada trabajador devuelve una oferta: `(price, eta, confidence)`donde el precio podría ser tokens, unidades de cálculo o dólares.
4. El gerente elige los ganadores (un solo o múltiples, dependiendo de la tarea) y los premios.
5. Los trabajadores rechazados pueden presentar ofertas para otras tareas.

Esto supera a 100 trabajadores porque la coordinación es transmisión y respuesta, no chat sincrónico.

### Negociación interactiva entre las partes interesadas de la MLL

El proyecto de ley de la Comisión de Infraestructuras y Desarrollo de la Información (NIIP)https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) introduce juegos de puntaje multipartíficos con **secret scores**y **minimum-acceptance thresholds**. Cada parte interesada tiene servicios públicos privados; el LLM debe inferirlos a partir de mensajes. Esta es la generalización de la negociación de dos partidos a la formación de coaliciones de partidos N. Relevante para los mercados de tareas de producción con capacidades de trabajadores heterogéneas.

### La regla de narración contra mecanismo

En todos los puntos de referencia de las negociaciones 2024-2026, la regla de ingeniería consistente es:

> Deje que el LLM narre. No deje que el LLM compute la oferta.

Si la oferta necesita ser un número (precio, ETA, cantidad), generarla deterministicamente desde el estado de negociación y que el LLM produzca el marco.

```figure
a5-og-narrator
```

## Construye el mismo

`code/main.py`los instrumentos:

- `ContractNetManager`¿ Qué ?`ContractNetTask`¿ Qué ?`Bid` gerente + licitadores, transmisión de programas, recopilación de propuestas, adjudicación.
- `og_narrator_bargain(state, rng)` Comprador OG-Narrador: concesión determinista de estilo Zeuthen hacia el punto medio.
- `seller_response(state, rng)` política determinista de contratiempos de venta (la verdad estructural de los dos estilos).
- `naive_llm_bargain(state, rng)` simula una negociación de LLM: elige precios con alta variación, a menudo fuera de la ZOPA.
- Medición: tasa de negociación de más de 1000 ensayos con precios de reserva frescos muestrados por ensayo.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

Resultado esperado: tasa de negocio de LLM ingenuo ~65-75%; tasa de negocio de OG-Narrador ~85-95%; la brecha de 15-25 puntos es la ventaja estructural de descomponer la generación de ofertas de la narración.

## Usalo

`outputs/skill-bargainer-designer.md`diseña un protocolo de negociación: quién genera ofertas (determinista o LLM), quién narra, cómo se separan los scratchpads privados de los mensajes públicos y cómo se monitorea la tasa de transacciones.

## Envío

Lista de control de las negociaciones de producción:

- **Separate scratchpad.**El Estado privado nunca llega al contexto de la contraparte.
- **Deterministic offer generation.**Precios, cantidades, ETA: calcular, no pedir.
- **Validate all incoming offers**Rechazar las ofertas fuera de la zona de ZOPA en el límite del protocolo.
- **Bound rounds.**3-5 disparos máximo; escala a mediador en punto muerto.
- **Measure deal rate and payoff variance**Una tasa de transacción en caída es un síntoma  a menudo una deriva rápida o un ataque de contraparte.
- **Log all rejected proposals**Para los administradores de la red de contratos, los licitadores perdedores deben entender por qué.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Confirme que OG-Narrador supera a Naive-LLM en precio de la oferta. ¿Por cuánto?
2. Implementación **persona-based payoff improvement**(arXiv:2402.05863)  el comprador adopta un personaje "desesperado de comprar esta semana" sólo en la narración, ofrece generador sin cambios. ¿Cambia la tasa de oferta o el pago?
3. Implementar la cadena de pensamiento **concealment**¿Qué sucede si accidentalmente se filtra (simula al cambiar los canales)?
4. Extenda el contrato neto a la subasta de N-bidor con precio de reserva. Cuando todas las ofertas superan la reserva, ¿cómo decide el gerente entre el precio más bajo y la más alta calidad? ¿Qué regla de entrega elige y por qué?
5. Lea Bhattacharya et al. 2025 en Harvard Negotiation Project metrics. Implemente dos negociación con diferentes estilos (agresivos vs. justos).

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Contract Net | "Task market" | Smith 1980, FIPA 1996. cfp + propose + accept/reject. The canonical task-market. |
| ZOPA | "Zone of possible agreement" | Overlap between buyer's max and seller's min. Offers outside it cannot close. |
| BATNA | "Best alternative to a negotiated agreement" | Your fallback if this deal fails. Sets your reservation price. |
| OG-Narrator | "Offer generator + narrator" | Decomposition: deterministic offer, LLM narration. |
| Zeuthen strategy | "Risk-minimizing concession" | Classical offer-generator that concedes based on risk limits. |
| Rubinstein bargaining | "Alternating-offer equilibrium" | Game-theoretic model for infinite-horizon bargaining with discounting. |
| CoT concealment | "Hide your reasoning" | Winners in arXiv:2503.06416 kept private scratchpads; public channel shows offer only. |
| Persona manipulation | "Emotional posturing" | arXiv:2402.05863: ~20% payoff gain from desperation/urgency personas. |

## Leer más

- [NegotiationArena](https://arxiv.org/abs/2402.05863) el índice de referencia; resultados de manipulación y explotación de personas
- [Measuring Bargaining Abilities of Language Models](https://arxiv.org/abs/2402.15813) OG-Narrator y el resultado de comprador-más duro que vendedor
- [Large-Scale Autonomous Negotiation Competition](https://arxiv.org/abs/2503.06416) ~ 180 mil negociaciones; la ocultación de la cadena de pensamiento gana
- [LLM-Stakeholders Interactive Negotiation (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) Juegos multipartíticos con utilidades secretas
- [Smith 1980 — The Contract Net Protocol](https://ieeexplore.ieee.org/document/1675516) el mecanismo clásico, IEEE Transacciones en computadoras
