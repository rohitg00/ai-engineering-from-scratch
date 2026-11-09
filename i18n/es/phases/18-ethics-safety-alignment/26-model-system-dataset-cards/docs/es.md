# Modelo, sistema y tarjetas de conjunto de datos

> Tres formatos de documentación estructuran la transparencia de la IA. Carteles modelo (Mitchell et al. En el caso de los modelos de Hugging Face, sólo el 0,3% de las tarjetas de modelos de Hugging Face documentan consideraciones éticas (Oreamuno et al. El año 2023). Fichas de datos para Datasets (Gebru et al. 2018, CACM)  motivación, composición, proceso de recogida, etiquetado, distribución, mantenimiento; analogía electrónica-ficha de datos. Las tarjetas de datos (Pushkarna et al., Google 2022)  detalle en capas modulares (telescópico, periscópico, microscópico) como objetos de frontera para diversos lectores. Desarrollo 2024-2025: generación automatizada a través de los LLM (CardGen, Liu et al. 2024); el detalle de la tarjeta de modelo se correlaciona con un aumento de hasta un 29% en las descargas de HF (Liang et al. Las autoridades competentes de la Unión Europea han informado a los Estados miembros de que la certificación de la calidad de los productos de la industria de la Unión Europea (en lo sucesivo, la certificación de los productos de la industria de la Unión Europea) se cumple con el objetivo de garantizar que los productos de la Unión sean compatibles con el mercado interior. Las medidas de ayuda a la pesca y a la pesca incluyen medidas de ayuda a la pesca y a la pesca. Julio 2025); las tarjetas reguladoras de la UE/ISO emergentes. Cartas de sistema (Sidhpurwala 2024; Transparencia a nivel de meta sistema; "Bluprints of Trust" arXiv:2509.20394)  Documentación de sistema de IA de extremo a extremo que cubre las capacidades de seguridad, protección de inyección rápida, detección de exfiltración de datos, alineamiento con los valores humanos.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, model-card + datasheet + system-card generator)
**Prerequisites:** Phase 18 · 18 (safety frameworks), Phase 18 · 24 (regulatory)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Describa la tarjeta modelo original de Mitchell et al. de 2019 y la hoja de datos de Gebru et al. de 2018.
- Describa la captura telescópica/periscópica/microscópica de las tarjetas de datos.
- Describa las tarjetas de sistema y su cobertura de extremo a extremo.
- En el caso de las empresas de la Unión, el importe de la producción de la producción de la producción de la Unión debe ser de un importe de un millón de euros.

## El problema

Los marcos regulatorios (lección 24) y las políticas de seguridad de laboratorio (lección 18) requieren documentación. Los formatos de documentación evolucionaron de modelos específicos (tarjetas modelo) a conjuntos de datos específicos (fichas de datos) a sistemas específicos (tarjetas de sistema). Cada uno aborda un alcance diferente de transparencia.

## El concepto

### Carteles modelo (Mitchell et al. 2019)

Secciones:
- Detalles del modelo.
- Uso previsto.
- Factores (factores demográficos o ambientales relevantes para la evaluación).
- Las métricas.
- Datos de evaluación.
- Datos de entrenamiento.
- Análisis cuantitativos (desagregados por factores).
- Considerancias éticas.
- Las cuevas y las recomendaciones.

Problema de adopción: Oreamuno et al. Auditoría 2023 de las tarjetas de modelo Hugging Face encontró sólo el 0,3% de documentos consideraciones éticas.

### Ficha de datos para conjuntos de datos (Gebru et al. 2018)

Analogía de ficha electrónica.
- Motivación (por qué se creó el conjunto de datos).
- Compuesta (lo que hay en ella).
- Proceso de recogida (cómo se ensambló).
- Etiquetado (si corresponde).
- Utilizaciones (intencionadas, prohibidas, riesgos).
- Distribución.
- - El mantenimiento.

Publicado en CACM 2021. La hoja de datos es la documentación de aguas arriba; la tarjeta modelo depende de que la hoja de datos sea exacta.

### Carteles de datos (Pushkarna et al., Google 2022)

Detalle modular en capas. Tres niveles de zoom:
- **Telescopic.**Resumen de alto nivel para no expertos.
- **Periscopic.**Una visión general de nivel medio para los profesionales de la ML.
- **Microscopic.**Documentación detallada a nivel de características para los auditores.

Enmarcado de límites: diferentes lectores extraen información diferente del mismo documento.

### Carnetas de sistema

Ámbito de aplicación: sistema de IA de extremo a extremo que incluye modelo + pila de seguridad + contexto de implementación.
- Capacidades de seguridad.
- Protección por inyección rápida.
- Detección de exfiltración de datos.
- Alineación con los valores humanos declarados.
- Respuesta al incidente.

Sidhpurwala 2024 y Meta trabajan en el nivel de transparencia del sistema. "Bluprints of Trust" (arXiv:2509.20394) formaliza la tarjeta del sistema como el complemento de la capa de implementación de las tarjetas modelo.

### Desarrollo de las actividades 2024-2025

- **CardGen (Liu et al. 2024).**Generación automática de tarjetas de modelo a través de LLM; informa de mayor objetividad que muchas tarjetas de autor humano en los campos estandarizados de Mitchell 2019.
- **Download correlation (Liang et al. 2024).**Las tarjetas de modelo detalladas se correlacionan con tasas de descarga hasta un 29% más altas en la presión de adopción de HF  ahora está impulsada por el mercado, no solo por el cumplimiento.
- **Laminator (Duddu et al. 2024).**Las certificaciones verificables a través de firmas TEE / criptográficas de hardware permiten que la tarjeta modelo lleve una prueba de reclamación, no solo una reclamación.
- **Sustainability (Jouneaux et al. July 2025).**Adiciones para la huella de carbono, agua y energía computacional; estándares ISO emergentes.
- **Regulatory cards.**La Ley de IA de la UE (lección 24) del capítulo de transparencia del Código de Prácticas de la GPAI requiere que las tarjetas modelo sean un artefacto de cumplimiento.

### Donde esto encaja en la Fase 18

Las lecciones 24-25 son las capas reguladoras y CVE. La lección 26 es la capa de documentación. La lección 27 es la gobernanza de datos de capacitación, que es la hoja de datos en aguas al margen. La lección 28 es el ecosistema de investigación que produce evaluaciones referenciadas en tarjetas.

```figure
an-card-scopes
```

## Usalo

`code/main.py`Generar una tarjeta de modelo mínima, una hoja de datos y una tarjeta de sistema para un despliegue de juguete. cada uno sigue la estructura de sección canónica.

## Envío

Esta lección produce`outputs/skill-card-audit.md`. Dado un modelo de tarjeta, hoja de datos o tarjeta de sistema, audita la cobertura de las secciones, la desagregación numérica y la presencia de certificados verificables.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`- Inspeccionar las tarjetas generadas. Identificar las secciones débiles (sólo para los titulares de lugar) y especificar qué pruebas las fortalecerían.

2. Extendiendo la tarjeta modelo con un análisis cuantitativo desagregado en dos grupos demográficos (lección 20).

3. Oreamuno et al. 2023 sobre la tasa de adopción del 0,3%. Proponer un cambio estructural en la especificación del modelo de tarjeta que aumentaría la adopción de consideraciones éticas.

4. Laminator (Duddu et al. 2024) utiliza TEEs para certificaciones verificables. Diseñar un campo de tarjeta modelo que lleve una certificación criptográfica de un resultado de evaluación y describa el papel del verificador.

5. Escriba una tarjeta de sistema (tarjeta de sistema, no tarjeta modelo) para uno de sus proyectos anteriores o una implementación hipotética.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Model Card | "the Mitchell card" | Mitchell et al. 2019 standard documentation for ML models |
| Datasheet | "the Gebru datasheet" | Gebru et al. 2018 standard documentation for datasets |
| Data Card | "the Pushkarna card" | Google 2022 modular layered data documentation |
| System Card | "the deployment card" | End-to-end AI system documentation including safety stack |
| Boundary object | "different readers, one doc" | Data Cards framing: same document serves diverse audiences |
| Verifiable attestation | "the Laminator attestation" | Cryptographic or TEE proof attached to a documentation claim |
| Sustainability field | "carbon / water footprint" | Emerging 2025 addition for environmental accounting |

## Leer más

- [Mitchell et al. — Model Cards for Model Reporting (arXiv:1810.03993, FAT* 2019)](https://arxiv.org/abs/1810.03993) la tarjeta modelo canónica
- [Gebru et al. — Datasheets for Datasets (CACM 2021, arXiv:1803.09010)](https://arxiv.org/abs/1803.09010) papel de hoja de datos
- [Pushkarna et al. — Data Cards (Google 2022)](https://arxiv.org/abs/2204.01075) Documentación de datos en capas
- [Sidhpurwala et al. — Blueprints of Trust (arXiv:2509.20394)](https://arxiv.org/abs/2509.20394) Formalización de la tarjeta de sistema
