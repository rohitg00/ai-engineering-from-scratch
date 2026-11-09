# Generación 3D

> La modalidad 3D es la que tiene mayor apalancamiento de 2D a 3D. El avance de 2023 fue el 3D Gaussian Splating. La generación de 2024-2026 genera capa de empuje de difusión de múltiples vistas + reconstrucción 3D en la parte superior para producir objetos y escenas a partir de un solo prompt o foto.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 4 (Vision), Phase 8 · 07 (Latent Diffusion)
**Time:** ~45 minutes

## El problema

El contenido en 3D es doloroso:

- **Representation.**Las redes de puntos, nubes de puntos, redes de voxel, campos de distancia firmados (SDF), campos de radiación neuronal (NeRF), Gaussians 3D. Cada uno tiene compensaciones.
- **Data scarcity.**ImageNet tiene 14 millones de imágenes. El conjunto de datos 3D más grande y limpio (Objaverse-XL, 2023) tiene ~ 10 millones de objetos, de calidad más baja.
- **Memory.**Una cuadrícula de 5123 voxel es de 128M voxel; una escena útil NeRF necesita 1M muestras / ray.
- **Supervision.**Para una imagen 2D tienes los píxeles. Para 3D normalmente tienes un puñado de vistas 2D y tienes que elevar a 3D.

La pila 2026 separa los dos problemas. Primero, genera * imágenes de vista multi-2D* con un modelo de difusión. segundo, ajusta una representación 3D* (generalmente esparcimiento gaussiano) a esas imágenes.

## El concepto

![3D generation: multi-view diffusion + 3D reconstruction](../assets/3d-generation.svg)

### Representación: 3D Gaussian Splatting (Kerbl et al., 2023)

Representa una escena como una nube de Gaussianos 3D de ~ 1M. Cada uno tiene 59 parámetros: posición (3), covarianza (6, o cuaternion 4 + escala 3), opacidad (1), color de armonía esférica (48 en grado 3, 3 en grado 0).

Rendering = proyección + composición alfa. Rápido (~100 fps a 1080p en un 4090). Diferenciable. Adaptable por descenso de gradiente contra fotos de la verdad de la tierra. Una escena se adapta en 5-30 minutos en una GPU de consumo.

Dos innovaciones en el período 2023-2024:
- **Generative Gaussian splats.**Modelos como LGM, LRM, InstantMesh predicen una nube gaussiana directamente a partir de una o varias imágenes.
- **4D Gaussian Splatting.**Gaussians con compensaciones por marco para escenas dinámicas.

### Difusión de múltiples visualizaciones

Afinar un modelo de difusión de imagen preentrenado para generar múltiples vistas consistentes del mismo objeto a partir de un texto rápido o una sola imagen. Zero123 (Liu et al., 2023), MVDream (Shi et al., 2023), SV3D (Estabilidad, 2024), CAT3D (Google, 2024). Por lo general, emitir 4-16 vistas alrededor del objeto, elevados a 3D a través de la descarga Gaussian o NeRF.

### Línea de conducción de texto a 3D

| Model | Input | Output | Time |
|-------|-------|--------|------|
| DreamFusion (2022) | text | NeRF via SDS | ~1 hour per asset |
| Magic3D | text | mesh + texture | ~40 min |
| Shap-E (OpenAI, 2023) | text | implicit 3D | ~1 min |
| SJC / ProlificDreamer | text | NeRF / mesh | ~30 min |
| LRM (Meta, 2023) | image | triplane | ~5 s |
| InstantMesh (2024) | image | mesh | ~10 s |
| SV3D (Stability, 2024) | image | novel views | ~2 min |
| CAT3D (Google, 2024) | 1-64 images | 3D NeRF | ~1 min |
| TripoSR (2024) | image | mesh | ~1 s |
| Meshy 4 (2025) | text + image | PBR mesh | ~30 s |
| Rodin Gen-1.5 (2025) | text + image | PBR mesh | ~60 s |
| Tencent Hunyuan3D 2.0 (2025) | image | mesh | ~30 s |

2025-2026 dirección: modelos directos de texto a malla con materiales PBR adecuados para motores de juego.

### NeRF (para el contexto)

El campo de radiación neuronal (Mildenhall et al., 2020).`(x, y, z, view direction)`y las salidas `(color, density)`. Render mediante la integración a lo largo de los rayos. Superó la síntesis de visión de novedades basada en malla en calidad pero es 100-1000 veces más lenta en renderización.

```figure
v4-3d-multiview
```

## Construye el mismo

`code/main.py`Implementa un juego 2D "splating Gaussian" fit: representa una imagen sintética de objetivo (un gradiente liso) como una suma de espacios Gaussian 2D. Optimiza posiciones, colores y covariancias por descenso de gradiente para coincidir con el objetivo. Veas las dos operaciones principales: renderización hacia adelante (splat + alfa-compuesto) y fit por descenso de gradiente.

### Paso 1: 2D Gaussian splat

```python
def gaussian_at(x, y, gaussian):
    px, py = gaussian["pos"]
    sigma = gaussian["sigma"]
    d2 = (x - px) ** 2 + (y - py) ** 2
    return math.exp(-d2 / (2 * sigma * sigma))
```

### Paso 2: renderización mediante la suma de manchas

```python
def render(image_size, gaussians):
    img = [[0.0] * image_size for _ in range(image_size)]
    for g in gaussians:
        for y in range(image_size):
            for x in range(image_size):
                img[y][x] += g["color"] * gaussian_at(x, y, g)
    return img
```

La verdadera esplanada gaussiana en 3D clasifica a los gaussianos por profundidad y por orden de compósitos alfa.

### Paso 3: ajuste por descenso de gradiente

```python
for step in range(steps):
    pred = render(size, gaussians)
    loss = mse(pred, target)
    gradients = compute_grads(pred, target, gaussians)
    update(gaussians, gradients, lr)
```

## Las trampas

- **View inconsistency.**Si se generan 4 vistas de forma independiente y no están de acuerdo sobre la estructura del objeto, el ajuste 3D es borroso.
- **Back-side hallucination.**La imagen única → 3D tiene que inventar el lado invisible. La calidad varía enormemente.
- **Gaussian splat explosion.**La formación sin restricciones crece hasta alcanzar los 10 millones de puntos y superposición.
- **Topology issues.**Las redes de campos implícitos (SDF) a menudo tienen agujeros o intersecciones automáticas.
- **License of training data.**Objaverse tiene licencias mixtas; el uso comercial varía según el modelo.

## Usalo

| Task | 2026 pick |
|------|-----------|
| Scene reconstruction from photos | Gaussian splatting (3DGS, Gsplat, Scaniverse) |
| Text-to-3D object for games | Meshy 4 or Rodin Gen-1.5 (PBR output) |
| Image-to-3D | Hunyuan3D 2.0, TripoSR, InstantMesh |
| Novel-view synthesis from few images | CAT3D, SV3D |
| Dynamic scene reconstruction | 4D Gaussian Splatting |
| Avatar / clothed human | Gaussian Avatar, HUGS |
| Research / SOTA | Whatever dropped last week |

Para la producción de envío 3D en un juego o en una línea de comercio electrónico: Meshy 4 o Rodin Gen-1.5 de salida de redes PBR que van directamente a Unity / Unreal.

## Envío

Salva .`outputs/skill-3d-pipeline.md`. La habilidad toma un resumen 3D (entrada: texto / una imagen / pocas imágenes; salida: malla / esparcimiento / NeRF; uso: renderización / juego / RV) y salidas: tubería (difusión de múltiples visualizaciones + ajuste o modelo de malla directa), modelo base, presupuesto de iteración, postprocesamiento topológico, canales de material necesarios.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`Con 4, 16, 64 Gaussians, informe final MSE vs objetivo.
2. **Medium.**Extenda a los gaussianos de color (RGB).
3. **Hard.**Utilizando gsplat o Nerfstudio, reconstruye un objeto real a partir de una captura de 50 fotos.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| 3D Gaussian Splatting | "3DGS" | Scene as a cloud of 3D Gaussians; differentiable alpha-composite render. |
| NeRF | "Neural radiance field" | MLP that outputs color + density at a 3D point; render by ray integration. |
| Triplane | "Three 2-D planes" | Factor 3D into three 2-D axis-aligned feature grids; cheaper than volumetric. |
| SDS | "Score distillation sampling" | Train 3D model by using 2D-diffusion score as pseudo-gradient. |
| Multi-view diffusion | "Many views at once" | Diffusion model that outputs a batch of consistent camera views. |
| PBR | "Physically-based rendering" | Material with albedo, roughness, metallic, normal channels. |
| Densification | "Grow splats" | 3DGS training heuristic: split / clone splats in high-gradient regions. |

## Nota de producción: 3D no tiene un sustrato compartido todavía

A diferencia de la imagen (difusión latente + DiT) y el video (diT espacial-temporal), 3D no tiene un solo tiempo de ejecución dominante en 2026.

- **NeRF / triplane.**La inferencia es el marcado de rayos + un MLP hacia adelante por muestra. Un renderizado 5122 requiere millones de MLP hacia adelante.
- **Multi-view diffusion + LRM reconstruction.**La fase 1 (difusión + una visión) es un servidor de difusión al igual que la Lección 07. La etapa 2 (transformador LRM) es un paso hacia adelante de un solo paso sobre las vistas.
- **SDS / DreamFusion.**Optimización por activo, no inferencias.

Para la mayoría de los productos de 2026, la respuesta correcta es "ejecutar un modelo de difusión de múltiples visualizaciones a petición, reconstruir a 3DGS de manera asíncrona, servir al 3DGS para visualización en tiempo real". Esto divide la carga de trabajo limpiamente entre un servidor de interferencia GPU (rápido) y un optimizador fuera de línea (lento).

## Leer más

- [Mildenhall et al. (2020). NeRF: Representing Scenes as Neural Radiance Fields](https://arxiv.org/abs/2003.08934) NeRF.
- [Kerbl et al. (2023). 3D Gaussian Splatting for Real-Time Radiance Field Rendering](https://arxiv.org/abs/2308.04079)¿Qué es eso?
- [Poole et al. (2022). DreamFusion: Text-to-3D using 2D Diffusion](https://arxiv.org/abs/2209.14988) SDS.
- [Liu et al. (2023). Zero-1-to-3: Zero-shot One Image to 3D Object](https://arxiv.org/abs/2303.11328) Cero123.
- [Shi et al. (2023). MVDream](https://arxiv.org/abs/2308.16512) Difusión de múltiples vistas.
- [Hong et al. (2023). LRM: Large Reconstruction Model for Single Image to 3D](https://arxiv.org/abs/2311.04400) LRM.
- [Gao et al. (2024). CAT3D: Create Anything in 3D with Multi-View Diffusion Models](https://arxiv.org/abs/2405.10314) CAT3D.
- [Stability AI (2024). Stable Video 3D (SV3D)](https://stability.ai/research/sv3d-novel-multi-view-synthesis-and-3d-generation-from-a-single-image-using-latent-video-diffusion)- SV3D.
