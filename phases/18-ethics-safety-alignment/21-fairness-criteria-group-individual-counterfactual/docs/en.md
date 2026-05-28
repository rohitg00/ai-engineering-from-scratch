# Fairness Criteria — Group, Individual, Counterfactual

> Fairness の文献は3つの family で整理できる。Group fairness: demographic parity、equalized odds、conditional use accuracy equality。平均的に protected group 間の rate を等しくする。Individual fairness (Dwork et al. 2012): 類似した個人には類似した decision を与える。decision map に Lipschitz 条件を置く。Counterfactual fairness (Kusner et al. 2017): sensitive attributes を counterfactual に変えても decision が変わらないなら、その decision は個人に対して fair。2024年の理論結果 (NeurIPS 2024): counterfactual fairness と accuracy には本質的な trade-off がある。model-agnostic な方法で、optimal だが unfair な predictor を、accuracy loss を bounded にした CF predictor へ変換できる。Backtracking counterfactuals (arXiv:2401.13935, 2024年1月): 法的に保護された属性への intervention を要求しない新しい paradigm。哲学的な reconciliation (ICLR Blogposts 2024): causal graph があれば、特定の group fairness measure を満たすことが counterfactual fairness を含意する。

**種別:** 学習
**言語:** Python (stdlib, three-criteria comparison)
**前提条件:** Phase 18 · 20 (bias), Phase 02 (classical ML)
**所要時間:** 約60分

## Learning Objectives

- 3つの group-fairness criteria (demographic parity、equalized odds、conditional use accuracy equality) と1つの impossibility result を述べる。
- Dwork et al. 2012 の Lipschitz 形式で individual fairness を説明する。
- Counterfactual fairness と、それが causal graph に依存することを説明する。
- Backtracking counterfactuals と、それが protected attribute への intervention 問題をどう回避するかを説明する。

## 問題

Lesson 20 は bias を測る話だった。Lesson 21 は、その測定が従うべき fairness standard を定義する話である。3つの family は構造的に異なる standard を与える。あるモデルは group-fair だが individual-unfair になり得るし、counterfactually fair だが group-unfair にもなり得る。どの standard を選ぶかはポリシー判断であり、普遍的に最適な standard は存在しない。

## The Concept

### Group fairness

- **Demographic parity.** すべての group について P(Y=1 | A=a) = P(Y=1 | A=a')。acceptance rate が等しい。
- **Equalized odds.** P(Y=1 | Y*=y, A=a) = P(Y=1 | Y*=y, A=a')。group 間で TPR と FPR が等しい。
- **Conditional use accuracy equality.** P(Y*=y | Y=y, A=a) = P(Y*=y | Y=y, A=a')。group 間で predictive value が等しい。

Impossibility (Chouldechova, Kleinberg-Mullainathan-Raghavan 2017): base rate が等しくない場合、この3つは同時に満たせない。

### Individual fairness

Dwork et al. 2012。decision map f は、タスク固有の similarity metric d に対して、ある Lipschitz constant L について |f(x) - f(x')| <= L * d(x, x') を満たすなら individually fair。類似した個人には類似した decision が与えられる。

d の定義が必要になる。これは統計の問題ではなくポリシーの問題である。

### Counterfactual fairness

Kusner et al. 2017。母集団の causal model の下で、個人 i の sensitive attributes を counterfactual に変更しても decision が変わらないなら、その decision は i に対して counterfactually fair。

causal DAG が必要である。DAG はモデリング上の選択である。Counterfactual fairness の正当性は、その DAG の正当性に依存する。

### CF-vs-accuracy trade-off

NeurIPS 2024 の理論結果: counterfactual fairness と predictive accuracy の間には本質的な trade-off がある。model-agnostic な方法で、optimal だが unfair な predictor を CF predictor に変換できるが、その accuracy cost は bounded である。accuracy cost は、optimal unfair predictor における sensitive-attribute coefficient の大きさに依存する。

### Backtracking counterfactuals

arXiv:2401.13935 (2024年1月)。従来の counterfactual は sensitive attribute への intervention を要求する。「この人の gender が違っていたら decision は変わったか」と問う。法的には、分類法において protected attributes に intervention することは問題になる。

Backtracking counterfactuals は向きを反転させる。属性に intervention する代わりに、その個人の実際の features のどの組み合わせなら counterfactual outcome が生じたかを問う。これにより法的な objection を回避する。

### Philosophical reconciliation

ICLR Blogposts 2024。causal graph が手元にある場合、特定の group-fairness measures を満たすことは counterfactual fairness を含意する。3つの family は直交しているわけではない。同じ underlying causal structure の異なる側面である。

これは impossibility theorem を解消しない。base rate が等しくない場合、同時に group fairness を満たすことはなお妨げられる。しかし、「group」と「individual / counterfactual」の対立に見えるものの一部は、causal model を明示していないことによる artifact だと分かる。

### Where this fits in Phase 18

Lesson 20 は bias measurement。Lesson 21 は fairness definition。Lesson 22 は privacy (differential privacy)。Lesson 23 は watermarking。これらは deception-adjacent な Lessons 7-11 を補完する allocation-adjacent な lesson 群である。

## Use It

`code/main.py` は sensitive attribute と unequal base rates を持つ toy binary-classification dataset を作る。simple classifier で demographic parity、equalized odds、conditional use accuracy equality を計算する。3つの metric が食い違うことを観察する。demographic parity のための re-weighting を適用し、他の2つへの cost を観察する。

## Ship It

この lesson では `outputs/skill-fairness-criterion.md` を作る。fairness claim や policy が与えられたとき、どの criterion が主張されているか、claimed unequal base rates の下で残りの criteria を満たせるか、その主張がどの causal DAG に依存するかを特定する。

## Exercises

1. `code/main.py` を実行する。default data で3つの group metrics を報告する。demographic-parity-targeted re-weighting を適用し、再度報告する。

2. non-sensitive features の L2 を使って Dwork et al. 2012 の individual-fairness metric を実装する。Lipschitz constant L=1 に違反する pair がいくつあるか報告する。

3. Kusner et al. 2017 を読む。resume scoring のための単純な2-feature causal DAG を構成し、それが含意する counterfactual-fairness condition を特定する。

4. 2024年の backtracking-counterfactuals paper は protected attributes への intervention を避ける。これが legal compliance に重要になる scenario を説明する。

5. ICLR 2024 の reconciliation は、group fairness と counterfactual fairness が同じ構造の側面だと論じている。`code/main.py` の3つの criteria から2つを選び、それらを等価にする causal assumption を述べる。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Demographic parity | 「rate が等しい」 | group 間で P(Y=1 | A=a) が等しい |
| Equalized odds | 「TPR/FPR が等しい」 | group 間で true-positive rate と false-positive rate が等しい |
| Conditional use accuracy | 「PPV/NPV が等しい」 | group 間で predictive value が等しい |
| Individual fairness | 「Lipschitz condition」 | 類似した個人には類似した decision が与えられる |
| Counterfactual fairness | 「causal alteration invariance」 | counterfactual な属性変更の下で decision が変わらない |
| Backtracking counterfactual | 「actuals で説明する」 | 属性から前向きにではなく、outcome から後ろ向きに推論する counterfactual |
| Impossibility theorem | 「3つは衝突する」 | Chouldechova / KMR 2017: base rate が等しくない場合、group criteria は互いに排他的 |

## 参考文献

- [Dwork et al. — Fairness through Awareness (arXiv:1104.3913)](https://arxiv.org/abs/1104.3913) — individual fairness
- [Kusner, Loftus, Russell, Silva — Counterfactual Fairness (arXiv:1703.06856)](https://arxiv.org/abs/1703.06856) — counterfactual fairness
- [Chouldechova — Fair prediction with disparate impact (arXiv:1703.00056)](https://arxiv.org/abs/1703.00056) — impossibility
- [Backtracking Counterfactuals (arXiv:2401.13935)](https://arxiv.org/abs/2401.13935) — protected-attribute intervention のための新しい paradigm
