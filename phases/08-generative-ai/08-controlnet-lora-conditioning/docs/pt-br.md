# ControlNet, LoRA e Condicionamento

> Só texto é um sinal de controle desajeitado. ControlNet permite clonar um modelo de difusão pré-treinado e direcioná-lo com um mapa de profundidade, esqueleto de pose, rabisco ou imagem de borda. LoRA permite fazer fine-tuning de um modelo de 2B params treinando 10 milhões de parâmetros. Juntos transformaram o Stable Diffusion de brinquedo na pipeline de imagem de 2026 que distribui em toda agência.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 8 · 07 (Difusão Latente), Fase 10 (LLMs do Zero — para base do LoRA)
**Tempo:** ~75 minutos

## O Problema

Um prompt como "uma mulher de vermelho andando com um cachorro numa rua movimentada" não dá ao modelo informação sobre *onde* o cachorro está, *qual pose* a mulher tem, ou *a perespecificaçãotiva* da rua. Texto define uns 10% do que você precisa eespecificaçãoificar uma imagem. O resto é visual e não pode ser descrito eficientemente em palavras.

Treinar um novo modelo condicional do zero para cada sinal (pose, profundidade, canny, segmentação) é proibitivo. Você quer manter o backbone SDXL de 2.6B params congelado, anexar uma rede lateral pequena que lê a condição, e fazê-la ajustar as features intermediárias do backbone. Isso é o ControlNet.

Você também quer ensinar conceitos novos (seu rosto, seu produto, seu estilo) sem retreinar o modelo inteiro. Você quer um delta 100x menor. Isso é o LoRA — adaptadores de baixo rank que entram nos pesos de attention existentes.

ControlNet + LoRA + texto = o kit do praticante de 2026. A maioria das pipelines de imagem em produção empilha 2-5 LoRAs, 1-3 ControlNets e um IP-Adapter sobre uma base SDXL / SD3 / Flux.

## O Conceito

![ControlNet clona o encoder; LoRA adiciona deltas de baixo rank](../assets/controlnet-lora.svg)

### ControlNet (Zhang et al., 2023)

Pega um SD pré-treinado. *Clona* a metade encoder do U-Net. Congela o original. Treina o clone para aceitar uma entrada de condição extra (bordas, profundidade, pose). Conecta o clone de volta à metade decoder do original com skip connections de *zero-convolution* (convs 1×1 inicializadas com zero — começa como no-op, aprende um delta).

```
SD U-Net decoder:   ... ← orig_enc_features + zero_conv(controlnet_enc(condition))
```

Init zero-conv significa que o ControlNet começa como identidade — sem dano mesmo antes do treinamento. Treina em 1M de triples (prompt, condição, imagem) com a loss padrão de difusão.

ControlNets por modalidade são distribuídos como modelos laterais pequenos (~360M para SDXL, ~70M para SD 1.5). Você pode compô-los na inferência:

```
features += weight_a * control_a(depth) + weight_b * control_b(pose)
```

### LoRA (Hu et al., 2021)

Para qualquer camada linear `W ∈ R^{d×d}` no modelo, congela `W` e adiciona um delta de baixo rank:

```
W' = W + ΔW,  ΔW = B @ A,  A ∈ R^{r×d},  B ∈ R^{d×r}
```

com `r << d`. Rank 4-16 é padrão para attention, rank 64-128 para fine-tunes pesados. Novos params: `2 · d · r` em vez de `d²`. Para attention SDXL com `d=640`, `r=16`: 20k params por adapter em vez de 410k — redução de 20x. Em todo o modelo: um LoRA é geralmente 20-200MB vs base de 5GB.

Na inferência você pode escalar o LoRA: `W' = W + α · B @ A`. `α = 0.5-1.5` é normal. Múltiplos LoRAs empilham aditivamente (com a ressalva usual de que interagem de formas não-lineares).

### IP-Adapter (Ye et al., 2023)

Um adapter minúsculo que aceita uma *imagem* como condição (junto com texto). Usa o encoder de imagem CLIP para produzir tokens de imagem, injeta eles na cross-attention junto com tokens de texto. ~20MB por modelo base. Permite fazer "gerar uma imagem no estilo dessa referência" sem um LoRA.

## Matriz de composabilidade

| Ferramenta | O que controla | Tamanho | Quando usar |
|------|------------------|------|-------------|
| ControlNet | Estrutura espacial (pose, profundidade, bordas) | 70-360MB | Layout exato, composição |
| LoRA | Estilo, sujeito, conceito | 20-200MB | Personalização, estilo |
| IP-Adapter | Estilo ou sujeito de imagem referência | 20MB | Nenhum texto descreve o visual |
| Textual Inversion | Conceito único como novo token | 10KB | Legado, maioritariamente substituído por LoRA |
| DreamBooth | Fine-tuning completo em sujeito | 2-5GB | Identidade forte, compute alto |
| T2I-Adapter | Alternativa leve ao ControlNet | 70MB | Dispositivos de borda, orçamento de inferência |

ControlNet ≈ espacial. LoRA ≈ semântico. Use os dois.

## Construa

`code/main.py` simula os dois mecanismos em 1-D:

1. **LoRA.** Uma camada linear pré-treinada `W`. Congela. Treina um `B @ A` de baixo rank para que `W + BA` combine uma camada linear alvo. Mostra que `r = 1` é suficiente para aprender uma correção de rank 1 perfeitamente.

2. **ControlNet-lite.** Um preditor "base congelada" e uma "rede lateral" que lê um sinal extra. A saída da rede lateral é controlada por um escalar aprendível inicializado com zero (nossa versão de zero-conv). Treina e observa o gate subir.

### Passo 1: matemática LoRA

```python
def lora(W, A, B, x, alpha=1.0):
    # W está congelado; A, B são os fatores treináveis de baixo rank.
    return [W[i][j] * x[j] for i, j in ...] + alpha * (B @ (A @ x))
```

### Passo 2: rede lateral com init zero

```python
side_out = control_net(x, condition)
gated = gate * side_out  # gate inicializado com 0
h = base(x) + gated
```

No passo 0 a saída é idêntica à base. Treinamento inicial atualiza `gate` lentamente — sem deriva catastrófico.

## Armadilhas

- **Escalando LoRAs demais.** `α = 2` ou `α = 3` é um hack comum para "fazer mais forte" que produz saídas estilizadas demais / quebradas. Mantenha `α ≤ 1.5`.
- **Conflito de pesos do ControlNet.** Usar um Pose ControlNet com peso 1.0 e um Depth ControlNet com peso 1.0 geralmente exagera. Soma de pesos ≈ 1.0 é um padrão seguro.
- **LoRA na base errada.** LoRAs de SDXL silenciosamente viram no-op em SD 1.5 porque as dimensões de attention não combinam. Diffusers vai avisar na 0.30+.
- **Deriva do Textual Inversion.** Tokens treinados num checkpoint derivam muito em outro. LoRA é mais portátil.
- **Merge e armazenamento de peso LoRA.** Você pode assar um LoRA nos pesos do modelo base para inferência mais rápida (sem adição em runtime), mas perde a capacidade de escalar `α` em runtime. Mantenha ambas as versões.

## Use

| Objetivo | Pipeline 2026 |
|------|---------------|
| Reproduzir estilo artístico de uma marca | LoRA treinado em ~30 imagens selecionadas com rank 32 |
| Colocar meu rosto em imagem gerada | DreamBooth ou LoRA + IP-Adapter-FaceID |
| Pose eespecificaçãoífica + prompt | ControlNet-Openpose + SDXL + texto |
| Composição com consciência de profundidade | ControlNet-Depth + SD3 |
| Referência + prompt | IP-Adapter + texto |
| Layout exato | ControlNet-Scribble ou ControlNet-Canny |
| Troca de fundo | ControlNet-Seg + Inpainting (Lição 09) |
| Estilo rápido 1 passo | LCM-LoRA no SDXL-Turbo |

## Entregue

Salve `outputs/skill-sd-toolkit-composer.md`. Skill recebe uma tarefa (inputs: prompt, imagem referência opcional, pose opcional, profundidade opcional, rabisco opcional) e gera a stack de ferramentas, pesos e protocolo de seed reproduzível.

## Exercícios

1. **Fácil.** Em `code/main.py`, varie o rank LoRA `r` de 1 a 4. Em qual rank o LoRA combina exatamente um delta alvo de rank-2?
2. **Médio.** Treine dois LoRAs separados em duas transformações alvo. Carregue-os juntos e mostre a interação aditiva. Quando a interação quebra a linearidade?
3. **Difícil.** Use diffusers para empilhar: SDXL-base + Canny-ControlNet (peso 0.8) + LoRA de estilo (α 0.8) + IP-Adapter (peso 0.6). Meça o trade-off FID-vs-aderência a prompt conforme os pesos da stack variam.

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|-----------------|-----------------------|
| ControlNet | "Controle espacial" | Encoder clonado + skips zero-conv; lê uma imagem de condição. |
| Zero convolution | "Começa como identidade" | Conv 1×1 inicializada com zero; ControlNet começa como no-op. |
| LoRA | "Adapter de baixo rank" | `W + B @ A`, `r << d`; 100x menos params que fine-tuning completo. |
| rank r | "O parâmetro" | Compressão LoRA; 4-16 típico, 64+ para personalização pesada. |
| α | "Força do LoRA" | Escala em runtime do delta do LoRA. |
| IP-Adapter | "Imagem referência" | Pequeno adapter de condicionamento por imagem via tokens CLIP-image. |
| DreamBooth | "Fine-tuning de sujeito completo" | Treina o modelo inteiro em ~30 imagens de um sujeito. |
| Textual Inversion | "Novo token" | Aprende um novo embedding de palavra apenas; legado, maioritariamente substituído. |

## Nota de produção: troca de LoRAs, pistas de ControlNet, serving multi-tenant

Um SaaS real de texto-para-imagem serve centenas de LoRAs e uma dúzia de ControlNets sobre o mesmo checkpoint base. O problema de serving parece muito com multi-tenant de LLM (a literatura de produção cobre o caso LLM sob batch contínuo e LoRAX / S-LoRA):

- **Hot-swap de LoRAs, não merge.** Merging `W' = W + α·B·A` na base dá ~3-5% de inferência mais rápida por passo mas congela `α` e a base. Mantenha LoRAs hot na VRAM como deltas de rank-r; diffusers expõe `pipe.load_lora_weights()` + `pipe.set_adapters([...], adapter_weights=[...])` para ativação por request. Custo de troca são os pesos `2 · d · r · num_layers` — escala MB, sub-segundo.
- **ControlNet como segunda pista de attention.** O encoder clonado roda em paralelo com a base. Dois ControlNets com peso 1.0 cada = dois forward passes extras por passo, não um passo merged. Headroom de batch size cai quadraticamente. Orçamento para ~1.5× custo por passo por ControlNet ativo.
- **LoRAs quantizados também.** Se você quantizou a base (ver Lição 07, Flux em 8GB), o delta do LoRA também quantiza limposamente para 8-bit ou 4-bit. Carregamento estilo QLoRA permite empilhar 5-10 LoRAs sobre uma base Flux 4-bit sem estourar memória.

Eespecificaçãoífico do Flux: o notebook do Niels "Flux em 8GB" quantiza a base para 4-bit; empilhar um LoRA de estilo (`pipe.load_lora_weights("user/style-lora")`) nessa base quantizada com `weight_name="pytorch_lora_weights.safetensors"` ainda funciona. Essa é a receita que a maioria das agências SaaS distribui em 2026.

## Leitura Adicional

- [Zhang, Rao, Agrawala (2023). Adding Conditional Control to Text-to-Image Diffusion Models](https://arxiv.org/abs/2302.05543) — ControlNet.
- [Hu et al. (2021). LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) — LoRA (originalmente para LLMs; portado para difusão).
- [Ye et al. (2023). IP-Adapter: Text Compatible Image Prompt Adapter](https://arxiv.org/abs/2308.06721) — IP-Adapter.
- [Mou et al. (2023). T2I-Adapter: Learning Adapters to Dig Out More Controllable Ability](https://arxiv.org/abs/2302.08453) — alternativa leve ao ControlNet.
- [Ruiz et al. (2023). DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation](https://arxiv.org/abs/2208.12242) — DreamBooth.
- [HuggingFace Diffusers — ControlNet / LoRA / IP-Adapter docs](https://huggingface.co/docs/diffusers/training/controlnet) — pipelines de referência.
