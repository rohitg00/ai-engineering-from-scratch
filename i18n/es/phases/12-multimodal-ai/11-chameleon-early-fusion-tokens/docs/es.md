# Modelos multimodal de camaleón y tokens de fusión temprana

> Cada VLM que hemos visto hasta ahora mantiene imágenes y texto separados. Los tokens visuales vienen de un codificador de visión, fluyen a un proyector, luego se encuentran con texto dentro del LLM. La visión y el vocabulario del texto nunca se superponen. El camaleón (Meta, mayo 2024) preguntó: ¿y si lo hicieran? Entrenar un VQ-VAE que convierte una imagen en una secuencia de tokens discretos de un vocabulario compartido. Cada documento multimodal es ahora una secuencia de tokens de texto y tokens de imagen entrelazados, una sola pérdida autoregressiva. Efecto secundario: el modelo puede generar salidas de modalidad mixta  tokens de texto e imagen alternados en una sola llamada de inferencia. Esta lección lee la tesis de la fusión temprana y construye una versión de juguete de extremo a extremo.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, VQ-VAE tokenizer + interleaved decoder)
**Prerequisites:** Phase 12 · 05, Phase 8 (Generative AI)
**Time:** ~180 minutes

## Objetivos de aprendizaje

- Explica por qué un vocabulario compartido + pérdida única cambia lo que el modelo puede hacer.
- Describa cómo un VQ-VAE tokeniza una imagen en una secuencia discreta compatible con el objetivo de token siguiente de un transformador.
- Nombre de los trucos de entrenamiento-estabilidad de Chameleon: QK-Norm, colocación de abandono, LayerNorm ordenando.
- Compara el enfoque de Q-Former de Chameleon vs BLIP-2 y describa cuándo cada uno es la opción correcta.

## El problema

Los VLM basados en adaptadores (LLaVA, BLIP-2, Qwen-VL) tratan el texto e imagen como dos cosas diferentes.`embed(text_token)`Una imagen pasa por`visual_encoder(image) → projector → ... pseudo_tokens`El modelo tiene dos vías de entrada que se funden en parte.

Tres consecuencias:

1. El LLM sólo puede consumir imágenes, no emitirlas.
2. Los documentos de modalidad mixta (apartados y imágenes alternativas, como en un artículo) son incómodos  o analizar la entrada multimodal fuera del modelo o generaciones de cadena.
3. Desajuste distribucional. Tokens visuales y tokens de texto viven en diferentes regiones del espacio oculto, creando problemas sutiles de alineación.

Cameleon rechaza la premisa: las imágenes son solo secuencias de tokens discretos de un vocabulario compartido. Entrenar el modelo en documentos entrelazados, una pérdida, un decodificador autoregresivista, y desbloquear la generación de modalidad mixta de forma gratuita.

## El concepto

### VQ-VAE como tokenizador de imágenes

El tokenizer es un autoencoder de variación cuantizado por vectores.

- Encoder: CNN + ViT que mapea la imagen a un mapa de características espaciales, digamos 32x32 características de dim 256.
- Libro de códigos: un vocabulario aprendido de vectores K (Chameleon utiliza 8192), también dim 256.
- Cuantización: para cada característica espacial, busque la entrada de código más cercana por distancia L2.
- Decodificador: CNN que lleva las características cuantizadas de vuelta a píxeles.

Formación: pérdida de reconstrucción de la AEV + pérdida de compromiso + pérdida de código de código.

Para Chameleon: una imagen se convierte en 32*32 = 1024 tokens extraídos de un vocabulario de 8192. Coloca esos ID de imagen en el mismo espacio de ID que los tokens BPE de texto. El tokenizer único de Chameleon tiene 65,536 entradas, y ese recuento ya incluye los códigos de imagen 8192 y los tokens especiales como los separadores de imagen. El transformador ve una secuencia, una pérdida.

### El vocabulario compartido

El vocabulario de Chameleon combina tokens de texto, tokens de imagen y separadores de modalidad. Cada token tiene un solo ID. La capa de incorporación de entrada mapea cada ID a un vector oculto D-dim.

Los separadores son importantes: `<image>`y `</image>`las etiquetas se encuentran en el bracket de la secuencia de la imagen-token. en el momento de generación, si el modelo emite `<image>`, el software de aguas abajo sabe que los próximos 1024 tokens son índices VQ para enviar al decodificador para la representación de píxeles.

### Generación de modalidad mixta

La inferencia es la predicción de la próxima señal en el vocabulario compartido. Ejemplo de solicitud: "Diseña un gato y describa".

```
<image> 4821 1029 2891 ... (1024 image tokens) </image>
The cat is orange, sitting on a windowsill...
```

El modelo selecciona el orden de forma autónoma. Puede producir imagen luego texto, texto luego imagen o interlea.

Comparar con los VLM adaptadores donde la generación es sólo de texto.

### Estabilidad de entrenamiento  QK-Norm, abandono, orden de LayerNorm

El entrenamiento de fusión temprana es inestable en escala.

- QK-Norm. Aplicar LayerNorm a la consulta y proyecciones clave dentro de la atención, antes del producto punto. Previene la explosión de magnitud logit en la profundidad.
- La colocación de abandono. abandono después de cada adición residual, no sólo después de la atención y MLP. Se requiere más regularización cuando los gradientes de los tokens de imagen pueden dominar.
- LayerNorm ordenando. Pre-LN en la rama residual (estándar), más un LN adicional en la conexión de salto del último bloque. Estabiliza el flujo de gradiente de la capa final.

Sin estos trucos, el entrenamiento del 34B-param Camelón divergió en múltiples puestos de control. Con ellos, converge.

### El techo de reconstrucción del tokenizer

VQ-VAE es pérdida. En 8192 entradas de código y 1024 tokens por 512x512 imagen, la reconstrucción PSNR limita alrededor de 26-28 dB. Esto es suficiente para la gen de imagen reconocible, pero visiblemente peor que la difusión en el espacio continuo (Stable Diffusion 3 alcanza 32+ dB).

El tokenizer es el cuello de botella. Los mejores tokenizadores (MAGVIT-v2, IBQ, SBER-MoVQGAN) elevan el techo. Emu3 (Lección 12.12) logra la generación de calidad SDXL solo a través de un mejor tokenizer.

### Cameleón vs BLIP-2 / LLaVA

Camelion (fusión temprana, vocabulario compartido):
- Una pérdida, un decodificador.
- Generar una salida de modalidad mixta.
- El tokenizer es el techo de calidad.
- Costo: Decodificador VQ-VAE por imagen generada en el camino de inferencia.

BLIP-2 / LLaVA (fusión tardía, torres separadas):
- La visión en, sólo mensajes de texto.
- Reutiliza el LLM pre-entrenado.
- No hay cuello de botella para el entendimiento.
- Barata: pase único hacia adelante.

Si necesitas generación de imágenes, familia Chameleon, si sólo necesitas comprensión, el adaptador VLM es más simple y reutiliza más computación pre-entrenada.

### Fuyu y AnyGPT

Fuyu (Adept, 2023) es un enfoque relacionado: omite el codificador de visión separado por completo, alimenta los parches de imagen crudas a través de la proyección de entrada de la LLM como si fueran tokens, sin tokenizer.

AnyGPT (Zhan et al., 2024) extiende Chameleon a cuatro modalidades: texto, imagen, habla, música. El mismo truco VQ-VAE para cada uno, transformador compartido. Cualquier generación.

```figure
vq-codebook
```

## Usalo

`code/main.py`construye un modelo de fusión temprana de juguete de extremo a extremo:

- Un pequeño cuantificador de estilo VQ-VAE que mapea parches 8x8 a índices de código (K=16).
- Un vocabulario compartido de (id de texto 0..31) + (id de imagen 32..47) + (separadores 48, 49).
- Un decodificador autoregresor de juguete (tabla de bigramas) entrenado en subtítulos sintéticos + secuencias de tokens de imagen.
- Un bucle de muestreo que emite tokens de texto + imagen alternados dado un aviso.

El código mantiene intencionalmente el transformador pequeño (bigramas) para que pueda rastrear el flujo de señal de extremo a extremo.

## Envío

Esta lección produce`outputs/skill-tokenizer-vs-adapter-picker.md`. Dado un producto específico (entender sólo vs entender + generar, calidad de imagen requerida, presupuesto de costes), elige entre familia de camaleones (fusión temprana) y familia de LLaVA (fusión tardía) y se justifica con reglas cuantitativas.

## Los ejercicios

1. Chameleon utiliza K=8192 entradas de código y 1024 tokens por 512x512 imagen. Estima la relación de compresión frente a una imagen RGB de 24 bits. ¿Es pérdida? ¿Qué tan pérdida?

2. ¿Puede un modelo al estilo Chameleon generar una imagen 4K en una llamada de inferencia? ¿Qué rompe primero el contexto, la calidad del tokenizer o el caché KV?

3. Implemente QK-Norm en Python puro. Dado una consulta y clave de 64 dimensiones, muestre el producto de puntos antes y después de LayerNorm. ¿Por qué es importante el control de magnitud en profundidad?

4. Leer la sección 2.3 de Chameleon sobre estabilidad de entrenamiento. Describa el modo exacto de falla del papel observado en 34B sin QK-Norm. ¿Cuál fue la firma de "explosión normal"?

5. Extenda el decodificador de juguete para emitir una respuesta de modalidad mixta dada una solicitud de texto solo. Medir la frecuencia con la que el modelo elige la imagen primero vs texto primero dada la distribución de datos de entrenamiento 60% texto primero / 40% imagen primero.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Early fusion | "Unified tokens" | Images converted to discrete tokens sharing the transformer's vocabulary from step one |
| VQ-VAE | "Image tokenizer" | CNN + ViT + codebook that maps images to integer indices the transformer can predict |
| Shared vocabulary | "One dictionary" | A single token ID space covering text + image + modality separators |
| QK-Norm | "Attention stabilizer" | LayerNorm applied to query and key before their dot product, prevents norm blowup |
| Mixed-modality generation | "Text + image output" | Inference that autonomously produces interleaved text and image tokens in one pass |
| Codebook size | "K entries" | Number of discrete vectors the VQ-VAE can quantize to; trades compression for fidelity |
| Tokenizer ceiling | "Reconstruction limit" | Best PSNR achievable by decoding VQ tokens; bounds the model's image quality |

## Leer más

- [Chameleon Team — Chameleon: Mixed-Modal Early-Fusion Foundation Models (arXiv:2405.09818)](https://arxiv.org/abs/2405.09818)
- [Aghajanyan et al. — CM3 (arXiv:2201.07520)](https://arxiv.org/abs/2201.07520)
- [Yu et al. — CM3Leon (arXiv:2309.02591)](https://arxiv.org/abs/2309.02591)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Adept — Fuyu-8B blog (adept.ai)](https://www.adept.ai/blog/fuyu-8b)
