# GANs condicionais & Pix2Pix

> A primeira grande desbloqueio de 2014-2017 foi controlar o que um GAN faz. Anexe um rótulo, ou uma imagem, ou uma frase. Pix2Pix fez a versão de imagem e ainda vence todos os modelos genéricos de texto para imagem em tarefas estreitas de imagem para imagem.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 06 (U-Net), Phase 3 · 07 (CNNs)
**Time:** ~75 minutes

## O problema

Uma GAN incondicional mostra rostos arbitrários. Útil para uma demonstração, inútil na produção. Você quer: *mapear um esboço para uma foto*, *mapear um mapa para uma foto aérea*, *mapear uma cena diurna para a noite*, *colorizar uma imagem em escala de cinza*. Em todos eles, você recebe uma imagem de entrada$x$e deve ser emitido$y$Há muitas hipóteses plausíveis.$y$É por .$x$O erro médio quadrado aplania-os em massa, mas a perda adversária não, porque "parece real" é acentuada.

GAN condicional (Mirza & Osindero, 2014) adiciona uma condição $c$como uma entrada para ambos $G$E ...$D$. Pix2Pix (Isola et al., 2017) especializou-se nisso: condição é uma imagem de entrada completa, gerador é uma U-Net, discriminador é um classificador baseado em patch (PatchGAN), e perda é adversária + L1. Essa receita supera modelos de texto a imagem de zero em domínios de imagem a imagem estreitos mesmo em 2026 porque é treinado em * dados em pares *  você tem exatamente o sinal que precisa.

## O conceito

![Pix2Pix: U-Net generator, PatchGAN discriminator](../assets/pix2pix.svg)

**Conditional G.** $G(x, z) \to y$- Na Pix2Pix,$z$é descontinuado dentro de G (sem ruído de entrada  Isola encontrou ruído explícito foi ignorado).

**Conditional D.** $D(x, y) \to [0, 1]$. A entrada é o *par* (condição, saída). Esta é a diferença chave: D deve julgar se $y$é consistente com $x$Não só se$y$Parece real.

**U-Net generator.**Encoder-decodificador com conexões de saltar através do gargalo de engarrafamento. É crítico para tarefas onde entrada e saída compartilham estrutura de baixo nível (borda, silueta). Sem os saltos, detalhes de alta frequência desaparecem.

**PatchGAN discriminator.**Em vez de emitir uma única pontuação real/falsa, D emitirá uma$N \times N$Grade onde cada célula julga um campo receptivo de ~70×70 pixels. média. Esta é uma suposição de campo aleatório de Markov: realismo é local. muito mais rápido para treinar, menos parâmetros, saída mais nítida.

**Loss.**

```math
\begin{aligned}
\text{loss}_G &= -\log D(x, G(x)) + \lambda \cdot \lVert y - G(x) \rVert_1 \\
\text{loss}_D &= -\log D(x, y) - \log(1 - D(x, G(x)))
\end{aligned}
```

O termo L1 estabiliza o treinamento e empurra G para o alvo conhecido.$\lambda = 100$Era o Pix2Pix padrão.

## CycleGAN  quando não tiver pares

Pix2Pix precisa de paragem $(x, y)$Os dados. CycleGAN (Zhu et al., 2017) reduz esta exigência ao custo de uma perda extra: a perda de *consistência do ciclo*.$G: X \to Y$E ...$F: Y \to X$Treinar-lhes assim .$F(G(x)) \approx x$E ...$G(F(y)) \approx y$Isto permite que se traduza cavalos em zebras, verão em inverno, sem exemplos emparelhados.

Em 2026, a imagem-para-imagem não-parejada é feita principalmente através da difusão (ControlNet, IP-Adapter) em vez do CycleGAN, mas a ideia de consistência de ciclo sobrevive em quase todos os documentos de adaptação de domínio não-parejado.

```figure
gx-patchgan
```

## Construí-lo

`code/main.py`Implementa uma pequena GAN condicional em dados 1-D.$c$é um rótulo de classe (0 ou 1). A tarefa: produzir uma amostra da distribuição condicional para a classe dada.

### Passo 1: apenda condição tanto às entradas G como D

```python
def G(z, c, params):
    return mlp(concat([z, one_hot(c)]), params)

def D(x, c, params):
    return mlp(concat([x, one_hot(c)]), params)
```

A codificação de um só-quente é a maneira mais simples. Os modelos maiores usam incorporados aprendidos, modulação FiLM ou atenção cruzada.

### Passo 2: com condição de trem

```python
for step in range(steps):
    x, c = sample_real_conditional()
    noise = sample_noise()
    update_D(x_real=x, x_fake=G(noise, c), c=c)
    update_G(noise, c)
```

O gerador deve corresponder à distribuição real * para a dada condição *, não à marginalidade.

### Passo 3: Verificação de saída por classe

```python
for c in [0, 1]:
    samples = [G(noise, c) for noise in batch]
    mean_c = mean(samples)
    assert_near(mean_c, real_mean_for_class_c)
```

## Encurralagens

- **Condition ignored.**G aprende a marginalizar, D nunca penaliza porque o sinal de condição é fraco.
- **L1 weight too low.**G deriva para resultados arbitrários de aparência real, não fiéis.$\lambda \approx 100$para tarefas de estilo Pix2Pix.
- **L1 weight too high.**G produz saídas borbulhas porque L1 é ainda um $L_p$A anel baixa quando o treino estabilizar.
- **Ground-truth leakage in D.**Concatenato $(x, y)$como entrada D, não apenas $y$Sem este D não podemos verificar a consistência.
- **Mode collapse per class.**Cada classe pode colapsar de forma independente.

## Usá-lo

2026 estado das tarefas de imagem em imagem:

| Task | Best approach |
|------|---------------|
| Sketch → photo, same domain, paired data | Pix2Pix / Pix2PixHD (still fast, still sharp) |
| Sketch → photo, unpaired | ControlNet with a Scribble conditioning model |
| Semantic seg → photo | SPADE / GauGAN2 or SD + ControlNet-Seg |
| Style transfer | Diffusion with IP-Adapter or LoRA; GAN methods are legacy |
| Depth → photo | ControlNet-Depth over Stable Diffusion |
| Super-resolution | Real-ESRGAN (GAN), ESRGAN-Plus, or SD-Upscale (diffusion) |
| Colorization | ColTran, diffusion-based colorizers, or Pix2Pix-color |
| Daytime → nighttime, seasons, weather | CycleGAN or ControlNet-based |

Pix2Pix continua a ser a ferramenta certa quando (a) você tem milhares de exemplos emparelhados, (b) a tarefa é estreita e repetível e (c) você precisa de inferência rápida. Em tarefas genéricas de domínio aberto, a difusão ganha.

## Envia-o

Salvar`outputs/skill-img2img-chooser.md`. A competência assume uma descrição da tarefa, a disponibilidade de dados (pareados vs. não-pareados, amostras N) e o orçamento de latência/qualidade, e em seguida, as saídas: abordagem (Pix2Pix, CycleGAN, variante ControlNet, SDXL + IP-Adapter), requisitos de dados de treinamento, custo de inferência e protocolo de avaliação (LPIPS, FID, específico de tarefa).

## Exercícios

1. **Easy.**Modificar`code/main.py`Confirme que o G ainda mapeia o ruído de cada classe para o modo correto.
2. **Medium.**Substituir o L1 por uma perda de estilo perceptivo na configuração 1-D (por exemplo, um pequeno D congelado que atua como extractor de características).
3. **Hard.**Esboçar um CycleGAN na configuração 1-D: duas distribuições, dois geradores, perda de ciclo. Mostrar que ele aprende a mapear entre eles sem dados emparelhados.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Conditional GAN | "GAN with labels" | G(z, c), D(x, c). Both networks see the condition. |
| Pix2Pix | "Image-to-image GAN" | Paired cGAN with U-Net G and PatchGAN D + L1 loss. |
| U-Net | "Encoder-decoder with skips" | Symmetric conv network; skips preserve high-freq. |
| PatchGAN | "Local-realism classifier" | D outputs per-patch score instead of global score. |
| CycleGAN | "Unpaired image translation" | Two G's + cycle-consistency loss; no paired data. |
| SPADE | "GauGAN" | Normalizes intermediate activations with the semantic map; segmentation-to-image. |
| FiLM | "Feature-wise linear modulation" | Per-feature affine transform from the condition; cheap conditioning. |

## Nota de produção: Pix2Pix como uma linha de base limitada à latência

Quando você combina dados e uma tarefa estreita (esquisa → renderização, mapa semântica → foto, dia → noite), a inferência de uma só vez da Pix2Pix supera a difusão em uma ordem de magnitude na latência.

| Path | Steps | Typical latency at 512² on a single L4 |
|------|-------|----------------------------------------|
| Pix2Pix (U-Net forward) | 1 | ~30 ms |
| SD-Inpaint or SD-Img2Img | 20 | ~1.2 s |
| SDXL-Turbo Img2Img | 1-4 | ~0.15-0.35 s |
| ControlNet + SDXL base | 20-30 | ~3-5 s |

Pix2Pix ganha em throughput em lotes estáticos (cada solicitação é a mesma FLOPs). Diffusão ganha na qualidade e generalização. O jogo moderno é muitas vezes enviar um modelo destilado estilo Pix2Pix para a tarefa estreita e uma falha de difusão para entradas de cauda.

## Mais leitura

- [Mirza & Osindero (2014). Conditional Generative Adversarial Nets](https://arxiv.org/abs/1411.1784)- o papel do CGAN.
- [Isola et al. (2017). Image-to-Image Translation with Conditional Adversarial Networks](https://arxiv.org/abs/1611.07004)- Pix2Pix.
- [Zhu et al. (2017). Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks](https://arxiv.org/abs/1703.10593) CycleGAN.
- [Wang et al. (2018). High-Resolution Image Synthesis with Conditional GANs](https://arxiv.org/abs/1711.11585)- Pix2PixHD.
- [Park et al. (2019). Semantic Image Synthesis with Spatially-Adaptive Normalization](https://arxiv.org/abs/1903.07291)- SPADE / Gaugan.
- [Miyato & Koyama (2018). cGANs with Projection Discriminator](https://arxiv.org/abs/1802.05637) a projecção D.
