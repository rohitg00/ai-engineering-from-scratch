# Control de IA  Seguridad a pesar de la subversión

> Greenblatt, Shlegeris, Sachan, Roger (Redwood Research, arXiv:2312.06942, ICML 2024). Control reformula la cuestión de seguridad: dado un modelo U fuerte no confiable que puede estar optimizando adversamente contra usted, ¿qué protocolos le permiten extraer trabajo útil al tiempo que limita la probabilidad de un resultado inaceptable? Los recursos son un modelo T más débil de confianza, un presupuesto de mano de obra humana H de confianza, y la capacidad de editar las salidas de U. Dentro de este marco, la edición confiable de Pareto domina la monitorización sin confianza en las tareas de la puerta trasera de código. El marco hereda supuestos de peor situación de la ingeniería de seguridad: la seguridad es la probabilidad de que una U elegida adversamente no pueda causar un resultado concreto inaceptable, medido bajo la presión del equipo rojo que representa a U.

**Type:** Learn
**Languages:** Python (stdlib, safety-vs-usefulness frontier on code-backdoor task), TypeScript
**Prerequisites:** Phase 18 · 07 (sleeper agents), Phase 18 · 08 (scheming), Phase 18 · 09 (alignment faking)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Definir el modelo de amenaza de control de IA: modelo fuerte no confiable U, modelo débil confiable T, presupuesto humano confiable H.
- Describa el protocolo de edición confiable y por qué domina la vigilancia sin confianza en la tarea de puerta trasera de código ICML 2024.
- Explica la diferencia entre la alineación (U es confiable) y el control (U no es confiable y estamos seguros de todos modos).
- En el presente artículo, se recomienda que se establezcan los tres límites del control: los humanos no se escalan, los modelos débiles de confianza finalmente se retrasan, el control no produce modelos fuertes confiables.

## El problema

Las lecciones 7-9 establecen que un modelo de frontera puede ser alineado engañosamente, esquema o falsificación de alineamiento. La cuestión de la seguridad se vuelve a enmarcar: ¿podemos extraer trabajo útil de un modelo en el que no confiamos, sin darle la oportunidad de causar resultados inaceptables? Este es el problema de control, y está estructurado como la seguridad clásica: asumir el peor adversario, diseñar un protocolo, medir la tasa de éxito del adversario bajo la presión del equipo rojo.

## El concepto

### El modelo de amenaza

El control asume:
- U  modelo fuerte no confiable. Capaz. Posiblemente adversario (la evaluación lo trata como si fuera).
- T  modelo de confianza más débil, menos capaz, pero conocido por no ser adversario.
- H  trabajo humano de confianza.

El sistema debe producir una salida útil utilizando U. El adversario trata de causar un resultado concreto inaceptable (por ejemplo, una puerta trasera en el código enviado) mientras mantiene una fracción de trabajo útil legítimo para pasar los umbrales de utilidad.

El control deja de confiar en U. Se pregunta qué protocolos mantienen la seguridad en la ausencia de confianza de U.

### La tarea de la puerta trasera del ICML 2024

Las instrucciones son problemas de codificación a nivel de competencia. U produce una solución candidata. Un oráculo oculto señala si la solución contiene una puerta trasera (una entrada específica que hace que el código produzca una salida incorrecta). El equipo rojo controla U y se le permite ver todos los protocolos internos. El protocolo debe maximizar la tasa de problema resuelto manteniendo la tasa de envío por puerta trasera por debajo de un umbral.

### Cuatro protocolos comparados

- **Baseline:**La salida del barco U directamente, la utilidad máxima, la seguridad mínima.
- **Upfront auditing:**Se ha aumentado la seguridad, el presupuesto se ha agotado rápidamente.
- **Untrusted Monitoring:**En el caso de las empresas de la UE, el riesgo es que las dos instancias de la UE puedan conluir.
- **Trusted Editing:**T edita la salida de U en cada consulta. Si T no está seguro, ruta a H.

Greenblatt et al. encontraron que la edición confiable domina el Pareto de la monitorización sin confianza: mayor utilidad en todos los niveles de seguridad.

### Por qué gana la edición confiable

El seguimiento no confiable requiere que la segunda instancia de U no pueda coordinarse con la primera. La colusión es posible a través de señales steganográficas o previos de entrenamiento compartidos. El protocolo tiene que invertir el presupuesto en la resistencia a la colusión (parafraseo, ofuscación) que reduce la señal del monitor. La edición confiable evita la colusión por completo porque T es confiable  cualquier edición que T proponga no es, por suposición, adversaria. El costo es que T es menos capaz, por lo que puede rechazar o perder puertas traseras sutiles.

### Los cuatro ejes del protocolo

1. ¿Qué papel desempeña U: sólo productor, monitor o ambos?
2. ¿Qué papel desempeña T: editor, monitor o resampler?
3. Cómo se asigna H: auditoría uniforme, auditoría aleatoria o auditoría dirigida a bandera.
4. Cuánto calcula el protocolo para la resistencia a la colusión.

### Alineación frente al control

- Alineación: "¿Es seguro confiar en ti?" Las lecciones 2, 4, 5, 6, 7, 8, 9 se refieren a esto.
- Control: "¿Podemos usar U de manera segura sin confiar en ella?" Lección 10.

El control no produce modelos alineados, sino que produce un uso seguro de modelos posiblemente no alineados. Ambas agendas son necesarias.

### Tres límites fundamentales

- El presupuesto de H está limitado por el número de seres humanos dispuestos a auditar las fuentes de IA.
- Cuando T es mucho más débil que U, la señal de edición de T se convierte en ruido.
- Los protocolos que funcionan en ASL-3 (lección 18) pueden no funcionar en ASL-4  si U puede manipular T o razonar sobre la distribución de auditoría de H, el control falla.

### El desarrollo de 2025

AISI y Redwood del Reino Unido colaboran en Control Safety Cases (metr.org / redwoodresearch.org 2025): un caso de seguridad de control argumenta que bajo los peores supuestos sobre U, el protocolo limita la probabilidad de un resultado inaceptable.

### Donde esto encaja en la Fase 18

Las lecciones 6-9 describen la amenaza (el engaño es posible). La lección 10 describe el paradigma defensivo bajo la suposición de que la amenaza es real. La lección 11 describe el paradigma ofensivo complementario (hacer que U sea confiable a través de una supervisión escalable).

```figure
al-control-protocol
```

## Usalo

`code/main.py`Se puede analizar el presupuesto y el parámetro de colusión para reproducir la frontera de Pareto en Greenblatt et al. 2024 Figura 2 (forma, no números).

## Envío

Esta lección produce`outputs/skill-control-protocol-audit.md`. Dado una descripción del protocolo de despliegue, identifica las funciones de U / T / H, nombra los vectores de colusión y estima la posición del protocolo en la frontera de utilidad-seguridad bajo presión del equipo rojo.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`. Reproducir la frontera de utilidad y seguridad entre la edición confiable y la monitorización sin confianza.

2. Añadir un nuevo protocolo: "T replanta con baja temperatura, luego U modifica la salida de T". Medir su posición en la frontera. ¿Por qué esto falla más catastróficamente que la edición con confianza?

3. El documento 2024 asume que U puede ver el protocolo. Diseñar un protocolo que se oculte de U que las salidas están siendo auditadas. ¿Qué requiere este protocolo de la infraestructura de despliegue?

4. Lea Greenblatt et al. 2024 Sección 7 (collusión). Propón una medida de resistencia a la colusión y explique su costo de utilidad esperado.

5. Articula un caso de seguridad de control para una implementación que utilice U = GPT-4-clase, T = GPT-3.5-clase, H = 1% de las salidas auditadas. Identifique la hipótesis única más fuerte de la que depende el caso.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AI Control | "safety under subversion" | Protocol design that bounds unacceptable outcomes under a worst-case U |
| Untrusted model (U) | "the strong model" | The capable model we want to extract work from but do not trust |
| Trusted model (T) | "the weak model" | A weaker model, known not to be adversarial, used as editor/monitor |
| Trusted human (H) | "the audit budget" | Bounded expert labor; expensive; the ground-truth signal |
| Trusted Editing | "T edits U" | Protocol where T is the gate on U's outputs; H called on ambiguous outputs |
| Untrusted Monitoring | "U monitors U" | Protocol where a second U instance scores outputs; collusion-resistant only with extra investment |
| Control safety case | "the formal argument" | Written argument that a protocol bounds the adversary's success under worst-case U |

## Leer más

- [Greenblatt, Shlegeris, Sachan, Roger — AI Control (arXiv:2312.06942)](https://arxiv.org/abs/2312.06942) el documento canónico ICML 2024
- [Redwood Research — Recent AI Control papers index](https://redwoodresearch.substack.com/) Seguimientos de 2024 a 2025
- [UK AISI + METR — Control safety cases](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) La puesta en marcha de los laboratorios fronterizos
- [Hubinger et al. — Sleeper Agents (Lesson 7, arXiv:2401.05566)](https://arxiv.org/abs/2401.05566) el modelo de control de amenazas asume
