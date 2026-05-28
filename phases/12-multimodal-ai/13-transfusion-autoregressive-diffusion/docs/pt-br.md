# Transfusion: Texto Autoregressivo + Imagem por Difusão em Um Só Transformer

> Chameleon e Emu3 apostaram tudo em tokens discretos. Funcionam, mas o gargalo da quantização é visível — a qualidade de imagem fica abaixo de modelos de difusão em espaço contínuo. Transfusion (Meta, Zhou et al., agosto 2024) faz a aposta oposta: mantém imagens contínuas, elimina o VQ-VAE completamente, e treina um transformer com duas losses. Tokens de texto recebem previsão de próximo token. Patches de imagem recebem uma loss de fluxo-matching / difusão. Ambos os objetivos otimizam os mesmos pesos. A arquitetura subjacente ao Stable Diffusion 3 (MMDiT) é uma prima de sangue. Esta aula analisa a tese do Transfusion, constrói um treinador toy de duas losses, e rastreia a máscara de attention que permite um transformer fazer os dois trabalhos.

**Tipo:** Construção
**Linguagens:** Python (stdlib, treinador de duas losses em escala toy MNIST)
**Pré-requisitos:** Fase 12 · 11 (Chameleon), Fase 8 (IA Generativa)
**Tempo:** ~180 minutos

## Objetivos de Aprendizado

- Conectar um transformer que roda duas losses (NTP em tokens de texto, MSE de difusão em patches de imagem) em uma backbone.
- Explicar por que attention bidirecional entre patches de imagem mais attention causal sobre tokens de texto é a escolha certa de máscara.
- Comparar estilo Transfusion (imagens contínuas, loss de difusão) com estilo Chameleon (imagens discretas, NTP) em compute, qualidade e complexidade de código.
- Nomear a contribuição do MMDiT: pesos específicos por modalidade em cada bloco, attention conjunta no fluxo residual.

## O Problemo

O debate entre tokens de imagem discretos vs contínuos é mais velho que LLMs. Representações contínuas (pixels brutos, latentes VAE) preservam detalhe. Tokens discretos (índices VQ) se encaixam no vocabulário nativo do transformer, mas perdem detalhe na etapa de quantização.

Chameleon / Emu3 foram pro lado discreto: uma loss, uma arquitetura, mas fidelidade de imagem limitada pela qualidade do tokenizer.

Modelos de difusão foram pro contínuo: qualidade de imagem excepcional, mas modelo separado do LLM, engenharia complexa de cronograma de ruído, e sem integração limpa com geração de texto.

Transfusion pergunta: podemos ter os dois? Manter imagens contínuas, ainda treinar um modelo, usar duas losses costuradas em um único step de gradiente.

## O Conceito

### A arquitetura de duas losses

Um único transformer decoder-only processa uma sequência que contém:

- Tokens de texto (discretos, do vocabulário BPE).
- Patches de imagem (contínuos, blocos de 16x16 pixels projetados na dimensão oculta via embedding linear — igual à entrada de um encoder ViT).
- Tags `<image>` e `</image>` marcando onde ficam os patches contínuos.

O passo forward roda uma vez. A loss escolhe uma de duas cabeças por token:

- Pra tokens de texto: entropia cruzada padrão na cabeça de logits do vocabulário.
- Pra patches de imagem: loss de difusão em patches contínuos — prever o ruído que foi adicionado em cada patch.

O gradiente flui pelo corpo compartilhado do transformer. Ambas as losses melhoram os pesos compartilhados simultaneamente.

### Máscara de attention: texto causal + imagem bidirecional

Tokens de texto precisam ser causais — você não pode deixar um token de texto olhar pra texto futuro, senão o teacher forcing quebra. Patches de imagem, por outro lado, representam um snapshot; eles devem se olhar bidirecionalmente dentro do mesmo bloco de imagem.

A máscara:

```
M[i, j] = 1 se:
  (i é texto e j é texto e j <= i)   # causal pra texto
  OU (i é imagem e j é imagem e same_image_block(i, j))   # bidirecional dentro da imagem
  OU (i é texto e j é imagem e j < i_image_end)   # texto olha pra imagens anteriores
  OU (i é imagem e j é texto e j < i_image_start)   # imagem olha pra texto anterior
```

Implementada como máscara bloco-triangular no treinamento e inferência.

### Loss de difusão dentro do transformer

A loss de difusão é padrão: adiciona ruído num patch de imagem, pede pro modelo prever o ruído (ou o patch limpo, equivalentemente). A versão do Transfusion usa fluxo-matching — prever o campo de velocidade do pro limpo.

Durante o treinamento:
1. Pra cada patch de imagem x0, amostra um timestep t aleatório.
2. Amostra ruído ε, calcula xt = (1-t) * x0 + t * ε (interpolação linear pra fluxo-matching).
3. O transformer prevê v_theta(xt, t); loss = MSE(v_theta(xt, t), ε - x0).
4. Backprop ao lado das losses de NTP de texto da mesma sequência.

Na inferência, a geração é:
- Tokens de texto: amostragem autoregressiva padrão.
- Patches de imagem: loop de amostragem de difusão (10-30 steps típicos) condicionado nos tokens de texto anteriores.

### MMDiT: a variante do Stable Diffusion 3

Stable Diffusion 3 (Esser et al., março 2024) lançou MMDiT (Multimodal Diffusion Transformer) mais ou menos na mesma época que Transfusion. As arquiteturas são irmãs.

Diferenças-chave do MMDiT:

- Pesos específicos por modalidade em cada bloco. Cada bloco do transformer tem pesos separados de Q, K, V e MLP pra tokens de texto vs patches de imagem. Attention é conjunta (cross-modal); o resto é específico por modalidade.
- Treinamento por fluxo retificado. Uma variante específica de fluxo-matching com amostragem conhecida e matemática mais simples que DDPM.
- Escala. MMDiT é a backbone do SD3 (variantes de 2B e 8B de parâmetros). O paper do Transfusion escala até 7B.

Ambos convergem na mesma ideia central: um transformer roda NTP em texto e difusão em representações contínuas de imagem.

### Por que isso supera estilo Chameleon

A diferença de qualidade entre difusão contínua e NTP discreto na geração de imagem é mensurável. O paper do Transfusion reporta:

- Com 7B de parâmetros, supera um modelo estilo Chameleon do mesmo tamanho no FID por 3-5 pontos.
- Sem necessidade de treinar tokenizer — o encoder de imagem é mais simples (projeção Linear pra dimensão oculta, igual à camada de entrada de um ViT).
- Inferência pode paralelizar denoising de patches de imagem, ao contrário de tokens de imagem autoregressivos.

Lado negativo: Transfusion é modelo de loss dupla, tornando a dinâmica de treinamento mais complicada. Pesos de loss precisam de ajuste. Incompatibilidade de cronograma entre NTP e difusão pode causar uma cabeça dominando.

### O que vem depois

Janus-Pro (Aula 12.15) refina a ideia do Transfusion desacoplando o encoder de visão pra compreensão e geração — SigLIP pra um, VQ pro outro — enquanto compartilha o corpo do transformer. Show-o (Aula 12.14) troca difusão por difusão discreta (previsão com máscara). A família de geração unificada se ramifica rapidamente após Transfusion.

VLMs de produção de 2026 que emitem imagens — Gemini 3 Pro, GPT-5, caminho de geração de imagem do Claude Opus 4.7 — quase certamente usam algum descendente dessa família. Detalhes são proprietários.

## Use

`code/main.py` constrói um Transfusion toy num problema minúsculo estilo MNIST:

- Legendas de texto são sequências curtas de inteiros descrevendo um dígito (0-9).
- Imagens são grids 4x4 de bytes.
- Um par de projeções lineares de pesos compartilhados atua como substituto do transformer; loss NTP em texto, loss MSE em patches ruidosos.
- Loop de treinamento alterna as duas losses, máscara de attention é explícita.
- Geração produz uma legenda de texto e uma imagem 4x4 em um único passo forward.

O transformer é um toy. A tubulação de duas losses, construção de máscara de attention e loop de inferência são os artefatos reais.

## Implemente

Esta aula produz `outputs/skill-two-loss-trainer-designer.md`. Dada uma nova tarefa de treinamento multimodal (texto + imagem, texto + áudio, texto + vídeo), projeta o cronograma de duas losses (pesos de loss, formato da máscara, blocos compartilhados vs específicos por modalidade) e sinaliza riscos de implementação.

## Exercícios

1. Um modelo estilo Transfusion treina 70% tokens de texto e 30% patches de imagem. A loss de difusão de imagem é ~10x a loss NTP de texto em magnitude. Quais pesos de loss equilibram elas?

2. Implemente a máscara bloco-triangular pra uma sequência: `[T, T, <image>, P, P, P, P, </image>, T]`. Marque cada entrada como 0 ou 1.

3. MMDiT tem pesos QKV específicos por modalidade. Qual sobrecarga de contagem de parâmetros isso adiciona vs o transformer totalmente compartilhado do Transfusion? Com 7B de parâmetros, vale a pena?

4. Geração: dado um prompt de texto, o modelo roda NTP por 50 tokens, depois encontra `<image>`, depois roda difusão em 256 patches com 20 steps de denoising. Quantos passos forward no total?

5. Leia o paper do SD3 Seção 3. Descreva o fluxo retificado e por que ele converge em menos steps de inferência que DDPM.

## Termos-Chave

| Termo | O que a galera diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Treinamento com duas losses | "NTP + difusão" | Um único transformer otimiza tanto entropia cruzada em tokens de texto quanto MSE em patches contínuos de imagem no mesmo step de gradiente |
| Fluxo-matching | "Fluxo retificado" | Variante de difusão que prevê um campo de velocidade do ruído pros dados; matemática mais simples que DDPM |
| MMDiT | "DiT Multimodal" | Arquitetura do Stable Diffusion 3: attention conjunta, MLPs e normalizações específicas por modalidade |
| Máscara bloco-triangular | "Texto causal + imagem bidirecional" | Máscara de attention que é causal entre texto mas bidirecional dentro de regiões de imagem |
| Representação contínua de imagem | "Sem VQ" | Patches de imagem como vetores de valores reais, não índices inteiros de codebook |
| Previsão de velocidade | "v-parametrização" | Saída da rede é o campo de velocidade entre ruído e dados, não o ruído em si |

## Leitura Complementar

- [Zhou et al. — Transfusion (arXiv:2408.11039)](https://arxiv.org/abs/2408.11039)
- [Esser et al. — Stable Diffusion 3 / MMDiT (arXiv:2403.03206)](https://arxiv.org/abs/2403.03206)
- [Peebles & Xie — DiT (arXiv:2212.09748)](https://arxiv.org/abs/2212.09748)
- [Zhao et al. — MonoFormer (arXiv:2409.16280)](https://arxiv.org/abs/2409.16280)
- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
