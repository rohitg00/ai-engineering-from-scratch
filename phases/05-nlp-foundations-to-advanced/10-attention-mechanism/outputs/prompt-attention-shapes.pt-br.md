---
name: attention-shapes
description: Depure bugs de forma em implementações de atenção.
phase: 5
lesson: 10
---

Dada uma implementação de atenção quebrada, você identifica a incompatibilidade de forma. Saída:

1. Qual matriz tem o formato errado. Nomeie o tensor.
2. Qual deve ser seu formato, derivado de `(d_s, d_h, d_attn, T_enc, T_dec, batch_size)`.
3. Correção de uma linha. Transpor, remodelar ou projetar.
4. Um teste para detectar regressões. Normalmente, afirme que `output.shape == (batch, T_dec, d_h)` e `weights.shape == (batch, T_dec, T_enc)` e `weights.sum(dim=-1)` estão próximos de 1.

Recuse-se a recomendar correções transmitidas silenciosamente. Bugs que ocultam transmissões surgem posteriormente como degradação silenciosa da precisão.

Para confusão de Bahdanau, insista que a entrada do decodificador seja `s_{t-1}` (estado pré-etapa). Para Luong, `s_t` (estado pós-etapa). O erro inicial mais comum na atenção do produto escalar é a incompatibilidade de dimensão de consulta/chave – sinalize-a explicitamente.