# Marco normativo  UE, EE.UU., Reino Unido, Corea

> Cuatro regímenes reguladores primarios definen el panorama de gobernanza de IA de 2026. La Ley de IA de la UE (en vigor el 1 de agosto de 2024)  prácticas prohibidas y alfabetización en IA a partir del 2 de febrero de 2025; obligaciones de GPAI a partir del 2 de agosto de 2025; plena aplicabilidad y transparencia del artículo 50 el 2 de agosto de 2026; GPAI heredado y sistemas de alto riesgo integrados el 2 de agosto de 2027; sanciones de hasta 15 millones de EUR o el 3% del volumen de negocios global. Código de práctica de la GPAI (10 de julio de 2025): tres capítulos  Transparencia, Derechos de Autor, Seguridad y Seguridad  12 compromisos; la aplicación comienza en agosto de 2026. Reino Unido AISI -> Instituto de Seguridad de la Inteligencia Artificial (febrero 2025): las señales de renombre tienen un alcance más reducido. US AISI -> CAISI (junio 2025): Centro de Estándares e Innovaciones de Inteligencia Artificial bajo NIST; cambio hacia una postura favorable al crecimiento. La Ley Marco de IA de Corea (aprobada en diciembre de 2024, vigente en enero de 2026): El artículo 12 establece AISI bajo MSIT; manda representantes locales para empresas extranjeras de IA, evaluación de riesgos, medidas de seguridad para IA de alto impacto y generativa.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 18 · 18 (frontier frameworks), Phase 18 · 27 (data governance)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Describa los niveles de riesgo de la Ley de IA de la UE (prohibido, de alto riesgo, de propósito general, de riesgo limitado) y el calendario de agosto de 2025 / agosto de 2026 / agosto de 2027.
- Describa los tres capítulos del Código de Práctica de la GPAI y qué proveedores se vinculan.
- Describa las rebrands de 2025: AISI del Reino Unido -> Instituto de Seguridad de la Inteligencia Artificial; AISI de Estados Unidos -> CAISI; lo que cada rebranding implica sobre la dirección de la política.
- En el artículo 6 del Reglamento (UE) n.o 1095/2013 se establece que las medidas de seguridad de las personas con inteligencia artificial deben ser adoptadas en el marco de la legislación de Corea.

## El problema

Los marcos de laboratorio (lección 18) son voluntarios. los marcos regulatorios son obligatorios. El período 2024-2026 vio entrar en vigor la primera ola de regulación integral de la IA. Los implementadores deben mapear los controles técnicos a las obligaciones regulatorias; el mapeo difiere según la jurisdicción.

## El concepto

### Acta de la UE sobre IA

**In force 1 August 2024.**Estructura de nivel de riesgo:

- **Prohibited practices**(Artículo 5). Punto social, identificación biométrica remota en tiempo real en público (con excepciones de las fuerzas del orden público), manipulación explotadora de grupos vulnerables. Aplicada el 2 de febrero de 2025.
- **High-risk systems**(Anexo III) Empleo, educación, crédito, aplicación de la ley, justicia, migración.
- **General-Purpose AI (GPAI) models**. Aplicado el 2 de agosto de 2025. Todos los proveedores de GPAI tienen obligaciones; el GPAI de riesgo sistémico (> 1e25 FLOP calculado de formación) tiene obligaciones adicionales.
- **Limited-risk systems**- Obligas de transparencia en virtud del artículo 50 (etiquetado de contenido generado por IA).

Línea de tiempo:
- 2 de febrero de 2025: prácticas prohibidas + alfabetización de IA.
- 2 de agosto de 2025: IGAP + gobernanza.
- 2 de agosto de 2026: plena aplicabilidad + transparencia del artículo 50 + sanciones de hasta 15 millones EUR / 3% de la facturación global.
- 2 de agosto de 2027: GPAI + de alto riesgo incorporado.

La Comisión propuso ajustar el calendario de alto riesgo a 16 meses a finales de 2025.

### Código de práctica del GPAI

Publicado el 10 de julio de 2025. Tres capítulos:

- **Transparency.**Todos los proveedores de GPAI.
- **Copyright.**Todos los proveedores de GPAI.
- **Safety and Security.**Proveedores de IGAP de riesgo sistémico (estimadas entre 5 y 15 empresas).

El Comité de Inteligencia Artificial (AI) ha establecido un plan de acción para la aplicación de los compromisos de la Comisión de Inteligencia Artificial (CAI) en el marco del cual se han adoptado 12 compromisos en total.

### Código de transparencia para el artículo 50

El primer borrador 17 de diciembre de 2025. El segundo borrador de marzo de 2026. La versión final de junio de 2026. Cubre el etiquetado de contenido generado por IA, incluidos los deepfakes  la capa regulatoria que requiere la tecnología de marcado de agua de la Lección 23.

### Instituto de Seguridad de la Inteligencia Artificial del Reino Unido (febrero 2025)

Renombrado por el Instituto de Seguridad de la IA. La nueva marca reduce el alcance: elimina el sesgo algorítmico y los marcos de libre expresión; se centra en la seguridad de la capacidad fronteriza. La herramienta de evaluación de inspección de código abierto (mayo 2024). Colabora con Redwood (lección 10) en casos de seguridad de control.

### US CAISI (junio 2025)

La administración Trump transforma el Instituto de Seguridad de la IA del NIST en el Centro de Estándares e Innovación de la IA. Cambiar hacia "políticas de IA a favor del crecimiento" según las observaciones de la Cumbre de Acción de la IA de París del VP Vance. Reducido el énfasis en la evaluación previo al despliegue; énfasis en los estándares y el apoyo a la innovación. contrapeso interno a la postura regulatoria de la Ley de IA de la UE.

### Ley marco de IA coreana

Se aprobó en diciembre de 2024. Se promulgó en enero de 2025.

El artículo 12 establece un AISI en el marco del Ministerio de Ciencia y TIC (MSIT).
- Representantes locales de empresas extranjeras de IA que operan en Corea.
- Evaluación de riesgos para sistemas de IA de "alto impacto".
- Medidas de seguridad para IA generativa y IA de alto impacto.

Primera jurisdicción asiática con una regulación horizontal de IA integral.

### Dinámica entre jurisdicciones

- La UE: sanciones estrictas, de alto riesgo y pesadas.
- Estados Unidos: estados descentralizados que favorecen la innovación (por ejemplo, California AB 2013  Lección 27) llenan las lagunas federales.
- Reino Unido: un enfoque limitado en la seguridad, una infraestructura de evaluación sólida.
- Corea: dirigida por el MSIT, centrada en proveedores extranjeros.

Las empresas de implementación en múltiples jurisdicciones deben cumplir con las normas más estrictas, que en 2026 son típicamente la Ley de IA de la UE.

### Donde esto encaja en la Fase 18

La lección 18 es la gobernanza voluntaria de laboratorio; la lección 24 es regulatoria; la lección 25 es una clase emergente de CVEs para sistemas de IA; las lecciones 26-27 cubren la documentación (cartas) y la gobernanza de datos de capacitación.

```figure
an-eu-act-timeline
```

## Usalo

No hay código. Lea las fuentes principales de la Ley de IA de la UE: el texto del reglamento, el Código de Práctica de GPAI, el marco de inspección de AISI del Reino Unido.

## Envío

Esta lección produce`outputs/skill-regulatory-map.md`. Dado una descripción de la implementación, el mapa describe las jurisdicciones aplicables, las clasificaciones de niveles en cada una, las obligaciones por jurisdicción y la estructura de plazos.

## Los ejercicios

1. Consulte la Ley de IA de la UE (reglamento 2024/1689) y el Código de Práctica del GPAI (10 de julio de 2025). Identifique tres obligaciones que se aplican a cada proveedor de GPAI y tres que se aplican únicamente al GPAI de riesgo sistémico.

2. ¿Cuáles son las tres reglas de jurisdicción que se aplican y qué regla es vinculante para cada cuestión de fondo?

3. El cambio de nombre del Instituto de Seguridad de la IA del Reino Unido reduce el alcance.

4. El marco "pro crecimiento" de CAISI es una desviación del modelo de instituto de seguridad de IA 2022-2024. Identifique dos cambios de política medibles que se derivarían de este marco.

5. La Ley Marco de Inteligencia Artificial de Corea requiere representantes locales para proveedores extranjeros.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| EU AI Act | "the regulation" | Risk-tier-based horizontal AI regulation; in force Aug 2024 |
| GPAI | "general-purpose AI" | Large foundation models; systemic-risk subset has additional obligations |
| Article 50 | "transparency obligations" | AI-generated content labelling; applies Aug 2026 |
| UK AISI | "AI Security Institute" | Renamed Feb 2025; narrower frontier-security focus |
| CAISI | "US center for AI standards" | Renamed Jun 2025 from AI Safety Institute; pro-growth posture |
| Korean AI Framework Act | "MSIT horizontal regulation" | First Asian comprehensive AI law; effective Jan 2026 |
| Systemic-risk GPAI | "the 1e25 FLOP threshold" | Additional obligations tier; estimated 5-15 companies bound |

## Leer más

- [EU AI Act text (Regulation 2024/1689)](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) el reglamento y el calendario
- [GPAI Code of Practice (10 July 2025)](https://digital-strategy.ec.europa.eu/en/library/final-version-general-purpose-ai-code-practice) Código de tres capítulos
- [UK AI Security Institute (renamed Feb 2025)](https://www.gov.uk/government/organisations/ai-security-institute) página oficial
- [CSET — South Korea AI Framework Act Analysis (2025)](https://cset.georgetown.edu/publication/south-korea-ai-law-2025/) Análisis del marco coreano
