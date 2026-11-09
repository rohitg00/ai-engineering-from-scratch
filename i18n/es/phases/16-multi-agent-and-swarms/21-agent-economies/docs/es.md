# Economías de agentes, incentivos para tokens, reputación

> Los agentes autónomos de largo horizonte (la curva de trabajo de 1 a 8 horas de METR) necesitan una agencia económica.**5-layer stack**es: **DePIN**(computación física) → **Identity**(DIDs de la W3C + capital de reputación) → **Cognition**(RAG + MCP) → **Settlement**(abstracción de cuentas) → **Governance**Las redes de incentivos a los agentes de producción incluyen:**Bittensor**(Las subredes de TAO recompensan modelos específicos de tareas), **Fetch.ai / ASI Alliance**(Token de ASI-1 Mini LLM + FET), y **Gonka**Trabajo académico: los usos descentralizados de LaMAS de AAMAS 2025 **Shapley-value credit attribution**Para recompensar justamente a los agentes que contribuyen; Google Research propone "Design Mechanism for large language models" **token auctions**Esta lección construye un mercado de agentes mínimo, aplica la atribución de crédito de valor Shapley a una tubería de agentes múltiples y ejecuta una subasta de tokens de segundo precio para que la maquinaria de teoría de juegos aterrice concretamente.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 16 (Negotiation and Bargaining), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## El problema

Los sistemas multi-agentes se complican cuando los agentes producen valor conjuntamente pero necesitan ser recompensados individualmente. Los mecanismos clásicos  división igual, último contribuyente-tomará-todo  son injustos o jugables. La recompensa basada en la coalición a través de los valores de Shapley es justa por construcción pero costosa para calcular. La literatura 2025-2026 impulsa aproximaciones útiles: muestreo de Shapley, subastas de agregación monótona y reputación en cadena que se acumula a partir de contribuciones confirmadas.

Más allá de la atribución de crédito, el campo se ha vuelto a agentes económicos reales: Bittensor TAO recompensa la computación minera para ajustar los modelos específicos de subredes, Fetch.ai/ASI recompensa el uso de ASI-1 Mini LLM con tokens FET, Gonka reasigna la prueba de trabajo de transformador hacia tareas productivas de IA.

Esta lección trata las economías de agentes como una familia de problemas específicos  atribución de crédito, diseño de mecanismos y reputación  y construye cada uno con la matemática mínima para que las ideas se adhieran.

## Concepto

### La pila de cinco capas de agente-economía

1. **DePIN (physical compute).**Infraestructura descentralizada que alquila GPU, almacenamiento, ancho de banda, subredes de Bittensor, Render Network, Akash, no es específico para el agente, los agentes lo usan.
2. **Identity.**Los identificadores descentralizados (DID) de W3C dan a cada agente un ID duradero independiente de cualquier plataforma. La reputación se acumula en el DID. El protocolo de red de agentes (ANP) utiliza el DID como la capa de descubrimiento.
3. **Cognition.**El bucle de razonamiento del agente: LLM + RAG + MCP. Esto es lo que construyen las otras fases.
4. **Settlement.**La abstracción de cuentas (ERC-4337) permite a los agentes pagar el gas de sus propios saldos sin tener ETH.
5. **Governance.**Los DAO agenciales: estructuras de gobierno donde los humanos *y* agentes votan sobre cambios en el protocolo, con poder de voto vinculado a la reputación.

No todos los sistemas de producción utilizan los cinco. Bittensor utiliza 1, 2, parcialmente 3, parcialmente 4, ninguno de 5. Los agentes OpenAI no utilizan ninguno excepto 3.

### Bittensor, Fetch.ai, Gonka  lo que corre

**Bittensor (TAO).**Las subredes son tareas especializadas (modelado de lenguaje, generación de imágenes, pronóstico). Los mineros envían resultados de modelos. Los validadores los clasifican; la puntuación ponderada por apuestas distribuye las recompensas de TAO. Cada subred tiene su propia evaluación. La lección económica: pagar por la calidad de la salida específica de la tarea, no el cálculo utilizado.

**Fetch.ai / ASI Alliance.**ASI-1 Mini LLM se ejecuta en la red de Fetch.ai; los usuarios pagan tokens FET para inferir. La narrativa de agentes como pares es más fuerte aquí: un agente en Fetch puede llamar a otro para una tarea y pagar en FET.

**Gonka.**Prueba de trabajo de transformador: el "trabajo" es los pases anteriores de un transformador. Los mineros ganan ejecutando tareas de inferencia que han conocido las salidas correctas (a partir de datos de entrenamiento).

Los tres son de producción a partir de abril de 2026. La distribución de pagos difiere.

### Atribución de crédito por valor de Shapley

Tres agentes colaboran en una tarea. ¿Quién contribuyó a qué?

Valor de Shapley: la asignación única de créditos que satisface cuatro axiomas (eficiencia, simetría, linealidad, nulo).`i`¿Qué es esto ?

```
shapley(i) = (1/N!) * sum over all orderings O of (v(S_i_O ∪ {i}) - v(S_i_O))
```

donde`S_i_O`es el conjunto de agentes antes `i`en orden `O`En la práctica: enumerar todas las permutaciones, registrar la contribución marginal de cada agente en cada permutación, promedio.

Para N=3 agentes, hay 6 permutaciones. para N=10, 3.6M  así que en la práctica se muestran ordenes en lugar de enumerar.

### Subastas de segundo precio para agregación

Google Research ("Diseño de Mecanismo para grandes modelos de lenguaje") propone subastas de tokens de segundo precio para agregar los resultados de LLM. Configuración: N agentes proponen cada uno una finalización; cada uno tiene un valor privado para ser seleccionado. El subastador elige la propuesta de mayor valor y paga el *segundo valor* más alto. En la agregación monótona (el valor depende de qué propuesta se elige, no de cuántos se ofrecieron), esto es cierto  los agentes ofrecen su verdadero valor.

Por qué esto es importante para los sistemas de LLM: puede externalizar las tareas de finalización a múltiples agentes con precios diferentes; la subasta elige el mejor + paga justamente, y los agentes no tienen ningún incentivo para informar incorrectamente.

### Capital de reputación

Una puntuación de reputación vinculada a DID se acumula a partir de contribuciones confirmadas.

```math
\text{rep}(i, t+1) = \alpha \cdot \text{rep}(i, t) + (1 - \alpha) \cdot \text{contribution\_quality}(i, t)
```

Con factor de descomposición`alpha`Propiedad:

- Es barato de leer para las decisiones de enrutamiento ("enviar tareas difíciles a agentes de alta reputación").
- Es costoso de forjar (se acumula con el tiempo, vinculado a DID).
- Se puede reducir: las contribuciones que no logren la verificación se restan.

### AAMAS 2025 LaMAS descentralizada

La propuesta de LaMAS (AAMAS 2025) combina: identidad DID, atribución de crédito de valor Shapley y un mecanismo de subastas simple.

### Cuando la economía se desmorona

- **Price oracle manipulation.**Si la función de crédito puede ser jugada, los agentes lo jugarán.
- **Sybil attacks.**Un operador hace que N agentes falsos inflen su propia contribución.
- **Verification cost.**La atribución de crédito es tan justa como el verificador.Si la verificación es barata (LLC pequeña), puede ser jugada; si es cara (panel humano), el sistema no se escala.
- **Regulatory overhang.**Las economías de los agentes se cruzan con la regulación financiera. Bittensor, Fetch y Gonka operan en áreas grises legales en algunas jurisdicciones a partir de 2026.

### Cuando las economías de agentes tienen sentido

- **Open networks with heterogeneous operators.**Ningún equipo controla a todos los agentes.
- **Verifiable outputs.**Sin verificación, la atribución de crédito es una conjetura.
- **Long-horizon workflows.**Las tareas de un solo tiro no se benefician de la acumulación de reputación.
- **Tokenized payments are legally viable**en su jurisdicción.

En los sistemas corporativos cerrados, la economía deja paso a una asignación más simple (los gerentes asignan trabajo, las métricas son internas).

```figure
swarm-auction
```

## Construye el mismo

`code/main.py`los instrumentos:

- `shapley(value_fn, agents)` cálculo exacto de Shapley por enumeración para N pequeño.
- `second_price_auction(bids)` mecanismo verdadero; el ganador paga el segundo más alto.
- `Reputation` Reputancia vinculada a DID con decadencia exponencial y recorte.
- Demo 1: tres agentes colaboran, exactamente Shapley atribuye crédito.
- Demo 2: cinco agentes ponen una oferta para una ranura de tareas; la subasta de segundo precio elige el ganador + pago.
- Demo 3: 100 rondas de asignación de tareas a agentes con repetición heterogénea; el enrutamiento ponderado por repetición golpea al azar.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

Producción esperada: valores de Shapley para cada agente; resultado de la subasta que muestra equilibrio de la oferta verdadera; enrutamiento ponderado por repetición que muestra una ganancia de calidad del 10-20% sobre el azar después del calentamiento.

## Usalo

`outputs/skill-economy-designer.md`diseña una economía de agente mínima: elección de la capa de identidad, mecanismo de atribución de crédito, mecanismo de pago, regla de reputación.

## Envío

Dirigir una economía de agentes en 2026:

- **Start with reputation, not tokens.**La reputación es barata de implementar y valiosa sola; los tokens añaden complejidad legal y económica.
- **Verify before you reward.**Nunca distribuir crédito sin una etapa de verificación independiente.
- **Shapley-sample, not Shapley-exact.**Muestra de 100-1000 ordenes; la enumeración exacta no es escalable.
- **Cap decay factor and floor reputation.**La descomposición ilimitada borra a los contribuyentes legítimos; la descomposición demasiado lenta recompensa a los agentes obsoletos de alta reposición.
- **Audit mechanisms adversarially.**Ejecutar escenarios de equipo rojo antes de abrir la red. Cada mecanismo tiene una teoría de juego; quieres encontrar los agujeros, no los atacantes.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Confirmar la suma de valores de Shapley al valor total (axioma de eficiencia). Cambiar la función de valor; ¿cambian las asignaciones de Shapley en la dirección esperada?
2. Implemente Shapley *sampling* (Monte Carlo sobre K ordenes). ¿Cómo afecta K a la precisión de aproximación?
3. Implementar un paso de formación de coalición antes de la subasta: los agentes pueden fusionarse en equipos y licitar como una unidad. ¿Qué coaliciones forman? ¿Es el resultado Pareto mejor que la licitación individual?
4. Leer el post de diseño de mecanismos de Google Research. Identifique una suposición que, si se viola, rompe la veracidad. ¿Cómo se ve ese modo de fracaso en un entorno de LLM?
5. Leer el documento LaMAS descentralizado de AAMAS 2025. Implemente su paso Shapley sobre 10 agentes en una tarea sintética. ¿Cuánto tiempo tarda el cálculo exacto? ¿Qué tan cerca se acerca el muestreo con 100 tiros?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| DePIN | "Decentralized physical infrastructure" | Token-incentivized compute/storage/bandwidth. Bittensor, Akash, Render. |
| DID | "Decentralized identifier" | W3C spec for portable IDs. Agent reputation binds to DID, not to a platform. |
| ERC-4337 | "Account abstraction" | Contract accounts that can sponsor gas, enabling agent payments. |
| Shapley value | "Fair credit attribution" | Unique allocation satisfying efficiency, symmetry, linearity, null. |
| Second-price auction | "Vickrey auction" | Truthful mechanism: winner pays second-highest bid. Monotone aggregation compatible. |
| Reputation capital | "Accumulated quality score" | DID-bound score from confirmed contributions; decays over time. |
| Agentic DAO | "Agents + humans govern" | DAO with agent voters as first-class, voting power tied to reputation. |
| TAO / FET / GPU credits | "Token denominations" | Bittensor TAO, Fetch.ai FET, various DePIN tokens. |

## Leer más

- [The Agent Economy](https://arxiv.org/abs/2602.14219) Encuesta de 2026 de la pila de cinco capas de agentes-economía
- [Google Research — Mechanism design for large language models](https://research.google/blog/mechanism-design-for-large-language-models/) Subastas simbólicas con agregación monótona
- [AAMAS 2025 — decentralized LaMAS](https://www.ifaamas.org/Proceedings/aamas2025/pdfs/p2896.pdf) Atribución de crédito por valor de Shapley
- [Bittensor TAO documentation](https://docs.bittensor.com/) La estructura de la subred y la distribución de las recompensas
- [Fetch.ai / ASI Alliance](https://fetch.ai/) ASI-1 Mini LLM y FET token
- [W3C Decentralized Identifiers (DIDs) spec](https://www.w3.org/TR/did-core/) Fundación de identidad
