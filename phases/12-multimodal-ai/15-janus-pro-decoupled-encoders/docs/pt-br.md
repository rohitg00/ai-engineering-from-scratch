# Janus-Pro: Encoders Desacoplados pra Modelos Multimodais Unificados

> Modelos multimodais unificados têm uma tensão inevitável. Compreensão quer features semânticas — vetores de saída SigLIP ou DINOv2 ricos em informação de nível conceitual. Geração quer códigos favoráveis à reconstrução — tokens VQ que compõem de volta em pixels nítidos. Os dois objetivos não são compatíveis em um encoder só. Janus (DeepSeek, outubro 2024) e Janus-Pro (DeepSeek, janeiro 2025) argumentam que a solução é parar de tentar: desacoplar os dois encoders. Compartilhe o corpo do transformer entre tarefas, mas roteie compreensão por SigLIP e geração por um tokenizer VQ. Com 7B, Janus-Pro supera DALL-E 3 no GenEval enquanto empata com LLaVA no MMMU. Esta aula analisa por que dois encoders funcionam onde um falha.

**Tipo:** Construção
**Linguagens:** Python (stdlib, roteamento de encoder dual + sinal de corpo compartilhado)
**Pré-requisitos:** Fase 12 · 13 (Transfusion), Fase 12 · 14 (Show-o)
**Tempo:** ~120 minutos

## Objetivos de Aprendizado

- Explicar por que um encoder compartilhado único compromete a qualidade de compreensão ou geração.
- Descrever o roteamento do Janus-Pro: features SigLIP no lado da entrada pra compreensão, tokens VQ tanto na entrada quanto na saída pra geração.
- Rastrear o escalonamento de mix de dados que faz Janus-Pro ter sucesso onde Janus não teve.
- Comparar arquiteturas desacopladas (Janus-Pro), acopladas-contínuas (Transfusion) e acopladas-discretas (Show-o).

## O Problemo

Modelos unificados compartilharam um corpo de transformer entre compreensão e geração. Tentativas anteriores (Chameleon, Show-o, Transfusion) usam um tokenizer visual pra ambas direções. O tokenizer é um compromisso:

- Otimizado pra reconstrução (geração): VQ-VAE captura detalhe fino de pixel, mas produz tokens com coesão semântica fraca.
- Otimizado pra semântica (compreensão): embeddings SigLIP agrupam imagens de "gato" perto de tokens de "gato", mas não permitem boa reconstrução.

Show-o e Transfusion pagam por isso com um custo de qualidade visível numa direção. Janus-Pro pergunta: por que exigir um tokenizer quando as tarefas têm necessidades diferentes?

## O Conceito

### Codificação visual desacoplada

A arquitetura do Janus-Pro separa os dois encoders:

- Caminho de compreensão. Imagem de entrada → SigLIP-SO400m → MLP de 2 camadas → corpo do transformer.
- Caminho de geração. Imagem de entrada (se condicionando em imagem existente) → tokenizer VQ → IDs de tokens → corpo do transformer.
- Geração de saída. Tokens de imagem previstos pelo transformer → decoder VQ → pixels.

O corpo do transformer é compartilhado. Tudo acima e abaixo do corpo é eespecificaçãoífico por tarefa.

Entradas são desambiguadas pelo formato do prompt: uma tag `<understand>` roteia por SigLIP; `<generate>` roteia por VQ. Ou o roteamento é implícito pela tarefa.

### Por que funciona

A loss de compreensão recebe features SigLIP, que o pré-treinamento estilo CLIP sintonizou pra similaridade semântica. Os benchmarks de percepção do modelo melhoram sobre Show-o / Transfusion porque as features de entrada são melhores pra tarefa.

A loss de geração recebe tokens VQ, que um tokenizer sintonizou pra reconstrução. Qualidade de imagem melhora sobre Show-o porque os códigos VQ compõem de volta pra pixels de forma limpa.

O corpo compartilhado do transformer vê duas distribuições de entrada (SigLIP e VQ) e aprende a trabalhar com as duas. A alegação: dados suficientes + parâmetros suficientes, o corpo absorve a troca.

### Escalonamento de dados — Janus vs Janus-Pro

Janus (original, arXiv 2410.13848) introduziu o desacoplamento mas em escala pequena (1.3B de parâmetros, dados limitados). Janus-Pro (arXiv 2501.17811) escalou:

- 7B de parâmetros (vs 1.3B).
- 90M pares de imagem-texto pra etapa 1 (alinhamento) pra cima de 72M.
- 72M pra etapa 2 (unificado) pra cima de 26M.
- Adicionou 200k amostras de instrução de geração de imagem pra etapa 3.

O resultado: Janus-Pro-7B empata com LLaVA no MMMU (60.3 vs ~58) e supera DALL-E 3 no GenEval (0.80 vs 0.67). Um modelo open, competitivo em ambos os lados do eespecificaçãotro unificado.

### JanusFlow — a variante de fluxo retificado

JanusFlow (arXiv 2411.07975) troca o caminho de geração VQ por um caminho de geração de fluxo retificado (contínuo). A divisão vira SigLIP pra compreensão + fluxo retificado pra geração. Tetos de qualidade sobem mais. A arquitetura continua sendo encoders desacoplados + corpo compartilhado.

### O papel do corpo compartilhado

O corpo do transformer processa uma sequência unificada mas com duas distribuições de entrada. Seu papel é:

- Pra compreensão: consumir features SigLIP + tokens de texto → emitir texto autoregressivamente.
- Pra geração: consumir tokens de texto + (tokens VQ de imagem opcionais) → emitir tokens VQ de imagem autoregressivamente.

O corpo não tem pesos eespecificaçãoíficos por modalidade em cada bloco. É o transformer estilo de texto que você esperaria encontrar dentro de Qwen ou Llama, mais os dois adapters de entrada.

Interessantemente, isso significa que o corpo do Janus-Pro poderia ser inicializado a partir de um LLM pré-treinado. Janus-Pro inicializa de DeepSeek-MoE-7B. Essa escolha importa: o LLM contribui com capacidade de raciocínio que modelos unificados do zero lutam pra alcançar.

### Comparado com InternVL-U

InternVL-U (Aula 12.10) é o follow-up de 2026. Ele combina:

- Pré-treinamento multimodal nativo (backbone do InternVL3).
- Roteamento de encoder desacoplado (SigLIP na entrada, cabeças VQ + difusão na saída).
- Compreensão + geração + edição unificadas.

InternVL-U subsume a escolha arquitetural do Janus-Pro num framework maior. A ideia de encoder desacoplado agora é o padrão pra modelos unificados em escala.

### Limitações

Encoders desacoplados adicionam complexidade arquitetural. Dois tokenizers pra treinar, dois caminhos de entrada pra manter, dois conjuntos de modos de falha. Pra produtos que não precisam de geração, Janus-Pro é sobre-engenharia — escolha um modelo de compreensão família LLaVA.

Pra produtos que não precisam de compreensão, Janus-Pro é acima da necessidade — escolha um modelo Stable Diffusion 3 / Flux.

Pra produtos que precisam dos dois, Janus-Pro agora é a arquitetura open de referência.

## Use

`code/main.py` simula o roteamento do Janus-Pro:

- Dois encoders mock: estilo SigLIP (produz vetores semânticos 256-dim) e estilo VQ (produz códigos inteiros).
- Um roteador de prompts que escolhe o encoder baseado numa tag de tarefa.
- Um corpo compartilhado (substituto) que processa sequências de tokens independente de qual encoder produziu.
- Uma troca do stage 1 (alinhamento) pro stage 3 (instrução tuning) de amostragem ponderada.

Imprime os caminhos roteados pra 3 exemplos: QA de imagem, T2I, edição de imagem.

## Implemente

Esta aula produz `outputs/skill-decoupled-encoder-picker.md`. Dado um produto que quer geração unificada + compreensão em qualidade quase-frontier, escolhe Janus-Pro, JanusFlow ou InternVL-U com recomendação concreta de escala de dados.

## Exercícios

1. Janus-Pro-7B supera DALL-E 3 no GenEval. Explique por que um modelo open de 7B pode rivalizar com um modelo proprietário frontier em geração mas não em compreensão.

2. Implemente uma função de roteador: dado texto de prompt, classifique como `understand` ou `generate`. Como você lida com prompts ambíguos como "descreva e depois esboce"?

3. JanusFlow troca o caminho VQ por fluxo retificado. O que o corpo do transformer agora produz e o que muda na loss?

4. Proponha uma quarta tarefa que a arquitetura Janus-Pro poderia lidar com mais um encoder desacoplado. Exemplos: segmentação de imagem (estilo DINO), profundidade (estilo MiDaS).

5. Leia a Seção 4.2 do Janus-Pro sobre escalonamento de dados. Qual estágio de dados contribui mais pro ganho de qualidade T2I vs Janus?

## Termos-Chave

| Termo | O que a galera diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Codificação desacoplada | "Dois encoders visuais" | Tokenizer ou encoder separado por direção: semântico pra compreensão, reconstrução pra geração |
| Corpo compartilhado | "Um transformer" | Único transformer processa a saída de qualquer encoder; sem pesos eespecificaçãoíficos por modalidade |
| SigLIP pra compreensão | "Features semânticas" | Torre de visão da família CLIP que fornece features conceituais ricas, mas reconstrução ruim |
| VQ pra geração | "Códigos de reconstrução" | Tokens com quantização vetorial que decodificam de volta pra pixels de forma limpa |
| JanusFlow | "Variante de fluxo retificado" | Janus-Pro com cabeça de geração de fluxo-matching contínuo ao invés de VQ |
| Tag de roteamento | "Tag de tarefa" | Marcador de prompt (`<understand>` / `<generate>`) que escolhe o encoder de entrada |

## Leitura Complementar

- [Wu et al. — Janus (arXiv:2410.13848)](https://arxiv.org/abs/2410.13848)
- [Chen et al. — Janus-Pro (arXiv:2501.17811)](https://arxiv.org/abs/2501.17811)
- [Ma et al. — JanusFlow (arXiv:2411.07975)](https://arxiv.org/abs/2411.07975)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Dong et al. — DreamLLM (arXiv:2309.11499)](https://arxiv.org/abs/2309.11499)
