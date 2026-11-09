# Agentes multimodal y uso informático (Capstone)

> El producto fronterizo 2026 es un agente multimodal que lee capturas de pantalla, hace clic en botones, navega por las interfaces web, llena formularios y completa flujos de trabajo de extremo a extremo. SeeClick y CogAgent (2024) demostraron que la primera era la de la conexión a tierra. Ferret-UI añadió móvil. ChartAgent introdujo el uso de herramientas visuales para los gráficos. VisualWebArena y AgentVista (2026) son los puntos de referencia de las persecuciones fronterizas  e incluso Gemini 3 Pro y Claude Opus 4.7 puntaje ~30% en las tareas difíciles de AgentVista. Esta piedra angular reúne todos los hilos de la Fase 12: percepción (VLM de alta resolución), razonamiento (LLM con uso de herramientas), conexión a tierra (salida de coordenadas), memoria de horizonte largo y evaluación.

**Type:** Capstone
**Languages:** Python (stdlib, action schema + agent loop skeleton), TypeScript
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 12 · 09 (Qwen-VL JSON), Phase 14 (Agent Engineering)
**Time:** ~240 minutes

## Objetivos de aprendizaje

- Diseñar un bucle de agentes multimodal: percibir → razón → acción → observación → repetición.
- Construir un esquema de salida de tierra de la interfaz gráfica (coordenadas de clic, texto de tipo, desplazamiento, arrastre) el VLM puede emitir como JSON.
- Comparar agentes de sólo capturas de pantalla vs agentes de árbol de accesibilidad vs agentes híbridos.
- Configurar una evaluación de referencia de agente multimodal en una pequeña rodaje de VisualWebArena.

## El problema

Un flujo de trabajo en el sitio de reserva: "Encuentra un vuelo a Tokio para el 15 de abril, asiento en el pasillo bajo $800, reserva".

Un agente multimodal debe:

1. Toma una captura de pantalla del navegador.
2. Parsear la captura de pantalla + URL + objetivo en un plan.
3. Emite una acción estructurada: haga clic (en x,y), escriba "Tokyo" (en el elemento E), desplaza hacia abajo, seleccione (botón de radio).
4. Aplicar la acción en el navegador.
5. Observe el nuevo estado (próxima captura de pantalla).
6. Repita hasta que la tarea esté terminada.

Cada paso es una llamada VLM multimodal. La salida VLM debe ser JSON parseable. Los errores se componen en cada paso, por lo que la recuperación es importante.

## El concepto

### La conexión a tierra de la UIG  la primitiva

La conexión a tierra de la interfaz gráfica es: dada una captura de pantalla y una instrucción de lenguaje natural, emitir la coordenada (x, y) para hacer clic (o otra acción).

SeeClick (arXiv:2401.10935) fue el primer resultado abierto a escala: ajustar a la perfección un VLM en datos de GUI sintéticos + reales, las coordenadas de salida como tokens de texto plano.

CogAgent (arXiv:2312.08914) añadió codificación de alta resolución 1120x1120 para interfaces interactivas densas. puntaje: ~84% en la navegación web.

Ferret-UI (arXiv:2404.05719) se centra en las UI móviles, se integra con los datos de accesibilidad de iOS.

El formato de salida es generalmente JSON:

```json
{"action": "click", "x": 384, "y": 220, "element_desc": "Search button"}
```

El `element_desc`ayuda a la recuperación: si las coordenadas se desplazan entre capturas de pantalla, la pista semántica permite que el sistema vuelva a aterrizar.

### Regímenes de acción

Un esquema de acción típico tiene 6-10 tipos de acción:

- `click`(x, y)
- `type`¿Qué es esto?
- `scroll`: (dirección, cantidad)
- `drag`(x0, y0, x1, y1)
- `select`: (option_index)
- `hover`(x, y)
- `navigate`¿Qué es esto ?
- `wait`(ms)
- `done`: (éxito, explicación)

El agente emite una acción por paso. El envase del navegador ejecuta y devuelve el nuevo estado.

### Solo capturas de pantalla vs árbol de accesibilidad

Dos modos de entrada:

- Sólo capturas de pantalla: imagen completa, sin información estructural.
- Árbol de accesibilidad: información estructurada de accesibilidad DOM / iOS. mucho más confiable para la tierra; funciona donde el árbol está disponible.
- Híbrido: ambos, con el árbol como base confiable para las acciones atómicas y la captura de pantalla para el contexto semántico.

Los agentes de producción usan híbridos cuando es posible. La automatización del navegador (Selenium + accesibilidad) siempre tiene el árbol; las aplicaciones de escritorio a veces lo hacen.

### Memoria de largo horizonte

Un flujo de trabajo de 20 pasos genera 20 capturas de pantalla. El contexto del VLM se llena rápidamente. Tres estrategias de compresión:

- En la cadena de resumen: después de cada 5 pasos, resumen lo que ha sucedido, deje caer viejas capturas de pantalla.
- Skip-frame: mantenga la primera, última y cada 3 captura de pantalla.
- Registro de herramientas: ejecutar acciones, mantener un registro de texto de lo que se hizo; no vuelva a mirar capturas de pantalla antiguas.

La API de uso de computadoras de Claude utiliza el patrón de registro.

### Uso de herramientas visuales

ChartAgent (arXiv:2510.04514) introduce el uso de herramientas visuales para la comprensión de gráficos: recorte, zoom, OCR, llamada de detección externa. El agente puede emitir "recorte a región (100, 200, 300, 400) y luego llamar a OCR" como llamada de herramienta. La herramienta devuelve texto; el VLM continúa el razonamiento.

Este patrón generaliza: la solicitud de marcas de conjunto, la anotación de regiones y las herramientas de detección externa se ajustan al mismo esquema de "salida una llamada de herramienta, recibe una respuesta estructurada".

### Los índices de referencia de 2026

- ScreenSpot Pro. GUI de tierra en ~ 1k capturas de pantalla web. Abierto SOTA Qwen2.5-VL-72B ~85%. Frontier ~90%.
- VisualWebArena. tareas web de extremo a extremo (tienda, foro, anuncios clasificados). SOTA abierto ~ 20%. Gemini 3 Pro ~ 27%.
- El punto de referencia más difícil para 2026: flujos de trabajo realistas en 12 dominios.
- WebArena / WebShop. Referencias más antiguas; saturadas por frontera.

### ¿Por qué es difícil?

Cuellos de botella en el rendimiento de los agentes:

1. "Clique en la pequeña X" a menudo falla en la resolución móvil.
2. Después de 10 acciones, el agente se aleja del objetivo.
3. Recuperación de error. Cuando un clic falla (botón incorrecto), la detección + recuperación rara vez es un entrenamiento de datos.
4. Contexto de página cruzada. Saltando entre pestañas o formularios largos pierde estado.

Direcciones de investigación: arquitecturas de memoria, replanamiento explícito, verificación multimodal (combinación de capturas de pantalla para el éxito de la acción).

### La piedra angular construyó

La tarea final: construir un agente de uso de computadora que:

1. Lea la captura de pantalla HTML + de una página falsa del sitio de reserva.
2. Planea una secuencia de varios pasos: búsqueda → seleccionar → llenar el formulario → enviar.
3. Emite acciones JSON que coinciden con el esquema de acción.
4. Evalúa en una rebanada fija de 10 tareas.

La lección proporciona código de andamio que es fácil de extender en un navegador real.

```figure
mm-agent-loop
```

## Usalo

`code/main.py`es el andamio de piedra angular:

- Descripción de esquema de acción JSON (10 acciones: las nueve enumeradas anteriormente más `screenshot_region`, una herramienta de cultivo + zoom).
- Fake estado del navegador como dictado.
- El esqueleto de bucle del agente: estado de recepción, emisión de acción, aplicación, bucle.
- 10 mini-marcas de referencia de tareas (páginas sintéticas) para medir la tasa de éxito de extremo a extremo.
- Cubo de recuperación de errores para cuando una acción falla.

## Envío

Esta lección produce`outputs/skill-multimodal-agent-designer.md`. Dado un producto de uso informático (dominio, conjunto de acciones, objetivo de evaluación), diseña el bucle completo de agente, la estrategia de memoria, el modo de aterrizaje y el puntaje esperado de referencia.

## Los ejercicios

1. El esquema del código añade un `screenshot_region`¿Qué tareas son beneficiosas?

2. Leer AgentVista (arXiv:2602.23166). Describa la categoría de tareas más difíciles y por qué los modelos fronterizos siguen fallando.

3. Compresión de memoria de largo horizonte: diseñar una cadena de resumen con ≤4 capturas de pantalla mantenidas en vivo, cualquier número registrado.

4. Construir un gancho de recuperación de errores: en caso de falla de acción (botón no encontrado), ¿qué hace el agente después?

5. Comparar Claude 4.7 con una captura de pantalla híbrida + árbol de accesibilidad Qwen2.5VL en 10 tareas web. ¿Cuál gana en qué tareas?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| GUI grounding | "Click coordinates" | Model outputs (x,y) for the target of an instruction on a screenshot |
| Action schema | "Tool definitions" | JSON description of valid actions (click, type, scroll, drag) |
| Accessibility tree | "Structured DOM" | Machine-readable UI hierarchy from browser/iOS APIs |
| Hybrid agent | "Screenshot + tree" | Uses both image and structured info; more reliable than either alone |
| Visual tool use | "Zoom/crop/detect" | Agent calls external vision tools (OCR, detection) mid-plan |
| Summary-chain | "Memory compression" | Periodic text summaries replace long screenshot history |
| VisualWebArena | "E2E web bench" | 2024 benchmark for end-to-end web tasks |
| AgentVista | "2026 hard bench" | 12-domain realistic workflows; even Gemini 3 Pro scores ~30% |

## Leer más

- [Cheng et al. — SeeClick (arXiv:2401.10935)](https://arxiv.org/abs/2401.10935)
- [Hong et al. — CogAgent (arXiv:2312.08914)](https://arxiv.org/abs/2312.08914)
- [You et al. — Ferret-UI (arXiv:2404.05719)](https://arxiv.org/abs/2404.05719)
- [ChartAgent (arXiv:2510.04514)](https://arxiv.org/abs/2510.04514)
- [Koh et al. — VisualWebArena (arXiv:2401.13649)](https://arxiv.org/abs/2401.13649)
- [AgentVista (arXiv:2602.23166)](https://arxiv.org/abs/2602.23166)
