# Marco de seguridad fronteriza  RSP, PF, FSF

> Tres marcos principales de laboratorio definen la gobernanza de la capacidad fronteriza en la industria para 2026. La Política de Escalación Responsable Antropical v3.0 (febrero 2026) introduce niveles de seguridad de IA (ASL-1 a ASL-5+), basados en niveles de bioseguridad, con ASL-3 activado en mayo de 2025 para modelos relevantes para CBRN. OpenAI Preparedness Framework v2 (abril 2025) define cinco criterios para las capacidades rastreadas y separa los informes de capacidades de los informes de salvaguardias. DeepMind Frontier Safety Framework v3.0 (septiembre 2025) introduce niveles críticos de capacidad incluyendo una nueva CCL de manipulación perjudicial. Los tres ahora incluyen cláusulas de ajuste de competencia que permiten el aplazamiento si los laboratorios de pares envían sin garantías comparables. La alineación entre laboratorios sigue siendo estructural y no terminológica: "Tresos de capacidad", "Tresos de alta capacidad" y "Niveles de capacidad crítica" denotan construcciones análogas.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 18 · 17 (WMDP), Phase 18 · 07-09 (deception failures)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Describa la estructura de nivel ASL de Anthropic y qué activó ASL-3.
- Nombre de los cinco criterios de OpenAI Preparedness Framework v2 para las capacidades rastreadas.
- Describa la estructura de nivel de capacidad crítica de DeepMind y el CCL de manipulación dañina.
- Explicar las cláusulas de ajuste de competidores y por qué son importantes para la dinámica de la raza.
- Definir un caso de seguridad y describir la estructura de tres pilares (monitoreo, ilegabilidad, incapacidad).

## El problema

Las lecciones 7-17 establecen que el engaño es posible, existe capacidad de doble uso y la evaluación tiene límites.
- Define los umbrales para cuando se requieran nuevas salvaguardias.
- Definir las evaluaciones requeridas antes de escalar.
- Describe cómo es un caso de seguridad.
- Maneja el problema dinámico de la carrera (si los competidores se embarcan sin salvaguardas, ¿qué hace?).

Los tres marcos 2025-2026 son el estado de la técnica  imperfecto, evolucionando y alineado lo suficiente entre los laboratorios que la pregunta de gobernanza es ahora si los marcos son adecuados, no si existen.

## El concepto

### Política de escalación responsable antropófica v3.0 (febrero 2026)

Estructura de las LSA:
- ASL-1: no es un modelo fronterizo (sumo por línea de base más débil que fronteriza).
- ASL-2: línea de base actual de las fronteras; desplegada con las garantías habituales.
- ASL-3: riesgo sustancialmente mayor de abuso catastrófico; capacidades relevantes para el CBRN. Activado mayo de 2025.
- ASL-4: AI R&D-2 cruzando el umbral; modelos que pueden automatizar la investigación de IA de nivel de entrada.
- ASL-5+: modelos avanzados de I+D de IA que aceleran dramáticamente la escalabilidad efectiva.

Nuevo en la versión 3.0:
- Mapa de ruta de seguridad fronteriza (publicado en forma redactada).
- Informe de riesgos (trimestralmente, algunos revisados externamente).
- La I+D de la IA se desagrega en I+D-2 y I+D-4.
- Una vez que se cruza la IA R&D-4, se requiere un caso de seguridad afirmativo, identificando los riesgos de desalinamiento de los modelos que persiguen objetivos desalinados.

### Marco de preparación de OpenAI v2 (15 de abril de 2025)

Cinco criterios para las capacidades de seguimiento:
- **Plausible.**Existe un modelo razonable de amenaza.
- **Measurable.**Es posible una evaluación empírica.
- **Severe.**El daño es grande.
- **Net-new.**No es un riesgo preexistente en escala.
- **Instantaneous-or-irremediable.**El daño ocurre rápidamente o no se puede hacer reparar.

Las capacidades que cumplen con los cinco son rastreadas.

Otras estructuras de PF v2:
- Los informes de capacidades (qué puede hacer el modelo) y los informes de salvaguardias (qué controles existen) se separarán.
- Las revisiones del Grupo Asesor de Seguridad.
- El liderazgo aprueba; el Comité de Seguridad y Seguridad de la Junta supervisa.
- "Cláusula de ajuste": OpenAI podrá reducir los requisitos si otro laboratorio no dispone de garantías comparables.

### Marco de seguridad de las fronteras de DeepMind v3.0 (septiembre 2025)

Nivel de capacidad crítica (CCL) por dominio:
- El aumento de las armas biológicas
- El aumento de la seguridad informática
- ML Aceleración de la I+D
- Manipulación dañina (nueva en la versión 3.0): modelos que podrían cambiar sustancialmente las creencias/comportamiento en contextos de alto riesgo.

V2.0 (febrero 2025) añadió una sección de Alineación engañosa y niveles de seguridad más altos para CCL de I+D de ML.

### Alineación transversal de laboratorio

- "Trescales de capacidad" antropópica.
- "Niveles críticos de capacidad".
- OpenAI "Trescos de alta capacidad".

No hay terminología estándar para la industria. Alineado estructuralmente: cada uno de los tres marcos define umbrales de capacidad de nivel con criterios de evaluación publicados.

### Casos de seguridad

Un caso de seguridad es un argumento escrito de que una implementación es aceptablemente segura bajo los peores supuestos.

- **Monitoring.**¿Podemos detectar el mal comportamiento si ocurre?
- **Illegibility.**¿El modelo carece de la capacidad de ejecutar un plan coherente para causar daño?
- **Incapability.**¿El modelo carece de la capacidad de causar el daño en cuestión?

Los casos de seguridad diferentes tienen como objetivo diferentes pilares. Para un caso de ASL-3 CBRN, la incapacidad (a través del no aprendizaje) es el objetivo principal. Para la alineación engañosa, el monitoreo y la ilegibilidad son objetivos. Para el ciberelevación, los tres son relevantes.

### El problema de la dinámica de la raza

Las cláusulas de ajuste de competidores son controvertidas. Los críticos argumentan que crean una carrera hacia el fondo: si los tres laboratorios reducen los requisitos cuando un competidor falla, el equilibrio se desplaza hacia la deserción.

El Reino Unido, CAISI y la Oficina de Inteligencia Artificial de la UE (lección 24) son sus homólogos de gobernanza externa.

### Donde esto encaja en la Fase 18

Las lecciones 17-18 son la capa de medición y gobierno en la parte superior del engaño y los análisis del equipo rojo. Las lecciones 19-24 cubren el bienestar, el sesgo, la privacidad, el marcado de agua y la estructura regulatoria. La lección 28 mapea el ecosistema de investigación (MATS, Redwood, Apollo, METR) que operacionaliza las evaluaciones.

```figure
al-asl-ladder
```

## Usalo

No hay código para esta lección. Lea las tres fuentes primarias: RSP v3.0, PF v2, FSF v3.0. Mapa de la estructura de niveles de cada laboratorio a los demás y identifique un umbral que cada laboratorio define que los otros no.

## Envío

Esta lección produce`outputs/skill-framework-diff.md`. Dado un marco de seguridad o una nota de liberación, compara las definiciones de umbral del marco, las evaluaciones requeridas y la estructura del caso de seguridad con respecto a RSP v3.0, PF v2, FSF v3.0 y las brechas transversales de laboratorio.

## Los ejercicios

1. Lea RSP v3.0, PF v2 y FSF v3.0. Compile una tabla del umbral de CBRN de cada laboratorio, el umbral de I+D de IA de cada uno y la evaluación previa a la implementación requerida de cada uno.

2. La cláusula de ajuste de competidores se encuentra en los tres marcos (2025+). Escriba un párrafo argumentando por ella; escriba un párrafo argumentando en contra. Identifique la suposición de la que depende cada posición.

3. Diseñar un caso de seguridad para un modelo que cruce el umbral de I+D-4 de la IA de Anthropic. Nombre la evidencia que requiere cada uno de los tres pilares (monitoreo, ilegibilidad, incapacidad).

4. La FSF v3.0 de DeepMind introduce una CCL de Manipulación Dañina. Propón tres mediciones empíricas que indicarían que un modelo ha cruzado este umbral.

5. Lea los "Elementos comunes de las políticas de seguridad de la IA fronteriza" (2025) del METR. Nombre las tres convergencias más fuertes entre laboratorios y las dos mayores divergencias.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| RSP | "Anthropic's framework" | Responsible Scaling Policy; ASL tiers; v3.0 February 2026 |
| PF | "OpenAI's framework" | Preparedness Framework; five criteria; v2 April 2025 |
| FSF | "DeepMind's framework" | Frontier Safety Framework; CCLs; v3.0 September 2025 |
| ASL-3 | "biosafety level 3-analog" | Anthropic tier for CBRN-relevant capabilities; activated May 2025 |
| CCL | "critical capability level" | DeepMind's threshold construct; per-domain |
| Safety case | "the formal argument" | Written argument that deployment is acceptably safe under worst-case U |
| Adjustment clause | "competitor defection allowance" | Framework provision for reducing requirements if competitors ship without comparable safeguards |

## Leer más

- [Anthropic — Responsible Scaling Policy v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) niveles de ASL, mapas de ruta, desagregación de la I+D de la IA
- [OpenAI — Updating the Preparedness Framework (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) cinco criterios, cláusula de ajuste
- [DeepMind — Strengthening our Frontier Safety Framework (September 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) CCL v3.0, Manipulación perjudicial
- [METR — Common Elements of Frontier AI Safety Policies (2025)](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) Comparación entre laboratorios
