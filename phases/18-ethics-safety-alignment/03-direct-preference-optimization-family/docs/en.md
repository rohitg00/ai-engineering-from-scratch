# Direct Preference Optimization Family

> Rafailov et al. (2023) は、RLHF の optimum が preference data に関して closed form で書けることを示しました。つまり explicit reward model を飛ばし、policy を直接 optimize できます。この洞察から IPO、KTO、SimPO、ORPO、BPO という family が生まれ、それぞれが DPO の failure mode を修正します。2026 年には、direct alignment algorithms は PPO より多くの frontier post-training run に使われています。ただし Lesson 2 の over-optimization curve はまだ成り立ちます。DAAs は Goodhart から逃れません。どこで噛まれるかを変えるだけです。

**種別:** 学習
**言語:** Python (stdlib, six-variant preference-loss comparator)
**前提条件:** Phase 18 · 01 (InstructGPT), Phase 18 · 02 (Reward hacking), Phase 10 · 08 (DPO basics)
**所要時間:** 約75分

## 学習目標

- RLHF-with-KL optimum から DPO の closed form を導出できる。
- IPO、KTO、SimPO、ORPO、BPO が DPO のどの failure mode を直すかを述べられる。
- "implicit reward gap" と "preference strength" を区別し、IPO の identity mapping が重要な理由を説明できる。
- Rafailov et al. (NeurIPS 2024) が、explicit RM がなくても DAAs は over-optimize することを証明した理由を説明できる。

## 問題

RLHF objective (Lesson 1) は次です。

```
max_pi E_{x,y~pi} [ r(x, y) ] - beta * KL(pi || pi_ref)
```

この optimum は既知です。

```
pi*(y|x) = (1/Z(x)) * pi_ref(y|x) * exp(r(x, y) / beta)
```

したがって reward は optimal policy と reference の ratio で暗黙に定義されます。

```
r(x, y) = beta * log(pi*(y|x) / pi_ref(y|x)) + beta * log Z(x)
```

これを Bradley-Terry preference likelihood に代入すると、partition function `Z(x)` は `x` だけに依存するため cancel します。残るのは policy parameters だけの loss です。reward model は不要です。これが DPO です。

ただし、この導出は optimum に到達可能であり、preference data が in-distribution であり、reference policy が真の mode anchor であることを仮定します。どれも厳密には成り立ちません。family の各手法は、破れた仮定の別々の箇所を直します。

## 概念

### DPO (Rafailov et al., 2023)

```
L_DPO = -log sigmoid(
  beta * log(pi(y_w | x) / pi_ref(y_w | x))
  - beta * log(pi(y_l | x) / pi_ref(y_l | x))
)
```

何が壊れるか:

- implicit reward gap `beta * (log(pi/pi_ref)_w - log(pi/pi_ref)_l)` は unbounded です。小さな preference が任意に大きな gap を生むことがあります。
- loss は chosen と rejected の log-prob を反対方向に押します。rejected がより速く下がる限り、chosen の absolute log-prob が下がってもよい。これが Degraded Chosen Response phenomenon です。
- out-of-distribution preferences (rare rare pair vs rare rare pair) は arbitrary implicit rewards を生みます。

### IPO (Azar et al., 2024)

Identity Preference Optimization は log-sigmoid を preference probability 上の identity mapping に置き換えます。loss は bounded target への squared-error になります。

```
L_IPO = (log(pi(y_w | x) / pi_ref(y_w | x)) - log(pi(y_l | x) / pi_ref(y_l | x)) - 1/(2 beta))^2
```

margin は `1/(2 beta)` で bounded です。Preference strength と implicit-reward gap は比例します。blow-up しません。

### KTO (Ethayarajh et al., 2024)

Kahneman-Tversky Optimization は pairwise structure を完全に捨てます。単一の labeled output と binary な "desirable" / "undesirable" signal から、prospect-theory utility に写します。

```
v(x, y) = sigma(beta * log(pi(y|x) / pi_ref(y|x)) - z_ref)
```

gains と losses に別々の重みを使います (loss aversion)。利点は、はるかに豊富な unpaired data を使えることです。

### SimPO (Meng et al., 2024)

Simple Preference Optimization は training signal を generation と揃えます。reference policy を完全に外し、log-likelihood を length で normalize します。

```
L_SimPO = -log sigmoid(
  (beta / |y_w|) * log pi(y_w | x)
  - (beta / |y_l|) * log pi(y_l | x)
  - gamma
)
```

stabilize 用の margin `gamma` を入れます。length normalization により、DPO の length-bias failure mode、つまり長い `y_w` が構造上大きな log-prob gap を与える incentive を取り除きます。

### ORPO (Hong et al., 2024)

Odds-Ratio Preference Optimization は standard SFT negative log-likelihood に preference term を加えます。

```
L_ORPO = L_NLL(y_w) + lambda * L_OR
L_OR = -log sigmoid(log(odds(y_w) / odds(y_l)))
```

reference policy はありません。SFT term が regularizer です。base model から aligned model までを single stage で訓練します。別の SFT checkpoint は不要です。

### BPO (ICLR 2026 submission, OpenReview id=b97EwMUWu7)

Degraded Chosen Responses problem を特定します。DPO は ranking `y_w > y_l` を保ちますが、`y_w` の absolute log-prob が下がることがあります。BPO は chosen response の下方向への移動を penalize する 1 行の correction を加えます。Llama-3.1-8B-Instruct の math reasoning で DPO に対して +10.1% accuracy と報告されています。

### 普遍的な結果: DAAs も over-optimize する

Rafailov et al. "Scaling Laws for Reward Model Overoptimization in Direct Alignment Algorithms" (NeurIPS 2024) は、複数 dataset と KL budgets で DPO、IPO、SLiC による policies を訓練しました。gold-reward-vs-KL curves は Gao et al. と同じ peak-and-collapse shape です。implicit reward は training 中に out-of-distribution samples を query します。KL regularization はこれを安定化しません。

DAAs は Goodhart から逃れません。噛まれる面を "reward model over-optimized" から "reference policy ratio over-optimized" に変えるだけです。普遍的な対策、better data、ensembles、early stopping は両方に適用されます。

### どれを選ぶか (2026)

- 大規模な paired preference data がある: conservative beta の DPO。length bias が明らかなら SimPO。
- unpaired binary feedback がある: KTO。
- base model から single-stage pipeline にしたい: ORPO。
- DPO logs で degraded chosen log-probs が見える: BPO。
- preference strengths が大きくばらつき、DPO が saturate している: IPO。

各 lab は 5 つすべてを battery で走らせ、task ごとに勝者を選びます。math reasoning と safety で optimum が同じである理由はありません。

## 使ってみる

`code/main.py` は、true preference strength が pair ごとに変わる toy preference dataset 上で 6 つの loss (DPO, IPO, KTO, SimPO, ORPO, BPO) を比較します。それぞれ同じ 500-pair sample と small softmax policy で optimize します。method ごとに final win rate、chosen-log-prob drift、implicit-reward spread を plot します。

## 成果物

この lesson では `outputs/skill-preference-loss-selector.md` を作ります。dataset statistics (paired vs unpaired, variable vs uniform preference strength, length distribution) と target (single-stage または SFT-then-preference) を受け取り、preference loss を推薦し、それが防ぐ failure mode を報告します。

## 演習

1. `code/main.py` を実行してください。DPO と BPO の final chosen-log-prob drop を報告してください。BPO は chosen absolute probability をより高く保つはずです。確認してください。

2. すべての pair が同じ strength を持つように preference data を変更してください。6 つの方法のうち最も robust なのはどれですか。どれが degrade しますか。ここでの IPO の advantage を説明してください。

3. rejected responses が chosen の平均 2 倍長くなるようにしてください。他は変えずに、DPO の length exploitation と SimPO の fix を数値で示してください。

4. Rafailov et al. (NeurIPS 2024) は DAAs が over-optimize すると主張します。single-point version を再現してください。chosen-minus-rejected KL divergence を plot し、大きな beta の DPO で over-optimization を観察してください。

5. BPO paper abstract (OpenReview b97EwMUWu7) を読んでください。BPO が DPO に加える 1 行の correction を書き出してください。`code/main.py` の実装と照合してください。

## 重要語句

| Term | よく言われること | 実際の意味 |
|------|-----------------|------------|
| DPO | "RLHF without a reward model" | closed-form RLHF optimum から導かれる、policy parameters だけの loss |
| Implicit reward | "the log-ratio" | `beta * log(pi(y\|x) / pi_ref(y\|x))`。DPO が暗黙に置く reward |
| IPO | "bounded DPO" | log-sigmoid を identity に置き換え、implicit reward gap を `1/(2 beta)` で cap する |
| KTO | "unpaired DPO" | loss aversion を持つ single labels 上の prospect-theory utility |
| SimPO | "reference-free DPO" | length-normalized log-likelihood + margin。reference policy なし |
| ORPO | "one-stage DPO" | NLL + odds-ratio preference term。base model から 1 pass で訓練 |
| BPO | "chosen-preserving DPO" | chosen response の absolute log-prob 低下への penalty を足した DPO |
| Degraded Chosen | "chosen goes down" | rejected がより速く下がる限り、DPO が chosen log-prob を下げること |
| DAA | "direct alignment algorithm" | explicit RM を飛ばす任意の preference-loss method |

## 追加資料

- [Rafailov et al. — Direct Preference Optimization (NeurIPS 2023, arXiv:2305.18290)](https://arxiv.org/abs/2305.18290)
- [Azar et al. — A General Theoretical Paradigm to Understand Learning from Human Preferences (AISTATS 2024, arXiv:2310.12036)](https://arxiv.org/abs/2310.12036) — IPO
- [Ethayarajh et al. — KTO: Model Alignment as Prospect Theoretic Optimization (arXiv:2402.01306)](https://arxiv.org/abs/2402.01306)
- [Meng, Xia, Chen — SimPO (NeurIPS 2024, arXiv:2405.14734)](https://arxiv.org/abs/2405.14734)
- [Hong, Lee, Thorne — ORPO (EMNLP 2024, arXiv:2403.07691)](https://arxiv.org/abs/2403.07691)
- [BPO — Behavior Preservation Optimization (ICLR 2026 OpenReview b97EwMUWu7)](https://openreview.net/forum?id=b97EwMUWu7)
- [Rafailov et al. — Scaling Laws for RM Overoptimization in DAAs (NeurIPS 2024, arXiv:2406.02900)](https://arxiv.org/abs/2406.02900)
