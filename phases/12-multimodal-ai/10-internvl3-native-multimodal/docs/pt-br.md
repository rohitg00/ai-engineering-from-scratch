# InternVL3: Pre-treinamento Multimodal Nativo

> Todo VLM open-source antes do InternVL3 seguiu a mesma receita de três etapas: pegar um LLM de texto treinado em trilhões de tokens de texto, enfiar um encoder de visão, e fazer fine-tuning nas juntas. Funciona, mas gera uma dívida de alinhamento — o LLM de texto gastou todo o orçamento de pré-treinamento em texto puro e não entende nativamente tokens visuais. Quando você adiciona visão depois, o LLM precisa reaprender a relacionar entrada visual com seu raciocínio de texto sem esquecer o texto. O InternVL3 (Zhu et al., abril 2025) rejeita a abordagem post-hoc: um único pré-treinamento, texto e multimodal intercalados desde o primeiro step. O resultado rivaliza com o Gemini 2.5 Pro no MMMU-Pro com 78B de parâmetros open. Esta aula analisa o caso do pré-treinamento nativo e o que muda quando você o implementa.

**Tipo:** Aprendizado
**Linguagens:** Python (stdlib, mixer de corpus de treinamento)
**Pré-requisitos:** Fase 12 · 05, Fase 12 · 07 (receitas)
**Tempo:** ~120 minutos

## Objetivos de Aprendizado

- Explicar por que o treinamento post-hoc de VLM acumula dívida de alinhamento, citando os três sintomas mensuráveis (esquecimento catastrófico, deriva de respostas, inconsistência visual-texto).
- Descrever o mix de corpus de pré-treinamento nativo do InternVL3 e por que a proporção de texto : intercalado : legenda importa.
- Comparar V2PE (codificação posicional visual variável) com o M-RoPE do Qwen2-VL.
- Nomear as otimizações de deployment Visual Resolution Router (ViR) e Decoupled Vision-Language (DvD).

## O Problemo

O treinamento post-hoc de VLM é o padrão. LLaVA, BLIP-2, Qwen-VL, Idefics — todos pegam um LLM já pré-treinado (Llama, Vicuna, Qwen, Mistral) e adicionam visão. As etapas de treinamento tipicamente são:

1. LLM congelado + encoder de visão congelado + projetor treinável, treinado em pares de legendas para alinhar embeddings.
2. Descongelar o LLM, treinar em dados de instrução (LLaVA-Instruct, ShareGPT4V).
3. Fine-tune opcional específico para a tarefa.

Três sintomas da dívida de alinhamento aparecem:

- Esquecimento catastrófico. O VLM post-hoc esquece habilidades puramente de texto. Scores no GSM8K caem 5-10 pontos. Scores no Hellaswag caem. Agents puramente de texto regredem.
- Deriva de respostas. Pequenas variações na mesma pergunta visual geram respostas diferentes. O encoder de visão se conecta ao LLM com vínculos mais fracos que os próprios tokens do LLM.
- Inconsistência visual-texto. O VLM descreve uma imagem corretamente e depois responde uma pergunta contradizendo sua própria descrição. Tokens visuais não participam das verificações de consistência interna do LLM da mesma forma que o texto.

Esses sintomas são bem documentados. A Seção 4 do MM1.5 os quantifica. As ablações do LLaVA-OneVision sugerem eles. Pré-treinamento nativo é a resposta.

## O Conceito

### Pré-treinamento multimodal nativo

O InternVL3 treina do zero em um corpus que é multimodal nativo desde o primeiro step. O mix é:

- 40% dados apenas de texto (FineWeb, Proof-Pile-2, etc.)
- 35% dados intercalados de imagem-texto (OBELICS, estilo MMC4)
- 20% dados pareados de imagem-legenda
- 5% dados de vídeo-texto

Tokens visuais, tokens de texto e interações cross-modal participam da mesma loss desde o primeiro gradiente. Sem pré-treinamento de alinhamento, sem etapa de congelamento do projetor, sem esquecimento catastrófico pra se recuperar.

O treinamento é uma etapa única para o modelo base. A instrução tuning vem depois, mas o modelo base já entende tokens visuais como cidadãos de primeira classe.

### V2PE (codificação posicional visual variável)

O Qwen2-VL usa M-RoPE com alocação fixa de eixo. O InternVL3 introduz V2PE: a codificação posicional varia por tipo de modalidade (texto, imagem, vídeo) com escalonamento aprendível. Na prática:

- Tokens de texto recebem posição 1D (índice do texto).
- Patches de imagem recebem posição 2D (linha, coluna).
- Frames de vídeo recebem posição 3D (tempo, linha, coluna).

Os três compartilham a mesma base de frequência RoPE, mas a alocação de dimensão oculta por banda é um parâmetro aprendido ao invés de uma divisão fixa. Liberdade pra trocar resolução temporal vs espacial durante o pré-treinamento.

A reivindicação de ablação do V2PE: 1-2 pontos em benchmarks de vídeo sobre o M-RoPE com o mesmo compute. Não é uma revolução, mas mais limpo.

### Visual Resolution Router (ViR)

Otimização de deployment. Nem todas as imagens precisam de codificação em resolução completa. Uma foto com um objeto em baixo detalhe desperdiça tokens quando codificada em 1280px nativo. ViR é um classificador pequeno que prevê a resolução mínima necessária pra responder a pergunta, antes da codificação.

O roteamento tem três níveis: baixa-res (256 tokens), média (576), alta (2048+). Pra 60% das queries em tráfego de produção, baixa ou média é suficiente. Efeito líquido: 2-3x de throughput com qualidade igual.

### Decoupled Vision-Language deployment (DvD)

Quando você serve um VLM grande, o encoder de visão roda uma vez por imagem, mas o LLM roda autoregressivamente pra cada token de saída. Os dois componentes têm gargalos diferentes (visão = largura de banda de memória GPU pra conv + attention; LLM = KV cache). DvD coloca eles em GPUs separadas com streaming entre elas.

Pra um modelo de 8B + 400M encoder, DvD mais ou menos dobra o throughput por nó em comparação com co-locado.

### Qualidade single-stage vs multi-stage

A principal reivindicação de benchmark do InternVL3: com 78B de parâmetros, rivaliza com o MMMU-Pro do Gemini 2.5 Pro. Com 38B, rivaliza com o GPT-4o. Com 8B, lidera o leaderboard open-8B. Tudo com uma receita de pré-treinamento single-stage + instrução tuning.

A hipótese da dívida de alinhamento é mensurável: InternVL3-8B perde menos pontos em benchmarks de texto (MMLU, GSM8K) por unidade de ganho em benchmarks visuais que o Qwen2.5-VL-7B. O modelo é mais generalista porque o treinamento foi uma peça só, não duas.

### InternVL3.5 e InternVL-U

O InternVL3.5 (agosto 2025) escala a receita. Mesmo método de pré-treinamento nativo, mais dados, mais parâmetros. Melhorias no MMMU são incrementais.

O InternVL-U (2026) adiciona geração unificada — saída de imagem via cabeças MMDiT sobre a mesma backbone. O "U" significa "Understanding + generation" (Compreensão + geração), seguindo o estilo Transfusion de modelos unificados (Aula 12.13). A mesma backbone de pré-treinamento nativo suporta tanto cabeças de compreensão quanto de geração.

### Trade-offs do pré-treinamento nativo

Pré-treinamento nativo não é de graça:

- Compute. Treinar um novo VLM do zero custa o mesmo que treinar um LLM de texto — milhões de GPU-hours. Adaptação post-hoc reutiliza pesos existentes do LLM, economizando a maior parte do custo.
- Dados. Corpora intercalados de imagem-texto em escala são raros. OBELICS tem 141M documentos; MMC4 tem 571M. Texto puro já chega a 15T tokens. Escassez de dados de pré-treinamento multimodal é uma restrição dura.
- Reuso de base-LLM. Pré-treinamento nativo abre mão da opção de trocar o LLM depois. Post-hoc permite trocar Llama-3.1 por Llama-4 retreinando apenas o adapter.

A aposta do InternVL3: a dívida de alinhamento é pior que a perda de reuso. Os benchmarks comprovam a alegação. O custo de produção barra laboratórios de replicar barato. VLMs post-hoc continuarão existindo porque continuam mais baratos pra maioria dos projetos.

## Use

`code/main.py` é um mixer de corpus de treinamento e simulador de roteamento ViR. Ele:

- Aceita um mix alvo de corpus (%texto, %intercalado, %legenda, %vídeo) e calcula steps esperados por modalidade.
- Simula roteamento ViR em um batch de queries (distribuição: 50% baixo-det, 30% médio, 20% alto-det) e reporta contagem média de tokens.
- Reporta estimativas de throughput do DvD dado encoder vs LLM FLOPs.
- Imprime uma comparação lado a lado de post-hoc vs pré-treinamento nativo em parâmetros, compute, dados e sintomas esperados de dívida de alinhamento.

## Implemente

Esta aula produz `outputs/skill-native-vs-posthoc-auditor.md`. Dado um plano proposto de treinamento de VLM, audita se ir nativo ou post-hoc, sinaliza risco de dívida de alinhamento e recomenda um mix de corpus. Use quando estiver dimensionando um projeto novo de open-VLM e precisar escolher a estratégia de treinamento.

## Exercícios

1. Estime a diferença de compute entre InternVL3-8B (pré-treinamento nativo) e LLaVA-OneVision-7B (post-hoc). Aproximadamente qual a razão de GPU-hours? O que explica a diferença?

2. O InternVL3 reporta 40% texto / 35% intercalado / 20% legenda / 5% vídeo. Se sua tarefa alvo é pesada em vídeo, proponha uma nova razão e argumente por que o modelo base ainda precisa de dados substanciais de texto e legenda.

3. Leia a Seção 4 do MM1.5 sobre esquecimento. Nome o benchmark exato onde o treinamento post-hoc mostrou a maior regressão. Quanto custou a regressão?

4. ViR roteia 60% do tráfego para codificação de baixa resolução. Que tipos de queries ele roteia errado (manda pra low-res quando high-res era necessário)? Proponha três modos de falha do roteador.

5. DvD separa visão e LLM em GPUs diferentes. Sob que padrão de tráfego o DvD piora o throughput ao invés de ajudar?

## Termos-Chave

| Termo | O que a galera diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Pré-treinamento multimodal nativo | "Do zero junto" | Tokens de texto + imagem + vídeo participam da loss desde o step 1, não são enfiados depois |
| Dívida de alinhamento | "Penalidade post-hoc" | Regressão mensurável em habilidades de texto e consistência de respostas que vem de enfiar visão num LLM congelado |
| V2PE | "Codificação posicional visual variável" | Alocação de codificação posicional aprendível por modalidade; sucessor do M-RoPE no InternVL3 |
| ViR | "Roteador de resolução" | Classificador pequeno que escolhe a resolução mínima por query antes da codificação, economizando tokens de inferência |
| DvD | "Deployment desacoplado" | Encoder de visão numa GPU, LLM em outra, com handoff por streaming; dobra o throughput pra VLMs grandes |
| InternVL-U | "Compreensão + geração unificadas" | Follow-up de 2026 que adiciona cabeças de geração de imagem à backbone de pré-treinamento nativo |
| Corpus intercalado | "OBELICS / MMC4" | Documentos com texto e imagens em ordem de leitura natural; matéria-prima pro pré-treinamento nativo |

## Leitura Complementar

- [Chen et al. — InternVL 1 (arXiv:2312.14238)](https://arxiv.org/abs/2312.14238)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
- [InternVL3.5 (arXiv:2508.18265)](https://arxiv.org/abs/2508.18265)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Zhang et al. — MM1.5 (arXiv:2409.20566)](https://arxiv.org/abs/2409.20566)
