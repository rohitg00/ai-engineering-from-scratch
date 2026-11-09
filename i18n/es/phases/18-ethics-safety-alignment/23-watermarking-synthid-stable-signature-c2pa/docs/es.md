# Marca de agua  SynthID, firma estable, C2PA

> Tres tecnologías estructuran 2026 procedencia de contenido generado por IA. SynthID (Google DeepMind)  marcado de agua de imágenes lanzado en agosto de 2023, texto + video mayo de 2024 (Gemini + Veo), texto de código abierto octubre de 2024 a través de Responsible GenAI Toolkit, detector multimedia unificado noviembre de 2025 junto con Gemini 3 Pro. El marcado de agua de texto ajusta las probabilidades de muestreo de los tokens siguientes de manera imperceptible; las marcas de agua de imagen / video sobreviven a la compresión, recorte, filtros, cambios en la velocidad de fotogramas. Firma estable (Fernandez et al., ICCV 2023, arXiv:2303.15435)  sintoniza el decodificador de difusión latente para que cada salida contenga un mensaje fijo; las imágenes recortadas (10% del contenido) generadas detectadas >90% en FPR<1e-6. Seguimiento "La firma estable es inestable" (arXiv:2405.07145, mayo 2024)  ajuste fino elimina la marca de agua mientras se conserva la calidad. C2PA  estándar de metadatos firmado criptográficamente, que es evidente que se han manipulado (C2PA 2.2 Explicador 2025). El marcado de agua y el C2PA son complementarios: los metadatos pueden ser eliminados pero tienen una procedencia más rica; las marcas de agua persisten a través del transcodificación pero llevan menos información.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, token-watermark embed + detect)
**Prerequisites:** Phase 10 · 04 (sampling), Phase 01 · 09 (information theory)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Describa el marcado de agua a nivel de token (estilo de texto SynthID) y el mecanismo por el cual se puede detectar.
- Describa la firma estable y el ataque de eliminación de 2024 que la rompió.
- El papel del C2PA estatal y por qué es complementario al marcado acuático.
- Describa las limitaciones clave: señal específica del modelo, robustez bajo parafraza y ataques que preservan el significado (arXiv:2508.20228).

## El problema

2023-2024 vio que las falsificaciones profundas y el contenido generado por IA entraron en contextos políticos y de consumo a escala. El Watermarking es la señal de procedencia técnica propuesta: marcar generaciones en el momento de la creación, detectarlas más tarde. Prueba de 2025: ninguna marca de agua es incondicionalmente robusta, pero en capas con metadatos C2PA la combinación proporciona una historia de procedencia utilizable.

## El concepto

### Marcación de agua de texto (estilo de texto SynthID)

El mecanismo de Kirchenbauer et al. 2023, producido por Google:

1. En cada paso de decodificación, hash los tokens K anteriores para producir una partición pseudorandomaria del vocabulario en conjuntos "verde" y "rojo".
2. Muestreo de sesgos hacia el conjunto verde añadiendo δ a los logitos verdes.
3. La generación contiene más tokens verdes de lo que producirían los hechos.

Detección: replantear cada prefijo, contar los tokens verdes en la generación, calcular un z-score. El z-score es >0 para texto marcado por agua, ~0 para texto humano.

Propiedades:
- Inperceptible para los lectores (δ es lo suficientemente pequeño como para que la pérdida de calidad sea menor).
- Detectable con acceso a la función de partición de vocabulario.
- No es robusto para parafrasear. Reescribir el texto destruye la señal.

SynthID-text es de código abierto en octubre de 2024 a través del Toolkit GenAI Responsable de Google.

### Firma estable (imagen)

Fernandez et al. ICCV 2023. Fine-tune el decodificador de difusión latente para que cada imagen generada contenga un mensaje binario fijo incrustado en la representación latente. La detección se decodifica desde el latente con un decodificador neuronal.

mayo 2024 "La firma estable es inestable" (arXiv:2405.07145): ajuste fino del decodificador elimina la marca de agua mientras se conserva la calidad de la imagen.

### Detector unificado SynthID (novembre 2025)

Junto con Gemini 3 Pro: un detector multimedia que lee señales SynthID de texto, imagen, audio y video en una API. Unifica la pila de procedencia de Google.

### C2PA

Coalición para la procedencia y autenticidad del contenido. estándar de metadatos de prueba de manipulación firmado criptográficamente. C2PA 2.2 Explicador (2025).

Complementario de la marca de agua:
- Los metadatos pueden ser despojados; las marcas de agua no pueden ser (fácilmente).
- Los metadatos son ricos (cadena de procedencia completa); las marcas de agua llevan bits.
- C2PA depende de la adopción de la plataforma; las marcas de agua se incorporan automáticamente.

Google integra tanto en la búsqueda, anuncios, y "Acerca de esta imagen".

### Las limitaciones

- **Model-specific.**Una generación de un modelo sin SynthID no está marcada por agua, por lo que "ningún señal SynthID" no es prueba de autenticidad.
- **Paraphrase.**Las marcas de agua del texto no sobreviven a la paráfrase que preserva el significado.
- **Transformation attacks.**arXiv:2508.20228 (2025) muestra ataques de preservación del significado que destruyen tanto las marcas de agua de texto como muchas marcas de agua de imagen.
- **Fine-tune removal.**Por "Signature stable is unstable", el ajuste fino de post-generación elimina las marcas de agua incrustadas.

### Artículo 50 de la Ley de IA de la UE

Código de transparencia para el etiquetado de contenidos generados por IA (primer proyecto de diciembre de 2025, segundo proyecto de marzo de 2026, previsto final de junio de 2026 por el año)[European Commission status page](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)El código permanece en redacción a partir de abril de 2026 y el calendario está sujeto a cambios. La capa regulatoria que requiere la capa técnica.

### Donde esto encaja en la Fase 18

Las lecciones 22-23 se refieren a lo que emite el modelo (datos privados, señal de procedencia). La lección 27 abarca la gobernanza de los datos de formación. La lección 24 es el marco regulatorio que requiere estas medidas técnicas.

```figure
an-watermark-greenlist
```

## Usalo

`code/main.py`construye una marca de agua de texto de juguete. Las fichas son números enteros 0..N-1; los parámetros de muestreo marcados con agua hacia el conjunto verde definido por hash. Un detector calcula el puntaje z del token verde. Puedes observar la detección en generaciones de 1000 fichas, ver la paráfrase destruir la señal y medir la tasa de falsos positivos en el texto humano.

## Envío

Esta lección produce`outputs/skill-provenance-audit.md`. Dado que se ha implementado un contenido con una declaración de procedencia, se realiza una auditoría: el mecanismo de marca de agua (si lo hay), la cadena de firma de la C2PA (si lo hay), la robustez adversaria de cada uno y la cobertura por modalidad.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`.Informe los resultados z para la generación de 1000 tokens con marca de agua frente al texto escrito por el hombre.Identifique la tasa de falsos positivos en el umbral de confianza del 95%.

2. Implemente un ataque parafrase que reemplace el 30% de los tokens con sinónimos.

3. Leer Kirchenbauer et al. 2023 Sección 6 sobre robustez. ¿Por qué las marcas de agua de texto fallan bajo la paráfrasis pero las marcas de agua de imagen sobreviven al recortar?

4. Diseñar una implementación que utilice SynthID-text + C2PA metadatos. Describir la cadena de procedencia que un consumidor ve. Identificar un modo de falla de cada componente.

5. El resultado de 2024 "Signature stable is unstable" muestra que el ajuste fino elimina la marca de agua de la imagen. Diseñar un control de despliegue que limite este ataque  por ejemplo, requiere liberaciones firmadas de puntos de control ajustados.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| SynthID | "Google's watermark" | Cross-modal provenance signal; text, image, audio, video |
| Token watermark | "Kirchenbauer-style" | Biased-sampling text watermark detectable via green-token z-score |
| Stable Signature | "image watermark" | Fine-tuned-decoder watermark; ICCV 2023 |
| C2PA | "the metadata standard" | Cryptographically signed tamper-evident provenance metadata |
| Paraphrase robustness | "does rewording break it" | Text watermark property; currently limited |
| Fine-tune removal | "adversarial unwatermark" | Attack that removes image watermark via decoder fine-tuning |
| Cross-modal detector | "unified SynthID" | November 2025 unified API across modalities |

## Leer más

- [Kirchenbauer et al. — A Watermark for Large Language Models (ICML 2023, arXiv:2301.10226)](https://arxiv.org/abs/2301.10226) el mecanismo de marcas de agua de los tokens
- [Fernandez et al. — Stable Signature (ICCV 2023, arXiv:2303.15435)](https://arxiv.org/abs/2303.15435) papel de marcas de agua de imagen
- ["Stable Signature is Unstable" (arXiv:2405.07145)](https://arxiv.org/abs/2405.07145) el ataque de eliminación
- [Google DeepMind — SynthID](https://deepmind.google/models/synthid/) la marca de agua transmódica
- [C2PA 2.2 Explainer (2025)](https://c2pa.org/specifications/specifications/2.2/explainer/Explainer.html) Norma de metadatos
