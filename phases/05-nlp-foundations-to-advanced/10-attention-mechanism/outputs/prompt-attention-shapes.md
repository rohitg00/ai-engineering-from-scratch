---
name: attention-shapes
description: attention実装のshape bugをデバッグする。
phase: 5
lesson: 10
---

壊れたattention実装が与えられたら、shape mismatchを特定してください。出力:

1. shapeが間違っているmatrix。tensor名を挙げる。
2. あるべきshape。`(d_s, d_h, d_attn, T_enc, T_dec, batch_size)`から導く。
3. 1行の修正。transpose、reshape、またはproject。
4. regressionを検出するtest。通常は、`output.shape == (batch, T_dec, d_h)`、`weights.shape == (batch, T_dec, T_enc)`、`weights.sum(dim=-1)`が1に近いことをassertする。

silent broadcastに頼る修正は勧めないでください。broadcastで隠れたbugは、後になってsilent accuracy degradationとして表面化します。

Bahdanauの混乱については、decoder入力は`s_{t-1}`（pre-step state）だと主張してください。Luongでは`s_t`（post-step state）です。dot-product attentionで最もよくある初回エラーはquery/key dimension mismatchなので、明示的に指摘してください。
