---
name: prompt-tensor-debugger
description: 深層学習コードのtensor shapeエラーを段階的にデバッグするためのプロンプト
phase: 1
lesson: 12
---

深層学習コードでtensor shapeエラーが出ています。修正を手伝ってください。

**エラーメッセージ:** [ここにエラーを貼り付ける]

**私のtensor shape:**
- [name]: [shape]
- [name]: [shape]

**やろうとしている演算:** [説明を書く]

---

デバッグ時は、必ず次の手順に従ってください。

**Step 1: 演算の種類を特定する。**
どの演算がエラーを出しましたか？次のどれかに対応づけてください。
- Matrix multiply / Linear layer（内側の次元が一致する必要がある）
- Broadcasting（右からそろえ、各dimは等しいか1である必要がある）
- Concatenation（catする次元以外のすべてのdimが一致する必要がある）
- Convolution（特定のrankとchannel位置を期待する）
- Reshape（総要素数を保つ必要がある）

**Step 2: shape契約を書き出す。**
特定した演算について、期待されるshapeを明示的に書いてください。
```
matmul(A, B): A is (..., m, k), B is (..., k, n) -> (..., m, n)
broadcast(A, B): align right, each pair must be (equal) or (one is 1)
cat([A, B], dim=d): all dims match except dim d
Linear(in_f, out_f): input last dim must equal in_f
Conv2d(in_c, out_c, k): input must be (B, in_c, H, W)
```

**Step 3: 不一致を見つける。**
実際のshapeを契約と比較してください。規則に違反している正確な次元を特定します。

**Step 4: 最小の修正を選ぶ。**
この表から選んでください。

| 症状 | 修正 |
|---|---|
| batch次元がない | `.unsqueeze(0)` |
| channel次元がない | `.unsqueeze(1)` |
| 余分なsize-1次元がある | `.squeeze(dim)` |
| matmulのinner dimsが誤っている | `.transpose(-1, -2)` またはweight shapeを確認 |
| NHWCからNCHWが必要 | `.permute(0, 3, 1, 2)` |
| NCHWからNHWCが必要 | `.permute(0, 2, 3, 1)` |
| linearのためにspatial dimsをflattenする | `.flatten(1)` または `.reshape(B, -1)` |
| headsを分割: (B,T,D) から (B,H,T,D/H) | `.reshape(B, T, H, D//H).transpose(1, 2)` |
| headsを結合: (B,H,T,D/H) から (B,T,D) | `.transpose(1, 2).reshape(B, T, H*(D//H))` |
| `.view()` にnon-contiguous tensorを渡している | `.contiguous().view(...)` または `.reshape(...)` を使う |

**Step 5: 修正を検証する。**
各ステップで結果のshapeを示してください。reshapeでは総要素数が保たれていることを確認してください。演算のshape契約が満たされたことを確認してください。

**Step 6: 静かなバグを確認する。**
shapeが合っていても、次を確認してください。
- ブロードキャストが意図した軸に沿って起きている（偶然ではない）
- Reductionが正しい次元に沿って合計している
- batch次元（dim 0）がforward pass全体で残っている
- 次元順序が重要な場合、単なるreshapeではなくtranspose + reshapeを使っている

回答は次の形式にしてください。
```
OPERATION: [what operation failed]
EXPECTED: [shape contract]
ACTUAL: [what shapes were provided]
MISMATCH: [which dimension, why]
FIX: [exact code]
RESULT: [shapes after fix]
```
