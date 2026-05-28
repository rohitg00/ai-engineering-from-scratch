# Vision Transformers (ViT)

> Uma imagem é uma grade de patches. Uma frase é uma grade de tokens. O mesmo transformer come os dois.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 7 · 05 (Transformer Completo), Fase 4 · 03 (CNNs), Fase 4 · 14 (Introdução a Vision Transformers)
**Tempo:** ~45 minutos

## O Problema

Antes de 2020, visão computacional significava convoluções. Todo state-of-the-art no ImageNet, COCO e benchmarks de detecção usava uma CNN backbone. Transformers eram pra linguagem.

Dosovitskiy et al. (2020) — "An Image is Worth 16x16 Words" — mostrou que dá pra abandonar convoluções completamente. Fatie uma imagem em patches de tamanho fixo, projete cada patch linearmente num embedding, alimente a sequência num encoder transformer vanilla. Em escala suficiente (pré-treinamento ImageNet-21k ou maior), ViT empata ou vence modelos baseados em ResNet.

ViT foi o começo de um padrão mais amplo em 2026: uma arquitetura, muitas modalidades. Whisper tokeniza áudio. ViT tokeniza imagens. Tokens de ação pra robótica. Tokens de pixel pra vídeo. O transformer não se importa — alimenta uma sequência e aprende.

Até 2026, ViT e seus descendentes (DeiT, Swin, DINOv2, ViT-22B, SAM 3) dominam a maioria da visão. CNNs ainda vencem em dispositivos de borda e tarefas sensíveis a latência. Todo o resto tem um ViT em algum lugar da pilha.

## O Conceito

![Imagem → patches → tokens → transformer](../assets/vit.svg)

### Passo 1 — patchify

Separe uma imagem `H × W × C` numa sequência de patches achatados `N × (P·P·C)`. Configuração típica: imagem `224 × 224`, patches `16 × 16` → 196 patches de 768 valores cada.

```
image (224, 224, 3) → 14 × 14 grid of 16x16x3 patches → 196 vectors of length 768
```

Tamanho do patch é a alavanca. Patches menores = mais tokens, melhor resolução, custo de attention quadrático. Patches maiores = mais grosseiro, mais barato.

### Passo 2 — embedding linear

Uma única matriz aprendida projeta cada patch achatado pra `d_model`. Equivalente a uma convolução com kernel de tamanho `P` e stride `P`. No PyTorch isso é literalmente `nn.Conv2d(C, d_model, kernel_size=P, stride=P)` — implementação de 2 linhas.

### Passo 3 — antepor token `[CLS]`, adicionar embeddings posicionais

- Antepore um token `[CLS]` aprendível. Seu estado oculto final é a representação da imagem usada pra classificação.
- Adicione embeddings posicionais aprendidos (ViT original) ou sinusoidais 2D (variantes posteriores).
- Em 2024+ RoPE estendida pra 2D pra posição, às vezes sem embeddings explícitos.

### Passo 4 — encoder transformer padrão

Empilhe L blocos de `LayerNorm → Self-Attention → + → LayerNorm → MLP → +`. Idêntico ao BERT. Sem camadas eespecificaçãoíficas de visão. Essa é a conclusão pedagógica do paper.

### Passo 5 — head

Pra classificação: pegue estado oculto `[CLS]` → linear → softmax. Pra DINOv2 ou SAM, descarte `[CLS]`, use os embeddings de patch diretamente.

### Variantes que importaram

| Modelo | Ano | Mudança |
|--------|-----|---------|
| ViT | 2020 | O original. Tamanho de patch fixo, attention global completa. |
| DeiT | 2021 | Destilação; treinável só no ImageNet-1k. |
| Swin | 2021 | Hierárquico com janelas deslizantes. Custo sub-quadrático fixo. |
| DINOv2 | 2023 | Auto-supervisionado (sem rótulos). Melhores features visuais gerais. |
| ViT-22B | 2023 | 22B parâmetros; leis de escala se aplicam. |
| SigLIP | 2023 | ViT + par texto, perda contrastiva sigmoide. |
| SAM 3 | 2025 | Segmentar qualquer coisa; ViT-Large + decoder de máscara com prompt. |

### Por que demorou

ViT precisa de *muitos* dados pra equiparar CNNs porque não tem nenhum dos vieses indutivos de CNN (invariância de translação, localidade). Sem >100M imagens rotuladas ou forte pré-treinamento auto-supervisionado, CNNs ainda vencem em compute equivalente. DeiT resolveu em 2021 com truques de destilação; DINOv2 resolveu permanentemente em 2023 com auto-supervisão.

## Construindo

Veja `code/main.py`. Patchify + embedding linear puro do stdlib + verificações. Sem treinamento — ViT em qualquer escala real precisa PyTorch e horas de GPU.

### Passo 1: imagem falsa

Uma imagem RGB 24 × 24 como lista de linhas de tuplas `(R, G, B)`. Usamos patches 6×6 → 16 patches, vetor embedding de 108 cada.

### Passo 2: patchify

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

Ordem de raster: linha por linha pela grade. Todo ViT usa essa ordem.

### Passo 3: embedding linear

Multiplique cada patch achatado por uma matriz aleatória `(patch_flat_size, d_model)`. Verifique que o shape da saída é `(N_patches + 1, d_model)` depois de antepor `[CLS]`.

### Passo 4: contar parâmetros pra um ViT realista

Imprima contagem de parâmetros do ViT-Base: 12 camadas, 12 heads, d=768, patch=16. Compare com ResNet-50 (~25M). ViT-Base chega em ~86M. ViT-Large ~307M. ViT-Huge ~632M.

## Usando

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

**Embeddings DINOv2 são o padrão de 2026 pra features de imagem.** Congele o backbone, treine uma head minúscula. Funciona pra classificação, recuperação, detecção, legenda. Checkpoints DINOv2 do Meta superam CLIP em toda tarefa visual não-textual.

**Escolha de tamanho de patch.** Modelos pequenos usam 16×16 (ViT-B/16). Predição densa (segmentação) usa 8×8 ou 14×14 (SAM, DINOv2). Modelos muito grandes usam 14×14.

## Entregando

Veja `outputs/skill-vit-configurator.md`. A skill escolhe uma variante de ViT e tamanho de patch pra uma nova tarefa visual dado tamanho do dataset, resolução e orçamento de compute.

## Exercícios

1. **Fácil.** Rode `code/main.py`. Verifique que o número de patches é `(H/P) * (W/P)` e a dimensão do patch achatado é `P*P*C`.
2. **Médio.** Implemente embeddings posicionais sinusoidais 2D — dois códigos sinusoidais independentes pra `row` e `col` de cada patch, concatenados. Alimente num tiny ViT PyTorch e compare acurácia vs embeddings posicionais aprendidos no CIFAR-10.
3. **Difícil.** Construa um ViT de 3 camadas (PyTorch), treine em 1.000 imagens MNIST com patches 4×4. Meça acurácia no teste. Agora adicione pré-treinamento DINOv2 nas mesmas 1.000 imagens (simplificado: treine só o encoder pra prever embeddings de patches a partir de patches mascarados). Acurácia melhora?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| Patch | "O token do vision transformer" | Vetor achatado de valores de pixel pra uma região `P × P × C` da imagem. |
| Patchify | "Picar + achatamento" | Fatiar imagem em patches não-sobrepostos, achatar cada um num vetor. |
| Token `[CLS]` | "O resumo da imagem" | Token aprendível anteposto; seu embedding final é a representação da imagem. |
| Viés indutivo | "O que o modelo assume" | ViT tem menos priors que CNNs; precisa de mais dados pra compensar. |
| DINOv2 | "ViT auto-supervisionado" | Treinado sem rótulos usando augmentação de imagem + teacher de momento. Melhores features de imagem gerais em 2026. |
| SigLIP | "O sucessor do CLIP" | ViT + encoder de texto treinado com perda contrastiva sigmoide; melhor que CLIP em compute equivalente. |
| Swin | "ViT com janelas" | ViT hierárquico com attention local + janelas deslizantes; sub-quadrático. |
| Tokens de registro | "Truque de 2023" | Alguns tokens aprendíveis extras que absorvem attention sinks; melhora features do DINOv2. |

## Leituras Complementares

- [Dosovitskiy et al. (2020). An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale](https://arxiv.org/abs/2010.11929) — paper do ViT.
- [Touvron et al. (2021). Training data-efficient image transformers & distillation through attention](https://arxiv.org/abs/2012.12877) — DeiT.
- [Liu et al. (2021). Swin Transformer: Hierarchical Vision Transformer using Shifted Windows](https://arxiv.org/abs/2103.14030) — Swin.
- [Oquab et al. (2023). DINOv2: Learning Robust Visual Features without Supervision](https://arxiv.org/abs/2304.07193) — DINOv2.
- [Darcet et al. (2023). Vision Transformers Need Registers](https://arxiv.org/abs/2309.16588) — a correção de tokens de registro pra DINOv2.
