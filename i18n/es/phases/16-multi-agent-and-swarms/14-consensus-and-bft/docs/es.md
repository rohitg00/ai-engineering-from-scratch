# Consenso y tolerancia bizantina a la culpa de los agentes

> Los sistemas distribuidos clásicos BFT se encuentran en el marco de los LLM estocásticos.**CP-WBFT**(arXiv:2511.10400) sopesa cada voto por una investigación de confianza; **DecentLLMs**(arXiv:2507.14928) se queda sin líder con propuestas paralelas de trabajadores y agregación geométrica-mediana; **WBFT**(arXiv:2505.05103) combina votación ponderada con Clustering de estructura jerárquica para dividir los nodos Core y Edge. El resultado empírico honesto de "¿Pueden Agentes de IA estar de acuerdo?" (arXiv:2603.01213) es que incluso el acuerdo escalar es frágil hoy en día  un solo agente engañoso puede comprometer una mezcla de Agentes. La BFT es necesaria, pero no suficiente. Esta lección construye un protocolo BFT mínimo, inyecta tres ataques específicos de agentes (mentir bizantino, conformidad sicófante, monocultura de errores correlacionados) y mide cómo se enfrenta cada variante de consenso.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## El problema

Hay N LLM agentes cada uno que produce una respuesta. No están de acuerdo. La mayoría de votos elige el equivocado porque dos agentes están correlacionados (el mismo modelo base, los mismos datos de entrenamiento, los mismos modos de falla).

Ahora añadir un agente engañoso: se encuentra a propósito. O un agente sicófante: está de acuerdo con quien ha hablado por último. En BFT clásico, la suposición es que los nodos bizantinos son una fracción.`f < n/3`La realidad de 2026 es que los nodos LLM son estocásticos incluso cuando son honestos, correlacionados entre los modelos, e influenciados por los resultados de los demás. No se puede tratarlos como votantes independientes de Bernoulli.

El BFT clásico (PBFT, 1999) no está equivocado  es incompleto. Se ocupa de la flexión arbitraria de bits. No se ocupa de "tres agentes honestos comparten una alucinación porque comparten datos de entrenamiento". Esta lección se basa en la base de PBFT y las capas de tres adaptaciones 2025-2026.

## Concepto

### ¿Qué te da el BFT clásico?

La tolerancia práctica de la falta bizantina (Castro y Liskov, OSDI 1999) tolera `f < n/3`Los nodos bizantinos. El protocolo tiene tres fases (preparación, preparación, compromiso) y dos primitivas (mensajes firmados, certificados de quórum).`n >= 3f + 1`los nodos honestos o maliciosos.

Las garantías son fuertes, pero se supone que:

1. **Independent faults.**Los bizantinos no se coordinan.
2. **Honest nodes are truly honest.**La corrección de las salidas honestas no es un problema; el protocolo solo alinea el desacuerdo.
3. **The question has a ground-truth answer.**El consenso sobre un hecho equivocado sigue siendo consenso.

Los agentes de LLM violan los tres. Dos agentes que ejecutan el mismo modelo base comparten fallos. Un LLM "honesto" todavía alucina. Y en preguntas ambigüas, la "verdad" es lo que los agentes deciden  no hay oráculo externo.

### Los tres ataques específicos de la LLM

**Byzantine lie.**Un agente da una respuesta deliberadamente incorrecta.`f < n/3`¿ Qué ?

**Sycophantic conformity.**Un agente lee las respuestas de otros antes de votar y se alinea con quien ha hablado por último. No es malicioso, pero correlaciona con la voz más alta.

**Correlated-error monoculture.**Tres agentes comparten un modelo base. Alucinan la misma respuesta equivocada. La mayoría está equivocada.

### Las respuestas de 2025 a 2026

**CP-WBFT**(arXiv:2511.10400)  BFT ponderado probado por confianza. Cada votante une una sonda de confianza a su respuesta (una probabilidad autoinformada o la predicción de un modelo de calibración separado).

**DecentLLMs**Los agentes de trabajo proponen en paralelo, los agentes de evaluación ponen propuestas, la respuesta final es la media geométrica de las posiciones ponedoras.`f < n/2`. Mitigation for: mentira bizantina y errores correlacionados (mediana geométrica es robusta a valores extremos y se dirige hacia el cúmulo denso, no a la media basada en modelos).

**WBFT**(arXiv:2505.05103)  Peso BFT con Clustering de Estructura Jerárquica. Los pesos de voto se asignan por calidad de respuesta más un puntaje de confianza aprendido de la historia. Agentes de grupo en Core y Edge; Agentes de Core deben lograr el consenso primero, Agentes de Edge siguen. Mitigation para: escalabilidad (Core consenso es pequeño y rápido) y parcialmente para monocultura (Core se puede elegir para la diversidad).

### Empirical: "¿Pueden los agentes de IA estar de acuerdo?" (arXiv:2603.01213)

El papel mide el acuerdo escalar (agentes LLM que acuerdan un solo valor numérico) en múltiples modelos fronterizos.

- Incluso sin adversarios, los agentes de LLM no están de acuerdo en cuestiones escalares a tasas superiores al 30% en muchos puntos de referencia.
- Un agente que adopte una personalidad engañosa puede sacar el consenso de la mezcla de agentes 40 puntos porcentuales más de la línea de base honesta.
- Las tasas de desacuerdo se correlacionan con la diversidad de modelos  los conjuntos heterogéneos no coinciden más que los homogéneos (bueno: errores no correlacionados) pero también se desvían más lentamente (malo: tiempo más largo para llegar a un acuerdo).

El resultado: BFT le da un mecanismo para alinear las salidas, pero no le dice si la salida alineada es correcta. Combina con la verificación (fase 16 · 08 especialización de roles), la diversidad (fase 16 · 15 variantes de debate) y los agentes evaluadores (fase 16 · 24 puntos de referencia).

### El protocolo central, despojado

Una ronda mínima de BFT para los agentes de LLM:

```
1. task arrives; each agent i produces answer a_i
2. each agent attaches confidence probe c_i in [0, 1]
3. aggregator collects (a_i, c_i) from all n agents
4. aggregator groups by semantic cluster (equivalent answers)
5. aggregator computes weight for each cluster C:
     w(C) = sum_{i in C} c_i
6. winner = cluster with max weight, if max > threshold * sum(c_i)
   else: retry or escalate
7. minority clusters logged with provenance for post-hoc audit
```

El paso de agrupamiento semántico es el giro específico del LLM. Dos respuestas "el estudio informa un 4,2%" y "una mejora del 4,2%" son el mismo agrupamiento.

### El ajuste del umbral

El `threshold`El parámetro decide cuándo aceptar y cuándo volver a intentar. Demasiado bajo: aceptas mayoritades débiles. Demasiado alto: nunca aceptas nada. Rango empírico: 0,5-0,67 para `n=5-7`Los agentes, más altos para los más pequeños `n`Por debajo de un umbral, escalar a un humano o a un conjunto de agentes diferentes.

### Cuando el consenso no ayuda

- **Ambiguous questions.**Si la pregunta no tiene verdad, el consenso es una opinión.
- **Compound questions.**"Escribe código y explique"  dos respuestas. Vota por cada uno de forma independiente.
- **Adversarial multi-round.**Si los agentes pueden observar las rondas anteriores y imitar (debate Du 2023), comienzan a estar de acuerdo entre sí independientemente de la verdad.

```figure
swarm-consensus-wave
```

## Construye el mismo

`code/main.py`los instrumentos:

- `AgentVoter` una política escrita con (respuesta, confianza).
- `MajorityVote` Pluralidad clásica.
- `CPWBFT` Votación ponderada por confianza con agrupación semántica.
- `DecentLLMs` Agregación geométrica-mediana de las propuestas obtenidas.
- `Scenario` ejecuta cada agregador bajo tres patrones de ataque.

Modelos de ataque implementados:

1. `byzantine`Un agente miente con mucha confianza.
2. `sycophancy`Un agente copia la primera respuesta que ve, con la misma confianza.
3. `monoculture`En el caso de los agentes, el resultado es el siguiente:

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

La mayoría de los casos de monocultura no se cumplen con el caso de la monocultura. La ponderación de confianza de CPWBFT mitigará la sícofancia. La mediana geométrica de los decentes LLM se dirige hacia el cúmulo honesto cuando la monocultura es menos de la mitad de la población.

## Usalo

`outputs/skill-consensus-designer.md`diseña un protocolo de consenso para un conjunto de múltiples agentes: método de agrupamiento, ponderación, umbral y política de escalada para las rondas de subumbral.

## Envío

Antes de enviar cualquier mecanismo de consenso:

- **Attack-test with at least the three patterns**Su protocolo debe fallar de manera predecible, no silenciosamente.
- **Log every minority cluster**Los grupos minoritarios son su sistema de alerta temprana para errores correlacionados.
- **Enforce bounded rounds.**No "continuar el debate hasta un acuerdo" que recompensa la sicofanía.
- **Separate agreement from correctness.**La salida de consenso se dirige a un verificador; el verificador es independiente del conjunto.
- **Monitor the agreement rate.**Un aumento agudo significa sesgo de conformidad; una caída aguda significa deriva del modelo.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`.Confirmar la pluralidad fracasa el ataque de la monocultura pero CPWBFT lo mitigará parcialmente cuando la confianza de la monocultura es inferior a 0,7.
2. Añadir un cuarto patrón de ataque:**silent abstention** un agente se niega a responder ("no sé"). ¿Cómo debe tratar cada agregador las abstenciones?
3. Cambiar el agrupamiento semántico de la canonización de cadenas a la similitud de incorporación (utilice cualquier modelo de incorporación de código abierto). ¿Qué sucede con el ataque de sícofancia?
4. Leer CP-WBFT (arXiv:2511.10400). Implementar el paso de calibración de la sonda de confianza (un modelo de calibración separado verifica la confianza autoinformada de cada agente). Medir el aumento de precisión en el escenario de monocultivo.
5. Leer "¿Pueden los agentes de IA estar de acuerdo?" (arXiv:2603.01213). Reproduce un experimento simplificado de acuerdo escalar: tres agentes, una pregunta escalar, la persona engañosa. ¿CFPBFT o DecentLLMs lo captan?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| BFT | "Byzantine fault tolerance" | Castro-Liskov 1999 protocol for consensus with `f < n/3` arbitrary faults. |
| Byzantine | "Any bad behavior" | A node that can lie, drop messages, fail silently — anything but crash safely. |
| Confidence probe | "How sure are you?" | Self-reported or calibrator-predicted probability attached to a vote. |
| Semantic clustering | "Same answer, different words" | Grouping equivalent answers before counting votes. |
| Geometric median | "Robust center" | The point minimizing sum of distances to sample points. Robust to outliers, unlike the mean. |
| Monoculture | "Same model, same failures" | Correlated errors when agents share training data or base model. |
| Sycophantic conformity | "Agreeing with the loud voice" | An agent's vote biases toward whoever spoke first/loudest. |
| Core/Edge | "Hierarchical BFT" | WBFT split: small Core consensus first, Edge nodes follow. Bounds latency. |

## Leer más

- [Castro & Liskov — Practical Byzantine Fault Tolerance (OSDI 1999)](https://www.usenix.org/conference/osdi-99/practical-byzantine-fault-tolerance) la fundación
- [CP-WBFT — Confidence-Probe Weighted BFT](https://arxiv.org/abs/2511.10400) Peso de los votos por confianza
- [DecentLLMs — leaderless multi-agent consensus](https://arxiv.org/abs/2507.14928) Agregación geométrica-mediana
- [WBFT — Weighted BFT with Hierarchical Structure Clustering](https://arxiv.org/abs/2505.05103) División de núcleo/ borde para latencia limitada
- [Can AI Agents Agree?](https://arxiv.org/abs/2603.01213) Fragilidad de los acuerdos escalares y ataque de persona engañosa
