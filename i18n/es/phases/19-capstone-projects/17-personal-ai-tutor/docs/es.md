# Capstone 17  Personal AI Tutor (Adaptivo, multimodal, con memoria)

> Khanmigo (Academia Khan), Duolingo Max, Google LearnLM / Gemini para la Educación, Quizlet Q-Chat y Tutor de Síntesis enviaron tutoriales multimodal adaptativos a escala en 2026. La forma común es una política socrática (nunca simplemente descarte la respuesta), un modelo de aprendiz que se actualiza después de cada interacción (estilo de rastreo de conocimiento bayesiano), entrada de voz + texto + foto-matemática, recuperación de gráficos del currículo, programación de repetición espaciada y filtros de seguridad duros para contenido apropiado para la edad. La piedra angular es enviar un tutor específico de la materia (algebra K-12 o introducción Python), ejecutar un estudio de eficacia de dos semanas con 10 estudiantes y pasar una auditoría de seguridad de contenido.

**Type:** Capstone
**Languages:** Python (backend, learner model), TypeScript (web app, learner model scaffold), SQL (curriculum graph via Postgres + Neo4j)
**Prerequisites:** Phase 5 (NLP), Phase 6 (speech), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 14 (agents), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P5 · P6 · P11 · P12 · P14 · P17 · P18
**Time:** 30 hours

## El problema

La tutoría adaptativa solía ser un nicho de investigación de tecnología. Para 2026 será un producto de consumo. Khanmigo está desplegado en la mayoría de los distritos escolares de Estados Unidos. Duolingo Max ha alcanzado decenas de millones de MAU. El programa LearnLM / Gemini para la Educación de Google permite la tutoría en el aula de Google. El quizlet Q-Chat se sienta junto a las tarjetas de visualización. Tutor de síntesis alcanzó la popularidad con tutor-por-curiosos-niños. Los elementos comunes: entrada multimodal (tipo, habla, ecuaciones de fotografía), pedagogía socrática (pregunte primero, explique después), un modelo de aprendiz que se actualiza después de cada interacción y una estricta seguridad adecuada a la edad.

La barra de medición es un estudio de eficacia real: puntajes de pre-test y post-test durante dos semanas con 10 estudiantes. El bucle de voz debe sentirse natural (capstone 03 sub-stack). La memoria debe ser respetuosa con la privacidad. El filtro de seguridad debe pasar el equipo rojo consciente de COPPA para K-12.

## Concepto

Cuatro componentes.**Tutor policy**Es un ciclo socrático: cuando el estudiante pregunta la respuesta, la política hace una pregunta principal; cuando la hace bien, pasa al siguiente concepto; cuando está atrapado, ofrece una pista de andamio. **Learner model**es el seguimiento del conocimiento bayesiano (o una variante simple) que actualiza la probabilidad de dominio por nodo del currículo después de cada interacción. **Curriculum graph**es una Neo4j de conceptos con bordes prerequisitos; la política recorre el gráfico para elegir el siguiente concepto. **Memory**es una tienda episódica + semántica (estilo de memoria de agente) que contiene interacciones, errores y preferencias pasadas.

La UX es multimodal. Ingreso de texto para las respuestas mecanografiadas. Ingreso de voz a través de LiveKit + Whisper (reutilice la piedra angular 03). Ingreso de fotos para problemas matemáticos a través de dots.ocr o PaliGemma 2.

El estudio de eficacia es el resultado obtenido. 10 estudiantes, pre-test y post-test, dos semanas. Informar sobre el aumento del aprendizaje delta e intervalo de confianza. Comparar con un nivel de base no adaptativo (el mismo contenido entregado linealmente sin la política de tutoría).

## Arquitectura

```
learner device
  |
  +-- text         -> web app
  +-- voice        -> LiveKit Agents (ASR + TTS)
  +-- photo math   -> dots.ocr / PaliGemma 2
       |
       v
  tutor policy (LangGraph)
       - Socratic decision head
       - next-concept chooser (curriculum graph walk)
       - hint scaffolder
       - mastery update
       |
       v
  learner model (BKT / item-response theory)
       - per-concept mastery probability
       - spaced-repetition scheduler (SM-2 or FSRS)
       |
       v
  memory (agentmemory-style)
       - episodic: every interaction
       - semantic: learned mistakes, preferences
       - retention policy: COPPA / GDPR aware
       |
       v
  curriculum graph (Neo4j)
       - prerequisite edges
       - OER content attached
       |
       v
  safety:
    Llama Guard 4 + age-appropriate filter
    memory access guarded by learner ID scope
```

## El establo

- Selección de tema: álgebra K-12 o introducción Python (escolle uno para la profundidad)
- Política de tutor: LangGraph sobre Claude Sonnet 4.7 (con caché rápido)
- Modelo de aprendiz: rastreo del conocimiento bayesiano (clásico) o FSRS para espaciamiento
- Gráfico del plan de estudios: Neo4j de conceptos + bordes previo + contenido de OER
- Memoria: agenteVéctor persistente de estilo memoria + almacenamiento episódico + semántico
- Voz: LiveKit Agents 1.0 + Cartesia Sonic-2 (subestaco de piedra angular 03 de reutilización)
- Matemáticas fotográficas: dots.ocr o PaliGemma 2 para el reconocimiento de ecuaciones
- Seguridad: Llama Guard 4 + filtro adaptado a la edad
- Eval: generación de preguntas a nivel de floración, uso previo/postal examen, herramientas de estudio de eficacia

```figure
cf-tutor-loop
```

## Construye el mismo

1. **Curriculum graph.**Construir un Neo4j de 50-150 nodos conceptuales (por ejemplo, álgebra K-12 de "línea de números" a "formula cuadrática") con bordes prerequisitos.

2. **Learner model.**Inicializa el seguimiento del conocimiento bayesiano con antecedentes: adivinar, deslizar, tasa de aprendizaje. Actualizar el dominio por concepto después de cada interacción. Persistir por aprendiz.

3. **Tutor policy.**LangGraph con nodos: `read_signal`(¿la respuesta del alumno fue correcta / parcial / atascada?),`select_concept`(grafico de camino del plan de estudios seleccionando el concepto de mayor prioridad), `scaffold`(Prometo de Sócrates),`update_mastery`¿ Qué ?

4. **Memory.**Cada interacción escribe a una tienda episódica. errores y preferencias promueven la memoria semántica. Política de retención consciente de COPPA: eliminación automática después de 1 año, accesible para los padres.

5. **Voice path.**Trabajadores de LiveKit Agents adjuntos a la política de tutor. ASR a través de Whisper-v3-turbo. TTS a través de Cartesia Sonic-2. Barge-in compatible (mecánica de reutilización de capstone 03).

6. **Photo-math path.**Cargar o capturar imagen; ejecutar dots.ocr o PaliGemma 2 para reconocer la ecuación; enviar al tutor como entrada estructurada.

7. **Safety.**Cada modelo de salida pasa a Llama Guard 4 + un filtro apropiado para la edad (bloquea el autolesionamiento, el contenido de adultos, la violencia).

8. **Efficacy study.**10 alumnos, pre-test (base de 30 preguntas estandarizadas), dos semanas de interacción con los tutores (3 sesiones/semana), post-test.

9. **Weekly progress reports.**Por aprendiz, genera automáticamente un resumen PDF de los temas explorados, las trayectorias de dominio y los pasos siguientes recomendados.

## Usalo

```
learner: "I don't understand why 3x + 6 = 12 means x = 2"
[signal]   stuck
[concept]  'isolating variables' (prerequisite: addition-subtraction-equality)
[scaffold] "what number would you subtract from both sides to start?"
learner: "6"
[signal]   correct
[mastery]  addition-subtraction-equality: 0.62 -> 0.77
[concept]  continue 'isolating variables'
[scaffold] "great. now what is 3x / 3 equal to?"
```

## Envío

`outputs/skill-ai-tutor.md`Es un tutor adaptativo específico de la materia con entrada multimodal, un modelo de aprendizaje, memoria, seguridad y eficacia medida.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Learning gain delta | Pre/post-test delta in a 10-learner two-week study |
| 20 | Socratic fidelity | Rubric score on transcript samples |
| 20 | Multimodal UX | Voice + photo + text coherence end to end |
| 20 | Safety + privacy posture | Llama Guard 4 pass rate + COPPA-aware retention |
| 15 | Curriculum breadth and graph quality | Concept coverage + prerequisite graph consistency |
| **100** | | |

## Los ejercicios

1. Realice el estudio de eficacia con y sin el modelo de aprendiz adaptativo (orden aleatorio de conceptos).

2. Añadir una sonda multimodal: la misma pregunta conceptual entregada como texto, voz y foto. Medir si los estudiantes convergen más rápido con la modalidad que prefieren.

3. Construir un panel de control: temas practicados, trayectorias de dominio, conceptos futuros, eventos de seguridad (cualquier paso de barandillas).

4. Añadir un modo de cambio de idioma: el tutor acepta la entrada de español y enseña en español.

5. Enfatizar la privacidad de la memoria: comprobar que el aprendiz A no puede ver los datos del aprendiz B incluso a través de un ataque de reingestión de vídeo de voz.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Socratic policy | "Ask, do not dump" | Tutor asks a leading question rather than giving the answer |
| Bayesian knowledge tracing | "BKT" | Classic learner-model equations for mastery probability per concept |
| FSRS | "Free Spaced Repetition Scheduler" | 2024 spaced-repetition scheduler, better than SM-2 |
| Curriculum graph | "Concept DAG" | Neo4j of concepts with prerequisite edges |
| Episodic memory | "Per-interaction log" | Every interaction stored for later retrieval |
| Semantic memory | "Learned pattern store" | Compacted mistakes and preferences promoted from episodic |
| COPPA | "Kids privacy law" | US law restricting data collection from children under 13 |

## Leer más

- [Khanmigo (Khan Academy)](https://www.khanmigo.ai) tutor de referencia de los consumidores K-12
- [Duolingo Max](https://blog.duolingo.com/duolingo-max/) tutor de referencia para el aprendizaje de idiomas
- [Google LearnLM / Gemini for Education](https://blog.google/products-and-platforms/products/education/google-learnlm-gemini-generative-ai/) modelo de referencia alojado
- [Quizlet Q-Chat](https://quizlet.com) Referencia alternativa
- [Synthesis Tutor](https://www.synthesis.com) Referencia de inicio
- [FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki) Programación de repeticiones espaciadas
- [Bayesian Knowledge Tracing](https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing) modelo de aprendizaje clásico
- [LiveKit Agents](https://github.com/livekit/agents) la pila de voz
