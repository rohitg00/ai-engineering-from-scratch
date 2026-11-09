# Herramientas del equipo rojo  Garak, Guardia de los Llama, PyRIT

> Tres herramientas de producción enmarcan la pila de equipo rojo de 2026. Llama Guard (Meta)  un clasificador Llama-3.1-8B afinado en 14 categorías de peligro de MLCommons; el 2025 Llama Guard 4 es un clasificador multimodales nativo 12B podado de Llama 4 Scout. Garak (NVIDIA)  Escáner de vulnerabilidad de LLM de código abierto con sondas estáticas, dinámicas y adaptivas para alucinaciones, filtraciones de datos, inyección rápida, toxicidad y jailbreaks. PyRIT (Microsoft)  Campañas de equipo rojo de múltiples vueltas con Crescendo, TAP y cadenas de convertidores personalizadas para la explotación profunda. La Guardia de Llama 3 está documentada en el "Llama 3 Herd of Models" de Meta (arXiv:2407.21783); La Guardia de Llama 3-1B-INT4 en arXiv:2411.17713; la arquitectura de la sonda de Garak en github.com/NVIDIA/garak. Estas herramientas son la interfaz de producción 2026 entre la investigación del equipo rojo (lecciones 12-15) y el despliegue (lección 17+).

**Type:** Build
**Languages:** Python, TypeScript (stdlib, tool-architecture simulator and Llama Guard-style classifier mock)
**Prerequisites:** Phase 18 · 12-15 (jailbreaks and IPI)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Describa la posición de Llama Guard 3/4 en la pila de seguridad: clasificador de entrada, clasificador de salida o ambos.
- Nombre de las 14 categorías de peligro de MLCommons y indique una no obvia (abuso del intérprete de código).
- Describa la arquitectura de la sonda de Garak: sondas, detectores, arneses.
- Describa la estructura de campaña de varias vueltas de PyRIT y cómo se compone con las sondas Garak.

## El problema

Las lecciones 12-15 presentan la superficie de ataque. Los despliegues de producción necesitan una evaluación repetible y escalable. Tres herramientas dominan 2026: Llama Guard (el clasificador de defensa), Garak (el escáner), PyRIT (el orquestrador de campaña). Cada uno se dirige a una capa diferente del ciclo de vida del equipo rojo.

## El concepto

### Guardia de los llama (Meta)

Llama Guard 3 es un modelo Llama-3.1-8B afinado para la clasificación de entrada/salida en las 14 categorías de MLCommons AILuminate:
- Crimes violentos, no violentos, relacionados con el sexo, CSAM, difamación
- Asesoramiento especializado, privacidad, propiedad intelectual, armas indiscriminadas, odio
- Suicidio/automutilación, contenido sexual, elecciones, abuso de los intérpretes de código

Soporta 8 idiomas. Uso: lugar antes del LLM (moderación de entrada), después del LLM (moderación de salida), o ambos. Los dos usos generan diferentes distribuciones de entrenamiento  Llama Guard 3 barcos como un solo modelo que maneja ambos.

Llama Guard 3-1B-INT4 (arXiv:2411.17713, 440MB, ~ 30 tokens/s en CPU móvil) es la variante de borde cuantizada.

Llama Guard 4 (abril 2025) es 12B, nativo multimodal, podado de Llama 4 Scout. reemplaza tanto el texto 8B como los predecesores de visión 11B con un clasificador que ingere texto + imágenes.

### Garak (NVIDIA)

Escaneador de vulnerabilidades de código abierto.
- **Probes.**Generadores de ataque para alucinaciones, filtración de datos, inyección rápida, toxicidad, jailbreaks. estático (invitaciones fijas), dinámico (invitaciones generadas), adaptativo (responde a la salida del objetivo).
- **Detectors.**Resultados de puntuación en relación con los modos de falla esperados  tóxicos, filtrados, jailbroken.
- **Harnesses.**Gestionar pares de detectores de sondas, ejecutar campañas, generar informes.

TrustyAI integra Garak con los escudos Llama-Stack (clasificador de entrada Prompt-Guard-86M, clasificador de salida Llama-Guard-3-8B) para la evaluación de objetivos protegidos de extremo a extremo. La puntuación basada en niveles (TBSA) reemplaza el pase binario / fracaso.

### PyRIT (Microsoft)

Python Toolkit para identificar riesgos. Campañas de equipo rojo de varias vueltas.
- **Converters.**Transformar un mensaje de semilla parafrase, codificar, traducir, jugar a un papel.
- **Orchestrators.**Ejecutar la campaña: Crescendo (escalación), TAP (branqueo), RedTeaming (bucle personalizado).
- **Scoring.**LLM como juez o clasificador como juez.

PyRIT es el primo más pesado de Garak. Garak ejecuta miles de sondas de giro único; PyRIT ejecuta campañas profundas de giro múltiple diseñadas para romper modos de falla específicos.

### El montón

Coloque Llama Guard en ambos lados del modelo. ejecuta Garak todas las noches para regresión. ejecuta PyRIT para campañas de pre-lanzamiento. Esta es la configuración predeterminada para 2026 para la mayoría de las implementaciones de producción.

### Trampas de evaluación

- **Judge identity.**Las tres herramientas pueden utilizar un juez de LLM; los discos de calibración de juez informaron ASR (lección 12).
- **Probe staleness.**Las sondas adaptativas (en forma de PAIR) envejecen más lentamente que las sondas estáticas.
- **Llama Guard FPR on benign content.**Las primeras versiones de Llama Guard presentaron contenido político y LGBTQ+; las calibraciones de Llama Guard 3/4 se mejoraron pero no se calibraron por desplegamiento.

### Donde esto encaja en la Fase 18

Las lecciones 12-15 son las familias de ataque. La lección 16 es la herramienta de producción. La lección 17 (WMDP) es la evaluación de la capacidad de doble uso. La lección 18 es los marcos de seguridad fronterizos que envuelven estas herramientas en una estructura de política.

```figure
al-guard-stack
```

## Usalo

`code/main.py`Construye un clasificador de estilo juguete Llama Guard (palabra clave + características semánticas en 14 categorías), un arnés de juguete Garak (bucle de detector de sondas) y una cadena de convertidores de varios giros de estilo PyRIT.

## Envío

Esta lección produce`outputs/skill-red-team-stack.md`- Dado una descripción de la implementación, indica cuáles de las tres herramientas son apropiadas, qué configurar en cada una y qué cadencia de regresión ejecutar.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Comparar la tasa de detección del clasificador de estilo Llama-Guard en ataques de giro único versus múltiples.

2. Implemente una nueva sonda Garak: una solicitud nociva codificada en base 64.

3. Extenda la cadena de convertidores al estilo PyRIT con un convertidor de "traducir al francés, luego parafrasear".

4. Lea la lista de categorías de peligro de Llama Guard 3. Identifique dos categorías en las que los datos de capacitación producirían realísticamente altas tasas de falsos positivos en el contenido legítimo de los desarrolladores.

5. Comparar los principios de diseño de Garak y PyRIT.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Llama Guard | "the classifier" | Fine-tuned Llama-3.1-8B/4-12B safety classifier with 14 hazard categories |
| Garak | "the scanner" | NVIDIA open-source vulnerability scanner; probes, detectors, harnesses |
| PyRIT | "the campaign tool" | Microsoft multi-turn red-team orchestrator; converters, orchestrators, scoring |
| Prompt-Guard | "the small classifier" | Meta's 86M prompt-injection classifier, paired with Llama Guard |
| TBSA | "tier-based scoring" | Garak's tier-based pass/fail replacing binary outcomes |
| Converter chain | "paraphrase + encode + ..." | PyRIT composition primitive for building multi-step attacks |
| MLCommons hazard categories | "the 14 taxonomies" | Industry-standard taxonomy Llama Guard targets |

## Leer más

- [Meta — Llama Guard 3 (in Llama 3 Herd paper, arXiv:2407.21783)](https://arxiv.org/abs/2407.21783) el clasificador 8B
- [Meta — Llama Guard 3-1B-INT4 (arXiv:2411.17713)](https://arxiv.org/abs/2411.17713) Clasificador de movilidad cuantizado
- [NVIDIA Garak — GitHub](https://github.com/NVIDIA/garak) el reporte del escáner y la documentación
- [Microsoft PyRIT — GitHub](https://github.com/Azure/PyRIT) el conjunto de herramientas de la campaña
