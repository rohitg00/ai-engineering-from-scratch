# LLaVA e Ajuste de Instrução Visual

> LLaVA (abril de 2023) é a arquitetura multimodal mais copiada do planeta. Substituiu o Q-Former do BLIP-2 por um MLP de 2 camadas, substituiu a cross-attention com gate do Flamingo por concatenação direta de tokens e treinou em 158k turnos de instrução visual gerados por GPT-4 a partir de legendas só de texto. Qualquer praticante que construiu um VLM entre 2023 e 2026 construiu alguma variante do LLaVA. LLaVA-1.5 adicionou AnyRes. LLaVA-NeXT aumentou resolução. LLaVA-OneVision unificou imagem, multi-imagem e vídeo em uma receita. Essa lição lê a receita, implementa o projetor e explica por que "mais simples ganhou."

**Tipo:** Construção
**Linguagens:** Python (stdlib, projetor + construtor de template de instrução)
**Pré-requisitos:** Fase 12 · 02 (CLIP), Fase 11 (Engenharia de LLM — ajuste de instrução)
**Tempo:** ~180 minutos

## Objetivos de Aprendizado

- Construir um projetor MLP de 2 camadas que mapeia embeddings de patch do ViT (dim 1024) pra dim de embedding do LLM (dim 4096).
- Percorrer a receita em duas etapas do LLaVA: (1) alinhamento do projetor em 558k pares de legenda, (2) ajuste de instrução visual em 158k turnos gerados por GPT-4.
- Construir um prompt no formato LLaVA com o placeholder de token de imagem, prompt de sistema e turnos usuário/assistente.
- Explicar por que a comunidade migrou do Q-Former pro MLP apesar da vitória do Q-Former em orçamento de tokens.

## O Problema

O Q-Former do BLIP-2 (Lição 12.03) comprime uma imagem em 32 tokens. Limpo, eficiente, bom pra benchmarks. Mas tem dois problemas.

Primeiro, o Q-Former é treinável mas sua perda não é a tarefa final. Etapa 1 treina ITC+ITM+ITG. Etapa 2 treina perda LM. As queries aprendem alguma representação intermediária que o LLM depois tem que decodificar. Informação se perde no gargalo.

Segundo, o Q-Former consome 188M parâmetros, e na escala de 2023 do LLaVA você tinha que codesignar ele com seu LLM-alvo. Mudar o LLM, retreinar o Q-Former. Mudar o encoder de visão, retreinar. Cada combinação era um projeto de P&D separado.

A resposta do LLaVA foi embaraçosamente simples: pegar os 576 patch tokens do ViT, passar cada um por um MLP de 2 camadas (`1024 → 4096 → 4096`) e despejar todos os 576 na sequência de entrada do LLM. Sem gargalo. Sem pré-treinamento da etapa 1 com objetivos estranhos. Apenas treinar o MLP numa perda LM direta.

De onde vêm os dados? A segunda sacada do LLaVA: usar GPT-4 (só texto) pra gerar dados de instrução. Alimentar o GPT-4 com a legenda do COCO e dados de bounding box pra uma imagem, pedir pra ele produzir conversas, descrições e questões de raciocínio complexo. 158k turnos instrução-resposta de graça. Sem anotação humana.

O resultado: um VLM que rodou em 8 A100s por um dia, superou o Flamingo no MMMU e entregou um checkpoint aberto que a comunidade podia estender. No final de 2023, já tinha gerado 50+ forks.

## O Conceito

### A arquitetura

LLaVA-1.5 em 13B:
- Encoder de visão: CLIP ViT-L/14 @ 336 (congelado na etapa 1, opcionalmente descongelado na etapa 2).
- Projetor: MLP de 2 camadas com ativação GELU, `1024 → 4096 → 4096`.
- LLM: Vicuna-13B (depois Llama-3.1-8B).

Forward pass numa imagem + prompt de texto:

```
img -> ViT -> 576 patches de dim 1024
patches -> MLP -> 576 tokens de dim 4096
prompt: sistema + "<image>" placeholder + pergunta do usuário
substituir token <image> pelos 576 tokens projetados
alimentar a sequência completa no LLM
decodificar resposta
```

A imagem ocupa 576 tokens do contexto do LLM. Em contexto de 2048, sobram 1472 tokens pra texto. Em contexto de 32k, é um erro de arredondamento.

### Etapa 1: alinhamento do projetor

Congela ViT. Congela LLM. Treina só o MLP de 2 camadas. Dataset: 558k pares imagem-legenda (LAION-CC-SBU). Perda: modelagem de linguagem na legenda, condicionado nos tokens de imagem projetados.

Em uma única epoch a batch 128, isso leva umas poucas horas. O projetor aprende a mapear espaço ViT pro espaço LLM. Sem supervisão específica de tarefa.

### Etapa 2: ajuste de instrução visual

Descongela o projetor (ainda treinável). Descongela o LLM (geralmente totalmente, às vezes LoRA). Treina em 158k turnos de instrução visual.

Os dados de instrução são o truque. Liu et al. os geraram assim:
1. Pegar uma imagem do COCO.
2. Extrair a descrição de texto (5 legendas humanas + lista de bounding boxes).
3. Enviar pro GPT-4 com três templates de prompt:
   - Conversa: "Gere um diálogo de ida e volta entre um usuário e um assistente sobre esta imagem."
   - Descrição detalhada: "Dê uma descrição rica e detalhada da imagem."
   - Raciocínio complexo: "Faça uma pergunta que exija raciocínio sobre a imagem, depois responda."
4. Parsear a saída do GPT-4 em pares (instrução, resposta).

Nada disso toca a imagem diretamente — só a descrição textual. GPT-4 alucina conteúdo de imagem plausível. Algum ruído, mas funcionou: 158k turnos foram suficientes pra desbloquear diálogo.

### Por que a comunidade copiou isso

- Sem perdas específicas da etapa 1 pra ajustar. Perda LM durante todo o processo.
- Projetor treina em horas, não dias.
- LLM pode ser trocado (LLaVA-Llama2, LLaVA-Mistral, LLaVA-Llama3) retreinando só o projetor.
- Pipeline de dados de instrução visual usa GPT-4 e é barato regenerar pra um novo domínio.

### LLaVA-1.5 e LLaVA-NeXT

LLaVA-1.5 (outubro de 2023) adicionou:
- Dados de tarefas acadêmicas (VQA, OKVQA, RefCOCO) misturados no ajuste de instrução.
- Melhor prompt de sistema.
- 2048 → 32k de contexto.

LLaVA-NeXT (janeiro de 2024) adicionou:
- AnyRes: divide imagens de alta resolução numa grade 2x2 ou 1x3 de crops de 336x336, mais um thumbnail global de baixa resolução. Cada crop vira 576 tokens; total ao redor de 2880 tokens visuais por imagem. Tarefas de OCR e gráficos dispararam.
- Melhor mistura de dados de instrução com ShareGPT4V (legendas de alta qualidade com GPT-4V).
- LLMs base mais fortes (Mistral-7B, Yi-34B).

### LLaVA-OneVision

Lição 12.08 cobre OneVision em profundidade. Versão curta: mesmo projetor, mas treinado com um currículo que cobre imagem única, multi-imagem e vídeo num modelo único com orçamento de tokens visual compartilhado.

### Comparação com Q-Former

| | Q-Former (BLIP-2) | MLP (LLaVA) |
|---|---|---|
| Tokens visuais por imagem | 32 | 576 (base) ou 2880 (AnyRes) |
| Parâmetros treináveis | 188M + LM | 40M + LM |
| Perda etapa 1 | ITC+ITM+ITG | Só LM |
| Troca de LLM | Exige retreino | Troca com retreino mínimo |
| Multi-imagem | Desajeitado | Natural (concat) |
| Vídeo | Desajeitado | Natural (concat por frame) |
| Orçamento de tokens | Pequeno | Grande |

MLP ganha em simplicidade e flexibilidade de tokens. Q-Former ganha em orçamento de tokens. No final de 2023, o orçamento de tokens não era mais a restrição limitante (contextos de LLM cresceram pra 32k-128k+) e simplicidade dominou.

### O formato do prompt

```
A chat between a curious human and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the human's questions. USER: <image> Describe this image in detail. ASSISTANT: The image shows ...
```

`<image>` é um token placeholder. Antes da tokenização, é substituído pelos 576 tokens visuais (ou 2880 com AnyRes). O tokenizador vê uma sequência um pouco maior do que foi treinado, mas o LLM lida com a entrada inédita porque a etapa 1 ensinou ele a isso.

### Economia de parâmetros

Detalhamento do LLaVA-1.5-7B:
- CLIP ViT-L/14 @ 336: 303M (congelado etapa 1, frequentemente descongelado etapa 2).
- Projetor (2x linear): ~22M treináveis.
- Llama-7B: 7B.
- Total: 7.3B parâmetros. Treináveis na etapa 2: 7B completos + 22M do projetor.

Custo de treino pra etapa 2: ~20 horas em 8xA100. Esse é o número chave — um dia, um nó, reproduzível. É por isso que LLaVA se espalhou.

## Use

`code/main.py` implementa:

1. O projetor MLP de 2 camadas (dim 16 → 32 → 32 em escala de brinquedo) em Python puro.
2. O pipeline de construção de prompt: prompt de sistema + `<image>` substituído por N tokens projetados + turno do usuário + placeholder de geração do assistente.
3. Um visualizador do que o bloco visual de 576 tokens parece no contexto do LLM (porcentagem de contexto 2k / 32k / 128k consumida).

## Entregue

Essa lição produz `outputs/skill-llava-vibes-eval.md`. Dado um checkpoint da família LLaVA, roda um conjunto de vibes-eval de 10 prompts (3 legendas, 3 VQA, 2 raciocínio, 2 recusa) e relata um placar legível por humanos. Não é um benchmark; é um smoke test pra confirmar que projetor e LLM estão se conectando bem.

## Exercícios

1. Calcule a contagem de parâmetros treináveis pro projetor MLP de 2 camadas em `1024 → 4096 → 4096`. Com GELU e bias, que fração do LLaVA-13B ele representa?

2. Construa um prompt LLaVA pra um caso de "recusa" — a imagem contém um indivíduo privado. Escreva a resposta esperada do assistente. Por que LLaVA deveria recusar isso zero-shot e quais dados de treino seriam necessários pra reforçar a recusa?

3. Leia a seção AnyRes do blog do LLaVA-NeXT. Calcule a contagem de tokens visuais pra uma imagem 1344x672 em AnyRes. Compare com os 576 tokens base em 336x336.

4. O projetor da etapa 1 do LLaVA é treinado com perda LM em legendas. O que acontece se você pular a etapa 1 e ir direto pra etapa 2 (ajuste de instrução visual)? Cite o ablation do Prismatic VLMs (arXiv:2402.07865) pra resposta.

5. LLaVA-Instruct-150k usa GPT-4 com legendas do COCO pra gerar instruções. Pra um novo domínio (raios-X médicos, imagens de satélite), descreva o pipeline de dados de quatro etapas pra gerar instruções do domínio. O que pode dar errado em cada etapa?

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|-------------------------|
| Projetor | "Ponte MLP" | MLP de 2 camadas com GELU que mapeia dim ViT pra dim LLM |
| Token de imagem | "Placeholder \<image\>" | Marcador de prompt substituído por N tokens visuais projetados antes da inferência |
| Ajuste de instrução visual | "LLaVA etapa 2" | Treino em tripletes (imagem, instrução, resposta) gerados por GPT-4 |
| Alinhamento etapa 1 | "Pré-treinamento do projetor" | Congela ViT e LLM, treina projetor com perda LM em legendas |
| AnyRes | "Mosaico multi-crop" | Divide imagem de alta resolução numa grade de tiles e concatena os tokens visuais de cada tile |
| LLaVA-Instruct | "Gerado por GPT-4" | 158k pares instrução-resposta sintetizados a partir de legendas do COCO + GPT-4 |
| Congelamento do encoder de visão | "Backbone travado" | Pesos do CLIP não atualizam na etapa 1, às vezes não na etapa 2 também |
| ShareGPT4V | "Melhores legendas" | 1M legendas densas geradas por GPT-4V, usadas pra alinhamento de maior qualidade |
| VQA | "Resposta a perguntas visuais" | Tarefa de responder uma pergunta livre sobre uma imagem |
| Prismatic VLMs | "Artigo de espaço de design" | Ablation do Karamcheti 2024 testando sistematicamente escolhas de projetor e dados |

## Leitura Complementar

- [Liu et al. — Visual Instruction Tuning (arXiv:2304.08485)](https://arxiv.org/abs/2304.08485) — o artigo do LLaVA.
- [Liu et al. — Improved Baselines with Visual Instruction Tuning (arXiv:2310.03744)](https://arxiv.org/abs/2310.03744) — LLaVA-1.5.
- [Chen et al. — ShareGPT4V (arXiv:2311.12793)](https://arxiv.org/abs/2311.12793) — dataset de legendas densas.
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865) — ablations de espaço de design.
- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326) — unificado imagem única, multi-imagem, vídeo.