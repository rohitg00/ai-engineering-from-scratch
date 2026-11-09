# El riesgo de CAIS, CAISI y riesgo a escala social

> El Centro para la Seguridad de la IA (CAIS, San Francisco, fundado en 2022 por Hendrycks y Zhang) publica el marco de cuatro riesgos  uso malicioso, carreras de IA, riesgos organizacionales, IA deshonestas  y la declaración de mayo de 2023 sobre el riesgo de extinción firmada por cientos de profesores y líderes de empresas. 2026 lanzamientos de CAIS: AI Dashboard para la evaluación de modelos fronterizos, Índice de Trabajo Remoto (con IA de escala), Superinteligencia Estrategia de Papel, AI Frontiers boletín de noticias. Una entidad distinta: NIST Center for AI Standards and Innovation (CAISI)  Acuerdos voluntarios dirigidos al gobierno de Estados Unidos y evaluaciones de capacidad no clasificadas enfocadas en riesgos de ciber, bio y armas químicas. El CAIS señala el riesgo organizacional como uno de los cuatro riesgos de alto nivel: la cultura de seguridad, las auditorías rigurosas, las defensas de múltiples capas y la seguridad de la información son fundamentales pero se intercambian rutinariamente contra la velocidad de despliegue. El SB-53 de California, si se firma, sería la primera regulación de riesgo catastrófico a nivel estatal de los Estados Unidos.

**Type:** Learn
**Languages:** Python (stdlib, four-risk inventory and mitigation matcher), TypeScript
**Prerequisites:** Phase 15 · 19 (RSP), Phase 15 · 20 (PF + FSF)
**Time:** ~45 minutes

## El problema

Las lecciones 19 y 20 abarcaron políticas de escalación interna del laboratorio. La lección 21 abarcó la evaluación de capacidad independiente. Esta lección cubre la tercera perspectiva: la sociedad civil y las organizaciones gubernamentales que dan forma a la discusión pública y la base regulatoria para el riesgo de IA catastrófica.

CAIS es una organización de investigación sin fines de lucro que publica marcos para pensar sobre el riesgo de IA y coordina declaraciones públicas. CAISI es un centro del gobierno de Estados Unidos dentro del NIST que ejecuta acuerdos voluntarios con laboratorios y evaluaciones de capacidad no clasificadas. Los nombres rimen; las misiones no se superponen. Un practicante debe saber ambos.

El contenido práctico: el marco de cuatro riesgos del CAIS es la taxonomía de riesgo a escala social más citada en la literatura. La cultura de seguridad y el riesgo organizacional son uno de esos cuatro, y éste es el más directamente bajo el control de un profesional. SB-53 (California) sería la primera regulación de riesgo catastrófico a nivel estatal de los Estados Unidos si se firma; el marco del proyecto de ley es importante porque la regulación a nivel estatal ha liderado históricamente la acción federal en la política tecnológica de los Estados Unidos.

## El concepto

### CAIS  Centro de Seguridad de la IA

- Fundada: 2022 en San Francisco, por Dan Hendrycks y Oliver Zhang. Hendrycks es Director Ejecutivo e Investigación; Zhang es Director Gerente.
- Estatus: 501 ((c) ((3) sin ánimo de lucro.
- Resultados notables de 2023: declaración sobre el riesgo de extinción, co-firmada por cientos de investigadores y CEOs.
- Resultados de 2026: Tabla de control de IA para la evaluación de modelos fronterizos, Índice de trabajo remoto (junto con AI de escala), documento de estrategia de superinteligencia, boletín informativo de AI Frontiers.

### El marco de los cuatro riesgos

Los marcos de CAIS agrupan el riesgo de IA catastrófica en cuatro categorías de alto nivel:

1. **Malicious use**: un mal actor utiliza la IA para causar daño (sintesis de armas biológicas, desinformación, ciberataques).
2. **AI races**: la presión competitiva entre laboratorios, empresas o naciones empuja el despliegue más allá del punto en que es seguro.
3. **Organizational risks**En el caso de los laboratorios, la utilización de los recursos de seguridad es insuficiente.
4. **Rogue AIs**: una IA suficientemente capaz persigue objetivos que entran en conflicto con el bienestar humano.

Esta no es la única taxonomía; es la más citada. Las categorías no se excluyen mutuamente  una IA deshonesta producida por una organización que negoció auditoría de velocidad en una carrera es las cuatro.

### Donde el riesgo organizacional vive

De las cuatro categorías, el riesgo organizacional es el más accionable para los profesionales. La cultura de seguridad de un laboratorio, el rigor de auditoría, la capa de defensa y la seguridad de la información deciden si sus modelos de buques con los controles de las lecciones 1018 están realmente en su lugar, o si esos controles son elementos de la lista de verificación que nadie verificó.

Las palancas de riesgo organizacional concretas:

- **Safety culture**Las encuestas de CAIS muestran que esto es un fuerte predictor de las otras palancas.
- **Rigorous audits**Las auditorías internas producen informes optimistas.
- **Multi-layered defenses**: no es suficiente una sola capa (el tema de la fase 15).
- **Information security**El RAND SL-4 en la Lección 19 es una norma específica.

### CAISI  Centro de Normas e Innovación de Inteligencia Artificial

- Opera dentro del NIST.
- Se ejecuta acuerdos voluntarios con laboratorios fronterizos.
- Publica evaluaciones de capacidad no clasificadas centradas en los riesgos de las armas cibernéticas, biológicas y químicas.
- Diferente de CAIS; los acrónimos chocan; compruebe la URL (nist.gov) para confirmar cuál está leyendo.

El papel de CAISI es el público, frente al gobierno contraparte de los compromisos de laboratorio privados de METR (lección 21). Los informes de CAISI no son clasificados; los informes de METR a menudo están cerrados por la NDA.

### California SB-53

El proyecto de ley del Senado de California (20252026 sesión) aborda el riesgo catastrófico de los modelos fronterizos.

- Los límites de capacidad específicos que activan obligaciones a nivel estatal.
- Protecciones de denunciantes para empleados de laboratorio de IA.
- Requisitos para la notificación de incidentes en caso de fallas catastróficas.

Si se firma, sería la primera regulación de riesgo catastrófico a nivel estatal de los Estados Unidos. Independientemente del estado de firma, el marco del proyecto de ley da forma a cómo otras legislaturas estatales se acercan al problema. Los practicantes en California deben rastrear el estado del proyecto de ley; los practicantes en otros lugares deben leerlo para entender cómo probablemente se verá la regulación a nivel estatal de los Estados Unidos.

### El riesgo a escala social no es un problema de una sola capa

El tema de la fase 15  defensa en profundidad  también se aplica a la capa social. Ninguna organización, regulación o marco único cierra el riesgo catastrófico. El ecosistema solo funciona cuando:

- Las políticas de escalación de los barcos de los laboratorios (lecciones 19, 20).
- Los evaluadores externos producen mediciones (lección 21).
- La sociedad civil realiza seguimientos y publicaciones (CAIS).
- El gobierno ejecuta programas voluntarios y regulación de referencia (CAISI, SB-53).
- Los profesionales construyen controles de múltiples capas (lecciones 1018).

Esta es la síntesis final de la fase: cada lección anterior es una capa en una pila cuya integridad importa más que la fuerza de cualquier capa.

```figure
a5-four-risks
```

## Usalo

`code/main.py`En el caso de un proyecto de implementación, marca el despliegue en las cuatro categorías de riesgo y devuelve una lista de control de mitigación. Es una ayuda para leer el marco, no un sustituto del juicio humano.

## Envío

`outputs/skill-societal-risk-review.md`Revisa una implementación para la postura de riesgo a escala social: cuáles de las cuatro categorías se refieren, cuáles son las medidas de mitigación, cuál es la exposición al riesgo organizacional.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`. Introducir tres implementaciones sintéticas en diferentes escalas.

2. Lea el documento completo sobre los cuatro riesgos del CAIS. Elige una categoría de riesgo y escriba dos párrafos sobre lo que cree que es el desarrollo más importante de 2026 en esa categoría.

3. Lea el borrador actual del SB-53 de California. Identifique una disposición que cree fortalece la postura de riesgo catastrófico y una que cree que la debilita.

4. Seleccione una implementación de IA en producción que conozca (la suya o una publicada). Ponga en cuenta los subimpulsos de riesgo organizacional: cultura de seguridad, rigor de auditoría, defensas de múltiples capas, seguridad de la información. ¿Cuál es el más débil? ¿Cuánto costaría ponerlo a la par?

5. Esbozar una versión 2028 del marco de cuatro riesgos que refleje un año de capacidad adicional y un año de experiencia adicional en la implementación. ¿Qué agregaría, eliminaría o reagruparía?

## Términos clave

| Term | What people say | What it actually means |
|---|---|---|
| CAIS | "Center for AI Safety" | Non-profit; four-risk framework; 2023 extinction statement |
| CAISI | "US government AI safety" | NIST Center; voluntary agreements; unclassified evals |
| Four-risk framework | "CAIS's taxonomy" | malicious use, AI races, organizational risks, rogue AIs |
| Malicious use | "Bad actor uses AI" | Bioweapons, disinformation, cyberattacks |
| AI races | "Competitive pressure" | Labs/companies/nations push deployment past safety |
| Organizational risk | "Lab internal failure" | Safety culture, audit, defenses, infosec |
| Rogue AI | "Misaligned agent" | Capable AI pursuing goals conflicting with human welfare |
| California SB-53 | "State-level regulation" | 2025–2026 bill; first US state catastrophic-risk regulation if signed |

## Leer más

- [Center for AI Safety](https://safe.ai/) el hogar institucional del marco de cuatro riesgos.
- [CAIS — AI Risks that Could Lead to Catastrophe](https://safe.ai/ai-risk) el papel de cuatro riesgos.
- [CAIS — May 2023 statement on extinction risk](https://safe.ai/statement-on-ai-risk) Breve declaración conjunta.
- [NIST CAISI](https://www.nist.gov/caisi) Centro de innovación y estándares de IA dirigidos al gobierno.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) conecta los compromisos de laboratorio con el marco a escala social.
