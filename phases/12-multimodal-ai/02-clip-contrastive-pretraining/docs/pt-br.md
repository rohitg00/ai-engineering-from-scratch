# CLIP e Pré-Treinamento Contrastivo Visão-Linguagem

> O CLIP da OpenAI (2021) provou uma ideia grande o suficiente pra alimentar os próximos cinco anos: alinhar um encoder de imagens e um encoder de texto no mesmo espaço vetorial usando apenas pares imagem-legenda ruidosos da web e uma perda contrastiva. Zero rótulos supervisionados. 400M pares. O espaço de embedding resultante faz classificação zero-shot, recuperação imagem-texto e se conecta a todo VLM de 2026 como sua torre de visão. SigLIP 2 (2025) substituiu softmax por sigmoid e escalou além do CLIP com custo menor. Essa lição percorre a matemática da InfoNCE até a perda sigmoid pareada e constrói o passo de treinamento em Python stdlib.

**Tipo:** Construção
**Linguagens:** Python (stdlib, implementações de InfoNCE + perda sigmoid)
**Pré-requisitos:** Fase 12 · 01 (patches ViT), Fase 7 (Transformers)
**Tempo:** ~180 minutos

## Objetivos de Aprendizado

- Derivar a perda InfoNCE a partir de informação mútua e implementar uma versão vetORIZADA numericamente estável.
- Explicar por que a perda sigmoid pareada (SigLIP) escala pra batch de 32768+ sem o overhead de all-gather que o softmax exige.
- Rodar classificação zero-shot no ImageNet construindo templates de texto (`a photo of a {class}`) e pegando argmax sobre similaridade cosseno.
- Nomear as quatro alavancas que o pré-treinamento CLIP / SigLIP te dá: tamanho do batch, temperatura, template de prompt, qualidade dos dados.

## O Problema

Pré-CLIP, a visão era supervisionada. Coleta de datasets rotulados (ImageNet: 1.2M imagens, 1000 classes), treino de uma CNN, deploy. Rótulos são caros, tendem ao que os anotadores conseguem concordar e não transferem pra novas tarefas sem fine-tuning.

A web de imagem-legenda tem mais de um bilhão de pares fracamente rotulados de graça. Uma foto de um golden retriever com alt text "meu cachorro Max no parque" carrega um sinal de supervisão — o texto descreve a imagem. A pergunta: você consegue transformar isso em treinamento útil?

A resposta do CLIP: tratar pares imagem-legenda como uma tarefa de correspondência. Dado um batch de N imagens e N legendas, aprender a corresponder cada imagem à sua própria legenda contra N-1 distratores. A supervisão é "essas duas coisas pertencem juntas; essas N-1 não." Sem rótulos de classe. Sem anotação humana. Apenas uma perda contrastiva.

O espaço de embedding resultante faz mais do que o CLIP foi treinado pra fazer. A classificação zero-shot no ImageNet funciona porque "uma foto de um gato" fica perto de imagens de gatos que nunca foram rotuladas como gatos. Essa é a aposta que gerou todo VLM de 2026.

## O Conceito

### O encoder dual

CLIP tem duas torres:

- Encoder de imagens `f`: ViT ou ResNet, produz um vetor de D dimensões por imagem.
- Encoder de texto `g`: transformer pequeno, produz um vetor de D dimensões por legenda.

Ambas as torres normalizam suas saídas pra comprimento unitário. A similaridade é `cos(f(x), g(y)) = f(x)^T g(y)` já que ambas são de norma unitária.

Para um batch de N pares (imagem, legenda), constrói a matriz de similaridade `S` de forma `(N, N)`:

```
S[i, j] = cos(f(x_i), g(y_j)) / tau
```

onde `tau` é uma temperatura aprendida (CLIP inicializa com 0.07; aprendida em log-space).

### Perda InfoNCE

CLIP usa uma entropia cruzada simétrica sobre linhas e colunas:

```
loss_i2t = CE(S, labels=identity)     # cada imagem positiva é sua própria legenda
loss_t2i = CE(S^T, labels=identity)   # cada legenda positiva é sua própria imagem
loss = (loss_i2t + loss_t2i) / 2
```

Isso é InfoNCE. O softmax na CE força cada imagem a corresponder mais à sua legenda do que a qualquer outra legenda no batch. Os "negativos" são todos os outros itens do batch. Batches maiores = mais negativos = sinal mais forte. CLIP treinou com batch 32k; escala importa.

### Temperatura

`tau` controla a agudeza do softmax. Tau baixo → distribuição afiada, efeito de mineração de hard negatives. Tau alto → suave, todas as amostras contribuem. CLIP aprende log(1/tau), com corte pra evitar colapso. SigLIP 2 fixa o tau inicial e usa um bias aprendido no lugar.

### Por que sigmoid escala melhor (SigLIP)

Softmax precisa da matriz de similaridade inteira sincronizada. No treinamento distribuído, você tem que fazer all-gather de cada embedding pra cada réplica, depois fazer o softmax. Isso é quadrático no tamanho do mundo pra comunicação.

SigLIP substitui o softmax por sigmoid elemento a elemento: pra cada par `(i, j)`, a perda é uma classificação binária de "estes são o par correspondente?" os rótulos da classe positiva são a diagonal, o resto é negativo. A perda é:

```
L = -1/N soma sobre (i, j) [ y_ij log sigmoid(S[i,j]) + (1-y_ij) log sigmoid(-S[i,j]) ]
```

`y_ij = 1` se `i == j`, senão 0. A perda de cada par é independente. Sem all-gather necessário. Cada GPU calcula seu bloco local e soma. SigLIP 2 escala pra batch 32k-512k barato onde CLIP precisaria de comunicação proporcionalmente maior.

### Classificação zero-shot

Dados N nomes de classe, pra cada classe constrói um template de texto:

```
"a photo of a {class}"
```

Faz embedding de cada template com o encoder de texto. Faz embedding da sua imagem com o encoder de imagens. Argmax de similaridade cosseno = classe predita. Sem treino nas classes-alvo.

Templates de prompt importam. O artigo original do CLIP usou 80 templates por classe (simples, artístico, foto, pintura, etc.) e fez média dos embeddings. +3 pontos no ImageNet. Uso moderno geralmente escolhe um ou dois templates.

### Lineares probes e fine-tuning

Zero-shot é uma baseline. Um linear probe (treinar uma camada linear sobre features congeladas do CLIP pra suas classes-alvo) supera zero-shot em tarefas dentro do domínio. Fine-tuning completo supera linear probe dentro do domínio mas pode prejudicar a transferência zero-shot. Três regimes com três trade-offs.

### SigLIP 2: NaFlex e features densas

SigLIP 2 (2025) adiciona:
- NaFlex: modelo único lida com proporções e resoluções variáveis.
- Melhores features densas pra segmentação e estimativa de profundidade, visando uso como backbone congelado em VLMs.
- Multilíngue: treinado em 100+ idiomas onde CLIP era só inglês.
- Escala de 1B parâmetros onde CLIP chegou no máximo em 400M.

Em VLMs abertos de 2026, SigLIP 2 SO400m/14 é a torre de visão padrão. CLIP continua sendo o padrão pra recuperação pura imagem-texto onde a distribuição de treino LAION-2B específica combina com seu padrão de consulta.

### ALIGN, BASIC, OpenCLIP, EVA-CLIP

ALIGN (Google, 2021): mesma ideia que o CLIP, escala de 1.8B pares, 90% ruidoso. Provou que dados ruidosos escalam. OpenCLIP (LAION): reprodução aberta do CLIP no LAION-400M / 2B, múltiplas escalas, o checkpoint aberto padrão. EVA-CLIP: inicializa a partir de modelagem de imagem mascarada; backbone forte pra VLMs. BASIC: híbrido CLIP+ALIGN do Google. Toda a mesma família, dados e ajustes diferentes.

### O teto do zero-shot

Modelos do tipo CLIP ficam em torno de 76% zero-shot no ImageNet (CLIP-G, OpenCLIP-G). Ir além exige dados muito maiores (SigLIP 2 chega em 80%+) ou mudanças de arquitetura (cabeças supervisionadas, mais parâmetros). O benchmark está saturando; o valor real é o espaço de embedding que VLMs downstream consomem.

## Use

`code/main.py` implementa:

1. Um encoder dual de brinquedo (features de imagem baseadas em hash, features de caractere de texto) pra você ver a forma da InfoNCE sem numpy.
2. Perda InfoNCE em Python puro (estabilidade numérica via log-sum-exp).
3. Perda sigmoid pareada pra comparação.
4. Uma rotina de classificação zero-shot: calcula similaridade cosseno contra um conjunto de prompts de texto, argmax pra predição.

Rode e observe a curva de perda. Os números absolutos são de brinquedo; a forma bate com o que um treinador real de CLIP emite.

## Entregue

Essa lição produz `outputs/skill-clip-zero-shot.md`. Dado um conjunto de imagens (via caminho) e uma lista de classes-alvo, constrói prompts de texto com o template do CLIP, faz embedding dos dois lados com um checkpoint declarado (ex.: `openai/clip-vit-large-patch14`) e retorna predições top-1 / top-5 com scores de similaridade. A skill se recusa a fazer afirmações sobre classes que não estão na lista de prompts.

## Exercícios

1. Implemente InfoNCE pra um batch de 4 pares na mão. Construa a matriz de similaridade 4x4, rode softmax, pegue a diagonal, calcule a entropia cruzada. Verifique sua implementação em Python contra esse cálculo manual.

2. SigLIP usa um parâmetro de bias `b` além da temperatura: `S'[i,j] = S[i,j]/tau + b`. Qual o papel de `b` quando o batch tem um grande desbalanceamento de classe (muitos mais negativos que positivos por linha)? Leia Seção 3 do SigLIP (arXiv:2303.15343).

3. Construa um classificador zero-shot pra gatos vs cães. Teste dois templates de prompt: `a photo of a {class}` e `a picture of a {class}`. Meça a acurácia em 100 imagens de teste. O ensemble de templates supera um único?

4. Calcule o custo de comunicação do InfoNCE com softmax vs sigmoid pareado pra uma execução com 512 GPUs a batch 32k. Qual escala como O(N), qual como O(N^2)? Cite Seção 4 do SigLIP.

5. Leia o artigo de leis de escala do OpenCLIP (arXiv:2212.07143, Cherti et al.). Reproduza a conclusão deles pra escalamendo de dados a partir das figuras: com tamanho fixo de modelo, qual é a relação log-linear entre acurácia zero-shot no ImageNet e tamanho dos dados de treino?

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|-------------------------|
| InfoNCE | "Perda contrastiva" | Entropia cruzada sobre a matriz de similaridade de um batch; cada item positivo é o item pareado, negativos são todo o resto |
| Perda sigmoid | "Perda SigLIP" | Entropia cruzada binária por par; sem softmax, sem all-gather, escala barato em treinamento distribuído |
| Temperatura | "tau" | Escalar que ajusta logits antes do softmax/sigmoid; controla a agudeza da distribuição |
| Zero-shot | "classificação sem fine-tuning" | Usa prompts de texto pra construir embeddings de classe e classificar por similaridade cosseno; sem treino nas classes-alvo |
| Template de prompt | "a photo of a ..." | Enquadramento de texto ao redor do nome de classe; afeta acurácia zero-shot em 1-5 pontos |
| Encoder dual | "Duas torres" | Um encoder de imagens + um encoder de texto, saídas no espaço compartilhado de D dimensões |
| Hard negative | "Distrator difícil" | Um negativo suficientemente parecido com o positivo que o modelo tem que trabalhar pra separá-los |
| Linear probe | "Congelado + uma camada" | Treina apenas um classificador linear sobre features congeladas; mede qualidade das features |
| NaFlex | "Resolução flexível nativa" | Capacidade do SigLIP 2 de ingerir imagens em qualquer proporção e resolução sem redimensionamento |
| Escala de temperatura | "tau parametrizado em log" | CLIP parametriza `log(1/tau)` pra gradients se comportarem; corta pra evitar colapso em tau próximo a zero |

## Leitura Complementar

- [Radford et al. — Learning Transferable Visual Models From Natural Language Supervision (arXiv:2103.00020)](https://arxiv.org/abs/2103.00020) — o artigo do CLIP.
- [Zhai et al. — Sigmoid Loss for Language Image Pre-Training (arXiv:2303.15343)](https://arxiv.org/abs/2303.15343) — SigLIP.
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) — multilíngue + NaFlex.
- [Jia et al. — ALIGN (arXiv:2102.05918)](https://arxiv.org/abs/2102.05918) — escala com dados ruidosos da web.
- [Cherti et al. — Reproducible scaling laws for contrastive language-image learning (arXiv:2212.07143)](https://arxiv.org/abs/2212.07143) — leis de escala do OpenCLIP.