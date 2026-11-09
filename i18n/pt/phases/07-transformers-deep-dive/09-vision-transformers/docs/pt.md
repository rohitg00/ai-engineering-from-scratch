# Transformadores de visão (ViT)

> Uma imagem é uma grade de parches, uma frase é uma grade de tokens, o mesmo transformador come as duas coisas.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 4 · 03 (CNNs), Phase 4 · 14 (Vision Transformers intro)
**Time:** ~45 minutes

## O problema

Antes de 2020, a visão por computador significava convulsões. Cada SOTA na ImageNet, COCO e benchmarks de detecção usavam uma espinha dorsal da CNN.

Dosovitskiy et al. (2020)  "Uma imagem vale 16x16 palavras"  mostrou que você pode soltar as convulsões inteiramente. Cortar uma imagem em parches de tamanho fixo, projetar linearmente cada parche em um incorporado, alimentar a sequência para um codificador transformador de vainilha. Em escala suficiente (ImageNet-21k pré-treino ou maior), ViT combina ou supera os modelos baseados em ResNet.

ViT foi o início de um padrão mais amplo em 2026: uma arquitetura, muitas modalidades. Whisper tokenizes áudio. ViT tokenizes imagens. Tokens de ação para robótica. Tokens de píxeles para vídeo. O transformador não se importa  alimentar uma sequência e ele aprende.

Em 2026, a ViT e seus descendentes (DeiT, Swin, DINOv2, ViT-22B, SAM 3) possuem a maior parte da visão.

## O conceito

![Image → patches → tokens → transformer](../assets/vit.svg)

### Passo 1  Aplicação

Dividir um`H × W × C`imagem em um `N × (P·P·C)`sequência de manchas planas.`224 × 224`imagem, `16 × 16`patches → 196 patches de 768 valores cada.

```
image (224, 224, 3) → 14 × 14 grid of 16x16x3 patches → 196 vectors of length 768
```

O tamanho do patch é a alavanca. Patches menores = mais tokens, melhor resolução, custo de atenção quadrática. Patches maiores = mais grosseiros, mais baratos.

### Passo 2  incorporação linear

Uma única matriz aprendida projeta cada parcela plana para `d_model`. Equivalente a uma convolução de tamanho do núcleo `P`E passo a passo .`P`Em PyTorch isto é literalmente`nn.Conv2d(C, d_model, kernel_size=P, stride=P)` uma aplicação de duas linhas.

### Passo 3  prepend `[CLS]`token, adicionar inserções posicionais

- Prepare um aprendizagem .`[CLS]`O seu estado oculto final é a representação de imagem usada para classificação.
- Adicionar embutidos posicionais aprendizes (ViT-original) ou sinusoidais 2D (variantes posteriores).
- Em 2024+ RoPE estendido para 2D para posição, às vezes sem incorporações explícitas.

### Passo 4  Encoder padrão de transformador

Estaca de blocos de`LayerNorm → Self-Attention → + → LayerNorm → MLP → +`- Identico ao BERT. Não há camadas específicas de visão.

### Passo 5 - cabeça

Para classificação: tomar `[CLS]`estado oculto → linear → softmax. para DINOv2 ou SAM, descartar `[CLS]`, usar as inserções do parche directamente.

### Variantes que importaram

| Model | Year | Change |
|-------|------|--------|
| ViT | 2020 | The original. Fixed patch size, full global attention. |
| DeiT | 2021 | Distillation; trainable on ImageNet-1k only. |
| Swin | 2021 | Hierarchical with shifted windows. Fixed sub-quadratic cost. |
| DINOv2 | 2023 | Self-supervised (no labels). Best general vision features. |
| ViT-22B | 2023 | 22B params; scaling laws apply. |
| SigLIP | 2023 | ViT + language pair, sigmoid contrastive loss. |
| SAM 3 | 2025 | Segment anything; ViT-Large + promptable mask decoder. |

### Por que demorou um tempo?

A ViT precisa de *muitos* dados para combinar com as CNNs porque não tem nenhum dos preconceitos indutivos da CNN (invariância de tradução, localidade). Sem >100M de imagens rotuladas ou um forte pré-treino auto-supervisionado, as CNNs ainda ganham em computação combinada.

```figure
n5-patch-stream
```

## Construí-lo

Veja .`code/main.py`- Pure-stdlib patchify + linear embutida + verificações de sanidade.

### Passo 1: imagem falsa

Uma imagem RGB 24 × 24 como uma lista de linhas de `(R, G, B)`Usamos 6×6 parches → 16 parches, vector de incorporação de 108D cada.

### Passo 2: Parchear

```python
def patchify(image, P):
    H = len(image)
    W = len(image[0])
    patches = []
    for i in range(0, H, P):
        for j in range(0, W, P):
            patch = []
            for di in range(P):
                for dj in range(P):
                    patch.extend(image[i + di][j + dj])
            patches.append(patch)
    return patches
```

A ordem de raster: linha-maior através da grade.

### Passo 3: inserção linear

Multiplicar cada parcela plana por um aleatório `(patch_flat_size, d_model)`Matrix. Verifique a forma de saída é `(N_patches + 1, d_model)`após a preparação `[CLS]`- Não .

### Passo 4: Parâmetros de contagem para um ViT realista

Imprima a contagem de parâmetros para ViT-Base: 12 camadas, 12 cabeças, d = 768, parche = 16.

## Usá-lo

```python
from transformers import ViTImageProcessor, ViTModel
import torch
from PIL import Image

processor = ViTImageProcessor.from_pretrained("google/vit-base-patch16-224-in21k")
model = ViTModel.from_pretrained("google/vit-base-patch16-224-in21k")

img = Image.open("cat.jpg")
inputs = processor(img, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, 197, 768): [CLS] + 196 patches
cls_emb = out[:, 0]                       # image representation
```

**DINOv2 embeddings are the 2026 default for image features.**A meta funciona para classificação, recuperação, detecção, subtítulos. Os pontos de controlo DINOv2 do Meta superam o CLIP em todas as tarefas de visão não textual.

**Patch-size picking.**Modelos pequenos usam 16×16 (ViT-B/16). A previsão densa (segmentação) usa 8×8 ou 14×14 (SAM, DINOv2).

## Envia-o

Veja .`outputs/skill-vit-configurator.md`. A habilidade escolhe uma variante ViT e tamanho de parche para uma nova tarefa de visão dada a dimensão do conjunto de dados, resolução e orçamento de computação.

## Exercícios

1. **Easy.**Corra .`code/main.py`Verifique o número de parches igual .`(H/P) * (W/P)`e a dimensão do parche plano é igual `P*P*C`- Não .
2. **Medium.**Implementar inserções posicionais sinusoidais 2D  dois códigos sinusoidais independentes para `row`E ...`col`Acompanhe-os num pequeno PyTorch ViT e compare a precisão vs. inserções posicionais aprendíveis no CIFAR-10.
3. **Hard.**Construir um ViT de 3 camadas (PyTorch), treinar em 1.000 imagens MNIST com 4×4 patches. Medir a precisão do teste. Agora adicionar DINOv2 pré-treinamento nas mesmas 1.000 imagens (simplificado: apenas treinar o codificador para prever embutidos de patches de patches mascarados). Melhora a precisão?

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Patch | "The vision-transformer token" | Flat vector of pixel values for a `P × P × C` region of the image. |
| Patchify | "Chop + flatten" | Slice image into non-overlapping patches, flatten each to a vector. |
| `[CLS]` token | "The image summary" | Prepended learnable token; its final embedding is the image representation. |
| Inductive bias | "What the model assumes" | ViT has fewer priors than CNNs; needs more data to make up the gap. |
| DINOv2 | "Self-supervised ViT" | Trained without labels using image augmentation + momentum teacher. Best general image features in 2026. |
| SigLIP | "CLIP's successor" | ViT + text encoder trained with sigmoid contrastive loss; better than CLIP on matched compute. |
| Swin | "Windowed ViT" | Hierarchical ViT with local attention + shifted windows; sub-quadratic. |
| Register tokens | "2023 trick" | A few extra learnable tokens that soak up attention sinks; improves DINOv2 features. |

## Mais leitura

- [Dosovitskiy et al. (2020). An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale](https://arxiv.org/abs/2010.11929)O papel do ViT.
- [Touvron et al. (2021). Training data-efficient image transformers & distillation through attention](https://arxiv.org/abs/2012.12877)- Não.
- [Liu et al. (2021). Swin Transformer: Hierarchical Vision Transformer using Shifted Windows](https://arxiv.org/abs/2103.14030)- Esvaziar.
- [Oquab et al. (2023). DINOv2: Learning Robust Visual Features without Supervision](https://arxiv.org/abs/2304.07193)- DINOv2.
- [Darcet et al. (2023). Vision Transformers Need Registers](https://arxiv.org/abs/2309.16588) a fixação do símbolo de registro para DINOv2.
