# Marco de preparación de OpenAI y Marco de seguridad de las fronteras de DeepMind

> OpenAI Preparedness Framework v2 (abril 2025) introduce categorías de investigación  Autonomía de largo alcance, Sandbagging, Replicación y Adaptación Autónoma, Minando las salvaguardas  distintas de las categorías rastreadas. Las categorías seguidas generan informes de capacidades más informes de salvaguardias revisados por el grupo asesor de seguridad. FSF v3 de DeepMind (septiembre 2025, con niveles de capacidad seguidas añadidos el 17 de abril de 2026) dobla la autonomía en dominios de I+D y Ciber (nivel de autonomía de I+D de I+D = automatizar completamente la tubería de I+D de IA a un costo competitivo frente a las herramientas de I+D de humanos). La FSF v3 aborda explícitamente la alineación engañosa mediante un monitoreo automatizado de un uso indebido de la razón instrumental. La nota honesta: Las categorías de investigación en PF v2 (incluida la autonomía de largo alcance) no desencadenan automáticamente las mitigaciones; el lenguaje de política es "potencial".

**Type:** Learn
**Languages:** Python (stdlib, three-framework decision-table diff tool), TypeScript
**Prerequisites:** Phase 15 · 19 (Anthropic RSP)
**Time:** ~45 minutes

## El problema

La lección 19 lee de cerca la política de escala de Anthropic. Esta lección completa la imagen leyendo OpenAI y DeepMind. Los tres documentos son artefactos primos que abordan la misma pregunta  cuándo debe un laboratorio fronterizo detener o abrir un modelo  y convergen en un pequeño conjunto de categorías y divergen en lugares específicos que importan.

La convergencia: las tres etiquetas de autonomía de largo alcance como una clase de capacidad que vale la pena rastrear. Los tres reconocen el comportamiento engañoso (falsificación de la alineación, sandbagging) como una clase específica de riesgo. Los tres tienen un organismo interno de revisión. La divergencia: OpenAI divide las categorías en "Seguido" ( mitigación obligatoria) y "Investigación" (sin desencadenante automático). DeepMind dobla la autonomía en dos dominios en lugar de nombrarla por separado. Los nombres del laboratorio son Tracked vs Research, o Critical vs Moderate, o Tier-1 vs Tier-2; la consecuencia operativa de cuál cubo vive una capacidad es diferente entre los laboratorios.

La misma capacidad puede ser " mitigación obligatoria " en Anthropic, " monitoreado pero no activado " en OpenAI, y " rastreado en un dominio específico " en DeepMind.

## El concepto

### Marco de preparación de OpenAI v2 (abril 2025)

Estructura:

- **Tracked Categories**El informe de seguridad de la empresa de seguridad (CPA) se presenta en el informe de la Comisión de Seguridad y Seguridad (CPA) y en el informe de las medidas de seguridad (CPA).
- **Research Categories**El estudio de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de los científicos de los científicos de los científicos de los científicos de los científicos de los científicos de los científicos de los científicos de la ciencia de los científicos de los científicos de los científicos de la ciencia de los científicos de la ciencia de la ciencia de la ciencia de la ciencia de los científicos de la ciencia de los científicos de la ciencia de los científicos de la ciencia de los científicos de la ciencia de los científicos de la ciencia de los científicos de los Estados Unidos de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de los Estados Unidos de que se hacientes de que no ha incluyen.

En el marco clave de v2: las categorías de investigación no desencadenan automáticamente las mitigaciones. El lenguaje de política es las mitigaciones "potenciales". Este es el delta específico para ver: la ubicación de una categoría en Tracked vs Research es la bisagra entre "perfugo" y "observado".

### Marco de seguridad de las fronteras de DeepMind v3 (septiembre 2025; niveles de capacidad seguidas añadidos el 17 de abril 2026)

Estructura:

- **Critical Capability Levels (CCLs)**El objetivo de la investigación es mejorar la capacidad de los usuarios de Internet y de los sistemas de comunicación, así como mejorar la capacidad de los usuarios de Internet y de los sistemas de comunicación.
- **Tracked Capability Levels**Ejemplo concreto: ML R&D autonomía nivel 1 = automatizar completamente la tubería de I&D de IA a un costo competitivo frente a las herramientas de IA + humanos.
- **Deceptive alignment monitoring**: compromiso explícito con el seguimiento automatizado de los abusos de razonamiento instrumental.

El marco de autonomía difiere de OpenAI. DeepMind no mantiene "Autonomía" como un dominio de nivel superior; se dobla en los dominios donde la autonomía causaría daño (ML R&D y Cyber). El argumento es que la autonomía sin un dominio es capacidad sin riesgo; el contraargumento es que la autonomía entre dominios es un meta-riesgo que el marco debe nombrar.

### ¿En qué convergen los tres?

- Grupo Asesor de Seguridad Interna (llamado Anthropic SAG, OpenAI SAG, DeepMind comité interno).
- Mención explícita de la alineación / alineación engañosa que se hace pasar como una clase de riesgo.
- Artículos permanentes en una cadencia declarada (Antropic: Roadmap de seguridad fronteriza, Informe de riesgo; OpenAI: Informe de capacidades y salvaguardias; DeepMind: Ciclo de actualización de FSF).
- El reconocimiento de que las defensas de monitoreo solo tienen un límite.

### Donde se desvían

- **Anthropic**: el compromiso de pausa eliminado en v3.0; el umbral de I+D-4 de IA es la próxima puerta nombrada.
- **OpenAI**: Se divide entre seguimiento y investigación; las categorías de investigación (incluida la autonomía de largo alcance) no se gate automáticamente.
- **DeepMind**: autonomía doblada en otros dominios; los niveles de capacidad seguidos agregan granularidad en abril de 2026.

### Sandbagging: una capacidad específica que complica los tres

El Sandbagging (un modelo que tiene un desempeño estratégicamente inferior en las evaluaciones) está en las categorías de investigación de OpenAI. RSP v3.0 de Anthropic lo aborda a través de la brecha de contexto-evaluación (lección 1). DeepMind lo aborda a través del monitoreo engañoso de alineación en FSF v3.

Si un modelo de arena se basa en las evaluaciones, los umbrales de capacidad de cada marco son subestimados. El marco sólo funciona si la medición funciona. Por eso, además de la autoevaluación de laboratorio, son necesarias mediciones externas (lección 21, METR) y evaluación adversaria.

### La habilidad de lectura de políticas

- Localiza: cada capacidad que te importa debe ser hallable en la póliza.
- Clasificar: ¿Es rastreado (acciona la mitigación) o Investigación (acciona pero no desencadena)? OpenAI llama esto; Anthropic y DeepMind tienen sus propios equivalentes.
- Cadencia: ¿La política se actualiza en un calendario declarado o sólo después de eventos específicos?
- Independencia: ¿es obligatoria o opcional la revisión externa?

```figure
a5-tracked-vs-research
```

## Usalo

`code/main.py`El programa de investigación de la Comisión de Investigación y Desarrollo (CEDEFOP) de la Comisión de Investigación y Desarrollo (CEDEFOP) de la Comisión de Investigación y Desarrollo (CEDEFOP) de la Comisión de Investigación y Desarrollo (CEDEFOP) de la Comisión de Desarrollo de la Investigación y Desarrollo de la Investigación (CEDEFOP) de la Comisión de Desarrollo de la Investigación y Desarrollo de la Investigación (CEDEFOP) de la Comisión de Investigación y Desarrollo de la Investigación (CEDEFOP) de la Comisión de Investigación y Desarrollo de la Investigación (CEDEFOP) de la Comisión de Investigación y Desarrollo de la Investigación (CEDEFOP) de la Comisión de Investigación (CEDEFOP) de la Comisión de Investigación (CEDEFOP) de la Comisión de Investigación (CEDEFOP) de la Comisión de Investigación (CEDEFOP) de la Comisión de Investigación (CEDEFOP) de la Investigación (CEDEFOP) de la Comisión de Investigación (CEDEFOP) de la Comisión de Investigación (C) de Investigación y de la Investigación (CEDEFOP) de la Comisión de Investigación (C) de la Comisión de Investigación (C) de la Comisión de Investigación y de Investigación (DO) de la Comisión de Investigación (DOCEDEFE) de la Comisión de la Comisión de Investigación de la Investigación (DO) de la Comisión de la Comisión de la Comisión de la Investigación y de la Investigación de la Investigación (DO) de la Investigación de la Investigación (DO) de la Investigación de la Investigación (DO) de la Investigación de la Investigación (DO, de la Comisión de la Comisión de la Comisión de la Comisión de la Comisión de la Investigación de la Investigación de la Investigación de la Investigación y de la Investigación de la Investigación de la Investigación (DO) sobre la Investigación de la Investigación de la Investigación (DO) sobre la Investigación de la Investigación (DO) sobre la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación (DO) sobre la Investigación de la Investigación de

## Envío

`outputs/skill-cross-policy-diff.md`produce una comparación entre políticas para una capacidad específica, utilizando los tres marcos como referencia.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`. Confirmar que la salida de la herramienta de diferencia coincide con las políticas para al menos dos capacidades que puede verificar con los documentos de origen.

2. Lea OpenAI Preparedness Framework v2 en su totalidad. Identifique cada categoría de investigación. Para cada una, escriba una frase sobre por qué está en investigación en lugar de rastreado.

3. Lea DeepMind FSF v3 en su totalidad, además de la actualización de los niveles de capacidad seguidos de abril de 2026. Identifique los criterios específicos de evaluación del nivel 1 de autonomía de I+D de ML. ¿Cómo lo mediría externamente?

4. El sandbagging está en las categorías de investigación de OpenAI. Diseñe una evaluación que obligue a un modelo de sandbagging a revelar su capacidad real.

5. Comparar las tres políticas en una capacidad específica (su elección). Nombre la clasificación de las políticas que usted considera más rigurosa y la que menos. Justifique con el texto fuente.

## Términos clave

| Term | What people say | What it actually means |
|---|---|---|
| Preparedness Framework | "OpenAI's scaling policy" | PF v2 (April 2025); Tracked vs Research categories |
| Tracked Category | "Mandatory mitigation" | Triggers Capabilities + Safeguards Reports; SAG review |
| Research Category | "Monitored only" | Tracked but no automatic mitigation; includes Long-range Autonomy |
| Frontier Safety Framework | "DeepMind's scaling policy" | FSF v3 (Sept 2025) + Tracked Capability Levels (Apr 2026) |
| CCL | "Critical Capability Level" | DeepMind threshold per domain (CBRN, Cyber, Harmful Manipulation, ML R&D) |
| ML R&D autonomy level 1 | "R&D automation" | Fully automate AI R&D pipeline at competitive cost |
| Sandbagging | "Strategic underperformance" | Model underperforms on evals; in OpenAI Research Categories |
| Instrumental reasoning | "Means-ends reasoning" | Reasoning about how to achieve goals; target of DeepMind monitoring |

## Leer más

- [OpenAI — Updating our Preparedness Framework](https://openai.com/index/updating-our-preparedness-framework/) Anuncio de v2.
- [OpenAI — Preparedness Framework v2 PDF](https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf) Documento completo.
- [DeepMind — Strengthening our Frontier Safety Framework](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) Anuncio de FSF v3.
- [DeepMind — Updating the Frontier Safety Framework (April 2026)](https://deepmind.google/blog/updating-the-frontier-safety-framework/) Aumento de los niveles de capacidad seguidos.
- [Gemini 3 Pro FSF Report](https://storage.googleapis.com/deepmind-media/gemini/gemini_3_pro_fsf_report.pdf) ejemplo de un informe de riesgo en formato FSF.
