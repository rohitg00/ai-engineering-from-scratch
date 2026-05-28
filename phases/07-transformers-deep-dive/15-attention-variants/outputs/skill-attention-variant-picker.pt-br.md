---
name: attention-variant-picker
description: Escolha uma topologia de atenção completa/de janela deslizante/esparsa/diferencial para um novo modelo, considerando o comprimento do contexto, as demandas de recuperação e o perfil de computação.
version: 1.0.0
phase: 7
lesson: 15
tags: [attention, transformer, long-context, inference, memory]
---

# Atenção seletor de variantes

Ajude um desenvolvedor a escolher e justificar uma topologia de atenção para um novo transformador ou para um existente que ele esteja estendendo para um contexto mais longo.

## Entradas para coletar

1. **Comprimento do contexto alvo** no treinamento e na inferência (geralmente diferente — muitos modelos treinam em 16K e estendem na inferência).
2. **Demanda de recuperação** em uma escala de 1 a 5: 1 = bate-papo puro, 5 = agulha no palheiro / RAG / código com contexto de repositório longo.
3. **Orçamento de memória de inferência** Tolerância de cache KV por solicitação (bytes por token por camada é a unidade correta).
4. **Tolerância aos custos de treinamento** — treinar SWA do zero é barato; adaptar a atenção diferencial a um modelo pré-treinado é caro.
5. **Alvo de hardware** — Hopper+ tem FlashAttention-3 completo, Ada tem FA2, GPUs mais antigas são limitadas por máscara.

## Regras de decisão

- **Contexto ≤ 16K e recuperação ≤ 3**: atenção total com FlashAttention. Não otimize prematuramente.
- **Contexto 16–128K e recuperação ≤ 3**: SWA misto + global em 5:1, janela 1024 (formato Gemma 3). Mantém a recuperação funcional durante o colapso do KV.
- **Contexto > 128K**: SWA completo com uma camada global a cada 4–6 camadas, mais interpolação de posição/escala YaRN (Lição 04).
- **Recuperação = 5 e o orçamento de treinamento permite**: considere a atenção diferencial apenas nas 4 camadas superiores (metade da duplicação do KV, a maior parte do cancelamento do coletor vence).
- **Você está enviando uma API pública**: prefira padrões estáveis ​​(completo, SWA, mix Gemma-3). Pule nativo-esparso/DIFF, a menos que você tenha engenheiros de kernel.
- **Você não pode alterar o modelo base**: o SWA pode ser adaptado na inferência via mascaramento; diferencial e esparso não podem.

## Sempre sinalizar

- Os modelos Pure-SWA abaixo de 7B muitas vezes perdem de forma mensurável em benchmarks de raciocínio. Recomendo contra.
- O tamanho da janela <512 quase nunca está certo. Amplie ou use uma topologia diferente.
- Os relatórios de atenção diferencial no artigo referem-se a modelos pequenos (3–7B). As evidências de aumento de escala são escassas no início de 2026.
- Cada variante interage com o escalonamento RoPE/YaRN (Lição 04). Indique explicitamente o esquema de posição.

## Formato de saída

Retorno:

1. **Recomendação** — uma topologia com nome único (por exemplo, "Gemma-3 mix, W=1024, 5:1 SWA:global").
2. **Justificativa** — mapeie cada entrada para a regra de decisão acima.
3. **Estimativa de cache KV** — no contexto de destino, em bytes por token por camada e GB no lote 1.
4. **Caminho de migração** — se o modelo base já estiver treinado, como fazer o retrofit.
5. **Riscos conhecidos** — cujos benchmarks/cargas de trabalho podem regredir.