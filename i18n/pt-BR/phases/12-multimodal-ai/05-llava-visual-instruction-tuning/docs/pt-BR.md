# LLaVA e sintonização de instruções visuais

> LLaVA (abril de 2023) é a arquitetura multimodal mais copiada do planeta. Substituiu o Q-Former do BLIP-2 com um MLP de 2 camadas, substituiu a atenção cruzada fechada do Flamingo com concatenamento de token ingênuo e treinou em 158k viradas de instrução visual geradas pelo GPT-4 a partir de legendas apenas de texto. Qualquer praticante que construiu um VLM entre 2023 e 2026 construiu alguma variante do LLaVA. LLaVA-1.5 trocado em um projetor MLP e um codificador 336px. LLaVA-NeXT adicionou azulejos AnyRes para entrada de alta resolução. LLaVA-OneVision imagem unificada, multi-imagem e vídeo em uma receita. Esta lição lê a receita, implementa o projetor e explica por que "o mais simples venceu".

**Type:** Build
**Languages:** Python (stdlib, projector + instruction-template builder)
**Prerequisites:** Phase 12 · 02 (CLIP), Phase 11 (LLM Engineering — instruction tuning)
**Time:** ~180 minutes

## Objetivos de aprendizagem

- Construa um projetor MLP de 2 camadas que mapeie as incorporações de parches ViT (dim 1024) para a dim de incorporação de um LLM (dim 4096).
- Caminhe pela receita de duas etapas do LLaVA: (1) alinhamento do projeto em pares de legendas 558k, (2) sintonização de instruções visuais em viradas geradas por GPT-4 de 158k.
- Construa um prompt em formato LLaVA com o marcador de lugar da imagem, o prompt do sistema e as viradas de usuário/assistente.
- Explique por que a comunidade mudou-se de Q-Former para MLP apesar da vitória do orçamento de token do Q-Former.

## O problema

O Q-Former do BLIP-2 (Lessão 12.03) comprime uma imagem para 32 tokens. Limpo, eficiente, bom para benchmarks. Mas tem dois problemas.

Primeiro, o Q-Former é treinável, mas sua perda não é a tarefa final. A primeira fase treina ITC+ITM+ITG. A segunda fase treina perda de LM. As consultas aprendem alguma representação intermediária que o LLM então tem que decodificar.

Em segundo lugar, o Q-Former toma 188 milhões de parâmetros, e na escala de 2023 da LLaVA você teve que co-desenhá-lo com o seu LLM alvo. Mudança o LLM, retrain o Q-Former. Mudança o codificador de visão, retrain. Cada combinação foi um projeto de P&D separado.

A resposta LLaVA foi embaraçosa em sua simplicidade: pegue os 576 tokens de parche do ViT, cada um através de um MLP de 2 camadas (`1024 → 4096 → 4096`Não há gargalos, não há estágio 1 de pré-treino em objetivos estranhos, apenas treine o MLP em uma perda direta de LM.

A segunda visão da LLaVA: usar GPT-4 (apenas texto) para gerar dados de instrução. Alimentar GPT-4 a legenda COCO e dados de caixa de limites para uma imagem, pedir que produzam conversas, descrições e perguntas de raciocínio complexas. 158k instrução-resposta gira gratuitamente.

O resultado: um VLM que correu em 8 A100s por um dia, venceu Flamingo no MMMU, e enviou um ponto de controle aberto que a comunidade poderia estender.

## O conceito

### A arquitetura

LLaVA-1.5 em 7B:
- Encoder de visão: CLIP ViT-L/14 @ 336 (congelado durante a fase 1, opcionalmente descongelado na fase 2).
- Projector: MLP de 2 camadas com ativação GELU, `1024 → 4096 → 4096`- Não .
- LLM: Vicuna-7B v1.5 (uma variante 13B usa Vicuna-13B; mais tarde as garfos foram transferidas para Llama-3.1-8B).

Passe para a frente uma imagem + texto de solicitação:

```
img -> ViT -> 576 patches of dim 1024
patches -> MLP -> 576 tokens of dim 4096
prompt: system + "<image>" placeholder + user question
replace <image> token with the 576 projected tokens
feed the full sequence to the LLM
decode response
```

A imagem ocupa 576 tokens do contexto LLM. No contexto de 2048, isso deixa 1472 tokens para o texto. No contexto de 32k, é um erro de arredondamento.

### Fase 1: Alineação do projector

Freeze ViT. Freeze LLM. Treinar apenas a MLP de 2 camadas. Dataset: 558k pares de imagem-caption (LAION-CC-SBU). Loss: modelagem de linguagem na legenda, condicionada aos tokens de imagem projetados.

Em uma única época no lote 128 isso é feito em algumas horas. O projetor aprende a mapear o espaço ViT para o espaço LLM.

### Fase 2: sintonização das instruções visuais

Desbloquear o projector (ainda treinável). Desbloquear o LLM (geralmente totalmente, às vezes LoRA). Treinar em 158k viradas de instrução visual.

Os dados de instrução são o truque.
1. Tome uma imagem do COCO.
2. Extrair a descrição do texto (5 legendas humanas + lista de caixa de limite).
3. Enviar para o GPT-4 com três modelos de solicitação:
   - Conversa: "Generar um diálogo entre um usuário e um assistente sobre esta imagem".
   - Descrição detalhada: "Dá uma descrição rica e detalhada da imagem".
   - Raciocínio complexo: "Pergunte uma pergunta que exige raciocínio sobre a imagem, e depois responda-a".
4. Parse a saída do GPT-4 em pares (instrução, resposta).

Nada disso toca diretamente à imagem  apenas a descrição do texto. GPT-4 alucina conteúdo de imagem plausível. Um pouco de ruído, mas funcionou: 158k voltas foi suficiente para desbloquear o diálogo.

### Por que a comunidade copiou isto

- Não há perdas específicas para a fase 1, perdas de LM ao longo.
- O projector treina em horas, não dias.
- O LLM pode ser trocado (LLaVA-Llama2, LLaVA-Mistral, LLaVA-Llama3) apenas reestruturando o projetor.
- O pipeline de dados de instrução visual utiliza o GPT-4 e é barato para regenerar para um novo domínio.

### LLaVA-1.5 e LLaVA-NeXT

LLaVA-1.5 (outubro de 2023) acrescentou:
- Dados académicos (VQA, OKVQA, RefCOCO) misturados para a sintonização das instruções.
- Melhor sistema de urgência.
- Um projeto MLP de 2 camadas em vez da camada linear original, e CLIP ViT-L/14 em 336px (576 tokens) em vez de 224px (256 tokens).
- Uma variante HD que divide a grade no jornal, que LLaVA-NeXT enviou mais tarde como AnyRes.

LLaVA-NeXT ( janeiro de 2024) acrescentou:
- AnyRes: divide imagens de alta resolução em uma grade de 2x2 ou 1x3 de 336x336 culturas, mais uma miniatura global de baixa resolução. Cada colheita se torna 576 tokens. Uma grade de 2x2 mais a miniatura dá cerca de 2880 tokens visuais por imagem. Uma grade de 1x3 tem menos culturas, por isso custa menos tokens. As tarefas OCR e gráfico saltaram.
- Melhor mistura de dados de instrução com ShareGPT4V (captions GPT-4V de alta qualidade).
- Mestrado em Direito Jurídico de base mais forte (Mistral-7B, Yi-34B).

### LLaVA-OneVision

A lição 12.08 abrange OneVision em profundidade. versão curta: o mesmo projetor, mas treinado com um currículo que abrange uma imagem única, várias imagens e vídeo em um modelo com orçamento compartilhado de tokens visuais.

### A comparação com o Q-Former

| | Q-Former (BLIP-2) | MLP (LLaVA) |
|---|---|---|
| Visual tokens per image | 32 | 576 (base) or about 2880 (AnyRes, 2x2 grid) |
| Trainable params | 188M + LM | ~22M (7B) + LM |
| Stage 1 loss | ITC+ITM+ITG | LM only |
| LLM drop-in | Requires retrain | Swap with minimal retrain |
| Multi-image | Awkward | Natural (concat) |
| Video | Awkward | Natural (per-frame concat) |
| Token budget | Small | Large |

O MLP ganha na simplicidade e flexibilidade de tokens. Q-Former ganha no orçamento de tokens. No final de 2023, o orçamento de tokens não era mais a restrição obrigatória (contextos LLM cresceram para 32k-128k +) e a simplicidade dominou.

### O formato de solicitação

```
A chat between a curious human and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the human's questions. USER: <image> Describe this image in detail. ASSISTANT: The image shows ...
```

`<image>`O Tokenizer vê uma sequência ligeiramente mais longa do que foi treinado, mas o LLM lida com a nova entrada porque a etapa 1 ensinou-o a.

### Economia de parâmetros

LLaVA-1.5-7B:
- CLIP ViT-L/14 @ 336: 303M (estadião congelada 1, muitas vezes des congelada, etapa 2).
- Projector (2x linear): ~ 22M de treino.
- Llama-7B: 7B.
- Total: 7,3 B parâmetros. Treinável durante a fase 2: projector completo 7B + 22M.

O custo de treinamento para a etapa 2: ~ 20 horas em 8xA100. Este é o número chave  um dia, um nó, reprodutivel.

```figure
mm-llava-projector
```

## Usá-lo

`code/main.py`Implementos:

1. O projeto MLP de 2 camadas (dim 16 → 32 → 32 para escala de brinquedo) em Python puro.
2. O canal de construção de sistemas de controlo: sistema de controlo de controlo + `<image>`substituído por N tokens projetados + turno de usuário + colocação de geração assistente.
3. Um visualizer para o que o bloco visual de 576 tokens parece no contexto de LLM (percentagem de 2k / 32k / 128k contexto consumido).

## Envia-o

Esta lição produz`outputs/skill-llava-vibes-eval.md`. Tendo em conta um ponto de controlo da família LLaVA, ele opera uma suite de vibrações de 10 pulsos (3 subtítulos, 3 VQA, 2 raciocínios, 2 recusa) e informa um cartão de pontuação legível ao ser humano.

## Exercícios

1. Calcule o número de parâmetros treinaveis para o projeto MLP de 2 camadas em `1024 → 4096 → 4096`Com GELU e Bias, que fracção de LLaVA-13B representa?

2. Construir um aviso de LLaVA para um caso de "recusar"  a imagem contém um indivíduo privado. Escrever a resposta esperada do assistente. Por que o LLaVA deve recusar este tiro zero e que dados de treinamento seriam necessários para reforçar a recusa?

3. Leia a seção AnyRes do blog LLaVA-NeXT. Calcule a contagem de tokens visuais para uma imagem de 1344x672 em AnyRes. Compare com 576 tokens base em 336x336.

4. O projeto LLaVA estágio 1 é treinado com perda de LM em legendas. O que acontece se você saltar a etapa 1 e passar diretamente para a etapa 2 (ajuste de instruções visuais)? Cite a ablação Prismatic VLMs (arXiv:2402.07865) para a resposta.

5. LLaVA-Instruct-150k usa GPT-4 com legendas COCO para gerar instruções. Para um novo domínio (radiografias médicas, imagens de satélite), descreva o pipeline de dados em quatro etapas para gerar instruções de domínio. O que pode dar errado em cada etapa?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Projector | "MLP bridge" | 2-layer MLP with GELU mapping ViT dim to LLM dim |
| Image token | "<image> placeholder" | Prompt marker replaced by N projected visual tokens before inference |
| Visual instruction tuning | "LLaVA stage 2" | Training on GPT-4-generated (image, instruction, response) triplets |
| Stage 1 alignment | "Projector pretraining" | Freeze ViT and LLM, train projector with LM loss on captions |
| AnyRes | "Multi-crop tiling" | Split high-res image into a tile grid and concatenate each tile's visual tokens |
| LLaVA-Instruct | "GPT-4-generated" | 158k instruction-response pairs synthesized from COCO captions + GPT-4 |
| Vision encoder freeze | "Backbone locked" | CLIP weights do not update in stage 1, sometimes not in stage 2 either |
| ShareGPT4V | "Better captions" | 1M dense captions generated by GPT-4V, used for higher-quality alignment |
| VQA | "Visual question answering" | Task of answering a free-form question about an image |
| Prismatic VLMs | "Design-space paper" | Karamcheti 2024 ablation systematically testing projector and data choices |

## Mais leitura

- [Liu et al. — Visual Instruction Tuning (arXiv:2304.08485)](https://arxiv.org/abs/2304.08485)O papel LLaVA.
- [Liu et al. — Improved Baselines with Visual Instruction Tuning (arXiv:2310.03744)](https://arxiv.org/abs/2310.03744) LLaVA-1.5.
- [Chen et al. — ShareGPT4V (arXiv:2311.12793)](https://arxiv.org/abs/2311.12793) conjunto de dados de legendas densas.
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865) Ablações de design-espaço.
- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326) Unificado de imagem única, multi-imagem, vídeo.
