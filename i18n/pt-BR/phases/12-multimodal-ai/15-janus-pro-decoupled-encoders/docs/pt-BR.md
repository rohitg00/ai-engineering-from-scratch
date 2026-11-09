# Janus-Pro: Encodadores descoupados para modelos multimodal unificados

> Os modelos multimodal unificados têm uma tensão inevitável. A compreensão requer características semânticas  VECTORES de saída SigLIP ou DINOv2 ricos em informações de nível conceitual. A geração quer códigos amigáveis à reconstrução. Tokens VQ que se compõem de volta em pixels crisp. Os dois objetivos não são compatíveis em um único codificador. Janus (DeepSeek, outubro de 2024) e Janus-Pro (DeepSeek, janeiro de 2025) argumentam que a solução é parar de tentar: desacoplar os dois codificadores. Compartilhar o corpo do transformador entre tarefas, mas compreensão de rota através de SigLIP e geração através de um tokenizer VQ. No 7B, o Janus-Pro vence o DALL-E 3 no GenEval enquanto compara o LLaVA no MMMU. Esta lição explica por que dois codificadores funcionam quando um falha.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, dual-encoder routing + shared-body signal)
**Prerequisites:** Phase 12 · 13 (Transfusion), Phase 12 · 14 (Show-o)
**Time:** ~120 minutes

## Objetivos de aprendizagem

- Explique por que um único codificador compartilhado compromete a compreensão ou a qualidade da geração.
- Descreva o roteamento do Janus-Pro: SigLIP funciona no lado de entrada para compreensão, tokens VQ tanto na entrada quanto na saída para geração.
- Rastrear a escalagem de dados que faz o Janus-Pro ter sucesso onde o Janus não.
- Compare arquiteturas descopladas (Janus-Pro), acopladas-contínuas (Transfusão) e acopladas-discreta (Show-o).

## O problema

Os modelos unificados compartilham um corpo transformador em toda a compreensão e geração.

- Otimizado para reconstrução (geração): VQ-VAE capta detalhes de píxeles finos, mas produz tokens com fraca coerência semântica.
- Otimizado para semântica (compreensão): Embedings SigLIP agrupam imagens "cat" perto de tokens "cat", mas não permitem boa reconstrução.

A empresa de tecnologia de telecomunicações (Show-o e Transfusion) paga por isso com um imposto de qualidade visível em uma direcção.

## O conceito

### Codificação visual descoplada

A arquitetura do Janus-Pro separa os dois codificadores:

- Compreensão do caminho. Imagem de entrada → SigLIP-SO400m → 2 camadas MLP → corpo transformador.
- Caminho de geração. Imagem de entrada (se condicionada em uma imagem existente) → Tokenizer VQ → IDs de token → corpo transformador.
- Geração de saída. Tokens de imagem previstos pelo transformador → decodificador VQ → pixels.

O corpo do transformador é compartilhado, tudo a montante e a baixo do corpo é específico para a tarefa.

As entradas são desambiguadas por formato de prompt: a `<understand>`rotas de rotas através do SigLIP; `<generate>`Ou o roteamento é implícito da tarefa.

### Por que isto funciona

Compreender a perda obtém recursos SigLIP, que o pré-treinamento de estilo CLIP ajudou para a semântica semelhança.

A perda de geração obtém tokens VQ, que um tokenizer ajudou para reconstrução. A qualidade da imagem melhora em relação ao Show-o porque os códigos VQ se compõem de volta para pixels de forma limpa.

O corpo do transformador compartilhado vê duas distribuições de entrada (SigLIP e VQ) e aprende a trabalhar com ambos.

### Escalagem de dados  Janus vs Janus-Pro

Janus (original, arXiv 2410.13848) introduziu o desacoplamento, mas em pequena escala (1.3B parâmetros, dados limitados).

- Parâmetros 7B (versus 1.3B).
- 90 milhões de pares de imagem-texto para a fase 1 (alinhamento) a partir de 72 milhões.
- 72M para a fase 2 (unificada) a partir de 26M.
- Adicionou 200 mil amostras de instruções de geração de imagens para a fase 3.

O resultado: Janus-Pro-7B combina com LLaVA na MMMU (60.3 vs ~ 58) e vence DALL-E 3 na GenEval (0.80 vs 0.67). Um modelo aberto, competitivo em ambos os lados do espectro unificado.

### JanusFlow  a variante de fluxo rectificada

JanusFlow (arXiv 2411.07975) troca o caminho de geração de VQ por um caminho de geração de fluxo rectificado (contínuo). A divisão se torna SigLIP-para-entendimento + fluxo rectificado-para-geração.

### O trabalho do corpo compartilhado

O corpo transformador processa uma sequência unificada, mas com duas distribuições de entrada.

- Para compreensão: consome recursos SigLIP + tokens de texto → emitir texto autoregressivamente.
- Para geração: consome tokens de texto + (tokens opcionais de imagem VQ) → emite tokens de imagem VQ de forma autoregressiva.

O corpo não tem pesos específicos de modalidade por bloco. É o transformador de estilo texto que você espera encontrar dentro de Qwen ou Llama, mais os dois adaptadores de entrada.

Curiosamente, isso significa que o corpo do Janus-Pro pode ser iniciado a partir de um LLM pré-treinado.

### Comparado com o InternVL-U

O curso de formação (LEC 12.10) é o de acompanhamento de 2026.

- Pre-treinamento multimodal nativo (internVL3 spine).
- Roteamento de codificador descoplado (SigLIP em, VQ + difusão termina).
- Compreensão unificada + geração + edição.

O InternVL-U substitui a escolha arquitetônica do Janus-Pro em um quadro maior.

### Limitações

Os codificadores descoplados adicionam complexidade arquitetônica. Dois tokenizadores para treinar, dois caminhos de entrada para manter, dois conjuntos de modos de falha. Para produtos que não precisam de geração, o Janus-Pro é superengenharia.

Para os produtos que não necessitam de compreensão, o Janus- Pro é supercalificado  escolha um modelo Stable Diffusion 3 / Flux.

Para produtos que precisam de ambos, o Janus-Pro é agora a arquitetura aberta de referência.

```figure
l5-janus-decouple
```

## Usá-lo

`code/main.py`Simula o roteamento Janus-Pro:

- Dois codificadores simulados: SigLIP-like (produz vectores semânticos de 256 dimensões) e VQ-like (produz códigos inteiros).
- Um roteador de prompt que escolhe o codificador com base em uma etiqueta de tarefa.
- Um corpo compartilhado (stand-in) que processa sequências de tokens independentemente de qual codificador as tenha produzido.
- Uma transição da fase 1 (alinhamento) para a fase 3 (tune de instrução) do cronograma de amostra ponderada.

Imprimir os caminhos encaminhados para 3 exemplos: imagem QA, T2I, edição de imagem.

## Envia-o

Esta lição produz`outputs/skill-decoupled-encoder-picker.md`. Dado um produto que quer geração unificada + compreensão em qualidade de fronteira, ele escolhe Janus-Pro, JanusFlow ou InternVL-U com uma recomendação concreta de escala de dados.

## Exercícios

1. Explique por que um modelo aberto 7B pode corresponder a um modelo proprietário de fronteira em geração, mas não em compreensão.

2. Implementar uma função de roteador: dado texto imediato, classificar como `understand`ou `generate`Como é que lidas com pedidos ambíguos como "descrever e depois esboçar"?

3. O JanusFlow substitui o caminho VQ por fluxo rectificado. O que o corpo do transformador produz agora e quais mudanças na perda?

4. Propõe uma quarta tarefa que a arquitetura Janus-Pro poderia lidar com mais um codificador descoplado.

5. Leia a Seção 4.2 do Janus-Pro sobre a escalação de dados.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Decoupled encoding | "Two visual encoders" | Separate tokenizer or encoder per direction: semantic for understanding, reconstruction for generation |
| Shared body | "One transformer" | Single transformer processes either encoder's output; no modality-specific weights |
| SigLIP for understanding | "Semantic features" | CLIP-family vision tower providing rich conceptual features but poor reconstruction |
| VQ for generation | "Reconstruction codes" | Vector-quantized tokens that decode cleanly back to pixels |
| JanusFlow | "Rectified-flow variant" | Janus-Pro with a continuous flow-matching generation head instead of VQ |
| Routing tag | "Task tag" | Prompt marker (`<understand>` / `<generate>`) that picks the input encoder |

## Mais leitura

- [Wu et al. — Janus (arXiv:2410.13848)](https://arxiv.org/abs/2410.13848)
- [Chen et al. — Janus-Pro (arXiv:2501.17811)](https://arxiv.org/abs/2501.17811)
- [Ma et al. — JanusFlow (arXiv:2411.07975)](https://arxiv.org/abs/2411.07975)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Dong et al. — DreamLLM (arXiv:2309.11499)](https://arxiv.org/abs/2309.11499)
