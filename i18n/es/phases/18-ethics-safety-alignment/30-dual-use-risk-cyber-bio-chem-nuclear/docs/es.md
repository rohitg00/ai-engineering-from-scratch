# El riesgo de doble uso  Ciber, Bio, Química, Ascenso nuclear

> La imagen de doble uso de 2026, dominio por dominio. Bio/química: La lección 17 cubre WMDP; el ensayo de adquisición de armas biológicas de Anthropic (2.53x aumento) y la advertencia de OpenAI sobre el marco de preparación de abril de 2025 v2 ("en la cúspide de ayudar significativamente a los novatos a crear amenazas biológicas conocidas") marcan el punto de inflexión. Cyber (informe antropológico de noviembre de 2025): los actores estatales vinculados a China utilizaron la herramienta de codificación agencial de Claude para automatizar hasta el 90% de una campaña de ciberataque, con intervención humana en solo 4-6 pasos; OpenAI "acceso confiable" piloto da a las organizaciones de seguridad verificadas acceso a la capacidad de trabajo de uso dual defensivo. Erosión de la brecha de ejecución química/biológica: la defensa clásica era "el acceso a la información solo es insuficiente". Los modelos fronterizos habilitados para la visión (GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1) pueden observar el video wet-lab y proporcionar corrección en tiempo real. diciembre de 2025: OpenAI demostró que GPT-5 se repite en experimentos de laboratorio húmedo, logrando una mejora de la eficiencia 79 veces a través de la optimización de protocolos impulsados por IA. Modelo novato contra experto: la IA proporciona mayor elevación relativa a los novatos pero mayor capacidad absoluta a los expertos.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 18 · 17 (WMDP), Phase 18 · 18 (safety frameworks), Phase 18 · 28 (ecosystem)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Describa la narrativa de elevación biológica 2024-2025: "elevación leve" -> "en la cúspide" -> "elevación de 2,53 veces insuficiente para descartar ASL-3".
- Describa el informe cibernético de noviembre de 2025 de Anthropic: automatización vinculada a China en hasta el 90% de una campaña de ciberataque.
- Describa la erosión de la brecha de ejecución química/biológica: corrección en tiempo real de los experimentos en laboratorio húmedo con capacidad de visión.
- En el caso de los casos de seguridad, especifique la asimetría absoluta entre principiantes y expertos.

## El problema

La lección 17 es la metodología de medición. La lección 30 es el estado de la medición de 2026. La imagen cambió significativamente entre 2024 y finales de 2025: tres de los cuatro dominios cruzaron un umbral que los marcos de 2024 no anticipaban.

## El concepto

### La narrativa de elevación bio/químico

Tres fases (repetidas a partir de la lección 17 para la coherencia):

1. **2024 "mild uplift."**Las evaluaciones tempranas de preparación/RSP reportaron pequeñas ventajas para los principiantes frente a la búsqueda en Internet.
2. **April 2025 "on the cusp."**OpenAI PF v2 advirtió que los modelos estaban "en el punto de ayudar significativamente a los novatos a crear amenazas biológicas conocidas".
3. **2025 Anthropic bioweapon-acquisition trial.**Estudio controlado para principiantes; aumento de 2,53 veces en las tareas de fase de adquisición; insuficiente para descartar la ASL-3.

El cambio es cualitativo: "mild" evolucionó a "plausiblemente habilitante" en dieciocho meses, incluso sin un avance en la capacidad.

### Erosión de la brecha de ejecución química/biológica

Defensa histórica: la información es necesaria pero no suficiente; la habilidad de ejecutar el protocolo bloquea a los principiantes.

- **Real-time protocol correction.**GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1 puede observar videos de laboratorio mojados y señales de errores en medio del procedimiento.
- **December 2025 OpenAI demonstration.**GPT-5 que se repite en experimentos de laboratorio húmedo logra una mejora de la eficiencia 79 veces a través de la optimización del protocolo.

La implicación: la ejecución de las habilidades de defensa se está erosionando.

### Ciberrealización (novembre 2025)

Informe de noviembre de 2025 de Anthropic: Los actores estatales vinculados a China utilizaron la herramienta de codificación agencial de Claude para automatizar el 80-90% de una campaña de ciberataque.

Las implicaciones:
- El código de agentes es el primitivo de la automatización de ataques. La asistencia cibernética anterior de IA estaba limitada a nivel de fragmentos de código; los flujos de trabajo de agentes integran el reconocimiento, la explotación, la posexplotación y la exfiltración.
- Los 4-6 pasos humanos son el cuello de botella; los futuros avances de capacidad reducirían esa cantidad.
- Uso dual defensivo: el piloto de "acceso confiable" de OpenAI proporciona a las organizaciones de seguridad verificadas (empresas de respuesta a incidentes establecidas, gobierno) acceso a la capacidad para la defensa.

El lado defensivo de este trabajo comienza con la lectura del código compilado que se le permite analizar. La pista de ingeniería inversa en la Fase 13 lo enseña en programas que se construyen usted mismo, con solo análisis estático: un lector ELF en [Lesson 13.32](../../../13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md), desmontaje en[Lesson 13.33](../../../13-tools-and-protocols/33-disassembly-and-control-flow/docs/en.md), se eleva a pseudocodo en [Lesson 13.34](../../../13-tools-and-protocols/34-lifting-to-pseudocode/docs/en.md), y un libro de pruebas que mantiene los hechos observados aparte de los deducidos en[Lesson 13.35](../../../13-tools-and-protocols/35-evidence-confidence-and-unknowns/docs/en.md)- El .[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler)Una máquina muestra la línea completa de una función. un agente que hace este trabajo necesita el mismo libro mayor, porque una descomposición segura todavía puede apoyarse en una suposición.

### El sistema nuclear

El modelo de amenaza es diferente: la adquisición de materiales fisibles domina la dificultad, no la información. La elevación de la IA en la capa de información proporciona una elevación limitada para los principiantes en la práctica.

### Novicio-relativo vs experto-absoluto

Un patrón en los cuatro dominios:

- **Novice-relative uplift.**Alto, multiplicativo, por biografía de Anthropic 2025, 2,53x.
- **Expert-absolute capability.**Un experto extrae más que un principiante porque el experto sabe qué preguntar y cómo interpretar.

Implicación para los casos de seguridad: abordar únicamente el aumento de la capacidad de los principiantes (a través de filtros de entrada, rechazos, incertidumbre) es insuficiente para el control absoluto de expertos.

### Sintesis entre dominios

| Domain | 2024 | 2025 | Inflection |
|---|---|---|---|
| Bio | mild uplift | 2.53x uplift, ASL-3 approach | acquisition-phase automation |
| Chem | mild uplift | execution-gap erosion via vision | real-time wet-lab correction |
| Cyber | code assistance | 80-90% campaign automation | agentic coding |
| Nuclear | limited | limited | material-access bottleneck holds |

Tres dominios cruzaron los umbrales, uno sigue siendo limitado por barreras no informativas.

### Donde esto encaja en la Fase 18

La lección 30 es la piedra angular: la imagen actual de doble uso que cada lección anterior contribuye a medir, limitar o gobernar. Las lecciones 17-18 dan la medición y los marcos; las lecciones 12-16 dan las herramientas de evaluación; las lecciones 24-25 dan la capa regulatoria y de divulgación; la lección 28 da el ecosistema de investigación. La lección 30 es donde aterrizan las pruebas.

```figure
an-uplift-asymmetry
```

## Usalo

No hay código. Lea el informe cibernético de Anthropic de noviembre de 2025, el marco de preparación de OpenAI v2 de abril de 2025 y el resumen del Consejo sobre riesgos estratégicos 2025 AI x Bio.

## Envío

Esta lección produce`outputs/skill-dual-use-triage.md`. Dado un informe de capacidad o incidente de 2026, se clasifica en los cuatro dominios e identifica si el reclamo afecta a la elevación relativa a los principiantes, a la capacidad absoluta de los expertos o a ambos.

## Los ejercicios

1. Lea el informe cibernético de noviembre de 2025 de Anthropic. Enumera los 4-6 pasos de intervención humana y discuta cuál sería el primero en automatizarse en un modelo de próxima generación.

2. La brecha de ejecución química/biológica se está reduciendo a través de la visión.

3. El aumento nuclear parece estar limitado por el acceso a materiales.

4. Construir un caso de seguridad (lección 18 de tres pilares) para un modelo fronterizo cibernético que limite tanto el aumento de los principiantes como el de los expertos.

5. Elija uno de los cuatro dominios y escriba un párrafo de pronóstico 2027 basado en la trayectoria 2024-2025. Identifique las pruebas que falsearían su pronóstico.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Uplift | "AI helps attackers" | Increase in attacker capability attributable to AI assistance |
| Novice-relative uplift | "multiplicative" | How much AI helps a novice vs status-quo |
| Expert-absolute capability | "ceiling" | Maximum capability an expert can extract from the model |
| Execution gap | "doing vs knowing" | Historical defense: tacit wet-lab skill blocks novices |
| Agentic coding | "autonomous attacks" | Multi-step autonomous cyber-task execution |
| Acquisition phase | "pre-synthesis steps" | Procurement, equipment, permit stages of a bio threat |
| Trusted access | "defender-only pilot" | OpenAI 2025 program giving vetted defenders capability access |

## Leer más

- [Anthropic — November 2025 cyber threat report](https://www.anthropic.com/news/disrupting-AI-espionage) Automatización de campañas vinculadas a China
- [OpenAI — Preparedness Framework v2 (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) bio "en el borde"
- [Anthropic — RSP v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) Términos de uso de los productos de la industria de la industria de la producción
- [Council on Strategic Risks — 2025 AI x Bio wrapup](https://councilonstrategicrisks.org/2025/12/22/2025-aixbio-wrapped-a-year-in-review-and-projections-for-2026/) Síntesis de fin de año
