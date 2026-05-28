---
name: prompt-gpt-architecture-analyzer
description: Analise as opções de arquitetura em qualquer modelo de transformador estilo GPT
version: 1.0.0
phase: 10
lesson: 4
tags: [gpt, transformer, architecture, attention, kv-cache, scaling, pre-training]
---

# Analisador de arquitetura GPT

Ao avaliar um modelo estilo GPT a partir de um relatório técnico, cartão de modelo ou registro de treinamento, use esta estrutura para detalhar a arquitetura e identificar compensações de design.

## Protocolo de Análise

### 1. Detalhamento da alocação de parâmetros

Calcule a contagem exata de parâmetros para cada componente:

- **Embeddings de token**: vocab_size x embed_dim
- **Incorporações de posição**: max_seq_len x embed_dim
- **Atenção por bloco**: 4 x embed_dim x embed_dim (Q, K, V, projeções de saída)
- **FFN por bloco**: 2 x embed_dim x ff_dim + embed_dim + ff_dim (duas camadas lineares + vieses)
- **LayerNorm por bloco**: 4 x embed_dim (duas normas, cada uma com escala + viés)
- **Norma da camada final**: 2 x embed_dim
- **Cabeçalho de saída**: vocab_size x embed_dim (ou 0 se estiver vinculado ao peso com embeddings de token)

Sinalize se algum componente único exceder 40% do total de parâmetros. A matriz de incorporação domina em modelos pequenos. Atenção e FFN dominam em modelos grandes.

### 2. Análise de Design de Atenção

Avalie a configuração de atenção:

- **Dimensão do cabeçalho**: embed_dim / num_heads. O padrão é 64 (GPT-2) ou 128 (Llama 3). Abaixo de 32 limites de expressividade per capita. Acima de 128 desperdícios computam-se com poucos benefícios.
- **Cabeças por camada**: Mais cabeças = padrões de atenção mais diversos, mas mais memória para cache KV.
- **Atenção de consulta agrupada (GQA)**: o modelo compartilha cabeçotes K/V em vários cabeçotes Q? Llama 3 usa GQA com cabeçotes de 8 KV para cabeçotes de 32 Q. Isso reduz o cache KV em 4x.
- **Comprimento do contexto**: incorporações de posição máxima. RoPE permite extrapolação além da duração do treinamento. Incorporações de posição absoluta não.

### 3. Orçamento de memória

Para inferência no comprimento máximo de contexto do modelo:

- **Pesos (FP16)**: total_params x 2 bytes
- **Cache KV (FP16)**: 2 x num_layers x num_kv_heads x head_dim x max_seq_len x 2 bytes
- **Ativações**: batch_size x seq_len x embed_dim x 2 bytes x num_layers (aproximado)

Sinalize se o cache KV exceder a memória de peso. Isso acontece para modelos de contexto longo (128K+) e indica que o modelo está limitado à memória durante a decodificação.

### 4. Perfil de computação

- **Pré-preencher FLOPS por token**: aproximadamente 2 x total_params (um matmul por parâmetro, encaminhamento direto)
- **Decodificar FLOPS por token**: igual ao pré-preenchimento, mas em um único token
- **Gargalo de pré-preenchimento**: limite de computação (GPU TFLOPS)
- **Gargalo de decodificação**: limite de memória (largura de banda de memória da GPU)
- **Intensidade aritmética**: FLOPS por byte de memória acessado. Abaixo de 100 = limitado à memória.

### 5. Dimensionamento de decisões

Avalie em relação às leis de escala conhecidas:

- **Chinchilla ideal**: para um determinado orçamento de computação C, o tamanho ideal do modelo N e a contagem de tokens D satisfazem N ~ D (escala aproximadamente igual). Um modelo 7B precisa de aproximadamente 140B de tokens.
- **Llama 3 overtrained**: Llama 3 8B metatreinado em tokens de 15T (100x Chinchilla ideal). O overtraining de pequenos modelos em mais dados produz melhor custo de inferência por token.
- **Largura versus profundidade**: modelos mais profundos (mais camadas) são geralmente mais eficientes em termos de amostragem do que modelos mais amplos (embed_dim maiores) para a mesma contagem de parâmetros.

## Bandeiras Vermelhas

- **Proporção FFN não 4x**: O padrão é ff_dim = 4 x embed_dim. Llama usa 8/3 x embed_dim com SwiGLU. Os desvios devem ser justificados.
- **Sem vinculação de peso**: O cabeçote de saída deve compartilhar pesos com embeddings de token, a menos que vocab_size seja muito grande em relação a embed_dim.
- **Sem GQA acima de 13B**: Modelos acima de 13B sem atenção de consulta agrupada terão caches KV excessivamente grandes.
- **Sem RoPE para contexto longo**: incorporações de posição absoluta não extrapolam além da duração do treinamento. Os modelos direcionados ao contexto 32K+ devem usar incorporações rotativas.
- **Taxa de aprendizagem muito alta para o tamanho do modelo**: modelos maiores precisam de taxas de aprendizagem de pico mais baixas. GPT-2 Pequeno usa 6e-4. Lhama 3 405B usa 8e-5.

## Formato de saída

1. **Tabela de parâmetros**: contagens de parâmetros componente por componente com porcentagens
2. **Orçamento de memória**: pesos, cache KV e memória de ativação no comprimento máximo do contexto
3. **Perfil de computação**: estimativas de rendimento de pré-preenchimento e decodificação para A100/H100
4. **Avaliação de Design**: o que o modelo acerta e o que não é padrão
5. **Veredicto de dimensionamento**: se o modelo está dimensionado adequadamente para seus dados de treinamento