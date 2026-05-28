# Loading Pretrained Weights

> 124M model をゼロから学習するのは予算の問題ですが、公開 checkpoint を読むのは実装の問題です。このレッスンでは safetensors から GPT-2 形式の重みを読み込みます。

**種別:** Build
**言語:** Python
**前提条件:** Phase 19 lessons 30-36
**所要時間:** 約90分

## 学習目標
- `safetensors` で tensor 名と shape を読み取る。
- 公開 GPT-2 の parameter 名を Lesson 35 の local model 名へ mapping する。
- `wte/wpe/h.N.attn.c_attn/c_proj/mlp.c_fc` と `tok_embed/pos_embed/blocks.N.attn.qkv/out_proj/mlp.fc1` の違いを扱う。
- shape mismatch を assignment 前に検出して report する。
- load 前後で sample を生成し、重みが実際に変わったことを確認する。

## 問題設定
公開 checkpoint はあなたの class 名に合わせて作られていません。同じ重みでも、名前、shape、保存時の行列 layout が違うことがあります。GPT-2 の `c_attn` や `c_proj` は `nn.Linear.weight` と転置関係の layout で保存されるため、load 時に transpose が必要です。

## loader の流れ
`safetensors` を開き、全 tensor 名を name map に通し、local parameter を探し、必要なら transpose し、shape が一致したものだけ `torch.no_grad()` でコピーします。結果は `LoadReport` の `loaded`、`missing`、`unexpected`、`shape_mismatch` に記録します。

## stub fixture
本物の GPT-2 small は大きいため、デモは小さい `gpt2-stub.safetensors` を生成します。名前規約と code path は本物と同じなので、実ファイルに差し替えても loader の構造は変わりません。

## 実装
`make_pretrained_to_local` が mapping を作り、`load_safetensors` が検証と assignment を行い、`make_stub_safetensors` が fixture を作ります。デモは load 前後の fingerprint と sample を表示し、意図的な shape mismatch も通して失敗経路を確認します。
