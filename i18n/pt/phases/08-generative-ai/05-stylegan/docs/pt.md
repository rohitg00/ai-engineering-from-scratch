# StyleGAN

> A maioria dos geradores agita .$z$O StyleGAN divide-o: primeiro mapa$z$para um intermediário $w$, depois * injectar * $w$Essa única mudança desenroou o espaço latente e fez com que os rostos fotorrealistas fossem um problema resolvido durante sete anos consecutivos.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 08 (Normalization), Phase 3 · 07 (CNNs)
**Time:** ~45 minutes

## O problema

Um mapa DCGAN $z$A questão é:$z$Controlar tudo  pose, iluminação, identidade, fundo  entrelaçados.$z$Não se pode perguntar ao modelo "a mesma pessoa, diferentes posturas" porque a representação não faz tal factor.

Karras et al. (2019, NVIDIA) propôs: parar de alimentar $z$- Alimentação constante.`4×4×512`Aprenda um MLP de 8 camadas que mapeia $z \in Z \to w \in W$Injecção$w$em cada resolução através da * normalização de instância adaptativa* (AdaIN): normalizar cada mapa de características conv, em seguida, escalar e deslocar por projeções afínas de $w$Adicionar ruído por camada para obter detalhes estocásticos (poros da pele, fios de cabelo).

O resultado: $W$Tem eixos ortogonais para "estilo de alto nível" (posição, identidade) vs "estilo fino" (iluminação, cor).$w$para os níveis de baixa resolução e imagens B $w$Esta edição desbloqueada, estilização de domínio cruzado e toda a linha de pesquisa "StyleGAN-inversion".

## O conceito

![StyleGAN: mapping network + AdaIN + per-layer noise](../assets/stylegan.svg)

**Mapping network.** $f: Z \to W$, um MLP de 8 camadas.$Z = \mathcal{N}(0, I)^{512}$- Não .$W$Não é forçado a ser gaussiano.

**Synthesis network.**Começa com uma constante aprendida .`4×4×512`. Cada bloco de resolução: `upsample → conv → AdaIN(w_i) → noise → conv → AdaIN(w_i) → noise`Resoluções duplas: 4, 8, 16, 32, 64, 128, 256, 512, 1024.

**AdaIN.**

```math
\mathop{\mathrm{AdaIN}}(x, y) = y_{\text{scale}} \cdot \frac{x - \mathop{\mathrm{mean}}(x)}{\mathop{\mathrm{std}}(x)} + y_{\text{bias}}
```

onde$y_{\text{scale}}$E ...$y_{\text{bias}}$vêm de projecções afínas de $w$Normalize por mapa de características, depois restyle. "Style" aqui é a estatística de primeira e segunda ordem do mapa de características.

**Per-layer noise.**Som Gaussian de canal único adicionado a cada mapa de características, escalado por um fator por canal aprendido. Controla detalhes estocásticos sem afetar a estrutura global.

**Truncation trick.**Na inferência, amostra $z$, computação $w = \text{mapping}(z)$, então$w' = \hat{w} + \psi \cdot (w - \hat{w})$onde$\hat{w}$é a média$w$sobre muitas amostras. $\psi < 1$O estiloGAN é um modelo de estilo que é usado por todos os usuários.$\psi \approx 0.7$- Não .

## StyleGAN 1 → 2 → 3

| Version | Year | Innovation |
|---------|------|------------|
| StyleGAN | 2019 | Mapping network + AdaIN + noise + progressive growing. |
| StyleGAN2 | 2020 | Weight demodulation replaces AdaIN (fixes droplet artifacts); skip/residual architecture; path-length regularization. |
| StyleGAN3 | 2021 | Alias-free convolution + equivariant kernels; eliminates texture sticking to pixel grid. |
| StyleGAN-XL | 2022 | Class-conditional, 1024², ImageNet. |
| R3GAN | 2024 | Rebrands with stronger reg; closes gap to diffusion on FFHQ-1024 with 20x fewer params. |

Em 2026, o StyleGAN3 continua a ser o padrão para (a) fotorrealismo de domínio estreito com FPS elevado, (b) adaptação de domínio de poucas fotografias (train em um novo conjunto de dados com 100 imagens, mapeamento de congelamento), (c) edição baseada em inversão (encontre o $w$que reconstruir uma foto real, e depois editar isso.$w$Para o domínio aberto, texto-imagem, não é a ferramenta  difusão é.

```figure
gx-stylegan-mapping
```

## Construí-lo

`code/main.py`Implementa um brinquedo "style-GAN lite" em 1-D: um MLP de mapeamento, uma função de síntese que toma um vetor constante aprendido e o modula com $w$- a escala/bias derivadas e o ruído por camada.$w$através de correspondências de modulação afina ou batimentos concatenando $z$- O que é que é?

### Passo 1: rede de mapeamento

```python
def mapping(z, M):
    h = z
    for i in range(num_layers):
        h = leaky_relu(add(matmul(M[f"W{i}"], h), M[f"b{i}"]))
    return h
```

### Passo 2: Normalização de instância adaptativa

```python
def adain(x, w_scale, w_bias):
    mu = mean(x)
    sd = std(x)
    x_norm = [(xi - mu) / (sd + 1e-8) for xi in x]
    return [w_scale * xi + w_bias for xi in x_norm]
```

A escala e o viés de mapas de características vêm de $w$através de projecção linear.

### Passo 3: ruído por camada

```python
def add_noise(x, sigma, rng):
    return [xi + sigma * rng.gauss(0, 1) for xi in x]
```

Sigma por canal é apropriado.

## Encurralagens

- **Droplet artifacts.**O StyleGAN 1 produziu uma gota de manchas nos mapas de recursos porque o AdaIN zeroou o meio. A desmodulação de peso do StyleGAN 2 corrige-o escalando os pesos de convolução em vez disso.
- **Texture sticking.**As texturas StyleGAN 1 e 2 seguiram as coordenadas de pixel, não as coordenadas de objeto (visíveis quando interpoladas).
- **Mode coverage.**Truncation `ψ < 0.7`Parece limpo mas amostras de um cone estreito; uso `ψ = 1.0`Se precisarem de diversidade.
- **Inversion is lossy.**Inverter uma foto real em $W$O resultado é geralmente feito através de otimização ou um codificador (e4e, ReStyle, HyperStyle).

## Usá-lo

| Use case | Approach |
|----------|----------|
| Photoreal human faces (anime, product, narrow) | StyleGAN3 FFHQ / custom fine-tune |
| Face editing from a photo | e4e inversion + StyleSpace / InterFaceGAN directions |
| Face swap / reenactment | StyleGAN + encoder + blending |
| Avatar pipelines | StyleGAN3 w/ ADA for low-data fine-tune |
| Domain adaptation from a few images | Freeze mapping network, fine-tune synthesis |
| Multi-modal or text-conditioned generation | Don't — use diffusion |

Para demonstrações de qualidade de produto onde a resposta é "foto do rosto de uma pessoa", o StyleGAN supera a difusão em custo de inferência (passante único para frente, <10ms em um 4090) e nitidez para a mesma barra de qualidade.

## Envia-o

Salvar`outputs/skill-stylegan-inversion.md`. A competência toma uma foto real e as saídas: método de inversão (e4e / ReStyle / HyperStyle), perda latente esperada, orçamento de edição (quão longe é o tempo de $W$O artigo 1.o do Tratado de Maastricht, que estabelece a política de política comum, é o seguinte:

## Exercícios

1. **Easy.**Corra .`code/main.py`com`adain_on=True`E ...`adain_on=False`Comparar a distribuição das saídas de um latente fixo com um latente perturbado.
2. **Medium.**Implementar regularização de mistura: para um lote de formação, computação $w_a$- Não .$w_b$, e aplicar $w_a$para a primeira metade da síntese e $w_b$O decodificador aprende estilos desenrolados?
3. **Hard.**Tome um modelo pré-treinado StyleGAN3 FFHQ (ffhq-1024.pkl).$w$Direcção que controla o "sorriso" através da formação de um SVM em amostras rotuladas; informe o que pode fazer antes de se desviar da identidade.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mapping network | "The MLP" | $f: Z \to W$, 8 layers, decouples latent geometry from data statistics. |
| W space | "The style space" | Output of the mapping network; roughly disentangled. |
| AdaIN | "Adaptive instance norm" | Normalize feature map, then scale + shift by $w$-projection. |
| Truncation trick | "Psi" | $w = \text{mean} + \psi \cdot (w - \text{mean})$, $\psi<1$ trades diversity for quality. |
| Path-length regularization | "PL reg" | Penalizes large changes in image per unit change in $w$; makes $W$ smoother. |
| Weight demodulation | "The StyleGAN2 fix" | Normalize conv weights instead of activations; kills droplet artifacts. |
| Alias-free | "StyleGAN3's trick" | Windowed sinc filters; eliminates texture sticking to the pixel grid. |
| Inversion | "Find w for a real image" | Optimize or encode $x \to w$ so $G(w) \approx x$. |

## Nota de produção: por que o StyleGAN ainda vai para 2026

O StyleGAN3 num 4090 gera uma face de 10242 FFHQ em menos de 10 ms  `num_steps = 1`Em termos de produção, esta é a latência de piso para qualquer gerador de imagem. Um tubo de decodificação SDXL + VAE de 50 passos com a mesma resolução é de ~ 3 segundos.**300× gap**, e para produtos de domínio restrito (serviços de avatares, canais de documentos de identificação, geração de imagens de estoque) ganha com o TCO.

Duas consequências operacionais:

- **No scheduler, no batcher.**O lote estático na ocupação alvo é otimizado. O lote contínuo (essencial para os LLM e a difusão) proporciona benefícios zero porque cada pedido recebe os mesmos FLOPs.
- **Truncation `ψ` is the safety knob.** `ψ < 0.7`A diferença entre a variância de amostra e a variância de um nível de variação de um nível de variação de um nível de variação de um nível de variação de um nível de variação de um nível de variação de um nível de variação de um nível de variação de um nível de variação de um nível de variação de um nível de variação de um nível de variação de uma variedade de variação de um nível de variação de um nível de variação de um nível de variação de um nível de variação de um nível de variação de uma variedade de variação de um nível de variação de um nível de variação de variação de um nível de variação de um nível de variação de variação de um nível de variação de variação de uma variedade de variação de um nível de variação de variação de uma variedade de variação de um nível de variação de variação de uma variedade de variação de um nível de variação de variação de uma variedade de variação de um nível de variação de variação de uma variedade de variação de uma variedade de variação de um nível de variação de variação de uma variedade de variação de uma variedade de variação de um nível de variação de uma variedade de uma variedade de variação de uma variedade de variação de uma variedade de variação de uma variedade de variação de uma variedade de variação de um nível de uma variedade de uma variedade de variação de uma variedade de variação de uma variedade de variação de uma variedade de variação de uma variedade de uma variedade de variação de uma variedade de variação de um nível de uma variedade de uma variedade de variação de uma variedade de variação de uma variedade de uma variedade de uma variedade de variação de uma variedade de um nível de uma variedade de uma variedade de uma variedade de uma variedade de uma variedade de variação de uma variedade de uma variedade de variação de um nível de uma variedade de uma variedade de uma variedade de uma variedade de uma variedade de uma variedade de um nível de uma variedade de uma variedade de um nível de uma variedade de uma variedade de uma variedade de um nível de uma variedade de uma variedade de`ψ`No pico de carga, eleva-o para os utilizadores premium.

## Mais leitura

- [Karras et al. (2019). A Style-Based Generator Architecture for GANs](https://arxiv.org/abs/1812.04948)- StyleGAN.
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958)- StyleGAN2.
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423)- StyleGAN3.
- [Tov et al. (2021). Designing an Encoder for StyleGAN Image Manipulation](https://arxiv.org/abs/2102.02766) inversão e4e.
- [Sauer et al. (2022). StyleGAN-XL: Scaling StyleGAN to Large Diverse Datasets](https://arxiv.org/abs/2202.00273)- StyleGAN-XL.
- [Huang et al. (2024). R3GAN: The GAN is dead; long live the GAN!](https://arxiv.org/abs/2501.05441) Recepta moderna de GAN mínimo.
