# ControlNet, LoRA & Conditização

> O texto sozinho é um sinal de controle desajeitado. ControlNet permite que você clone um modelo de difusão pré-treinado e guiá-lo com um mapa de profundidade, esqueleto de pose, rabisco ou imagem de borda. LoRA permite que você ajuste um modelo de parâmetro 2B treinando 10 milhões de parâmetros. Juntos eles transformaram a Diffusão estável de um brinquedo no pipeline de imagem 2026 que é enviado para todas as agências.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 10 (LLMs from Scratch — for LoRA foundation)
**Time:** ~75 minutes

## O problema

Um prompt como "uma mulher de vestido vermelho caminhando com um cão numa rua movimentada" não dá ao modelo informações sobre *onde* o cão está, *qual é a posição* da mulher ou *a perspectiva* da rua.

O treinamento de um novo modelo condicional a partir do zero para cada sinal (posição, profundidade, inteligência, segmentação) é proibitivo. Você quer manter a espinha dorsal SDXL de 2.6B parâmetro congelada, anexar uma pequena rede lateral que lê o condicionamento e fazer com que ele empurra as características intermediárias da espinha dorsal.

Você também quer ensinar o modelo novos conceitos (sua cara, seu produto, seu estilo) sem reestruturação do modelo completo. Você quer um delta 100x menor.

ControlNet + LoRA + texto = kit de ferramentas do profissional de 2026. A maioria dos canais de imagem de produção de camada 2-5 LoRAs, 1-3 ControlNets e um IP-Adapter em cima de uma base SDXL / SD3 / Flux.

## O conceito

![ControlNet clones the encoder; LoRA adds low-rank deltas](../assets/controlnet-lora.svg)

### ControlNet (Zhang et al., 2023)

*Clon* a metade do codificador da U-Net. Congelhe o original. Treine o clone para aceitar uma entrada de condicionamento extra (borda, profundidade, pose). Conecte o clone de volta ao decodificador metade do original com *convolução zero* ligações de saltos (1×1 convs iniciados em zero  começa como um no-op, aprenda um delta).

```
SD U-Net decoder:   ... ← orig_enc_features + zero_conv(controlnet_enc(condition))
```

O treinamento em 1M (prompto, condição, imagem) triplica a perda de difusão padrão.

ControlNets por modalidade são enviados como pequenos modelos laterais (~ 360 M para SDXL, ~ 70 M para SD 1.5).

```
features += weight_a * control_a(depth) + weight_b * control_b(pose)
```

### LoRA (Hu et al., 2021)

Para qualquer camada linear $W \in \mathbb{R}^{d \times d}$no modelo, congelar $W$e adicionar um delta de baixo grau:

```math
W' = W + \Delta W, \quad \Delta W = B A, \quad A \in \mathbb{R}^{r \times d}, \quad B \in \mathbb{R}^{d \times r}
```

com$r \ll d$. O ranking 4-16 é padrão para atenção, o ranking 64-128 para tons finas pesados.$2 \cdot d \cdot r$Em vez de$d^2$. Para a atenção da SDXL com $d=640$- Não .$r=16$Por exemplo, o modelo de um adaptador de 20k em vez de 410k  uma redução de 20x.

Em inferência , pode escalar a LoRA:$W' = W + \alpha \cdot B A$- Não .$\alpha = 0.5\text{-}1.5$Os LoRAs múltiplos se empilham adicionalmente (com a habitual advertença de que interagem de forma não linear).

### Adaptador IP (Ye et al., 2023)

Um pequeno adaptador que aceita uma *imagem* como condição (junto ao texto). Utiliza o codificador de imagem CLIP para produzir tokens de imagem, injetá-los em atenção cruzada ao lado de tokens de texto. ~ 20 MB por modelo base. Permite "gerar uma imagem no estilo desta referência" sem um LoRA.

## Matriz de composibilidade

| Tool | What it controls | Size | When to use |
|------|------------------|------|-------------|
| ControlNet | Spatial structure (pose, depth, edges) | 70-360MB | Exact layout, composition |
| LoRA | Style, subject, concept | 20-200MB | Personalization, style |
| IP-Adapter | Style or subject from reference image | 20MB | No text can describe the look |
| Textual Inversion | Single concept as a new token | 10KB | Legacy, mostly replaced by LoRA |
| DreamBooth | Full fine-tune on a subject | 2-5GB | Strong identity, high compute |
| T2I-Adapter | Lighter ControlNet alternative | 70MB | Edge devices, inference budget |

ControlNet ≈ espacial, LoRA ≈ semântico, use os dois.

```figure
v4-controlnet-zero
```

## Construí-lo

`code/main.py`Simula os dois mecanismos em 1-D:

1. **LoRA.**Uma camada linear pré-treinada .$W$- Congelar. Treinar um de baixo grau.$BA$Tal como isso .$W + BA$- O que é que ele faz?$r = 1$É suficiente para aprender uma correcção de grau 1 perfeitamente.

2. **ControlNet-lite.**Um preditor de "base congelada" e uma "rede lateral" que lê um sinal extra. A saída da rede lateral é bloqueada por um escalar aprendizagem iniciada para zero (nossa versão de zero-conv).

### Passo 1: Matemática de LoRA

```python
def lora(W, A, B, x, alpha=1.0):
    # W is frozen; A, B are the trainable low-rank factors.
    return [W[i][j] * x[j] for i, j in ...] + alpha * (B @ (A @ x))
```

### Passo 2: Rede lateral de zero-init

```python
side_out = control_net(x, condition)
gated = gate * side_out  # gate initialized to 0
h = base(x) + gated
```

No passo 0 a saída é idêntica à base.`gate`lentamente, sem uma deriva catastrófica.

## Encurralagens

- **Over-scaling LoRAs.** $\alpha = 2$ou $\alpha = 3$É um hack comum "faça-o mais forte" que produz resultados excessivamente estilizados / quebrados.$\alpha \le 1.5$- Não .
- **ControlNet weight conflict.**Usando uma Pose ControlNet com peso 1.0 e uma Depth ControlNet com peso 1.0 geralmente ultrapassam.
- **LoRA on the wrong base.**Os SDXL LoRAs silenciosamente não operam no SD 1.5 porque as dimensões de atenção não coincidem.
- **Textual Inversion drift.**Os tokens treinados num ponto de controlo desviam mal em outro.
- **LoRA weight-merging and storage.**Você pode fazer um LoRA em pesos do modelo base para inferência mais rápida (sem adição de tempo de execução), mas você perde a capacidade de escalar $\alpha$Mantém as duas versões.

## Usá-lo

| Goal | 2026 pipeline |
|------|---------------|
| Reproduce a brand's art style | LoRA trained on ~30 curated images at rank 32 |
| Put my face in a generated image | DreamBooth or LoRA + IP-Adapter-FaceID |
| Specific pose + prompt | ControlNet-Openpose + SDXL + text |
| Depth-aware composition | ControlNet-Depth + SD3 |
| Reference + prompt | IP-Adapter + text |
| Exact layout | ControlNet-Scribble or ControlNet-Canny |
| Background replace | ControlNet-Seg + Inpainting (Lesson 09) |
| Fast 1-step style | LCM-LoRA on SDXL-Turbo |

## Envia-o

Salvar`outputs/skill-sd-toolkit-composer.md`. A competência assume uma tarefa (asset de entrada: prompt, imagem de referência opcional, posição opcional, profundidade opcional, rabisco opcional) e produz a pilha de ferramentas, pesos e um protocolo de semente reprodutivel.

## Exercícios

1. **Easy.**- Não .`code/main.py`, variar o grau de LoRA `r`Em que nível o LoRA corresponde exactamente a um delta-alvo de nível 2?
2. **Medium.**Treinar dois LoRAs separados em duas transformações alvo. carregar-los juntos e mostrar a sua interação aditiva. Quando a interação quebra a linearidade?
3. **Hard.**Utilize difusores para empilhar: SDXL-base + Canny-ControlNet (peso 0,8) + um estilo LoRA ($\alpha$0.8) + IP-Adapter (peso 0,6).

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| ControlNet | "Spatial control" | Cloned encoder + zero-conv skips; reads a conditioning image. |
| Zero convolution | "Starts as identity" | 1×1 conv initialized to zero; ControlNet starts as no-op. |
| LoRA | "Low-rank adapter" | $W + BA$, $r \ll d$; 100x fewer params than a full fine-tune. |
| rank r | "The knob" | LoRA compression; 4-16 typical, 64+ for heavy personalization. |
| $\alpha$ | "LoRA strength" | Runtime scaling of the LoRA delta. |
| IP-Adapter | "Reference image" | Small image-conditioning adapter via CLIP-image tokens. |
| DreamBooth | "Full subject fine-tune" | Train the full model on ~30 images of a subject. |
| Textual Inversion | "New token" | Learn a new word embedding only; legacy, mostly replaced. |

## Nota de produção: LoRA swaps, vias de controlo da rede, serviço para vários inquilinos

Um SaaS de texto a imagem real serve centenas de LoRAs e uma dúzia de ControlNets sobre o mesmo ponto de controle base. O problema de serviço parece muito com a LLM multi-pensionamento (a literatura de produção abrange o caso LLM sob batch contínuo e LoRAX / S-LoRA):

- **Hot-swap LoRAs, do not merge.**Fusão$W' = W + \alpha \cdot B \cdot A$na base dá ~ 3-5% mais rápido por etapa de inferência, mas congela $\alpha$Mantém os LoRAs quentes no VRAM como delta de rango; os difusores expõem`pipe.load_lora_weights()`+ `pipe.set_adapters([...], adapter_weights=[...])`O custo de troca é o `2 · d · r · num_layers`Pesos  em escala de MB, subsegundo.
- **ControlNet as a second attention lane.**O codificador clonado funciona em paralelo com a base. Dois ControlNets com peso de 1.0 cada = dois passes adicionais adicionais por passo, não um passes combinados.
- **Quantized LoRAs too.**Se você quantizar a base (ver Lição 07, Flux em 8GB), o delta LoRA também quantiza limpo para 8-bit ou 4-bit.

Flux-specific: o notebook Flux-on-8GB de Niels quantifica a base para 4 bits; empilhando um estilo LoRA (`pipe.load_lora_weights("user/style-lora")`) sobre essa base quantizada em `weight_name="pytorch_lora_weights.safetensors"`Esta é a receita que a maioria das agências SaaS vai enviar em 2026.

## Mais leitura

- [Zhang, Rao, Agrawala (2023). Adding Conditional Control to Text-to-Image Diffusion Models](https://arxiv.org/abs/2302.05543) ControlNet.
- [Hu et al. (2021). LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) LoRA (originalmente para LLM; portos para difusão).
- [Ye et al. (2023). IP-Adapter: Text Compatible Image Prompt Adapter](https://arxiv.org/abs/2308.06721) Adaptador IP.
- [Mou et al. (2023). T2I-Adapter: Learning Adapters to Dig Out More Controllable Ability](https://arxiv.org/abs/2302.08453) alternativa mais leve ao ControlNet.
- [Ruiz et al. (2023). DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation](https://arxiv.org/abs/2208.12242)- DreamBooth.
- [HuggingFace Diffusers — ControlNet / LoRA / IP-Adapter docs](https://huggingface.co/docs/diffusers/training/controlnet)- canais de referência.
