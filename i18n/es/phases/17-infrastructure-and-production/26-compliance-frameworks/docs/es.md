# Conformidad  SOC 2, HIPAA, GDPR, PCI-DSS, Ley de IA de la UE, ISO 42001

> La cobertura multi-marco es la participación de las mesas para las operaciones empresariales de 2026. **EU AI Act**La mayoría de los requisitos de alto riesgo se aplican el 2 de agosto de 2026. Se aplican multas de hasta 15 millones de euros o un 3% del volumen de negocios global por obligaciones de sistemas de alto riesgo (art. 99(4); hasta 35 millones de euros o un 7% por prácticas prohibidas de IA (art. 99(3)).**Colorado AI Act**: con efecto el 30 de junio de 2026 (retrasado a partir de febrero de 2026 por SB25B-004)  evaluaciones de impacto para sistemas de alto riesgo, derecho a apelar decisiones de IA. Virginia similar para el crédito/empleo/vivivienda/educación. **SOC 2 Type II**: requisito de facto de IA B2B (tipo II, no tipo I, para la tecnología financiera). **GDPR**: la multa más grande documentada específica de IA es de 30,5 millones de euros contra Clearview AI (DPA holandés, septiembre 2024); Garante de Italia emitió 15 millones de euros contra OpenAI en diciembre de 2024 (más tarde revocada en apelación en marzo de 2026).**HIPAA**: la atención médica obligada  no puede enviar PHI a servicios externos de IA sin BAA. **PCI-DSS**: La cobertura de la capa de interacción de IA requiere configuración + acuerdos contractuales, no automática. **ISO 42001**El perfil de referencia: OpenAI mantiene SOC 2 Tipo 2, ISO/IEC 27001:2022, ISO/IEC 27701:2019, GDPR/CCPA/HIPAA (BAA) / FERPA, PCI-DSS para los componentes de pago de ChatGPT.

**Type:** Learn
**Languages:** (Python, TypeScript optional: compliance is policy + process, not code)
**Prerequisites:** Phase 17 · 25 (Security), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Enumerar los siete marcos de 2026 relevantes para los productos de LLM y combinar cada uno con un segmento de clientes.
- Citar el calendario de aplicación de la Ley de IA de la UE (en vigor agosto de 2024; aplicación de riesgos altos agosto de 2026) y el límite máximo de multas de dos niveles (€15M / 3% para obligaciones de alto riesgo, €35M / 7% para prácticas prohibidas).
- Explica por qué la limpieza de PII posterior al procesamiento no es suficiente para el RGPD y nombra la redacción en tiempo real de la capa de inferencia como el estándar defendible.
- Describa el mapeo de control transversal (por ejemplo, mapas de control de acceso a ISO 27001 A.5.15-5.18 + RGPD Art. 32 + HIPAA §164.312(a)).

## El problema

La adquisición de un cliente empresarial pide SOC 2 Tipo II, GDPR, HIPAA BAA, ISO 27001, y "Declaración de cumplimiento de la Ley de IA de la UE". Su equipo tiene SOC 2 Tipo I. Usted tiene seis meses de Tipo II y no ha comenzado los registros del Artículo 30 del GDPR.

La cobertura multi-marco no es un problema de LLM  es un problema de empresa-SaaS, con superposiciones específicas de LLM. Los equipos de adquisiciones en 2026 quieren una matriz con una fila por marco y una columna por control, no un PDF.

## El concepto

### Los siete marcos

| Framework | Scope | LLM-specific requirement |
|-----------|-------|--------------------------|
| SOC 2 Type II | B2B SaaS baseline | Process controls audited over 6-12 months |
| HIPAA | US healthcare | BAA required; PHI cannot leave infrastructure without signed agreement |
| GDPR | EU users | Real-time PII redaction; data subject rights; Article 30 records |
| PCI-DSS | Payment data | Configuration + contracts for AI touching payment |
| EU AI Act | Serving EU users | Risk tier classification; high-risk systems: conformity assessment, documentation, logging |
| Colorado AI Act | Serving CO residents | Impact assessments; right to appeal |
| ISO 42001 | AI governance | Emerging; pairs with ISO 27001 |

### Línea de tiempo de la Ley de IA de la UE

- 1 de agosto de 2024: en vigor.
- 2 de febrero de 2025: se aplican las prácticas prohibidas de IA.
- El 2 de agosto de 2026: aplicación de sistemas de alto riesgo (evaluación de la conformidad, documentación, registro).
- Agosto 2027: sistemas de alto riesgo en productos en virtud de una legislación armonizada.

Los niveles de riesgo: Inaceptables (prohibidos), de alto riesgo (conformidad + registro), de riesgo limitado (transparencia), de riesgo mínimo (sin restricción). La mayoría de los servicios de gestión de empresas B2B LLM SaaS tienen un riesgo limitado; los riesgos altos se aplican en el empleo, crédito, educación, aplicación de la ley, migración, servicios esenciales.

Las multas (artículo 99): hasta 15 millones de euros o un volumen de negocios global anual del 3% por incumplimiento de las obligaciones del sistema de alto riesgo (artículo 99(4); hasta 35 millones de euros o un 7% por prácticas prohibidas de IA (artículo 99(3)); según sea superior.

### GDPR  Reducción en tiempo real es el estándar

La limpieza posterior al procesamiento (reducir PII después de que el LLM lo vea) no es una postura defendible  el modelo ya vio los datos.

- Reconocimiento de la entidad antes de la convocatoria de LLM.
- La tokenización consistente (enfoque Mesh) conserva la semántica.
- Almacenar sólo las instrucciones editadas + consentido opt-in crudo.

Reciente ejecución: €30.5M contra Clearview AI (DPA holandés, septiembre 2024) es la multa GDPR más grande documentada específica de IA hasta la fecha; €15M contra OpenAI (Garante de Italia, diciembre 2024) es la multa más grande específica de LLM, aunque fue revocada en apelación en marzo de 2026 y la decisión sigue siendo objeto de revisión.

### HIPAA  BAA no es opcional

No se puede enviar PHI a servicios externos de IA sin un Acuerdo de Asociación de Negocios firmado. Las tres plataformas de LLM hiperescalada (Bedrock, Azure OpenAI, Vertex) ofrecen BAA. OpenAI direct API ofrece BAA. Antropic direct API ofrece BAA. Confirmar antes de enviar PHI.

### SOC 2 Tipo II

Tipo I: controles diseñados y documentados.
Tipo II: los controles funcionan efectivamente durante 6-12 meses.

Las compras B2B en 2026 son de tipo II. El tipo I es un arranque; el tipo II es la puerta.

Los factores de auditoría comunes: registros de acceso (quién vio qué), gestión de cambios (cómo se implementó), evaluaciones de riesgos (trimestral), respuesta a incidentes (probados)?

### Mapeo de los marcos cruzados

Una política de control de acceso satisface múltiples controles marco:

| Control | Frameworks |
|---------|-----------|
| Access logging | ISO 27001 A.5.15-5.18, GDPR Art. 32, HIPAA §164.312(a) |
| Change management | ISO 27001 A.8.32, PCI DSS Req. 6, HIPAA breach-notification scope |
| Encryption in transit | ISO 27001 A.8.24, GDPR Art. 32, HIPAA §164.312(e) |
| Secrets management | ISO 27001 A.8.19, PCI DSS Req. 8, SOC 2 CC6.1 |

Las herramientas de cumplimiento (Drata, Vanta, Secureframe) automatizan este mapeo.

### ISO 42001  emergente

Publicado a finales de 2023. Creciente requisito de contratación junto con la norma ISO 27001. Marco para la gobernanza de la IA, incluida la gestión de riesgos, la calidad de los datos, la transparencia, la supervisión humana.

### Profil de referencia de OpenAI

OpenAI mantiene SOC 2 Tipo 2, ISO/IEC 27001:2022, ISO/IEC 27701:2019, GDPR/CCPA/HIPAA (BAA) / FERPA, PCI-DSS para los componentes de pago ChatGPT. Eso es aproximadamente la mesa de la empresa apuesta en 2026.

### Números que debes recordar

- Las multas de la Ley de IA de la UE: hasta 15 millones de euros / 3% (obligaciones de alto riesgo, artículo 99(4)); hasta 35 millones de euros / 7% (prácticas prohibidas, artículo 99(3)).
- Aplicación de la Ley de IA de la UE sobre alto riesgo: 2 de agosto de 2026.
- La multa más grande documentada del RGPD específica de IA: € 30,5 millones, Clearview AI (DPA holandés, septiembre 2024).
- La mayor multa del RGPD específica de la LLM: 15 millones de euros, OpenAI (Garante de Italia, diciembre 2024; anulada en apelación en marzo 2026).
- Ventana SOC 2 Tipo II: 6-12 meses de controles operados.
- Fecha de entrada en vigor de la Ley de IA de Colorado: 30 de junio de 2026 (retrasado a partir de febrero de 2026 por SB25B-004).

```figure
i4-control-matrix
```

## Usalo

`code/main.py`es una hoja de cálculo de cartografía de cumplimiento en Python  dado un control, enumera los marcos que satisface.

## Envío

Esta lección produce`outputs/skill-compliance-matrix.md`. En función del segmento de clientes y de la geografía, especifica los marcos y controles requeridos.

## Los ejercicios

1. Su primer cliente empresarial requiere SOC 2 Tipo II, HIPAA BAA, declaración de la Ley de IA de la UE. ¿Cuál es la postura mínima de cumplimiento viable para ganar el acuerdo?
2. Clasificar tres productos hipotéticos de LLM bajo los niveles de riesgo de la Ley de IA de la UE. ¿Qué cambios ocurren en caso de alto riesgo?
3. Enviaste accidentalmente PHI a un proveedor sin BAA.
4. Argumentar si ISO 42001 es "necesario en 2026" para un proveedor de IA de mercado medio.
5. Mapear los campos de registro de auditoría de su LLM (fase 17 · 25) a al menos tres controles marco.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SOC 2 Type II | "audited controls" | Controls operating over 6-12 months, independently attested |
| HIPAA BAA | "healthcare contract" | Business Associate Agreement; required for PHI |
| GDPR | "EU privacy" | Real-time PII redaction is the defensible 2026 standard |
| EU AI Act | "EU AI rules" | High-risk enforcement August 2026; €15M / 3% (high-risk obligations) — €35M / 7% (prohibited practices) |
| Colorado AI Act | "US AI state law" | June 30, 2026 effective (delayed by SB25B-004); impact assessments |
| ISO 42001 | "AI governance" | Emerging framework for AI risk + transparency |
| ISO 27001 | "security ISMS" | Information Security Management System baseline |
| Conformity assessment | "EU AI doc package" | High-risk requirement: docs, testing, logging |
| Cross-framework mapping | "one control, many frames" | Single policy satisfies multiple framework controls |

## Leer más

- [OpenAI Security and Privacy](https://openai.com/security-and-privacy/) perfil de referencia de cumplimiento.
- [GuardionAI — LLM Compliance 2026: ISO 42001, EU AI Act, SOC 2, GDPR](https://guardion.ai/blog/llm-compliance-guide-iso-42001-eu-ai-act-soc2-gdpr-2026)
- [Dsalta — SOC 2 Type 2 Audit Guide 2026: 10 AI Controls](https://www.dsalta.com/resources/ai-compliance/soc-2-type-2-audit-guide-2026-10-ai-powered-controls-every-saas-team-needs)
- [EU AI Act official text](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) fuente primaria.
- [Colorado AI Act](https://leg.colorado.gov/bills/sb24-205) fuente primaria.
- [ISO/IEC 42001:2023](https://www.iso.org/standard/81230.html) Estándar de sistemas de gestión de IA.
