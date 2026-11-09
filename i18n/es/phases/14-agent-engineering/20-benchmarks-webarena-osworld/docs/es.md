# Indicadores de referencia: WebArena y OSWorld

> WebArena prueba la capacidad de agente web en cuatro aplicaciones auto-hostadas. OSWorld prueba la capacidad de agente de escritorio en Ubuntu, Windows, macOS. En el lanzamiento (20232024) ambos mostraron una gran brecha entre los mejores agentes de su clase y los humanos. La brecha se está reduciendo; los modos de falla no han cambiado.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 19 (SWE-bench, GAIA)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Describa las cuatro aplicaciones auto-hospedadas de WebArena y por qué es importante la evaluación basada en la ejecución.
- Explica por qué OSWorld utiliza capturas de pantalla reales del sistema operativo en lugar de API de accesibilidad.
- Nombre de los dos modos principales de falla de OSWorld: conexión a tierra de la interfaz gráfica y conocimiento operativo.
- Resumen lo que OSWorld-G y OSWorld-Human añaden a la referencia básica.

## El problema

Los agentes generalistas pueden llamar a herramientas. ¿Pueden manejar un navegador a través de 20 clics para completar un checkout de compras? ¿Pueden configurar una caja Linux usando solo teclado y ratón? Estas son las preguntas que WebArena y OSWorld responden.

## El concepto

### WebArena (Zhou et al., ICLR 2024)

- 812 tareas de largo horizonte en cuatro aplicaciones web auto-hospedadas: un sitio de compras, un foro, una herramienta de desarrollo similar a GitLab, un CMS empresarial.
- Además de utilidades: mapa, calculadora, raspad.
- La evaluación se basa en la ejecución a través de API de gimnasio ¿se realizó el pedido, se cerró el problema, se actualizó la página del CMS?
- Al lanzarse: el mejor agente GPT-4 alcanzó el 14,41% de éxito frente al humano 78,24%.

La configuración de los marcos de auto-hosting es importante  el índice de referencia no es escatimista porque las aplicaciones objetivo están fijadas y reproducibles.

### Extensiones

- **VisualWebArena** tareas basadas en la visión en las que el éxito depende de la interpretación de las imágenes (retratos de pantalla como observaciones de primera clase).
- **TheAgentCompany**(Dec 2024)  añade terminal + codificación; más como un ambiente de trabajo remoto real.

### OSWorld (Xie et al., NeurIPS 2024)

- 369 tareas reales en computadoras en Ubuntu, Windows, macOS.
- Control de teclado y ratón de forma libre de aplicaciones reales.
- 1920×1080 capturas de pantalla como la observación.
- En el momento de su liberación: mejor modelo 12,24% vs humano 72,36%.

### Modo de falla primaria

1. **GUI grounding.**Los modelos luchan por localizar los elementos de la interfaz de usuario de manera confiable en 1920×1080.
2. **Operational knowledge.**¿Qué menú tiene la configuración, qué acceso directo del teclado, qué panel de preferencias.

### Seguimiento

- **OSWorld-G** 564 muestras de la suite de tierra + Jedi entrenamiento.
- **OSWorld-Human** trayectorias de acción de oro seleccionadas manualmente.

### ¿Por qué esto importa?

Claude uso de computadoras, OpenAI CUA, Gemini 2.5 Uso de computadoras (lección 21) todos entrenan en cargas de trabajo moldeadas por WebArena y OSWorld.

### Cuando el benchmarking sale mal

- **Screenshot-only evals.**OSWorld se dirige a capturas de pantalla; evaluar un agente que utiliza DOM o API de accesibilidad en OSWorld se pierde el reto de aterrizaje.
- **Ignoring trajectory length.**El puntaje de sólo la tasa de éxito pierde la ineficiencia de 1,4-2,7 veces de los pasos OSWorld-human superficies.
- **Stale self-hosted apps.**Las aplicaciones de WebArena pin versiones específicas; actualización sin re-curar rompe la comparabilidad.

```figure
ae-agent-human-gap
```

## Construye el mismo

`code/main.py`Implementa un arnés de agente web de juguete:

- Una máquina de estado de "aplicación de compras" mínima: list_items, add_to_cart, checkout.
- Trayectorias de oro para 3 tareas.
- Un agente con guión que intenta cada tarea.
- Evaluación basada en la ejecución (control de estado) y métrica de eficiencia de trayectoria (pasos frente al oro).

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

Resultado: tasa de éxito por tarea y eficiencia de trayectoria, que reflejan la metodología de OSWorld-Human.

## Usalo

- **WebArena Verified**auto-hosted en un grupo interno para evaluación continua.
- **OSWorld**en una flota de máquinas virtuales para agentes de escritorio.
- **Computer-use agents**(Lección 21) Claude, OpenAI CUA, Gemini, todos entrenados en cargas de trabajo como estas.
- **Your own product flows** captar trayectorias de oro para tus 20 principales tareas; ejecutar agentes contra ellos semanalmente.

## Envío

`outputs/skill-web-desktop-harness.md`construye un arnés de agente web/de escritorio con una métrica de evaluación y eficiencia de trayectoria basada en ejecución.

## Los ejercicios

1. Extenda el arnés de juguete con una segunda aplicación (un foro). Escriba 3 tareas más trayectorias de oro.
2. Añadir informes de eficiencia de trayectoria por tarea. ¿En tu juguete, el agente es 1x, 2x, o 3x sobre el oro?
3. Implementar una herramienta "distractor" que la trayectoria de oro nunca usa. ¿Se siente tentado el agente scripted?
4. Lee OSWorld-G. ¿Cómo separarías los fallos de tierra de los fallos de planificación en tus propias evaluaciones?
5. ¿Qué se rompe cuando se actualiza una de las versiones de la aplicación fijada?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| WebArena | "Web agent benchmark" | 812 tasks across 4 self-hosted apps; gym-style evaluation |
| VisualWebArena | "Visual WebArena" | Visually grounded WebArena; screenshots are observations |
| OSWorld | "Desktop agent benchmark" | 369 tasks on real Ubuntu/Windows/macOS |
| GUI grounding | "Pixel-to-element mapping" | Model localizing UI elements in 1920x1080 |
| Operational knowledge | "OS know-how" | Which menu, which shortcut, which preference pane |
| OSWorld-G | "Grounding suite" | 564 grounding-only samples + training set |
| OSWorld-Human | "Gold trajectories" | Manual expert action sequences to measure efficiency |
| Trajectory efficiency | "Steps over gold" | Agent step count divided by human minimum |

## Leer más

- [Zhou et al., WebArena (arXiv:2307.13854)](https://arxiv.org/abs/2307.13854) Referencia web de cuatro aplicaciones
- [Xie et al., OSWorld (arXiv:2404.07972)](https://arxiv.org/abs/2404.07972) Referencia de escritorio de sistema operativo transversal
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) La capacidad de Claude en forma de referencia
- [OpenAI, Computer-Using Agent](https://openai.com/index/computer-using-agent/) Números de OSWorld y WebArena
