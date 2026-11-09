# Sistemas de moderación  OpenAI, Perspectiva, Guardia de Llama

> Los sistemas de moderación de producción operationalizan las políticas de seguridad definidas en las lecciones 12-16.`omni-moderation-latest`(2024) basado en GPT-4o clasifica texto + imágenes en una llamada; 42% mejor en el conjunto de pruebas multilingües que la versión anterior; el esquema de respuesta devuelve 13 categorías booleanas  acoso, acoso/amenaza, odio, odio/amenaza, ilícito, ilícito/violento, autolesiones, autolesiones/intención, autolesiones/instrucciones, sexuales, sexuales/minores, violencia, violencia/grafica; gratuito para la mayoría de los desarrolladores. Modelos en capas: moderación de entrada (pre-generación), moderación de salida (post-generación), moderación personalizada (reglas de dominio). Las llamadas paralelas sincronizadas ocultan la latencia; una respuesta de lugar puede cubrir la espera mientras se completa la moderación de entrada. Llama Guard 3/4 (lección 16): 14 peligros de MLCommons, Abuso de intérpretes de código, 8 idiomas (v3), múltiples imágenes (v4). API de perspectiva (Google Jigsaw): puntuación de toxicidad anterior a la onda de LLM como moderador; toxicidad principalmente de una sola dimensión con variantes de toxicidad grave/insulto/profanidad; línea de base para la investigación de moderación de contenido. Deprecaciones: Moderador de contenido de Azure se desactualizó en febrero de 2024, retirado en febrero de 2027, reemplazado por Azure AI Content Safety.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, three-layer moderation harness)
**Prerequisites:** Phase 18 · 16 (Llama Guard / Garak / PyRIT)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Describa la taxonomía de categorías de la API OpenAI Moderation y cómo difiere del conjunto de MLCommons de Llama Guard 3.
- Describa el patrón de las tres capas de moderación (entrada, salida y personalización) y nombre un modo de falla de cada una.
- Describa la posición de la API de Perspective como una línea de base pre-LLM y por qué sigue siendo utilizada en la investigación.
- Indique el calendario de depreciación de Azure.

## El problema

Las lecciones 12-16 describen los ataques y las herramientas de defensa. La lección 29 abarca los sistemas de moderación desplegados que operacionalizan las defensas en la superficie donde los usuarios tocan el producto.

## El concepto

### API de moderación de OpenAI

`omni-moderation-latest`(2024). Construido en GPT-4o. Clasifica texto + imágenes en una sola llamada. Gratis para la mayoría de los desarrolladores.

Categorías (13 booleanos en el esquema de respuesta):
- acoso, acoso/amenaza
- odio, odio/amenaza
- autolesiones, autolesiones/intenciones, autolesiones/instrucciones
- Sexual, sexual/minores
- violencia, violencia/grafía
- Ilícito, ilícito/violento

Se aplica el apoyo multimodal a `violence`¿ Qué ?`self-harm`, y `sexual`Pero no lo es .`sexual/minors`El resto es sólo de texto.

Para el código de uso en `code/main.py`- ¿Qué ? - ¿ Qué ?`/threatening`¿ Qué ?`/intent`¿ Qué ?`/instructions`, y `/graphic`El código de producción debe utilizar el esquema completo de 13 categorías.

El resultado de las pruebas de la categoría de evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la

### Guardia de los llama 3/4

Se cubre en la Lección 16. 14 categorías de peligro de MLCommons (organizada de manera diferente a los 13 booleanos de esquema de respuesta de OpenAI).

Las taxonomías de OpenAI y Llama Guard se superponen pero difieren. OpenAI tiene "ilícito" como una categoría amplia; Llama Guard tiene "delitos violentos" y "delitos no violentos" por separado.

### API de perspectiva (Google Jigsaw)

Sistema de puntuación de toxicidad anterior a la ola de LLM como moderador (antes de 2020). Categorías: TOXICIDAD, SEVERE_TOXICIDAD, INSULT, PROFANITY, THREAT, IDENTITY_ATTACK. Punto primario de una sola dimensión (TOXICIDAD) con variantes sub-dimensionales.

Ampliamente utilizado como una línea de base de investigación de moderación de contenido porque la API es estable, documentada y tiene años de datos de calibración. Para los casos de uso modernos de LLM adyacentes, Llama Guard o OpenAI Moderation suele ser mejor adaptado.

### El patrón de tres capas

1. **Input moderation.**Clasifica el mensaje del usuario antes de la generación. Rechazar si está marcado.
2. **Output moderation.**Clasificar la salida del modelo antes de la entrega. reemplazar con una negativa si se marca. Latencia: una llamada de clasificador tras generación.
3. **Custom moderation.**Reglas específicas de dominio (regex, permisos, política de negocio).

Las tres capas son secuenciales por diseño: la moderación de entrada debe completarse antes de la generación, y la moderación de salida se ejecuta después de la generación. El paralelismo se aplica dentro de una capa  que ejecuta múltiples clasificadores (por ejemplo, OpenAI Moderation + Llama Guard + Perspective) simultáneamente en el mismo texto oculta la latencia por clasificador. Como optimización opcional, se puede mostrar una respuesta de retención de lugar ("un momento, comprobar...") mientras se completa la moderación de entrada y se aplaza la transmisión de token-1. El comportamiento de la bandera es configurable: rechazar, desinfectar, escalar a la revisión humana.

### Modo de falla

- **Input only.**No capta alucinaciones de salida (lesón 12-14 de codificación de ataques eludir los clasificadores de entrada).
- **Output only.**Permite que cualquier entrada llegue al modelo; aumenta el costo; supervive el razonamiento interno al atacante.
- **Custom only.**No es robusto entre categorías; los regexes son frágiles.

La capa es el estándar.

### Descripción de Azure

Moderador de contenido de Azure: se desactualizó en febrero de 2024, se retiró en febrero de 2027. Fue reemplazado por Azure AI Content Safety, que está basado en LLM e integra con Azure OpenAI. La migración es un proyecto de nivel de campo de 2024-2027 para implementaciones de Azure.

### Donde esto encaja en la Fase 18

La lección 16 abarca las herramientas de moderación en el contexto del equipo rojo. La lección 29 abarca la moderación desplegada. La lección 30 se cierra con la evidencia actual de capacidad de doble uso.

```figure
an-moderation-layers
```

## Usalo

`code/main.py`construye un arnés de moderación de tres capas: moderador de entrada (palabra clave + puntaje de categoría), moderador de salida (el mismo clasificador en la salida), moderador personalizado (reglas de dominio).

## Envío

Esta lección produce`outputs/skill-moderation-stack.md`. En vista de una implementación, se recomienda una configuración de la pila de moderación: qué clasificador en entrada, qué en salida, qué reglas personalizadas y qué juez para los casos de borde.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`- Ejecutar una entrada benigna, de límite y perjudicial a través de las tres capas.

2. Extenda el arnés con una puntuación de toxicidad al estilo Perspective-API en una categoría específica.

3. Lea los documentos de la API de Moderación de OpenAI y la lista de categorías de Llama Guard 3. Mapear cada categoría de OpenAI a las categorías de Llama Guard más cercanas. Identifique tres categorías que no se mapean limpiamente.

4. Diseñar una pila de moderación para una implementación de asistentes de código (por ejemplo, Copilot de GitHub). Identificar las categorías más y menos relevantes y proponer reglas personalizadas.

5. Azure Content Moderator se retira en febrero de 2027. Planifique una migración a Azure AI Content Safety. Identifique el elemento de mayor riesgo de la migración.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| OpenAI Moderation | "omni-moderation-latest" | GPT-4o-based 13-category (text) classifier with partial multimodal support |
| Perspective API | "Google Jigsaw toxicity" | Pre-LLM-era toxicity scoring baseline |
| Llama Guard | "MLCommons 14-category" | Meta's hazard classifier (v3: 8B text, 8 langs; v4: 12B multimodal) |
| Input moderation | "pre-generation filter" | Classifier on user prompt before model call |
| Output moderation | "post-generation filter" | Classifier on model output before delivery |
| Custom moderation | "domain rules" | Deployment-specific rules (regex, allowlist, policy) |
| Layered moderation | "all three layers" | Standard production deployment pattern |

## Leer más

- [OpenAI Moderation API docs](https://platform.openai.com/docs/api-reference/moderations) punto final de omni-moderación
- [Meta PurpleLlama + Llama Guard](https://github.com/meta-llama/PurpleLlama) Llama Guard repo
- [Google Jigsaw Perspective API](https://perspectiveapi.com/) Posibilidad de la toxicidad
- [Azure AI Content Safety](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/) reemplazo de Azure
