# InternVL3: Pré-treinamento Multimodal Nativo

> Todos os VLM abertos antes do InternVL3 seguiram a mesma receita de três passos: pegue num texto LLM treinado em trilhões de tokens de texto, aperte um codificador de visão, e depois ajuste as costuras. O texto LLM gastou todo o seu orçamento pré-treino em texto puro e não entende nativamente os tokens visuais. Quando adicionar a visão post-hoc, o LLM tem que reaprender a relacionar a entrada visual ao seu raciocínio do texto sem esquecer o texto. O InternVL3 (Zhu et al., abril 2025) rejeita a abordagem pós-hoc: uma corrida pré-treino, texto e multimodal interligados a partir do primeiro passo. O resultado coincide com o Gemini 2.5 Pro no MMMU-Pro com 78B params abertos. Esta lição diz o caso do pré-treino nativo e o que muda quando o fizer.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, training-corpus mixer)
**Prerequisites:** Phase 12 · 05, Phase 12 · 07 (recipes)
**Time:** ~120 minutes

## Objetivos de aprendizagem

- Explique por que o treinamento de VLM pós-hoc acumula dívidas de alinhamento, citando os três sintomas mensuráveis (oblitário catastrófico, deriva de resposta, inconsistência visual-texto).
- Descreva a mistura de corpus pré-treino nativa do InternVL3 e porque a proporção de texto: interligado: subtítulos importa.
- Compare o V2PE (codelagem de posição visual variável) com o M-RoPE do Qwen2-VL.
- Nomear as optimizações de implantação do Router de Resolução Visual (ViR) e da Língua de Visão Desacoplada (DvD).

## O problema

O treinamento pós-hoc é o padrão. LLaVA, BLIP-2, Qwen-VL, Idefics  todos tomam um LLM já treinado (Llama, Vicuna, Qwen, Mistral) e adicionam visão.

1. Mestrado em LLM congelado + codificador de visão congelado + projetor treinável, treinado em pares de legendas para alinhar embutimentos.
2. Descongelar o Mestrado em Direito e Formação em Dados de Instrução (LLaVA-Instruir, ShareGPT4V).
3. Opcional, ajuste específico de tarefa.

Três sintomas da dívida de alinhamento aparecem:

- O VLM pós-hoc esquece as habilidades apenas de texto, os resultados do GSM8K caem de 5 a 10 pontos, os resultados do Hellaswag caem, os agentes de texto puro regressam.
- A resposta deriva. Pequenas frases da mesma pergunta visual obtêm respostas diferentes. O codificador de visão se conecta ao LLM com ligações mais fracas do que os próprios tokens do LLM.
- Incoerência visual-textual. O VLM pode descrever uma imagem corretamente e, em seguida, responder a uma pergunta contradizendo sua própria descrição.

Os sintomas são bem documentados. MM1.5 Secção 4 quantifica-los. As ablações da LLaVA-OneVision sugerem-lhes.

## O conceito

### Pre-treino nativo multimodal

O InternVL3 treina a partir do zero em um corpus que é nativo multimodal a partir do primeiro passo.

- 40% de dados apenas de texto (FineWeb, Proof-Pile-2, etc.)
- 35% de dados de imagem-texto entrelaçados (OBELICS, estilo MMC4)
- 20% de dados de captura de imagem em par
- 5% de dados de vídeo-texto

Tokens de visão, tokens de texto e interações transmodais participam da mesma perda desde o primeiro passo do gradiente.

O modelo base é uma fase única, seguindo-se a sintonia de instruções, mas o modelo base já entende os tokens visuais como cidadãos de primeira classe.

### V2PE (codificação de posição visual variável)

O Qwen2-VL utiliza M-RoPE com alocação de eixo fixo. InternVL3 introduz V2PE: a codificação de posição varia por tipo de modalidade (texto, imagem, vídeo) com escalabilidade apropriada.

- Tokens de texto obter posição 1D (index de texto).
- Os parches de imagem obtêm posição 2D (linha, coluna).
- Os quadros de vídeo obtêm posição 3D (tempo, linha, col).

Os três compartilham a mesma base de frequência RoPE, mas a alocação de dim oculta por banda é um parâmetro aprendido em vez de uma divisão fixa.

A afirmação de ablação do V2PE: 1-2 pontos em benchmarks de vídeo sobre M-RoPE no mesmo cálculo.

### Roteador de resolução visual (ViR)

Optimização de implantação. Nem todas as imagens precisam de codificação em resolução completa. Uma foto com um objeto em baixo detalhe desperdiça tokens quando codificada em 1280px nativo. ViR é um pequeno classificador que prevê a resolução mínima necessária para responder à pergunta, antes de codificar.

O roteamento tem três níveis: baixa resolução (256 tokens), média (576), alta (2048+). Para 60% das consultas no tráfego de produção, baixa ou média é suficiente. Efeito líquido: 2-3x de transmissão em qualidade igual.

### Descopação de Língua de Visão (DvD)

Quando você serve um grande VLM, o codificador de visão é executado uma vez por imagem, mas o LLM é executado autoregressivamente para cada token de saída. Os dois componentes têm gargalos de engarrafamento diferentes (visão = largura de banda de memória da GPU para conv + atenção; LLM = cache KV).

Para um modelo de codificador 8B + 400M, DvD aproximadamente dobrar a capacidade de transmissão por nó versus co-localizado.

### Qualidade de uma fase versus de várias fases

A principal referência de InternVL3 é: em 78B params, coincidem com o MMMU-Pro do Gemini 2.5 Pro. Em 38B, coincidem com o GPT-4o. Em 8B, liderem o ranking de 8B aberto. Tudo em uma receita de preparação de um único estágio + instrução-tune.

A hipótese de dívida de alinhamento é mensurável: o InternVL3-8B perde menos pontos de referência de texto (MMLU, GSM8K) do que o Qwen2.5-VL-7B por unidade de ganho de referência de visão.

### InternVL3.5 e InternVL-U

O InternVL3.5 (agosto 2025) amplia a receita. A mesma abordagem nativa, mais dados, mais parâmetros. Melhorias no MMMU são incrementais.

O InternVL-U (2026) adiciona a saída de imagem de geração unificada  através de cabeças MMDiT no topo da mesma espinha dorsal. A "U" significa "Entendimento + geração", perseguindo modelos unificados de estilo Transfusão (Lessão 12.13).

### Compensações de pré-formação nativa

A formação pré-aprendizagem nativa não é gratuita:

- Computação. Treinar um novo VLM a partir do zero custa o mesmo que treinar um texto LLM  milhões de horas de GPU.
- Dados. Corpos de imagem-texto interligados em escala são raros. OBELICS é 141M documentos; MMC4 é 571M. O texto sozinho é enviado em tokens 15T. A escassez de dados pré-treinamento multimodal é uma restrição dura.
- Base-LLM reutilização. Pre-treinamento nativo desiste da opção de deixar em um novo LLM mais tarde. Post-hoc permite-lhe trocar Llama-3.1 por Llama-4 re-treinando apenas o adaptador.

A aposta que faz o InternVL3 é que a dívida de alinhamento é pior do que a perda de reutilização. Os valores de referência apoiam a alegação. Os custos para produzir impedem que futuros laboratórios replicem barato.

```figure
l5-native-pretrain
```

## Usá-lo

`code/main.py`é um misturador de treinamento e um simulador de roteador ViR.

- Tome um mix de corpus-alvo (% texto, % interleaved, % caption, % video) e calcula as etapas esperadas por modalidade.
- Simula o roteamento ViR em um lote de consultas (distribuição: 50% de baixo detalhe, 30% de médio e 20% de alto detalhe) e relata a contagem média de tokens.
- Relatórios estimativas de transmissão DvD dados em relação a FLOPs de codificação versus LLM.
- Imprime um lado a lado de pós-hoc vs nativo pré-treino em params, computação, dados e sintomas esperados de alinhamento-devedor.

## Envia-o

Esta lição produz`outputs/skill-native-vs-posthoc-auditor.md`- Tendo em conta um plano de formação VLM proposto, verifica se é necessário proceder a um processo de formação nativa ou pós-hoc, indica o risco de alinhamento-devedor e recomenda um mix de corpus.

## Exercícios

1. Estima o delta de computação entre o InternVL3-8B (pre-treino nativo) e o LLaVA-OneVision-7B (post-hoc).

2. InternVL3 relata 40% de texto / 35% entrelaçado / 20% de legenda / 5% de vídeo. Se a sua tarefa-alvo é video-pesado, propor uma nova proporção e argumentar por que o modelo base ainda precisa de substantivos dados de texto e legenda.

3. Leia MM1.5 Secção 4 sobre esquecimento. Nomear o indicador exato onde o treinamento pós-hoc mostrou a maior regressão.

4. O ViR encaminha 60% do tráfego para codificação de baixa resolução. Que tipos de consultas encaminha mal (envia para baixa resolução quando é necessária alta resolução)? Propõe três modos de falha do roteador.

5. O DvD divide a visão e o LLM em GPUs separadas.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Native multimodal pretraining | "From scratch together" | Text + image + video tokens participate in the loss from step 1, not bolted on later |
| Alignment debt | "Post-hoc penalty" | Measurable regression in text skills and answer consistency that comes from bolting vision onto a frozen LLM |
| V2PE | "Variable visual pos encoding" | Per-modality learnable position encoding allocation; InternVL3's M-RoPE successor |
| ViR | "Resolution router" | Small classifier that picks minimum resolution needed per query before encoding, saving inference tokens |
| DvD | "Decoupled deployment" | Vision encoder on one GPU, LLM on another, with stream handoff; doubles throughput for large VLMs |
| InternVL-U | "Unified understanding + generation" | 2026 follow-up that adds image-generation heads to the native-pretrain backbone |
| Interleaved corpus | "OBELICS / MMC4" | Documents with text and images in natural reading order; the raw material for native pretraining |

## Mais leitura

- [Chen et al. — InternVL 1 (arXiv:2312.14238)](https://arxiv.org/abs/2312.14238)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
- [InternVL3.5 (arXiv:2508.18265)](https://arxiv.org/abs/2508.18265)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Zhang et al. — MM1.5 (arXiv:2409.20566)](https://arxiv.org/abs/2409.20566)
