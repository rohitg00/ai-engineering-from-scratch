# Transfusão: Texto autoregressivo + Imagem de difusão em um transformador

> O Camelão e o Emu3 apostaram tudo em tokens discretos. Funcionam, mas o gargalhão de quantização é visível  os planícies de qualidade de imagem abaixo dos modelos de difusão no espaço contínuo. A transfusão (Meta, Zhou et al., agosto 2024) faz a aposta oposta: manter imagens contínuas, soltar o VQ-VAE inteiramente e treinar um transformador com duas perdas. Os tokens de texto recebem a previsão do próximo token. Os parches de imagem têm uma perda de fluxo de correspondência / difusão. Ambos os objetivos otimizam os mesmos pesos. A arquitetura subjacente à Stable Diffusion 3 (MMDiT) é uma prima próxima. Esta lição lê a tese da Transfusão, constrói um treinador de brinquedos de duas perdas e rastreia a máscara de atenção que permite que um transformador faça ambos os trabalhos.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, two-loss trainer on MNIST-scale toy)
**Prerequisites:** Phase 12 · 11 (Chameleon), Phase 8 (Generative AI)
**Time:** ~180 minutes

## Objetivos de aprendizagem

- Enviar um transformador que corre duas perdas (NTP em tokens de texto, MSE de difusão em parches de imagem) em uma espinha dorsal.
- Explique por que a atenção bidirecional entre os patches de imagem mais a atenção causal sobre os tokens de texto é a escolha certa da máscara.
- Compare o estilo Transfusão (imagem contínua, perda de difusão) com o estilo Camelão (imagem discreta, NTP) em computação, qualidade e complexidade de código.
- Nomear a contribuição da MMDiT: pesos específicos de modalidade em cada bloco, atenção conjunta no fluxo residual.

## O problema

O debate entre tokens de imagem discretos e contínuos é mais antigo do que os LLM. As representações contínuas (pixels brutos, VAE latentes) preservam detalhes.

O Chameleon / Emu3 foi discreto: uma perda, uma arquitetura, mas a fidelidade da imagem foi limitada pela qualidade do tokenizer.

Os modelos de difusão foram contínuos: qualidade de imagem excepcional, mas um modelo separado do LLM, engenharia complexa de programação de ruído e nenhuma integração limpa com a geração de texto.

A transfusão pergunta: podemos ter ambas? Mantém as imagens contínuas, ainda treine um modelo, use duas perdas costuradas em um passo de gradiente.

## O conceito

### A arquitetura de duas perdas

Um único transformador de decodificador só processa uma sequência que contém:

- Tokens de texto (discreto, do vocabulário BPE).
- Patches de imagem (contínuos, blocos de pixels 16x16 projetados em dim oculto através de incorporação linear  igual à entrada de um codificador ViT).
- `<image>`E ...`</image>`Tags que marcam onde os parches contínuos vivem.

O passante avançado corre uma vez.

- Para tokens de texto: entropia cruzada padrão na cabeça do vocabulário-logits.
- Para os parches de imagem: perda de difusão em parches contínuos  prevê o ruído que foi adicionado a cada parche.

O gradiente flui através do corpo do transformador compartilhado.

### Mascara de atenção: texto causal + imagem bidirecional

Os tokens de texto devem ser causais  você não pode deixar um token de texto atender a texto futuro, ou professor forçando pausas.

A máscara:

```
M[i, j] = 1 if:
  (i is text and j is text and j <= i)   # causal for text
  OR (i is image and j is image and same_image_block(i, j))   # bidirectional within image
  OR (i is text and j is image and j < i)   # text attends to images that closed before it
  OR (i is image and j is text and j < i_image_start)   # image attends to preceding text
```

Implementado como uma máscara triangular de bloco no treinamento e inferência.

### Perda de difusão dentro do transformador

A perda de difusão é padrão: adicione ruído a um parche de imagem, peça ao modelo para prever o ruído (ou o parche limpo, equivalentemente).

Durante a formação:
1. Para cada parche de imagem $x_0$, amostra de um passo de tempo aleatório $t$- Não .
2. Resumo de amostra$\epsilon$, computação $x_t = (1-t) \cdot x_0 + t \cdot \epsilon$(interpolação linear para a correspondência de fluxo).
3. O transformador prevê .$v_\theta(x_t, t)$- O que é ?$\text{loss} = \mathop{\mathrm{MSE}}(v_\theta(x_t, t), \epsilon - x_0)$- Não .
4. O backprop ao lado de perdas de texto NTP da mesma sequência.

Na inferência, a geração é:
- Tokens de texto: amostragem autoregressiva padrão.
- Parches de imagem: ciclo de amostragem de difusão (10-30 passos típicos) condicionado aos tokens de texto anteriores.

### MMDiT: Variante da Stable Diffusion 3

Estabilidade Diffusion 3 (Esser et al., março 2024) enviou MMDiT (Multimodal Diffusion Transformer) em torno do mesmo tempo que Transfusion.

Principais diferenças do MMDiT:

- Pesos específicos de modalidade por bloco. Cada bloco transformador tem pesos Q, K, V e MLP separados para tokens de texto versus parches de imagem.
- Formação de fluxo corrigida. Uma variante específica de correspondência de fluxo com amostragem conhecida e matemática mais simples do que a DDPM.
- Escala. MMDiT é a espinha dorsal para SD3 (2B e 8B variantes param).

Ambos convergem na mesma ideia central: um transformador executa NTP em texto e difusão em representações contínuas de imagem.

### Por que é melhor que o estilo de camaleão

A diferença de qualidade entre a difusão contínua e a NTP discreta na geração de imagens é mensurável.

- Nos parâmetros 7B, supera um modelo de estilo camaleão do mesmo tamanho na FID por 3-5 pontos.
- Não é necessário treinamento de tokenizer  o codificador de imagem é mais simples (projeção linear para oculta, igual à camada de entrada de um ViT).
- A inferência pode paralelalizar a denotação de patch de imagem, ao contrário dos tokens de imagem autoregressivos.

Desvantagem: A transfusão é um modelo de dupla perda, tornando a dinâmica de treinamento mais complicada. Pesos de perda precisam ser ajustados.

### O que fica ao fundo do rio

Janus-Pro (Lessão 12.15) aperfeiçoou a ideia da Transfusion descouplando o codificador de visão para compreensão e geração  SigLIP para um, VQ para o outro  enquanto compartilha o corpo do transformador. Show-o (Lessão 12.14) troca difusão por difusão discreta (previsão mascarada).

Modelos de produção fechados que emitem imagens nativamente podem usar algum descendente desta família, mas suas arquiteturas não são publicadas, então trate qualquer alegação como um adivinho.

```figure
cfg-guidance-scale
```

## Usá-lo

`code/main.py`Construiu um brinquedo Transfusion sobre um pequeno problema parecido com o MNIST:

- Capções de texto são curtas sequências de números inteiros que descrevem um dígito (0-9).
- As imagens são redes de 4x4 bytes.
- Um par de projeções lineares de peso compartilhado atua como o substitutor do transformador; perda de NTP no texto, perda de MSE em parches barulhentos.
- O ciclo de treinamento alternou as duas perdas, a máscara de atenção é explícita.
- Uma demonstração de máscara imprime o padrão de atenção triangular de bloco para um texto, imagem, sequência de texto. A geração não é executada: um sampler real decodificaria o token de texto por token, depois denotava os patches de imagem em muitas etapas, conforme os exercícios abaixo contam.

A canalização de duas perdas, a construção da máscara de atenção e o ciclo de inferência são os verdadeiros artefatos.

## Envia-o

Esta lição produz`outputs/skill-two-loss-trainer-designer.md`. Tendo em conta uma nova tarefa de formação multimodal (texto + imagem, texto + áudio, texto + vídeo), elabora o cronograma de duas perdas (pesos de perda, forma de máscara, blocos compartilhados versus blocos específicos de modalidade) e sinaliza os riscos de implementação.

## Exercícios

1. Um modelo de estilo Transfusion treina 70% de tokens de texto e 30% de parches de imagem. A perda de difusão de imagem é ~10x a perda de NTP de texto em magnitude. Que pesos de perda os equilibrar?

2. Implementar a máscara triangular de bloco para uma sequência: `[T, T, <image>, P, P, P, P, </image>, T]`Marque cada entrada 0 ou 1.

3. MMDiT tem pesos QKV específicos para modalidade. Que parâmetro contagem sobrecarga adiciona esta versus o transformador totalmente compartilhado da Transfusion?

4. Geração: dado um prompt de texto, o modelo executa NTP para 50 tokens, em seguida, atinge `<image>`, então corre difusão em 256 parches sobre 20 passos denoise.

5. Leia o artigo SD3 Secção 3. Descreva o fluxo rectificado e por que converge em menos etapas de inferência do que o DDPM.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Two-loss training | "NTP + diffusion" | A single transformer optimizes both cross-entropy on text tokens and MSE on continuous image patches in the same gradient step |
| Flow matching | "Rectified flow" | Diffusion variant that predicts a velocity field from noise to clean data; simpler math than DDPM |
| MMDiT | "Multimodal DiT" | Stable Diffusion 3's architecture: joint attention, modality-specific MLPs and norms |
| Block-triangular mask | "Causal text + bidirectional image" | Attention mask that is causal across text but bidirectional within image regions |
| Continuous image representation | "No VQ" | Image patches as real-valued vectors, not integer codebook indices |
| Velocity prediction | "v-parameterization" | Network output is the velocity field between noise and data, not the noise itself |

## Mais leitura

- [Zhou et al. — Transfusion (arXiv:2408.11039)](https://arxiv.org/abs/2408.11039)
- [Esser et al. — Stable Diffusion 3 / MMDiT (arXiv:2403.03206)](https://arxiv.org/abs/2403.03206)
- [Peebles & Xie — DiT (arXiv:2212.09748)](https://arxiv.org/abs/2212.09748)
- [Zhao et al. — MonoFormer (arXiv:2409.16280)](https://arxiv.org/abs/2409.16280)
- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
