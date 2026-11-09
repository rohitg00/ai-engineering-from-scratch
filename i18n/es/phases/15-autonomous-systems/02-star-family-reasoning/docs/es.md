# STAR, V-STAR, Quieto-STAR  Razonamiento autodidacta

> El más pequeño bucle de auto-mejora posible se encuentra dentro de la lógica. Un modelo genera una cadena de pensamientos, mantiene los que aterrizan en las respuestas correctas, y los ajusta a la perfección. Eso es STAR. V-STaR añade un verificador para que la selección de tiempo de inferencia sea mejor. Quiet-STaR empuja la razón a cada token. Los tres trabajan. Ninguno de ellos es mágico. El bucle conserva cualquier atajo que sucedió para llegar a la respuesta correcta.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, bootstrap-loop simulator)
**Prerequisites:** Phase 13 · 01-03 (Reasoning and CoT), Phase 15 · 01 (long-horizon framing)
**Time:** ~60 minutes

## El problema

La forma más sencilla de enseñar a un modelo a razonar es recopilar rastros de razonamiento escritos por el hombre.

STaR (Self-Teught Reasoner, Zelikman et al., 2022) pregunta: ¿qué pasa si el modelo escribe sus propias racionalidades y las califica en función de las respuestas conocidas?

1. Muestre un rasgo de razonamiento más respuesta.
2. Si la respuesta final es correcta, mantenga el rastro.
3. - En sintonía con los rastros guardados.
4. Repito, ¿qué quieres?

GSM8K y CommonsenseQA mejoraron sin nuevas anotaciones humanas. Pero el bucle tiene un sesgo incorporado: cualquier razonamiento que produjo la respuesta correcta se conserva, independientemente de si el razonamiento en sí era sólido. V-STaR (Hosseini et al., 2024) corregir esto con un verificador aprendido; Quiet-STaR (Zelikman et al., 2024) generaliza la idea a per-token racionales internos.

## El concepto

### STaR: arranque en lo que funcionó

Comience con un modelo base con alguna capacidad de razonamiento débil. En cada problema de entrenamiento, muestre una razón más una respuesta. Si la respuesta coincide con la etiqueta, mantenga el (problema, razón, respuesta) triple. Ajuste el modelo en el conjunto mantenido. Repita.

Si el modelo nunca puede resolver un problema, el bucle no puede aprender de él.**rationalization**En el caso de problemas que el modelo no logre, inyectar la respuesta correcta como una pista y volver a impulsar el modelo para producir una justificación que lo lleve.

Resultado en el documento original (Zelikman et al., 2022): un modelo base GPT-J mejoró en GSM8K del 5.8% al 10.7% a través de rondas repetidas de STaR con racionalización  aproximadamente 5 puntos porcentuales absolutos. En CommonsenseQA, el GPT-J 6B entrenado en STaR alcanzó el 72.5%, comparable con un GPT-3 175B (~73%)

### V-STaR: entrenar a un verificador con DPO

Los datos de la serie de racionalidades de los usuarios de STaR son los datos de los usuarios de los datos de los usuarios de STaR. Hosseini et al. (2024) observan que estos son también datos: cada par de (racional, "es correcto esto") puede entrenar a un verificador. Utilizan la optimización de preferencias directas sobre soluciones correctas e incorrectas para construir un ranker.

Delta reportada: +4 a +17 puntos porcentuales respecto a las líneas de referencia anteriores de auto-mejora en GSM8K y MATH, la mayor parte de la ganancia proviene del uso del verificador para la selección del tiempo de inferencia en lugar de para el ajuste fino adicional del generador.

### Quiet-STaR: racionalidades internas por token

Zelikman et al. (2024) preguntó: ¿qué pasa si el modelo aprende a generar una racionalidad interna corta en cada posición de token, no solo entre el problema y la respuesta? Quiet-STaR entrena a un modelo para emitir un "pensamiento" oculto antes de cada token predicho, luego mezcla la predicción consciente del pensamiento con la predicción de línea de base a través de un peso aprendido.

Resultado: Mistral 7B obtuvo mejoras absolutas de cero disparos en GSM8K del 5.9% al 10.9% y CommonsenseQA del 36.3% al 47.2% sin ajuste específico de tarea. El modelo aprendió "cuándo pensar"  los tokens duros obtienen racionales internos más largos; los fáciles casi no obtienen ninguno.

### ¿Por qué los tres comparten una preocupación por la seguridad?

Los tres métodos utilizan la respuesta final como la señal de gradiente. Una razón que llega a la respuesta correcta a través de razonamiento defectuoso  explotando un atajo, adivinando o utilizando un patrón no generalizador  se refuerza positivamente. En los problemas de distribución el atajo funciona. En los problemas fuera de distribución rompe silenciosamente.

El verificador de V-STaR mitigará al aprender a clasificar las racionalidades, pero el verificador está entrenado en el mismo conjunto de etiquetas. Puede aprender a preferir el razonamiento incorrecto bien formado a la incertidumbre honesta. El diseño más seguro es combinar datos de estilo STaR con (a) modelos de recompensa supervisados por el proceso (recompensar pasos intermedios, no solo respuestas) y (b) evaluación OOD prolongada que rompe atajos simples.

### Comparación

| Method | Training signal | Inference cost | Data waste | Known failure mode |
|---|---|---|---|---|
| STaR | keep (rationale, answer) if correct | 1x | discards all incorrect rationales | shortcut rationales |
| STaR + rationalization | above + correct-answer hinted retries | 1x | less | rationalized rationales may be implausible |
| V-STaR | STaR + DPO verifier from both classes | Nx (best-of-N) | minimal | verifier can reinforce confident wrongness |
| Quiet-STaR | per-token rationale + mixing weight | 1.5-3x | minimal | still answer-conditioned gradient |

### Donde esto se encuentra en la pila de 2026

El STAR es viejo. Pero el patrón reaparece en todas partes en 2025-2026. RL en problemas matemáticos verificables (DeepSeek-R1, Kimi-k1.5, o1) es la señal de gradiente de respuesta de STaR, ampliada. Los modelos de recompensas de procesos (Lightman et al., 2023; "Verifiquemos paso a paso" de OpenAI) son la alternativa supervisada por el proceso. AlphaEvolve (Lección 3) es STaR para código, con un evaluador de programa en lugar de una etiqueta. La Máquina Darwin Godel (Ley 4) es STaR para el propio andamio del agente.

Comprender STaR hace que todos estos clics. Es el ciclo de auto-mejora mínimo viable.

```figure
reflection-loop
```

## Usalo

`code/main.py`ejecuta un ciclo STaR simulado en una tarea aritmética de juguete.

- Cómo la precisión se eleva sobre las balas de arranque.
- Cómo se introducen los atajos: el simulador incluye una clase de racionalización "perezosa" que obtiene la respuesta correcta el 40% de las veces pero generaliza mal.
- Cómo un verificador (estilo V-STaR) ayuda a la inferencia pero no puede recortar completamente los atajos introducidos durante el entrenamiento.

## Envío

`outputs/skill-star-loop-reviewer.md`ayuda a auditar una propuesta de diseño de razonamiento autodidacta antes de entrenar en ella.

## Los ejercicios

1. Ejecutar el simulador. Establecer la frecuencia de acceso directo a cero, luego a 0.4. ¿Cuánto difiere la precisión final entre las dos carreras, aunque ambas alcancen >90% en la distribución de entrenamiento?

2. Añadir una prueba de OOD prolongada al simulador. Dibujar problemas de una distribución diferente y evaluar el modelo arrancado tanto en los conjuntos de distribución como en los conjuntos de OOD. Cuantificar la brecha.

3. Lea el documento Quiet-STaR (arXiv:2403.09629) Sección 3. Explica el símbolo "fin de pensamiento" y la cabeza de peso mezclado en tres frases cada una.

4. Comparar el filtro de mantenimiento si es correcto de STaR con una alternativa supervisada por el proceso que recompensa cada paso racional de forma independiente.

5. Diseñar una evaluación que capture racionales de atajos en un modelo implementado. No tiene que ser perfecto  tiene que romper los atajos más simples que un bucle STaR reforzaría.

## Términos clave

| Term | What people say | What it actually means |
|---|---|---|
| STaR | "Self-Taught Reasoner" | Fine-tune on model-generated rationales that land correct answers; repeat |
| Rationalization | "Hinted retry" | Inject the correct answer and re-prompt for a rationale on problems the base model fails |
| V-STaR | "Verifier STaR" | DPO-train a verifier on both correct and incorrect rationales, use it for inference-time selection |
| Quiet-STaR | "Per-token rationales" | Generate hidden thoughts at every token position; mix with baseline prediction |
| Answer-conditioned gradient | "Outcome-based signal" | The training loop rewards final answers, not reasoning steps |
| Process reward model | "Step-level verifier" | Reward model trained on per-step correctness, not outcome — contrasts with STaR |
| Shortcut rationale | "Right answer, wrong reasoning" | A rationale that reaches the label via a non-generalizing pattern; STaR keeps these |

## Leer más

- [Zelikman et al. (2022). STaR: Bootstrapping Reasoning With Reasoning](https://arxiv.org/abs/2203.14465) el papel original.
- [Hosseini et al. (2024). V-STaR: Training Verifiers for Self-Taught Reasoners](https://arxiv.org/abs/2402.06457) añade un verificador de DPO para la selección del tiempo de inferencia.
- [Zelikman et al. (2024). Quiet-STaR: Language Models Can Teach Themselves to Think Before Speaking](https://arxiv.org/abs/2403.09629) rationales internos por token.
- [Lightman et al. (2023). Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) modelos de recompensas de proceso, la señal de gradiente alternativa.
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) RL en tareas verificables, STaR escalado a la formación fronteriza.
