# GANs — Generator vs Discriminator

> O truque do Goodfellow em 2014 foi pular a densidade inteiramente. Duas redes. Uma faz falsos. Uma pega eles. Elas brigam até os falsos serem indistinguíveis dos reais. Não deveria funcionar. Frequentemente não funciona. Quando funciona, as amostras ainda são as mais nítidas da literatura para domínios estreitos.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 3 · 02 (Backprop), Fase 3 · 08 (Otimizadores), Fase 8 · 02 (VAE)
**Tempo:** ~75 minutos

## O Problema

VAEs produzem amostras borradas porque a loss MSE do decoder é Bayes-ótima para a imagem *média* — e a média de muitos dígitos plausíveis é um dígito borrado. Você quer uma loss que recompense *plausibilidade*, não proximidade pixel-a-pixel com algum alvo. Não existe forma fechada para plausibilidade. Você tem que aprender.

A ideia do Goodfellow: treinar um classificador `D(x)` para distinguir imagens reais de falsas. Treinar um gerador `G(z)` para enganar `D`. O sinal de loss para `G` é o que `D` atualmente acha que faz algo parecer real. Esse sinal atualiza conforme `G` melhora, perseguindo um alvo em movimento. Se ambas as redes convergem, `G` aprendeu a distribuição dos dados sem nunca escrever `log p(x)`.

Isso é treinamento adversarial. A matemática é um jogo minimax:

```
min_G max_D  E_real[log D(x)] + E_fake[log(1 - D(G(z)))]
```

Em 2026 GANs não são mais o gerador SOTA (difusão e flow matching tomaram essa coroa). Mas StyleGAN 2/3 continuam os modelos de rosto mais nítidos já distribuídos, discriminadores de GAN são usados como *losses perceptuais* no treinamento de difusão, e treinamento adversarial alimenta as destilações rápidas de 1 passo (SDXL-Turbo, SD3-Turbo, LCM) que permitem distribuir difusão em tempo real.

## O Conceito

![Treinamento GAN: generator e discriminator em minimax](../assets/gan.svg)

**Generator `G(z)`.** Mapeia um vetor de ruído `z ~ N(0, I)` para uma amostra `x̂`. Uma rede em forma de decoder (dense ou convolução transposta).

**Discriminator `D(x)`.** Mapeia uma amostra para uma probabilidade escalar (ou score). Real → 1, falso → 0.

**Loss.** Duas atualizações alternadas:

- **Treinar `D`:** `loss_D = -[ log D(x) + log(1 - D(G(z))) ]`. Entropia cruzada binária real=1, falso=0.
- **Treinar `G`:** `loss_G = -log D(G(z))`. Essa é a forma *não saturante* que Goodfellow usou (o original `log(1 - D(G(z)))` satura e mata gradientes quando `D` está confiante).

**Loop de treinamento.** Um passo de `D`, um passo de `G`. Repita.

**Por que funciona.** Se `G` combina perfeitamente `p_data`, então `D` não consegue fazer melhor que azar e sai 0.5 em todo lugar; `G` não ganha mais gradiente. Equilíbrio.

**Por que quebra.** Colapso de modo (`G` encontra um modo que `D` não consegue classificar e gera ele pra sempre), gradiente evanescente (`D` aprende rápido demais e `log D` satura), instabilidade de treinamento (taxas de aprendizado, tamanhos de lote, qualquer coisa).

## Variantes que fizeram GANs funcionarem

| Ano | Inovação | Solução |
|------|------------|-----|
| 2015 | DCGAN | Conv/deconv, batch norm, LeakyReLU — a primeira arquitetura estável. |
| 2017 | WGAN, WGAN-GP | Substitui BCE por distância Wasserstein + penalidade de gradiente. Corrige gradiente evanescente. |
| 2017 | Normalização eespecificaçãotral | Limita Lipschitz do discriminator. Ainda usado em discriminadores em 2026. |
| 2018 | Progressive GAN | Treina low-res primeiro, adiciona camadas. Primeiros resultados de megapixel. |
| 2019 | StyleGAN / StyleGAN2 | Rede de mapeamento + norma de instância adaptativa. State-of-the-art em fotorrealismo de domínio fixo. |
| 2021 | StyleGAN3 | Sem aliasing, equivariante a translação — ainda o padrão ouro para rostos em 2026. |
| 2022 | StyleGAN-XL | Condicional, awareness de classe, maior escala. |
| 2024 | R3GAN | Reformulação com regularização mais forte; funciona em 1024² sem truques. |

## Construa

`code/main.py` treina uma GAN minúscula em dados 1-D: uma mistura de duas Gaussianas. Generator e discriminator são MLPs de uma camada oculta. Implementamos forward, backward e o loop minimax à mão. O objetivo é ver os dois modos de falha principais (colapso de modo + gradiente evanescente) acontecendo.

### Passo 1: loss não saturante

A loss vanilla do Goodfellow `log(1 - D(G(z)))` vai a zero quando D classifica o falso de G como falso com alta confiança. Nesse ponto o gradiente de G é basicamente zero — G não pode melhorar. A forma não saturante `-log D(G(z))` tem o assíntoto oposto: explode quando D está confiante, dando a G um sinal forte.

```python
def g_loss(d_fake):
    # maximizar log D(G(z))  <=>  minimizar -log D(G(z))
    return -sum(math.log(max(p, 1e-8)) for p in d_fake) / len(d_fake)
```

### Passo 2: um passo de discriminator por passo de generator

```python
for step in range(steps):
    # treinar D
    real_batch = sample_real(batch_size)
    fake_batch = [G(z) for z in sample_noise(batch_size)]
    update_D(real_batch, fake_batch)

    # treinar G
    fake_batch = [G(z) for z in sample_noise(batch_size)]  # falsos frescos
    update_G(fake_batch)
```

Falsos frescos para G, caso contrário os gradientes estão stale.

### Passo 3: observe o colapso de modo

```python
if step % 200 == 0:
    samples = [G(z) for z in sample_noise(500)]
    mode_a = sum(1 for s in samples if s < 0)
    mode_b = 500 - mode_a
    if min(mode_a, mode_b) < 50:
        print("  [!] colapso de modo: um modo está sendo estrelado")
```

O sintoma canônico: um dos dois modos reais para de ser gerado. O discriminator para de corrigir porque nunca viu como falso.

## Armadilhas

- **Discriminator forte demais.** Reduza a taxa de aprendizado de D em 2-5x, ou adicione ruído de instância/camada. Se D chega a >95% de acurácia, G está morto.
- **Generator memoriza um modo.** Adicione ruído nos inputs de D, use uma camada minibatch-discriminator, ou mude para WGAN-GP.
- **Estatísticas vazando do batch norm.** Batch real + batch falso passando pela mesma camada BN mistura estatísticas. Use norma de instância ou norma eespecificaçãotral no lugar.
- **Jogo no inception score.** FID e IS são ruidosos em contagens baixas de amostras. Use ≥10k amostras na avaliação.
- **Amostragem one-shot é mentira para tarefas condicionais.** Você ainda precisa de escalas CFG, truques de truncamento e re-amostragem para ter saídas utilizáveis.

## Use

A stack de GANs em 2026:

| Situação | Escolha |
|-----------|------|
| Rostos fotorrealistas, pose fixa | StyleGAN3 (mais nítido, menor) |
| Anime / rostos estilizados | StyleGAN-XL ou LoRA do Stable Diffusion |
| Tradução imagem-para-imagem | Pix2Pix / CycleGAN (Fase 8 · 04) ou ControlNet (Fase 8 · 08) |
| Texto-para-imagem rápido 1 passo | Destilação adversarial de difusão (SDXL-Turbo, SD3-Turbo) |
| Loss perceptual dentro de um treinador de difusão | Discriminator de GAN pequeno em crops de imagem |
| Qualquer coisa multimodal, aberta | Não use — use difusão ou flow matching |

GANs são nítidas mas estreitas. Quando seu domínio abre — fotos, prompts de texto arbitrários, vídeo — mude para difusão. O truque adversarial sobrevive como componente (losses perceptuais, destilação), não como gerador isolado.

## Entregue

Salve `outputs/skill-gan-debugger.md`. Skill recebe uma execução de GAN com falha (curvas de loss, grid de amostras, tamanho do dataset) e gera uma lista ranqueada de causas prováveis, correções de uma linha e um protocolo de re-execução.

## Exercícios

1. **Fácil.** Execute `code/main.py` com as configurações padrão. Depois defina `D_LR = 5 * G_LR` e re-execute. Quão rápido a loss de G colapsa para uma constante?
2. **Médio.** Substitua a loss BCE do Goodfellow pela loss WGAN: `loss_D = E[D(fake)] - E[D(real)]`, `loss_G = -E[D(fake)]`, e recorte os pesos de D para `[-0.01, 0.01]`. O treinamento fica mais estável? Compare o tempo de parede para convergir.
3. **Difícil.** Estenda o exemplo 1-D para dados 2-D (mistura de 8 Gaussianas num anel). Rastreie quantos dos 8 modos o generator captura nos passos 1k, 5k, 10k. Implemente minibatch discrimination e meça novamente.

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|-----------------|-----------------------|
| Generator | "G" | Rede de ruído para amostra, `G: z → x̂`. |
| Discriminator | "D" | Classificador `D: x → [0, 1]`, real vs falso. |
| Minimax | "O jogo" | `min_G max_D` de um objetivo conjunto. |
| Loss não saturante | "A correção" | Use `-log D(G(z))` para G em vez de `log(1 - D(G(z)))`. |
| Colapso de modo | "G memorizou uma coisa" | Generator produz poucas saídas distintas apesar de dados diversos. |
| WGAN | "Wasserstein" | Substitui BCE por distância Earth-Mover + penalidade de gradiente; gradiente mais suave. |
| Norma eespecificaçãotral | "Truque de Lipschitz" | Restringe normas dos pesos de D para limitar inclinação; estabiliza treinamento. |
| StyleGAN | "O que funciona" | Rede de mapeamento + AdaIN; melhor da classe para rostos, ainda em 2026. |

## Nota de produção: inferência one-shot é a vantagem duradoura das GANs

GANs não vencem mais em qualidade de amostra para geração de domínio aberto, mas ainda vencem em custo de inferência. Na linguagem da literatura de inferência em produção, uma GAN tem:

- **Sem prefill, sem estágios de decode.** Um único forward pass de `G(z)`. TTFT ≈ latência total.
- **Sem pressão de KV-cache.** O único estado são os pesos. Tamanho do lote é limitado por memória de ativação, não cache.
- **Batch contínuo trivial.** Como cada request tem os mesmos FLOPs fixos, um batch estável na ocupação alvo do servidor é geralmente ótimo. Nenhum agendador in-flight necessário.

É por isso que destilação de GAN (SDXL-Turbo, SD3-Turbo, ADD, LCM) é a técnica dominante para texto-para-imagem rápido em 2026: colapsa um pipeline de difusão de 20-50 passos em 1-4 forward passes estilo GAN mantendo a distribuição de uma base de difusão. A loss adversarial sobrevive como um parâmetro de treinamento para transformar geradores lentos em rápidos.

## Leitura Adicional

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) — o paper original das GAN.
- [Radford et al. (2015). Unsupervised Representation Learning with DCGAN](https://arxiv.org/abs/1511.06434) — a primeira arquitetura estável.
- [Arjovsky, Chintala, Bottou (2017). Wasserstein GAN](https://arxiv.org/abs/1701.07875) — WGAN.
- [Miyato et al. (2018). Spectral Normalization for GANs](https://arxiv.org/abs/1802.05957) — SN.
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) — StyleGAN2.
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) — StyleGAN3.
- [Sauer et al. (2023). Adversarial Diffusion Distillation](https://arxiv.org/abs/2311.17042) — SDXL-Turbo.
