# StyleGAN

> A maioria dos generators mistura `z` em todas as camadas ao mesmo tempo. O StyleGAN separou isso: primeiro mapeia `z` para um `w` intermediário, depois *injeta* `w` em cada nível de resolução via AdaIN. Essa mudança única desentrelaçou o espaço latent e fez rostos fotorrealistas um problema resolvido por sete anos seguidos.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 8 · 03 (GANs), Fase 4 · 08 (Normalização), Fase 3 · 07 (CNNs)
**Tempo:** ~45 minutos

## O Problema

Um DCGAN mapeia `z` para uma imagem através de uma pilha de convoluções transpostas. O problema: `z` controla tudo — pose, iluminação, identidade, fundo — entrelaçados juntos. Move ao longo de um eixo de `z`, os quatro mudam. Você não consegue pedir ao modelo "mesma pessoa, pose diferente" porque a representação não fatora assim.

Karras et al. (2019, NVIDIA) propuseram: pare de alimentar `z` diretamente nas camadas conv. Alimente um tensor constante `4×4×512` como input da rede. Aprenda um MLP de 8 camadas que mapeia `z ∈ Z → w ∈ W`. Injete `w` em cada resolução via *normalização de instância adaptativa* (AdaIN): normaliza cada funcionalidade map de conv, depois escala e desloca com projeções afins de `w`. Adiciona ruído por camada para detalhes estocásticos (poros de pele, fios de cabelo).

O resultado: `W` tem eixos aproximadamente ortogonais para "estilo alto nível" (pose, identidade) vs "estilo fino" (iluminação, cor). Você pode trocar estilos entre duas imagens usando o `w` da imagem A para os níveis de baixa resolução e o `w` da imagem B para os altos. Isso desbloqueou edição, estilização cross-domain, e toda a linha de pesquisa de "inversão StyleGAN".

## O Conceito

![StyleGAN: rede de mapeamento + AdaIN + ruído por camada](../assets/stylegan.svg)

**Rede de mapeamento.** `f: Z → W`, um MLP de 8 camadas. `Z = N(0, I)^512`. `W` não é forçado a ser Gaussiano — aprende uma forma adaptada aos dados.

**Rede de síntese.** Começa de um constante aprendido `4×4×512`. Cada bloco de resolução: `upsample → conv → AdaIN(w_i) → ruído → conv → AdaIN(w_i) → ruído`. Resoluções dobram: 4, 8, 16, 32, 64, 128, 256, 512, 1024.

**AdaIN.**

```
AdaIN(x, y) = y_scale · (x - mean(x)) / std(x) + y_bias
```

onde `y_scale` e `y_bias` vêm de projeções afins de `w`. Normaliza por funcionalidade map, depois reestiliza. "Estilo" aqui são as estatísticas de primeira e segunda ordem do funcionalidade map.

**Ruído por camada.** Ruído Gaussiano de canal único adicionado a cada funcionalidade map, escalado por um fator por canal aprendido. Controla detalhes estocásticos sem afetar estrutura global.

**Truque de truncamento.** Na inferência, amostra `z`, calcula `w = mapping(z)`, depois `w' = ŵ + ψ·(w - ŵ)` onde `ŵ` é a média `w` de muitas amostras. `ψ < 1` troca diversidade por qualidade. Quase toda demo do StyleGAN usa `ψ ≈ 0.7`.

## StyleGAN 1 → 2 → 3

| Versão | Ano | Inovação |
|---------|------|------------|
| StyleGAN | 2019 | Rede de mapeamento + AdaIN + ruído + crescimento progressivo. |
| StyleGAN2 | 2020 | Demodulação de pesos substitui AdaIN (corrige artefatos de gota); arquitetura skip/residual; regularização de comprimento de caminho. |
| StyleGAN3 | 2021 | Convolução sem aliasing + kernels equivariantes; elimina textura grudada no grid de pixels. |
| StyleGAN-XL | 2022 | Condicional a classe, 1024², ImageNet. |
| R3GAN | 2024 | Reformulação com reg mais forte; fecha gap com difusão em FFHQ-1024 com 20x menos params. |

Em 2026 StyleGAN3 continua o padrão para (a) fotorrealismo de domínio estreito em alto FPS, (b) adaptação de domínio few-shot (treina em um novo dataset com 100 imagens, congela o mapeamento), (c) edição baseada em inversão (encontra o `w` que reconstrói uma foto real, depois edita esse `w`). Para texto-para-imagem de domínio aberto, não é a ferramenta — difusão é.

## Construa

`code/main.py` implementa um "estilo-GAN lite" de brinquedo em 1-D: um MLP de mapeamento, uma função de síntese que pega um vetor constante aprendido e o modula com scale/bias derivados de `w`, e ruído por camada. Mostra que injetar `w` via modulação afim combina ou supera concatenar `z` no input do generator.

### Passo 1: rede de mapeamento

```python
def mapping(z, M):
    h = z
    for i in range(num_layers):
        h = leaky_relu(add(matmul(M[f"W{i}"], h), M[f"b{i}"]))
    return h
```

### Passo 2: normalização de instância adaptativa

```python
def adain(x, w_scale, w_bias):
    mu = mean(x)
    sd = std(x)
    x_norm = [(xi - mu) / (sd + 1e-8) for xi in x]
    return [w_scale * xi + w_bias for xi in x_norm]
```

Scale e bias por funcionalidade map vêm de `w` via projeção linear.

### Passo 3: ruído por camada

```python
def add_noise(x, sigma, rng):
    return [xi + sigma * rng.gauss(0, 1) for xi in x]
```

Sigma por canal é aprendível.

## Armadilhas

- **Artefatos de gota.** StyleGAN 1 produzia uma gota borrada nos funcionalidade maps porque AdaIN zerava a média. A demodulação de pesos do StyleGAN 2 corrige escalando os pesos de convolução no lugar.
- **Textura grudada.** As texturas do StyleGAN 1 e 2 seguiam coordenadas de pixel, não coordenadas do objeto (visível ao interpolar). As convoluções sem aliasing do StyleGAN 3 corrigem com filtros janelados sinc.
- **Cobertura de modo.** Truncamento `ψ < 0.7` parece limpo mas amostra de um cone estreito; use `ψ = 1.0` se precisar de diversidade.
- **Inversão é lossy.** Inverter uma foto real em `W` geralmente é feito via otimização ou um encoder (e4e, ReStyle, HyperStyle). Resultados derivam ao longo de muitas iterações.

## Use

| Caso de uso | Abordagem |
|----------|----------|
| Rostos fotorrealistas (anime, produto, estreito) | StyleGAN3 FFHQ / fine-tune custom |
| Edição de rosto a partir de foto | Inversão e4e + direções StyleSpace / InterFaceGAN |
| Troca de rosto / reenactment | StyleGAN + encoder + blending |
| Pipelines de avatar | StyleGAN3 com ADA para fine-tune com poucos dados |
| Adaptação de domínio com poucas imagens | Congela rede de mapeamento, fine-tune a síntese |
| Geração multimodal ou condicionada por texto | Não use — use difusão |

Para demos de nível de produto onde a resposta é "foto do rosto de uma pessoa", StyleGAN supera difusão em custo de inferência (forward pass único, <10ms em 4090) e nitidez para a mesma barra de qualidade.

## Entregue

Salve `outputs/skill-stylegan-inversion.md`. Skill recebe uma foto real e gera: método de inversão (e4e / ReStyle / HyperStyle), loss latent esperada, orçamento de edição (quão longe em `W` você pode mover antes de artefatos), e uma lista de direções de edição conhecidas e boas (idade, expressão, pose).

## Exercícios

1. **Fácil.** Execute `code/main.py` com `adain_on=True` e `adain_on=False`. Compare a dispersão das saídas para latent fixo vs latent perturbado.
2. **Médio.** Implemente regularização de mixing: para um batch de treinamento, compute `w_a`, `w_b`, e aplique `w_a` na primeira metade da síntese e `w_b` na segunda metade. O decoder aprende estilos desentrelaçados?
3. **Difícil.** Pegue um modelo StyleGAN3 FFHQ pré-treinado (ffhq-1024.pkl). Encontre a direção `w` que controla "sorriso" treinando um SVM em amostras rotuladas; reporte quão longe você pode empurrar antes da identidade derivar.

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|-----------------|-----------------------|
| Rede de mapeamento | "O MLP" | `f: Z → W`, 8 camadas, desacopla geometria latent de estatísticas dos dados. |
| Espaço W | "O espaço de estilo" | Saída da rede de mapeamento; aproximadamente desentrelaçado. |
| AdaIN | "Normalização de instância adaptativa" | Normaliza funcionalidade map, depois escala + desloca por projeção de `w`. |
| Truque de truncamento | "Psi" | `w = média + ψ·(w - média)`, ψ<1 troca diversidade por qualidade. |
| Regularização de comprimento de caminho | "PL reg" | Penaliza grandes mudanças na imagem por unidade de mudança em `w`; torna `W` mais suave. |
| Demodulação de pesos | "A correção do StyleGAN2" | Normaliza pesos de conv em vez de ativações; elimina artefatos de gota. |
| Sem aliasing | "Truque do StyleGAN3" | Filtros janelados sinc; elimina textura grudada no grid de pixels. |
| Inversão | "Encontra w para uma imagem real" | Otimiza ou codifica `x → w` para que `G(w) ≈ x`. |

## Nota de produção: por que StyleGAN ainda distribui em 2026

StyleGAN3 em uma 4090 gera um rosto FFHQ de 1024² em menos de 10 ms — `num_steps = 1`, sem decode de VAE, sem passo de cross-attention. Em termos de produção isso é a latência mínima para qualquer gerador de imagem. Um pipeline SDXL + decode de VAE de 50 passos na mesma resolução é ~3 segundos. Isso é uma **lacuna de 300x**, e para produtos de domínio estreito (serviços de avatar, pipelines de documentos de identidade, geração de rostos para stock) vence em TCO.

Duas consequências operacionais:

- **Sem scheduler, sem batcher.** Batch estável na ocupação alvo é ótimo. Batch contínuo (essencial para LLMs e difusão) não traz benefício porque cada request tem os mesmos FLOPs.
- **Truncamento `ψ` é o parâmetro de segurança.** `ψ < 0.7` amostra de um cone estreito do alcance da rede de mapeamento. Essa é a única alavanca que a camada de serving tem sobre a variância das amostras. Reduza `ψ` no pico de carga, aumente para usuários premium.

## Leitura Adicional

- [Karras et al. (2019). A Style-Based Generator Architecture for GANs](https://arxiv.org/abs/1812.04948) — StyleGAN.
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) — StyleGAN2.
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) — StyleGAN3.
- [Tov et al. (2021). Designing an Encoder for StyleGAN Image Manipulation](https://arxiv.org/abs/2102.02766) — inversão e4e.
- [Sauer et al. (2022). StyleGAN-XL: Scaling StyleGAN to Large Diverse Datasets](https://arxiv.org/abs/2202.00273) — StyleGAN-XL.
- [Huang et al. (2024). R3GAN: The GAN is dead; long live the GAN!](https://arxiv.org/abs/2501.05441) — receita moderna de GAN mínimo.
