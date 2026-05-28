# GANs Condicionais & Pix2Pix

> O primeiro grande desbloqueio de 2014-2017 foi controlar o que uma GAN faz. Anexa um label, ou uma imagem, ou uma frase. Pix2Pix fez a versão de imagem e ainda supera qualquer modelo texto-para-imagem genérico em tarefas imagem-para-imagem estreitas.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 8 · 03 (GANs), Fase 4 · 06 (U-Net), Fase 3 · 07 (CNNs)
**Tempo:** ~75 minutos

## O Problema

Uma GAN incondicional amostra rostos arbitrários. Útil para demo, inútil em produção. Você quer: *mapear um esboço para uma foto*, *mapear um mapa para uma foto aérea*, *mapear uma cena diurna para noturna*, *colorir uma imagem em escala de cinza*. Em todas essas, você recebe uma imagem de entrada `x` e precisa gerar `y` com alguma correspondência semântica. Existem muitos `y`s plausíveis para cada `x`. Erro médio quadrático achata eles em papa. Uma loss adversarial não, porque "parece real" é nítido.

GAN Condicional (Mirza & Osindero, 2014) adiciona uma condição `c` como input tanto para `G` quanto para `D`. Pix2Pix (Isola et al., 2017) eespecificaçãoializou isso: condição é uma imagem de entrada completa, generator é um U-Net, discriminator é um classificador *baseado em patches* (PatchGAN), e loss é adversarial + L1. Essa receita supera modelos texto-para-imagem feitos do zero em domínios imagem-para-imagem estreitos mesmo em 2026 porque é treinada em *dados pareados* — você tem exatamente o sinal que precisa.

## O Conceito

![Pix2Pix: U-Net generator, PatchGAN discriminator](../assets/pix2pix.svg)

**G Condicional.** `G(x, z) → y`. No Pix2Pix, `z` é dropout dentro do G (sem ruído de entrada — Isola descobriu que ruído explícito era ignorado).

**D Condicional.** `D(x, y) → [0, 1]`. Input é o *par* (condição, saída). Essa é a diferença chave: D precisa julgar se `y` é consistente com `x`, não só se `y` parece real.

**U-Net generator.** Encoder-decoder com skip connections através do gargalo. Crítico para tarefas onde entrada e saída compartilham estrutura de baixo nível (bordas, silhueta). Sem os skips, detalhes de alta frequência somem.

**PatchGAN discriminator.** Em vez de sair um único score real/falso, D sai um grid `N×N` onde cada célula julga um campo receptivo de ~70×70 pixels. Média. Essa é uma suposição de campo aleatório Markoviano: realismo é local. Muito mais rápido de treinar, menos parâmetros, saída mais nítida.

**Loss.**

```
loss_G = -log D(x, G(x)) + λ · ||y - G(x)||_1
loss_D = -log D(x, y) - log (1 - D(x, G(x)))
```

O termo L1 estabiliza o treinamento e puxa G para o alvo conhecido. L1 dá bordas mais nítidas que L2 (medianas, não médias). `λ = 100` era o padrão do Pix2Pix.

## CycleGAN — quando você não tem pares

Pix2Pix precisa de dados `(x, y)` pareados. CycleGAN (Zhu et al., 2017) elimina esse requisito ao custo de uma loss extra: a loss de *consistência ciclica*. Dois generators `G: X → Y` e `F: Y → X`. Treine eles para que `F(G(x)) ≈ x` e `G(F(y)) ≈ y`. Isso permite traduzir cavalos em zebras, verão em inverno, sem exemplos pareados.

Em 2026, imagem-para-imagem não pareada é feita principalmente via difusão (ControlNet, IP-Adapter) em vez de CycleGAN, mas a ideia de consistência ciclica sobrevive em quase todo paper de adaptação de domínio não pareado.

## Construa

`code/main.py` implementa uma GAN condicional minúscula em dados 1-D. A condição `c` é um label de classe (0 ou 1). A tarefa: produzir uma amostra da distribuição condicional para a classe dada.

### Passo 1: anexa condição nos inputs de G e D

```python
def G(z, c, params):
    return mlp(concat([z, one_hot(c)]), params)

def D(x, c, params):
    return mlp(concat([x, one_hot(c)]), params)
```

Codificação one-hot é o caminho mais simples. Modelos maiores usam embeddings aprendidos, modulação FiLM ou cross-attention.

### Passo 2: treina condicional

```python
for step in range(steps):
    x, c = sample_real_conditional()
    noise = sample_noise()
    update_D(x_real=x, x_fake=G(noise, c), c=c)
    update_G(noise, c)
```

O generator precisa combinar a distribuição real *para a condição dada*, não a marginal.

### Passo 3: verificação de saída por classe

```python
for c in [0, 1]:
    samples = [G(noise, c) for noise in batch]
    mean_c = mean(samples)
    assert_near(mean_c, real_mean_for_class_c)
```

## Armadilhas

- **Condição ignorada.** G aprende a marginalizar, D nunca penaliza porque o sinal de condição é fraco. Solução: condicione D mais agressivamente (camada inicial, não só final), use discriminator de projeção (Miyato & Koyama 2018).
- **Peso L1 baixo demais.** G deriva para saídas reais-arbitrárias, não fiéis. Comece com λ≈100 para tarefas estilo Pix2Pix.
- **Peso L1 alto demais.** G produz saídas borradas porque L1 ainda é uma norma L_p. Reduza quando o treinamento estabilizar.
- **Vazamento de ground-truth em D.** Concatene `(x, y)` como input de D, não só `y`. Sem isso D não pode verificar consistência.
- **Colapso de modo por classe.** Cada classe pode colapsar independentemente. Rode checagens de diversidade por classe condicional.

## Use

Estado da arte em tarefas imagem-para-imagem em 2026:

| Tarefa | Melhor abordagem |
|------|---------------|
| Esboço → foto, mesmo domínio, dados pareados | Pix2Pix / Pix2PixHD (ainda rápido, ainda nítido) |
| Esboço → foto, não pareado | ControlNet com modelo de condicionamento Scribble |
| Seg semântica → foto | SPADE / GauGAN2 ou SD + ControlNet-Seg |
| Transferência de estilo | Difusão com IP-Adapter ou LoRA; métodos GAN são legado |
| Profundidade → foto | ControlNet-Depth sobre Stable Diffusion |
| Super-resolução | Real-ESRGAN (GAN), ESRGAN-Plus ou SD-Upscale (difusão) |
| Colorização | ColTran, colorizadores baseados em difusão ou Pix2Pix-color |
| Dia → noite, estações, clima | CycleGAN ou baseado em ControlNet |

Pix2Pix continua sendo a ferramenta certa quando (a) você tem milhares de exemplos pareados, (b) a tarefa é estreita e repetível, e (c) você precisa de inferência rápida. Em tarefas genéricas de domínio aberto, difusão vence.

## Entregue

Salve `outputs/skill-img2img-chooser.md`. Skill recebe uma descrição de tarefa, disponibilidade de dados (pareado vs não pareado, N amostras) e orçamento de latência/qualidade, e gera: abordagem (Pix2Pix, CycleGAN, variante ControlNet, SDXL + IP-Adapter), requisitos de dados de treinamento, custo de inferência e protocolo de avaliação (LPIPS, FID, eespecificaçãoífico da tarefa).

## Exercícios

1. **Fácil.** Modifique `code/main.py` para adicionar uma terceira classe. Confirme que G ainda mapeia o ruído de cada classe para o modo correto.
2. **Médio.** Substitua L1 por uma loss de estilo perceptual no cenário 1-D (ex: um D pequeno congelado funcionando como extrator de features). Isso muda a nitidez da distribuição condicional?
3. **Difícil.** Esboce um CycleGAN no cenário 1-D: duas distribuições, dois generators, loss ciclica. Mostre que ele aprende a mapear entre elas sem dados pareados.

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|-----------------|-----------------------|
| GAN Condicional | "GAN com rótulos" | G(z, c), D(x, c). Ambas as redes veem a condição. |
| Pix2Pix | "GAN imagem-para-imagem" | cGAN pareado com U-Net G e PatchGAN D + loss L1. |
| U-Net | "Encoder-decoder com skips" | Rede conv simétrica; skips preservam alta-freq. |
| PatchGAN | "Classificador de realismo local" | D sai score por patch em vez de score global. |
| CycleGAN | "Tradução de imagem não pareada" | Dois Gs + loss de consistência ciclica; sem dados pareados. |
| SPADE | "GauGAN" | Normaliza ativações intermediárias com o mapa semântico; segmentação para imagem. |
| FiLM | "Modulação linear por feature" | Transformada afim por funcionalidade vindas da condição; condicionamento barato. |

## Nota de produção: Pix2Pix como baseline limitado por latência

Quando você tem dados pareados e uma tarefa estreita (esboço → render, mapa semântico → foto, dia → noite), a inferência one-shot do Pix2Pix supera difusão por uma ordem de magnitude em latência. A comparação de produção é geralmente:

| Caminho | Passos | Latência típica em 512² em L4 única |
|------|-------|----------------------------------------|
| Pix2Pix (forward U-Net) | 1 | ~30 ms |
| SD-Inpaint ou SD-Img2Img | 20 | ~1.2 s |
| SDXL-Turbo Img2Img | 1-4 | ~0.15-0.35 s |
| ControlNet + SDXL base | 20-30 | ~3-5 s |

Pix2Pix vence em throughput em batches estáticos (cada request tem os mesmos FLOPs). Difusão vence em qualidade e generalização. O jogo moderno é frequentemente distribuir um modelo destilado estilo Pix2Pix para a tarefa estreita e uma alternativa de difusão para inputs de cauda.

## Leitura Adicional

- [Mirza & Osindero (2014). Conditional Generative Adversarial Nets](https://arxiv.org/abs/1411.1784) — o paper cGAN.
- [Isola et al. (2017). Image-to-Image Translation with Conditional Adversarial Networks](https://arxiv.org/abs/1611.07004) — Pix2Pix.
- [Zhu et al. (2017). Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks](https://arxiv.org/abs/1703.10593) — CycleGAN.
- [Wang et al. (2018). High-Resolution Image Synthesis with Conditional GANs](https://arxiv.org/abs/1711.11585) — Pix2PixHD.
- [Park et al. (2019). Semantic Image Synthesis with Spatially-Adaptive Normalization](https://arxiv.org/abs/1903.07291) — SPADE / GauGAN.
- [Miyato & Koyama (2018). cGANs with Projection Discriminator](https://arxiv.org/abs/1802.05637) — o D de projeção.
