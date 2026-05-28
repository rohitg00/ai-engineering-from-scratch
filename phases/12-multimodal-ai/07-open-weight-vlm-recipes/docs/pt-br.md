# Receitas de VLMs de Pesos Abertos: O Que Realmente Importa

> A literatura de VLMs de pesos abertos de 2024-2026 é um bosque de tabelas de ablation. MM1 da Apple testou 13 combinações de encoder de imagem, conector e mistura de dados. Molmo do Allen AI provou que legendas humanas detalhadas superam destilação de GPT-4V. Cambrian-1 rodou 20+ comparações de encoders. Idefics2 formalizou o espaço de design de cinco eixos. Prismatic VLMs comparou 27 receitas de treino num benchmark controlado. De todo esse ruído, um pequeno conjunto de resultados se mantém entre artigos: o encoder de imagem importa mais que a arquitetura do conector, a mistura de dados importa mais que ambos, e legendas humanas detalhadas superam dados sintéticos destilados. Essa lição lê essas tabelas pra você não ter que ler.

**Tipo:** Aprendizado + laboratório
**Linguagens:** Python (stdlib, parser de tabela de ablation + selecionador de receita)
**Pré-requisitos:** Fase 12 · 05 (LLaVA baseline)
**Tempo:** ~180 minutos

## Objetivos de Aprendizado

- Nomear o espaço de design de VLM de cinco eixos: encoder de imagem, conector, LLM, mistura de dados, cronograma de resolução.
- Ler uma tabela de ablation do MM1 / Idefics2 / Cambrian-1 e prever qual ajuste move um benchmark dado.
- Escolher uma receita (encoder, conector, dados, resolução) pra um novo VLM dado um orçamento de computação e mistura de tarefas.
- Explicar por que legendas humanas detalhadas superam destilação de GPT-4V no mesmo número de tokens.

## O Problema

Existem centenas de VLMs de pesos abertos. A maior parte da lacuna entre "bom" e "estado da arte" não é arquitetura. São dados, cronograma de resolução e escolha do encoder. Saber qual botão girar primeiro quando seu modelo tem performance ruim te poupa um erro de 5 milhões de horas-GPU.

A onda de 2023 (LLaVA-1.5, InstructBLIP, MiniGPT-4) rodou em pré-treinamento com pares de legenda + LLaVA-Instruct-150k. Baseline bom. Estagnou em torno de MMMU 35%.

A onda de 2024 (MM1, Idefics2, Molmo, Cambrian-1, Prismatic VLMs) rodou ablations exaustivos. Resultados surpreendentes e práticos.

## O Conceito

### O espaço de design de cinco eixos

Idefics2 (Laurençon et al., 2024) nomeou os eixos:

1. Encoder de imagem. CLIP ViT-L/14, SigLIP SO400m/14, DINOv2 ViT-g/14, InternViT-6B. Encoders diferem em tamanho de patch, resolução e objetivo de pré-treinamento.
2. Conector. MLP (2-4 camadas), Q-Former (32 queries + cross-attn), Perceiver Resampler (64 queries), C-Abstractor (convolucional + pooling bilinear).
3. Modelo de linguagem. Llama-3 8B / 70B, Mistral 7B, Phi-3, Gemma-2, Qwen2.5. Tamanho do LLM é o custo dominante de parâmetros.
4. Dados de treino. Pares de legenda (CC3M, LAION), intercalados (OBELICS, MMC4), instrução (LLaVA-Instruct, ShareGPT4V, PixMo, Cauldron).
5. Cronograma de resolução. Fixo 224/336/448, AnyRes, dinâmico nativo. Aumentado durante treino ou constante.

Todo VLM em produção faz uma escolha em cada eixo. A maior parte da variância nas pontuações MMMU é explicada pelos eixos 1, 4 e 5 — não por qual conector você escolheu.

### Eixo 1: encoder > conector

Seção 3.2 do MM1 mostrou: trocar de CLIP ViT-L/14 pra SigLIP SO400m/14 adicionou 3+ pontos MMMU. Trocar o conector de MLP pra Perceiver Resampler adicionou menos de 1 ponto. Idefics2 replicou: SigLIP > CLIP, Q-Former ≈ MLP ≈ Perceiver no mesmo número de tokens.

"Cambrian Vision Encoders Match-Up" do Cambrian-1 (Tong et al., 2024) rodou 20+ encoders num benchmark visão-centrado (CV-Bench). O topo do ranking é uma mistura de DINOv2 e SigLIP; CLIP fica no meio; ImageBind e ViT-MAE ficam abaixo. A lacuna do CLIP ViT-L pro DINOv2 ViT-g/14 é de ~5-7 pontos no CV-Bench.

O encoder padrão de 2026 pra VLMs abertos é SigLIP 2 SO400m/14 pra features semânticas + densas, às vezes concatenado com features DINOv2 ViT-g/14 ("Spatial Vision Aggregator" do Cambrian faz isso).

### Eixo 2: design de conector é irrelevante

MM1, Idefics2, Prismatic e MM-Interleaved todos chegaram na mesma conclusão: com contagem de tokens visual fixa, a arquitetura do conector quase não importa. Um MLP de 2 camadas em patches com pooling médio performa dentro de 1 ponto de um Q-Former de 32 queries no mesmo orçamento de tokens.

O que importa é a contagem de tokens. Mais tokens visuais = mais computação do LLM = performance melhor até certo ponto, depois rendimento decrescente. 64 tokens por imagem é pouco pra OCR. 576-1024 tokens é o ponto ideal pra maioria dos VLMs abertos. 2048+ só ajuda pra documentos e gráficos.

Q-Former vs MLP é questão de custo, não qualidade: Q-Former limita tokens em 32-64 independentemente da resolução da imagem; MLP emite todos os patch tokens. Pra entradas de alta resolução, Q-Former economiza contexto do LLM; pra baixa resolução, a diferença é ruído.

### Eixo 3: tamanho do LLM define o teto

Dobrar o LLM de 7B pra 13B adiciona 2-4 pontos no MMMU de forma confiável em todo artigo de VLM. Em 70B você satura a maioria dos benchmarks. O teto de raciocínio multimodal do VLM é o teto de raciocínio de texto do LLM — o encoder visual só pode alimentá-lo, não raciocinar por ele.

É por isso que Qwen2.5-VL-72B e Claude Opus 4.7 esmagam MMMU-Pro e ScreenSpot-Pro: o cérebro de linguagem é enorme. Um VLM de 7B não substitui um VLM de 70B por design inteligente de conector.

### Eixo 4: dados — legendas humanas detalhadas superam destilação

Molmo + PixMo (Deitke et al., 2024) é o resultado de 2024 que todo mundo deveria ler. Allen AI teve anotadores humanos descrevendo imagens em passes de fala-densa de 1-3 minutos, produzindo 712K imagens densamente legendadas. Sem destilação de GPT-4V em nenhum lugar dos dados de treino.

Molmo-72B superou Llama-3.2-90B-Vision em 11 de 11 benchmarks. A diferença não é arquitetura — é qualidade de legenda. Legendas humanas detalhadas contêm 5-10x mais informação por imagem que legendas web curtas e permanecem factualmente fundamentadas onde destilação de GPT-4V alucina.

ShareGPT4V (Chen et al., 2023) e Cauldron (Idefics2) seguiram o mesmo playbook com legendas misturadas humanas + GPT-4V. A tendência é clara: pra fronteira de 2026, densidade de legenda > quantidade de legenda > conveniência de destilação.

### Eixo 5: resolução e seu cronograma

Ablations do Idefics2: 384 -> 448 adiciona 1-2 pontos. 448 -> 980 com divisão de imagem (AnyRes) adiciona mais 3-5 em benchmarks de OCR. Treino em resolução plana estagna em acurácia média; aumento de resolução (começa em 224, termina em 448 ou nativo) treina mais rápido e termina mais alto.

Cambrian-1 rodou um trade-off resolução vs tokens: com computação fixa, você pode ter mais tokens em resolução menor ou menos tokens em resolução maior. Resolução maior ganha pra OCR; menos resolução-mais-tokens ganha pra compreensão geral de cenas.

A receita de produção de 2026: treinar Etapa 1 em 384 fixo, Etapa 2 com resolução dinâmica até 1280 pra tarefas com foco em OCR.

### A comparação controlada do Prismatic

Prismatic VLMs (Karamcheti et al., 2024) é o artigo que controlou todos os eixos. Mesmo LLM de 13B, mesmos dados de instrução, mesma avaliação — só um eixo varia por vez. Resultados:

- Contagem de tokens visuais por imagem explica ~60% da variância.
- Escolha do encoder explica ~20%.
- Arquitetura do conector explica ~5%.
- Todo o resto (mistura de dados, scheduler, LR) os ~15% restantes.

Essa é uma decomposição aproximada, mas é a resposta mais limpa pra "o que devo ablationar primeiro" na literatura.

### Um selecionador pra 2026

Dada a evidência, a receita padrão de VLM aberto pra um novo projeto em 2026:

- Encoder: SigLIP 2 SO400m/14 em resolução nativa com NaFlex, concatenado com DINOv2 ViT-g/14 pra features densas se precisar de segmentação/grounding.
- Conector: MLP de 2 camadas em patch tokens. Pule Q-Former a menos que você seja limitado por tokens.
- LLM: Qwen2.5 / Llama-3.1 / Gemma 2, 7B pra custo, 70B pra qualidade, escolhido pela latência-alvo.
- Dados: PixMo + ShareGPT4V + Cauldron, completado com dados de instrução eespecificaçãoíficos de tarefa.
- Resolução: dinâmica (mín 256, máx 1280 pixels por lado longo).
- Cronograma: Etapa 1 alinhamento (só projetor), Etapa 2 fine-tuning completo, Etapa 3 fine-tuning eespecificaçãoífico de tarefa.

Cada uma dessas premissas remonta a uma ablation mensurada nos artigos citados no final dessa lição.

## Use

`code/main.py` é um parser de tabela de ablation e selecionador de receita. Ele codifica as tabelas de ablation do MM1 e Idefics2 (condensadas) e permite consultar:

- "Dado orçamento X e tarefa Y, qual receita ganha?"
- "Se eu trocar SigLIP por CLIP num Llama 7B, qual é o delta MMMU esperado?"
- "Qual eixo devo ablationar primeiro pra ter 80% de confiança?"

A saída é uma lista ranqueada de receitas com deltas esperados de benchmark e uma recomendação de "ablationar primeiro."

## Entregue

Essa lição produz `outputs/skill-vlm-recipe-picker.md`. Dada uma mistura-alvo de tarefas, um orçamento de computação e uma latência-alvo, emite uma receita completa (encoder, conector, LLM, mistura de dados, cronograma de resolução) com citações pra ablation que justifica cada escolha. Impede engenheiros de reinventar a tabela de ablation do Idefics2 toda vez que um novo projeto de VLM começa.

## Exercícios

1. Leia Seção 3.2 do MM1. Pra um LLM fixo de 2B com orçamento de 50M imagens, qual encoder ganha? A resposta inverteria com LLM de 13B? Por quê?

2. Cambrian-1 descobre que concatenar DINOv2 + SigLIP supera cada um sozinho em benchmarks visão-centrados mas não adiciona sinal no MMMU. Prevê quais benchmarks ganham e quais ficam planos.

3. Seu alvo é um agente de UI mobile num LLM de 2B. Escolha encoder, conector, resolução e mistura de dados. Justifique cada escolha com uma tabela de ablation eespecificaçãoífica.

4. Molmo entrega modelos de 4B e 72B. O 4B é competitivo com VLMs fechados de 7B; o 72B supera Llama-3.2-90B-Vision em 11/11 benchmarks. O que isso te diz sobre a hipótese de platô no tamanho do LLM?

5. Projete uma tabela de ablation pra isolar qualidade da mistura de dados da qualidade do encoder num VLM de 7B. Mínimo de quantas corridas de treino? Proponha as quatro configurações de eixo.

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|-------------------------|
| Ablation | "Girar um botão" | Treinar múltiplas corridas que diferem em exatamente um eixo do espaço de design, mantendo todo o resto constante |
| Conector | "Ponte" / "projetor" | Módulo treinável que mapeia a saída do encoder de visão pro espaço de tokens do LLM (MLP, Q-Former, Perceiver) |
| Legenda humana detalhada | "Legenda densa" | Descrição humana multi-frase (tipicamente 80-300 tokens) mais rica que um alt text web |
| Destilação | "Legendas GPT-4V" | Dados de treino gerados por um VLM proprietário mais forte; conveniente mas propenso a herdar alucinação |
| AnyRes / res dinâmica | "Caminho de alta resolução" | Estratégia pra alimentar imagens maiores que a resolução nativa do encoder via mosaico ou M-RoPE |
| Aumento de resolução | "Currículo" | Cronograma de treino que começa em baixa resolução e aumenta, acelerando aprendizado de alinhamento |
| Benchmark visão-centrado | "CV-Bench / BLINK" | Avaliação que enfatiza percepção visual refinada em vez de raciocínio pesado em linguagem |
| PixMo | "Dados do Molmo" | Dataset de 712K imagens densamente legendadas do Allen AI; fala humana transcrita em legendas densas |

## Leitura Complementar

- [McKinzie et al. — MM1 (arXiv:2403.09611)](https://arxiv.org/abs/2403.09611)
- [Laurençon et al. — Idefics2 / What matters building VLMs (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Deitke et al. — Molmo and PixMo (arXiv:2409.17146)](https://arxiv.org/abs/2409.17146)
- [Tong et al. — Cambrian-1 (arXiv:2406.16860)](https://arxiv.org/abs/2406.16860)
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865)