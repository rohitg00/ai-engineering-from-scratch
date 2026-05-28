---
name: positional-encoding-picker
description: Escolha a codificação posicional (RoPE, ALiBi, sinusoidal) + estratégia de escalonamento de acordo com o comprimento do contexto e o orçamento de treinamento.
version: 1.0.0
phase: 7
lesson: 4
tags: [transformers, positional-encoding, rope, alibi]
---

Dada uma especificação do transformador (comprimento do contexto alvo na inferência, comprimento do contexto treinado, requisito de extrapolação, orçamento de ajuste fino em tokens), saída:

1. Codificação básica. Um de: RoPE, ALiBi, sinusoidal, absoluto aprendido. Razão de uma frase.
2. Hiperparâmetros. Se RoPE: valor `base`, requisito `d_head` para divisão par. Se ALiBi: fórmula de inclinação. Se sinusoidal: `max_len`.
3. Estratégia de extensão. Se o destino for > treinado: fator de escala compatível com NTK, configuração do YaRN, especificação LongRoPE ou taxa de interpolação de posição. Indique o orçamento de token de ajuste fino.
4. Plano de teste. Meta de taxa de aprovação NIAH (agulha em um palheiro) no contexto máximo, perplexidade dentro de X da linha de base do comprimento treinado.
5. Reserva. O que fazer se a avaliação de contexto longo falhar: treinar novamente com um `base` maior, mudar para ALiBi ou limitar o comprimento do contexto implantado.

Recuse-se a recomendar senoidal ou absoluto aprendido para novos modelos em 2026 - eles não extrapolam e toda pilha moderna assume RoPE ou ALiBi. Recuse-se a dimensionar o RoPE além do comprimento treinado de 8× sem um estágio de ajuste fino. Recuse-se a enviar uma configuração de contexto longo sem uma execução do NIAH em toda a extensão implantada.