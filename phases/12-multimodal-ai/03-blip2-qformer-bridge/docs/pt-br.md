# Do CLIP ao BLIP-2 — Q-Former como Ponte entre Modalidades

> CLIP alinha imagem e texto mas não consegue gerar legendas, responder perguntas ou manter uma conversa. BLIP-2 (Salesforce, 2023) resolveu isso com uma ponte treinável pequena: 32 vetores de consulta aprendíveis atentam sobre as features de um ViT congelado via cross-attention, depois entram direto no fluxo de entrada de um LLM congelado. 188M parâmetros de ponte conectaram um LLM de 11B a um ViT-g/14. Todo VLM baseado em adaptador até 2026 — MiniGPT-4, InstructBLIP, primos do LLaVA — é descendente. Essa lição lê a arquitetura do Q-Former, explica seu treinamento em duas etapas e constrói uma versão de brinquedo que alimenta tokens visuais num decoder de texto congelado.

**Tipo:** Construção
**Linguagens:** Python (stdlib, demonstração de cross-attention + queries aprendíveis)
**Pré-requisitos:** Fase 12 · 02 (CLIP), Fase 7 (Transformers)
**Tempo:** ~180 minutos

## Objetivos de Aprendizado

- Explicar por que um gargalo treinável entre um encoder de visão congelado e um LLM congelado supera fine-tuning ponta a ponta em custo e estabilidade.
- Implementar um bloco de cross-attention onde um conjunto fixo de queries aprendíveis atenta sobre features externas de imagem.
- Percorrer o pré-treinamento em duas etapas do BLIP-2: representação (ITC + ITM + ITG) e depois generativo (perda LM com decoder congelado).
- Comparar o Q-Former com o projetor MLP mais simples usado no LLaVA e argumentar quando cada escolha ganha.

## O Problema

Você tem um ViT congelado que produz 256 patch tokens de dim 1408 por imagem. Tem um LLM de 7B congelado que espera embeddings de tokens de dim 4096. A ponte óbvia — uma camada linear de 1408 pra 4096 — funciona, mas alimentar todos os 256 patch tokens no contexto do LLM custa 256 tokens extras por imagem. Em um batch de 32 imagens, são 8192 tokens consumidos só pela modalidade visual.

A pergunta do BLIP-2: você consegue comprimir a representação de imagem de 256 tokens em bem menos tokens (digamos 32) preservando informação suficiente pro LLM fazer legendas, responder perguntas e raciocinar sobre a imagem? E você consegue treinar essa ponte sem tocar nos backbones congelados, mantendo o custo de treino só nos parâmetros da ponte?

A resposta: um Q-Former. 32 vetores "consulta" aprendíveis que fazem cross-attention sobre os patch tokens do ViT, produzindo um resumo visual de 32 tokens que o LLM consome. 188M parâmetros no total. Treinado com objetivos contrastivos, de correspondência e generativos antes de nunca tocar no LLM.

## O Conceito

### Queries aprendíveis

O truque central do Q-Former: em vez de deixar os tokens de texto do LLM atentarem sobre patches de imagem, introduz um novo conjunto de 32 vetores de consulta aprendíveis `Q` e deixa *eles* atentarem sobre patches de imagem. As queries são parâmetros do modelo — são aprendidas durante treinamento e as mesmas 32 queries são usadas pra cada imagem.

Após cross-attention, cada consulta guarda um resumo comprimido da imagem — "descreve o objeto principal", "descreve o fundo", "conta os objetos", etc. As queries não se eespecificaçãoializam literalmente em rótulos semânticos; elas aprendem qualquer codificação que faça as perdas downstream caírem.

### Arquitetura

O Q-Former é um transformer pequeno (12 camadas, ~100M parâmetros) com dois caminhos:

1. Caminho de consulta: 32 vetores de consulta fluem por self-attention (entre si), depois cross-attention sobre os patch tokens do ViT congelado, depois FFN.
2. Caminho de texto: um encoder de texto estilo BERT compartilha os pesos de self-attention e FFN com o caminho de consulta. Cross-attention é desabilitado pro caminho de texto.

Durante treino, ambos os caminhos rodam. As queries e o texto interagem por self-attention compartilhada, o que significa que as queries podem condicionar no texto pra tarefas que precisam (ITM, ITG). Na inferência pra transferência pro VLM, só as queries fluem, produzindo 32 tokens visuais.

### Treinamento em duas etapas

BLIP-2 pré-treina em duas etapas:

Etapa 1: aprendizado de representação (sem LLM). Três perdas:
- ITC (contraste imagem-texto): estilo CLIP entre tokens de consulta com pooling e token CLS de texto.
- ITM (correspondência imagem-texto): classificador binário — este par imagem-texto corresponde? Com mineração de hard negatives.
- ITG (geração de texto baseada em imagem): cabeça LM causal no texto, condicionado nas queries. Força as queries a codificar conteúdo gerável por texto.

Só o Q-Former treina. ViT congelado. Sem LLM envolvido.

Etapa 2: aprendizado generativo. Anexa um LLM congelado (OPT-2.7B ou Flan-T5-XL, etc.). Projeta as 32 saídas de consulta pra dim de embedding do LLM via uma pequena camada linear. Antecede-as ao prompt de texto. Treina só a projeção linear e o Q-Former na perda LM sobre a sequência concatenada prompt + imagem + legenda.

Após a etapa 2, Q-Former + projeção é o adaptador visual completo. Na inferência: imagem → ViT → Q-Former → projeção linear → antecedido ao texto → LLM congelado emite saída.

### Economia de parâmetros

BLIP-2 com ViT-g/14 (1.1B, congelado) + OPT-6.7B (6.7B, congelado) + Q-Former (188M, treinado) = 8B total, 188M treinados. O Q-Former sozinho é ~2.4% dos parâmetros da stack completa. O custo de treino reflete isso: dias em um punhado de A100s vs semanas pra ponta a ponta.

Qualidade: BLIP-2 iguala ou supera Flamingo-80B em VQA zero-shot sendo 50x menor. A ponte funciona.

### InstructBLIP e o Q-Former consciente de instrução

InstructBLIP (2023) estende o Q-Former com uma entrada extra: o texto da instrução em si. No momento da cross-attention, as queries agora têm acesso tanto aos patches da imagem quanto à instrução. As queries podem se eespecificaçãoializar por instrução ("conta os carros", "descreve o clima") em vez de aprender um único resumo fixo. Ganhos em benchmarks em tarefas hold-out.

### MiniGPT-4 e a abordagem só com projetor

MiniGPT-4 manteve o Q-Former mas treinou só a projeção linear de saída enquanto congelou tudo o resto. Barato, mas custo é qualidade — as queries eram do BLIP-2, não suas. Bom pra iteração rápida, não a melhor arquitetura.

### Por que LLaVA foi mais simples

LLaVA (2023, Lição 12.05) substituiu o Q-Former por um MLP de 2 camadas simples que projeta cada patch token do ViT pro espaço do LLM — 576 tokens por imagem pra uma grade 24x24, todos alimentados ao LLM. Compressão pior mas deixa o LLM atentar sobre patches brutos. Na época isso foi controverso; no final de 2023 era dominante porque dados de instrução visual (LLaVA-Instruct-150k) provaram que o MLP podia ser treinado pra preservar sinal suficiente. O trade-off: o contexto do LLaVA enche mais rápido, mas escala naturalmente pra múltiplas imagens e vídeo.

Em 2026, o campo se dividiu: Q-Former sobrevive onde orçamento de tokens importa (vídeo longo, muitas imagens); projetor MLP domina onde qualidade bruta por token é prioridade.

### Cross-attention com gate: Flamingo, o ancestral

Flamingo (Lição 12.04) antecedeu o BLIP-2 e usou a mesma ideia de cross-attention mas em cada camada do LLM congelado, não como uma ponte única. BLIP-2 mostrou que você pode comprimir pra só a camada de entrada e ainda funciona. Gemini e Idefics combinam os dois: tokens de entrada intercalados mais cross-attention com gate opcional pra few-shot in-context.

### Os descendentes de 2026

- Q-Former: BLIP-2, InstructBLIP, MiniGPT-4 e a maioria dos modelos de vídeo-linguagem por razões de orçamento de tokens.
- Perceiver resampler: variante do Flamingo (Lição 12.04); família Idefics, Eagle, OmniMAE.
- Projetor MLP: LLaVA, LLaVA-NeXT, LLaVA-OneVision, Cambrian-1.
- Attention pool: VILA, PaliGemma.

Os quatro são válidos. A questão decisiva é se você é limitado pelo orçamento de tokens ou pela qualidade por token.

## Use

`code/main.py` constrói uma cross-attention estilo Q-Former em stdlib:

1. Simula 256 patch tokens de imagem (dim 128).
2. Instancia 32 queries aprendíveis (dim 128).
3. Roda scaled-dot-product cross-attention (Q das queries, K/V dos patches).
4. Projeta pra dim do LLM (512) via camada linear.
5. Saem 32 tokens visuais prontos pro LLM.

Toda a matemática em Python puro (loops aninhados sobre vetores). De brinquedo mas com forma correta. A matriz de pesos de attention é impressa pra você ver de quais patches cada consulta puxou.

## Entregue

Essa lição produz `outputs/skill-modality-bridge-picker.md`. Dada uma configuração-alvo de VLM (contagem de tokens do encoder de visão, orçamento de contexto do LLM, restrições de deploy, objetivo de qualidade), recomenda Q-Former vs MLP vs Perceiver resampler com uma justificativa curta e estimativa de contagem de parâmetros pra cada ponte.

## Exercícios

1. Implemente o bloco de cross-attention em PyTorch. Verifique que com 32 queries e 256 keys/values, a matriz de pesos de attention é 32 x 256 e cada linha soma 1 após softmax.

2. Na etapa 1 do BLIP-2, o Q-Former roda três perdas simultaneamente: ITC, ITM, ITG. Escreva a assinatura de forward de cada uma em pseudocódigo. Qual exige que o caminho do encoder de texto esteja ativo?

3. Compare contagens de parâmetros: Q-Former (12 camadas, 768 oculto) vs projetor MLP de 2 camadas (1408 → 4096, duas camadas). Em que escala do LLM o custo de 188M do Q-Former se paga em eficiência de treino?

4. Leia Seção 3.2 do artigo BLIP-2 (arXiv:2301.12597) sobre como o Q-Former é inicializado. Explique por que inicializar a partir de BERT-base (não aleatório) acelera a convergência.

5. Pra um vídeo de 10 minutos a 1 FPS amostrado em 60 frames, calcule o custo por frame em tokens com (Q-Former → 32 tokens/frame) vs (projetor MLP → 576 tokens/frame). Qual cabe numa janela de contexto de LLM de 128k tokens?

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|-------------------------|
| Q-Former | "Transformer de queries" | Transformer pequeno com 32 vetores de consulta aprendíveis que fazem cross-attention sobre features congeladas do ViT |
| Queries aprendíveis | "Soft prompt pra visão" | Um conjunto fixo de parâmetros que servem como o lado de consulta da cross-attention; aprendidos por modelo, compartilhados em todas as entradas |
| Cross-attention | "Q de aqui, K/V de lá" | Attention onde consulta, key e value vêm de fontes diferentes; como as queries puxam dos patches do ViT |
| ITC | "Contraste imagem-texto" | Perda estilo CLIP aplicada a queries com pooling do Q-Former vs CLS de texto |
| ITM | "Correspondência imagem-texto" | Classificador binário em pares com mineração de hard negatives; força as queries a discriminar desalinhamentos refinados |
| ITG | "Geração de texto baseada em imagem" | Perda LM causal onde o texto é gerado condicionado nas queries; força as queries a codificar conteúdo decodificável por texto |
| Pré-treinamento em duas etapas | "Representação depois generativo" | Etapa 1 treina só o Q-Former (ITC/ITM/ITG); Etapa 2 anexa LLM congelado e treina só projeção + Q-Former |
| Backbone congelado | "Não fazer fine-tuning" | Os pesos do encoder de visão e do LLM são fixos; só a ponte treina |
| Cabeça de projeção | "Linear pra dim do LLM" | Camada linear final que mapeia a saída do Q-Former pra dimensão de embedding do LLM |
| Perceiver resampler | "Versão do Flamingo" | Cross-attention com queries aprendíveis similar, usado pelo Flamingo em cada camada em vez de como ponte única |

## Leitura Complementar

- [Li et al. — BLIP-2 (arXiv:2301.12597)](https://arxiv.org/abs/2301.12597) — o artigo principal.
- [Li et al. — BLIP (arXiv:2201.12086)](https://arxiv.org/abs/2201.12086) — o predecessor com o trio ITC/ITM/ITG.
- [Li et al. — ALBEF (arXiv:2107.07651)](https://arxiv.org/abs/2107.07651) — "align before fuse" — o ancestral conceitual da etapa 1 de treinamento.
- [Dai et al. — InstructBLIP (arXiv:2305.06500)](https://arxiv.org/abs/2305.06500) — Q-Former consciente de instrução.
- [Zhu et al. — MiniGPT-4 (arXiv:2304.10592)](https://arxiv.org/abs/2304.10592) — abordagem só com projetor.
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) — arquitetura geral pra cross-attention com queries aprendíveis.