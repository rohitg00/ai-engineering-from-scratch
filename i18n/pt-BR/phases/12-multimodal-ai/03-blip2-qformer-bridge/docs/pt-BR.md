# Do CLIP ao BLIP-2  Q-Former como ponte de modalidade

> O CLIP alinha imagem e texto, mas não pode gerar legendas, responder perguntas ou manter uma conversa. BLIP-2 (Salesforce, 2023) resolveu que com uma pequena ponte treinável: 32 vetores de consulta aprendizagem atender sobre os recursos de um ViT congelado através da atenção cruzada, em seguida, slot diretamente no fluxo de entrada de um LLM congelado. 188 milhões de parâmetros de ponte conectaram um ViT-g/14 a LLMs congeladas de tamanho igual ao 11B Flan-T5-XXL. Cada VLM baseado em adaptador até 2026  MiniGPT-4, InstructBLIP, primos de LLaVA  é um descendente. Esta lição lê a arquitetura do Q-Former, explica o seu treinamento em duas etapas e constrói uma versão de brinquedo que alimenta tokens visuais em um decodificador de texto congelado.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, cross-attention + learnable-query demo)
**Prerequisites:** Phase 12 · 02 (CLIP), Phase 7 (Transformers)
**Time:** ~180 minutes

## Objetivos de aprendizagem

- Explique por que um gargalo de engarrafamento treinavel entre um codificador de visão congelado e um LLM congelado supera a fixação de custos e estabilidade de ponta a ponta.
- Implementar um bloco de atenção cruzada onde um conjunto fixo de consultas de aprendizagem atende às características externas da imagem.
- Passe pelo pré-treino em duas etapas do BLIP-2: representação (ITC + ITM + ITG) e depois geração (perda de LM com decodificador congelado).
- Compare Q-Former com o simples projetor MLP usado em LLaVA e discuta quando cada escolha ganha.

## O problema

Você tem um ViT congelado que produz 256 tokens de parches de dim 1408 por imagem. Você tem um LLM congelado 7B que espera incrustamentos de tokens de dim 4096. A ponte óbvia  uma camada linear de 1408 a 4096  funciona, mas alimentar todos os 256 tokens de parches no contexto do LLM custa 256 tokens extras por imagem.

A pergunta do BLIP-2: pode comprimir a representação da imagem de 256 tokens em muito menos tokens (digamos 32) enquanto preserva informações suficientes para o LLM captar, responder perguntas e raciocinar sobre a imagem? E pode treinar esta ponte sem tocar nas espinhas congeladas, mantendo o custo de treinamento apenas nos parâmetros da ponte?

A resposta: um Q-Former. 32 vectores "queri" aprendizes que atendem aos tokens de patch do ViT, produzindo um resumo visual de 32 tokens que o LLM consome. Parâmetros 188M no total. Treinado com objetivos contrastativos, de correspondência e gerativos antes de tocar o LLM.

## O conceito

### Questões que podem ser aprendidas

O truque principal do Q-Former: em vez de deixar que os tokens de texto do LLM assistam a parches de imagem, introduzir um novo conjunto de 32 vetores de consulta apropriados `Q`As consultas são parâmetros do modelo  que são aprendidas durante o treinamento e as mesmas 32 consultas são utilizadas para cada imagem.

Após a atenção cruzada, cada consulta contém um resumo comprimido da imagem  "descrever o objeto principal", "descrever o fundo", " contar os objetos", etc. As consultas não se especializam literalmente em rótulos semânticos; elas aprendem qualquer codificação que faça cair as perdas no fluxo de baixo.

### Arquitetura

O Q-Former é um pequeno transformador (12 camadas, ~ 100M params) com dois caminhos:

1. Caminho de consulta: 32 vetores de consulta fluem através da auto-atenção (entre si), então a atenção cruzada sobre os tokens de parche do ViT congelado, depois FFN.
2. Caminho de texto: um codificador de texto semelhante ao BERT compartilha a auto-atenção e pesos FFN com o caminho de consulta.

No tempo de treinamento, ambos os caminhos são executados. As consultas e o texto interagem através da auto-atenção compartilhada, o que significa que as consultas podem condicionar o texto para tarefas que precisam dele (ITM, ITG). No momento de inferência para a entrega do VLM, apenas as consultas fluem, produzindo 32 tokens visuais.

### Formação em duas fases

O BLIP-2 prepara-se em duas fases:

Fase 1: aprendizagem representativa (sem Mestrado em Direito Executivo).
- ITC (imagem-texto contrastivo): contrastivo de estilo CLIP entre os tokens de consulta em conjunto e o token CLS de texto.
- ITM (imagem-texto de correspondência): classificador binário  é este par de imagem-texto de correspondência?
- ITG (Generação de texto baseada em imagem): LM causal cabeçalho em texto, condicionado às consultas. Força consultas a codificar conteúdo gerável por texto.

Só os trens Q-Former, o ViT está congelado, não há LLM envolvido.

Fase 2: aprendizagem gerativa. Anexe um LLM congelado (OPT-2.7B ou Flan-T5-XL, etc.). Projete os 32 resultados de consulta para o LLM de inserção dim através de uma pequena camada linear. Prepare-os para o texto de instrução. Treinar apenas a projeção linear e o Q-Former em LM perda sobre a sequência de instrução + imagem + legenda concatenada.

Após a etapa 2, a projeção Q-Former + é o adaptador visual completo. Na inferência: imagem → ViT → Q-Former → proj linear → pré-pendido ao texto → LLM congelado emite saída.

### Economia de parâmetros

BLIP-2 com ViT-g/14 (1.1B, congelado) + OPT-6.7B (6.7B, congelado) + Q-Former (188M, treinado) = 8B total, 188M treinado. O Q-Former sozinho é ~ 2,4% dos parâmetros da pilha completa.

Qualidade: BLIP-2 combina ou supera o Flamingo-80B em VQA de tiro zero, enquanto é 50 vezes menor.

### O instructoBLIP e o Q-Former, que tem conhecimento das instruções

O instructoBLIP (2023) estende o Q-Former com uma entrada extra: o próprio texto de instrução. No tempo de atenção cruzada, as consultas agora têm acesso tanto aos patches de imagem quanto à instrução. As consultas podem se especializar por instrução ("contar os carros", "descrever o humor") em vez de aprender um único resumo fixo.

### MiniGPT-4 e a abordagem apenas com projector

MiniGPT-4 manteve o Q-Former, mas treinou apenas a projeção linear de saída enquanto congelava tudo o resto. Barato, mas o custo é qualidade  as consultas eram de BLIP-2, não suas. Boa para iteração rápida, não a melhor arquitetura.

### Por que a LLaVA foi mais simples

LLaVA (2023, lição 12.05) substituiu o Q-Former por um simples MLP de 2 camadas que projeta cada token de patch ViT em espaço LLM  576 tokens por imagem para uma grade 24x24, todos alimentados para o LLM. Pior compressão, mas deixa o LLM assistir em vez de manchas crudas. Na época, isso era controverso; no final de 2023 era dominante porque os dados de instrução visual (LLaVA-Instruct-150k) provaram que o MLP poderia ser treinado para preservar sinal suficiente. A compensação: O contexto do LLaVA se enche mais rápido, mas se escala naturalmente para a imagem e o vídeo.

Em 2026, o campo se divide: Q-Former sobrevive onde o orçamento de token importa (vídeo longo, muitas imagens); o projeto MLP domina onde a qualidade bruta por token é a prioridade.

### Atensão cruzada: Flamingo, o ancestral

Flamingo (Lessão 12.04) antecedeu BLIP-2 e usou a mesma ideia de atenção cruzada, mas em cada camada LLM congelada, não como uma única ponte. BLIP-2 mostrou que você pode comprimir apenas para a camada de entrada e ainda funcionar. Gemini e Idefics combinam ambos: tokens de entrada entrelaçados mais atenção cruzada fechada opcional para poucas fotos no contexto.

### Os descendentes de 2026

- Q-Former: BLIP-2, InstructBLIP, MiniGPT-4, e a maioria dos modelos de vídeo-linguagem por razões de orçamento token.
- Re-estamplador de percepção: variante do Flamingo (Lessão 12.04); família Idefics, Eagle, OmniMAE.
- Projector MLP: LLaVA, LLaVA-NeXT, LLaVA-OneVision, Cambrian-1.
- Polar de atenção: VILA, PaliGemma.

A questão decisiva é se você está limitado no orçamento de token ou na qualidade por token.

```figure
modality-projection
```

## Usá-lo

`code/main.py`construi uma atenção cruzada no estilo stdlib Q-Former:

1. Simula 256 tokens de parche de imagem (dim 128).
2. Instantanear 32 consultas de aprendizagem (dim 128).
3. Execute a atenção cruzada ponto-produto escalado (Q das consultas, K/V dos patches).
4. Projeto para LLM-dim (512) através de uma camada linear.
5. Faça 32 tokens visuais prontos para LLM.

Todas as matemáticas em Python puro (bucles aninhados sobre vetores). Joguete mas forma correta. A matriz de peso de atenção é impressa para que você possa ver quais patches cada consulta tirada de.

## Envia-o

Esta lição produz`outputs/skill-modality-bridge-picker.md`. Dada a configuração de VLM-alvo (contagem de tokens do codificador de visão, orçamento contextual do LLM, restrições de implantação, objetivo de qualidade), recomenda o resampler Q-Former vs. MLP vs. Perceptor com uma breve justificação e uma estimativa da contagem de parâmetros para cada ponte.

## Exercícios

1. Implementar o bloco de atenção cruzada no PyTorch. Verifique que com 32 consultas e 256 chaves/valores, a matriz de peso da atenção é 32 x 256 e cada linha somou a 1 após softmax.

2. No BLIP-2 estágio 1, o Q-Former executa três perdas simultaneamente: ITC, ITM, ITG. Escreva a assinatura para frente para cada um em pseudo-código. Qual deles requer que o caminho de codificação de texto seja ativo?

3. Comparar contagens de parâmetros: Q-Former (12 camadas, 768 escondidas) vs um projetor MLP de 2 camadas (1408 → 4096, duas camadas). Em que escala LLM o custo de 188M Q-Former compensa na eficiência do treinamento?

4. Leia a Seção 3.2 do artigo BLIP-2 (arXiv:2301.12597) sobre como o Q-Former é iniciado.

5. Para um vídeo de 10 minutos a 1 FPS amostrado para 60 quadros, calcule o custo de token por quadro em (Q-Former → 32 tokens/frame) vs (projector MLP → 576 tokens/frame). Quantas quadros cada ponte pode caber em uma janela de contexto de LLM de 128k-token antes que o texto de solicitação obtenha algum espaço?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Q-Former | "Querying transformer" | Small transformer with 32 learnable query vectors that cross-attend to frozen ViT features |
| Learnable queries | "Soft prompt for vision" | A fixed set of parameters that serve as the query side of cross-attention; learned per model, shared across all inputs |
| Cross-attention | "Q from here, K/V from there" | Attention where query, key, and value come from different sources; how the queries pull from ViT patches |
| ITC | "Image-text contrastive" | CLIP-style loss applied to Q-Former pooled queries vs text CLS |
| ITM | "Image-text matching" | Binary classifier on hard-negative-mined pairs; forces the queries to discriminate fine-grained mismatches |
| ITG | "Image-grounded text generation" | Causal LM loss where text is generated conditioned on queries; forces queries to encode text-decodable content |
| Two-stage pretraining | "Representation then generative" | Stage 1 trains Q-Former alone (ITC/ITM/ITG); Stage 2 attaches frozen LLM and trains only the projection + Q-Former |
| Frozen backbone | "Do not finetune" | The vision encoder and LLM weights are fixed; only the bridge trains |
| Projection head | "Linear to LLM dim" | Final linear layer mapping Q-Former output to the LLM's embedding dimension |
| Perceiver resampler | "Flamingo's version" | Similar learnable-query cross-attention; Flamingo runs it once per image to make fixed latents, then reads them through gated cross-attention at every LLM layer |

## Mais leitura

- [Li et al. — BLIP-2 (arXiv:2301.12597)](https://arxiv.org/abs/2301.12597) o papel central.
- [Li et al. — BLIP (arXiv:2201.12086)](https://arxiv.org/abs/2201.12086) o antecessor com o trio ITC/ITM/ITG.
- [Li et al. — ALBEF (arXiv:2107.07651)](https://arxiv.org/abs/2107.07651) "align antes de fusão"  o ancestral conceitual do treino de fase 1.
- [Dai et al. — InstructBLIP (arXiv:2305.06500)](https://arxiv.org/abs/2305.06500)- Q-Former, consciente de instruções.
- [Zhu et al. — MiniGPT-4 (arXiv:2304.10592)](https://arxiv.org/abs/2304.10592) abordagem apenas de projector.
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) arquitetura geral para a atenção transversal entre as questões de aprendizagem.
