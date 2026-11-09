# Provenencia de datos y formación - Gobernanza de datos

> La Ley de IA de la UE requiere que las normas de exclusión de GPAI sean legibles por máquina para agosto de 2025 (a través de la excepción TDM de la Directiva de la UE sobre derechos de autor). California AB 2013 (firmada 2024)  Transparencia de datos de capacitación de IA generativa requiere que los desarrolladores publiquen un resumen de conjuntos de datos con 12 campos mandados. 2025 Alineación de la DPA sobre el interés legítimo: la DPC irlandesa (21 de mayo de 2025) acepta la formación de la MLC de Meta sobre contenido público para adultos de la UE/EEE de primera parte con garantías después de la opinión del EDPB; el Tribunal Regional Superior de Colonia (23 de mayo de 2025) rechaza la orden de injunción; la DPA de Hamburgo reduce la urgencia; la ICO del Reino Unido (23 de septiembre de 2025) emite una respuesta regulatoria positiva a las garantías de formación de la IA de LinkedIn (transparencia, exclusión simplificada, ventanas de objeción ampliadas) y continúa monitoreando  no una autorización formal. La ANPD brasileña (2 de julio de 2024) suspendió el procesamiento de Meta por falta de transparencia de la información; la medida preventiva fue levantada el 30 de agosto de 2024 después de que Meta presentó un plan de cumplimiento. El problema clave de irreversibilidad: los marcos de consentimiento de cookies están diseñados para el seguimiento reversible en tiempo real; una vez que los datos están en pesos de modelo, la eliminación quirúrgica es imposible  no hay derecho práctico de borrado del GDPR para redes neuronales entrenadas. La ventana de cumplimiento está en el momento de la recogida. Iniciativa de Provenanza de Datos (dataprovenance.org, Longpre, Mahari, Lee et al., "Consent in Crisis", julio 2024): la auditoría a gran escala muestra un rápido declive de los datos comunes de IA a medida que los editores añaden restricciones a robots.txt.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, 12-field California AB 2013 scaffolding generator)
**Prerequisites:** Phase 18 · 24 (regulatory), Phase 18 · 26 (cards)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Describa los 12 campos mandados de California AB 2013 para la transparencia de datos en capacitación de IA generativa.
- En el artículo 1, apartado 1, del Reglamento (UE) n.o 1095/2013 se establece que los Estados miembros deben adoptar medidas para garantizar que los programas de formación de los jóvenes en el ámbito de la formación profesional y de la formación profesional de los jóvenes en el ámbito de la formación profesional de los jóvenes en el ámbito de la formación profesional de los jóvenes en el ámbito de la formación profesional de los jóvenes en el ámbito de la formación profesional de los jóvenes en el ámbito de la formación profesional de los jóvenes en el ámbito de la formación profesional de los jóvenes en el sector de la formación profesional.
- Describa el problema de irreversibilidad: por qué el derecho a borrar del RGPD no tiene equivalente práctico para redes neuronales entrenadas.
- En el artículo 6 del Reglamento (UE) n.o 1095/2013 se establece que el Estado miembro debe adoptar medidas de protección de los datos y de protección de los datos.

## El problema

La gestión de datos de formación es la prioridad de cada tarjeta modelo (lección 26) y de la obligación regulatoria (lección 24). En 2024-2025, el panorama regulador se consolidó en tres principios: la infraestructura de exclusión, la divulgación de datos por conjunto y las adaptaciones de intereses legítimos para los datos disponibles públicamente.

## El concepto

### California AB 2013

Se firmó el 2024. La documentación debe ser publicada el 1 de enero de 2026 o antes para los sistemas lanzados el 1 de enero de 2022. La sección 3111 (a) requiere que los desarrolladores publiquen un resumen de alto nivel de los conjuntos de datos utilizados en la capacitación con 12 elementos legales:
1. Fuentes o propietarios de los conjuntos de datos.
2. Descripción de cómo los conjuntos de datos promueven el propósito previsto del sistema de IA.
3. Número de puntos de datos en los conjuntos de datos (intervalos generales aceptables; estimaciones para conjuntos de datos dinámicos).
4. Descripción de los tipos de puntos de datos (tipos de etiquetas para conjuntos de datos etiquetados; características generales para los sin etiquetar).
5. Si los conjuntos de datos incluyen cualquier dato protegido por derechos de autor, marca registrada o patente, o si están enteramente en dominio público.
6. Si los conjuntos de datos fueron comprados o autorizados.
7. Si los conjuntos de datos incluyen información personal (según el código civil de Cal. §1798.140 ((v)).
8. Si los conjuntos de datos incluyen información agregada del consumidor (según el código civil de Cal. §1798.140 ((b)).
9. Limpiamiento, procesamiento u otra modificación por parte del desarrollador, con el propósito previsto.
10. Periodo de tiempo durante el cual se recopilaron los datos, con aviso si la recopilación está en curso.
11. Datas en que los conjuntos de datos se utilizaron por primera vez durante el desarrollo.
12. Si el sistema utiliza o utiliza continuamente la generación de datos sintéticos.

El punto 12 (datos sintéticos) es nuevo en relación con las hojas de datos de Gebru et al. 2018. El punto 7 (información personal) desencadena las obligaciones de la Ley de Derechos de Privacidad (CPRA).

### La ley de IA de la UE (lección 24) y la exclusión de la TDM

La excepción de la Directiva de la UE sobre derechos de autor para la extracción de textos y datos permite la formación sobre contenido disponible al público a menos que el titular de derechos decida no a través de ella.

### Conversión del DPA 2025 en base a intereses legítimos

El Comité de la Comisión de la Unión Europea (CDI) ha aprobado el proyecto de ley de la Comisión de la Unión Europea (CE) de 20 de diciembre de 2015 (Carta de Acción de la Unión Europea) y de la Comisión de la Unión Europea (Carta de Acción de la Unión Europea) de 20 de diciembre de 2015. El Tribunal Regional Superior de Colonia (23 de mayo de 2025) rechaza la orden judicial contra Meta: la exclusión es suficiente. El DPA de Hamburgo elimina el procedimiento de urgencia para la coherencia a escala de la UE. ICO del Reino Unido (23 de septiembre de 2025) emitió una respuesta regulatoria positiva  no una autorización formal  a la reanudación de LinkedIn de la capacitación en IA con garantías similares y monitoreo continuo.

Principio convergente: el interés legítimo puede justificar la formación sobre el contenido de primera parte disponible al público con exclusión.

### ANPD brasileño (julio 2024)

Suspendió el procesamiento de datos de usuarios brasileños por parte de Meta para la capacitación en IA por falta de transparencia de la información.

### El problema de la irreversibilidad

El consentimiento de cookies fue diseñado para el seguimiento reversible en tiempo real. Los datos de entrenamiento son diferentes: una vez que los datos entran en los pesos del modelo, no es posible borrarlos quirúrgicamente.

Remedios parciales:
- **Unlearning.**El valor de la carga de la carga de carga de la carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de
- **Influence function-based localization.**Identificar los pesos más afectados por los datos; actualizar selectivamente.
- **Fine-tune-suppression.**Entrenar al modelo a rechazar las salidas derivadas de los datos.

Ninguno resuelve el problema por completo.

### Iniciativa de procedencia de datos

Dataprovenance.org. Longpre, Mahari, Lee y otros. "Consent in Crisis" (julio 2024): auditoría a gran escala de los datos comunes de capacitación de IA. Encontrar: los editores están añadiendo restricciones de robots.txt a un ritmo acelerado. Los bienes comunes abiertamente adicionales se están contrayendo rápidamente. 2023 -> 2024 vio alrededor del 25% de las principales fuentes de capacitación añadir cierta restricción. Implicación: la futura disponibilidad de datos de formación depende de nuevos paradigmas de adquisición (licencia, generación sintética, participación incentivada).

### Donde esto encaja en la Fase 18

La lección 26 es la documentación a nivel de modelo. La lección 27 es la gobernanza a nivel de conjunto de datos. Juntos definen la capa de transparencia. La lección 28 mapea el ecosistema de investigación que trabaja en estas preguntas.

```figure
an-provenance-oneway
```

## Usalo

`code/main.py`Generar un esqueleto de resumen de un conjunto de datos de 12 campos de California AB 2013 para un conjunto de datos de juguete. Puede llenar los campos y observar cuáles desencadenan obligaciones de seguimiento de privacidad o derechos de autor.

## Envío

Esta lección produce`outputs/skill-provenance-check.md`. Dado que el conjunto de datos utilizado en la formación, comprueba la cobertura de 12 campos de AB 2013, el cumplimiento de la infraestructura de exclusión, la alineación de los DPA y la evaluación del riesgo de irreversibilidad.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`. Producir un resumen de 12 campos para un conjunto de datos de juguetes e identificar qué campos están menos especificados.

2. La Directiva de la UE sobre derechos de autor TDM es legible por máquina. Propón un formato estándar para la señal de exclusión y compártala con robots.txt y C2PA "No hay capacitación en IA".

3. Lea el "Consentimiento en Crisis" de la Iniciativa de Provenanza de Datos (julio 2024). Describa las tres categorías de contenido que restringen más rápido y argumenta una consecuencia económica.

4. La alineación de DPA 2025 acepta un interés legítimo en la formación de contenidos públicos.

5. Esbozar un manifiesto de origen de datos de formación que se compone de los campos AB 2013 y una cadena de origen firmada por C2PA para cada conjunto de datos.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AB 2013 | "the California law" | Generative AI training-data transparency; 12 mandated fields |
| TDM exception | "text-and-data-mining" | EU Copyright Directive training-data exception with opt-out |
| Legitimate interest | "the EU basis" | GDPR Article 6 basis that may justify training on public content |
| Opt-out signal | "machine-readable no-train" | robots.txt, C2PA "No AI Training," TDM.Reservation |
| Irreversibility | "cannot un-train" | Data in model weights is not surgically removable |
| Unlearning | "approximate removal" | Post-training interventions to reduce model dependence on specific data |
| Consent in Crisis | "the DPI audit" | July 2024 finding of accelerating robots.txt restrictions |

## Leer más

- [California AB 2013](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2013) Ley de transparencia de datos sobre formación en IA generativa
- [EU AI Act + GPAI Code of Practice (Lesson 24)](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) Capítulo de derechos de autor
- [Longpre, Mahari, Lee et al. — Consent in Crisis (dataprovenance.org, July 2024)](https://www.dataprovenance.org/consent-in-crisis-paper) Auditoría del IPD
- [IAPP — EU Digital Omnibus GDPR amendments (2025)](https://iapp.org/news/a/eu-digital-omnibus-amendments-to-gdpr-to-facilitate-ai-training-miss-the-mark) contexto regulatorio
