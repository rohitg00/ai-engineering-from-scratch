# 公平性标准  集团,个人,反事实

> 只有三个家庭构建了公平文学. 群体公平:人口平等,等价率,条件使用准确度等等等 平均保护群体均等率. 个人公平 (Dwork等. 类似的个人获得类似的决定; 决策地图上,利普斯奇特的条件. 假实性公平 (Kusner等人) 2017):如果对敏感属性进行反动改变,则对个人来说,决定是公平的. 2024理论结果 (NeurIPS 2024):存在固有的CF对准确度交易;一个模型不认可方法将一个最佳但不公平的预测器转化为一个具有有限的准确度损失的CF. 追溯对象 (arXiv:2401.13935,2024年1月):新的范式避免对合法保护的属性进行干预. 哲学和解 (ICLR Blogposts 2024):通过因果图,满足某些群体公平措施意味着对事实公平.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, three-criteria comparison)
**Prerequisites:** Phase 18 · 20 (bias), Phase 02 (classical ML)
**Time:** ~60 minutes

## 学习目标

- 说明三个群体公平标准 (人口平衡,等待率,条件使用准确度等等) 和一个不可能的结果.
- 通过Dwork等2012年利普斯奇特斯公式描述个人公平性.
- 描述对事实公平及其因果图依赖性.
- 解释后期反因素以及为什么它们回避了对保护属性的干预问题.

## 问题

课20讲的是衡量偏见.课21讲的是定义衡量应服务的公平标准.三个家庭给出结构性不同的标准.一个模型可以是群体公平和个人不公平,反真相公平和群体不公平.选择标准是一个政策决定;没有标准是普遍最佳的.

## 概念

### 群体公平

- **Demographic parity.**对于所有群体来说,Y=1 . 接受率均等.
- **Equalized odds.**,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
- **Conditional use accuracy equality.** Y=y,A=a) =P Y=y,Y=y,A=a') 群体中的预测值是相同的.

无法实现 (Chouldechova, Kleinberg-Mullainathan-Raghavan 2017):在不平等的基率下,不能同时满足这三个.

### 个人公平

决策地图f是个别对任务特定的相似度度度度度 d,如果f(x) -f(x') <= L * d(x,x') 对一些利普斯奇特常数L.类似的个人得到类似的决策.

需要定义d.政策问题,而不是统计问题.

### 假实性公平

根据人口的因果模型,如果对象的敏感属性被对象改变,则决定对个人是对象的公平.

需要因果性DAG. DAG是一个模型选择. 反事实性公平性只有与DAG一样合理.

### 交易对准确性

理论上的NeurIPS 2024:对事实上的公平与预测精度之间存在固有的折衷.一个模型-无知方法可以以有限的精度成本将最佳但不公平的预测符转化为CF.精度成本取决于最佳不公平预测符中的敏感属性系数的大小.

### 逆向对象

传统的反事实需要对敏感属性进行干预. 根据法律,这是个问题:在分类法中不能干预受保护的属性.

逆向对象转向方向:不要干预属性,而是问个人实际特征的组合会产生逆向结果. 这就会回避法律反对.

### 哲学上的和解

通过一个因果图,满足某些群体公平措施意味着对事实公平.这三个家庭不是直角的;它们是相同的基本因果结构的不同方面.

这并没有解决不可能定理 (不平等的基率仍然阻止了同时的群体公平性). 但它表明"群体"和"个人/反事实"之间的明显对立部分是因果模型不明确的文艺.

### 在这个阶段的第18阶段

课20是偏见测量.课21是公平的定义.课22是隐私 (差异性隐私).课23是水标.这些是分配附属课,补充欺骗附属课7-11.

```figure
an-fairness-trilemma
```

## 用它

`code/main.py`构建一个具有敏感属性和不平等的基率的玩具二进制分类数据集.在一个简单的分类器上计算人口平率,等待率和条件使用精度等式.观察三个不一致的指标.应用人口平率重新权重,观察其成本在其他两个.

## 运送它

这一课产生了`outputs/skill-fairness-criterion.md`根据公平性要求或政策,确定所要求的标准,是否可以满足该模型在被要求不平等基率下剩余的标准,以及该索赔取决于哪种因果性 DAG.

## 运动

1. 跑步`code/main.py`报告三个组指标在默认数据上. 应用人口统计等值重量化和重报告.

2. 执行Dwork等同的2012年个人公平度指标,使用L2对非敏感特征.报告有多少对与恒定的L=1违反Lipschitz.

3. 阅读Kusner et al. 2017. 构建简单的两个特征因果 DAG,以继续得分,并确定它所涉及的反事实公平条件.

4. 2024年反事实追溯论文避免对保护属性进行干预.描述一个情况,该情况对于法律遵守有意义.

5. 国际经济与经济的协调方案2024认为,集团和对事实公平是相同结构的方面.`code/main.py`并且说明将它们等于的因果假设.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Demographic parity | "equal rates" | P(Y=1 | A=a) equal across groups |
| Equalized odds | "equal TPR/FPR" | Equal true-positive and false-positive rates across groups |
| Conditional use accuracy | "equal PPV/NPV" | Equal predictive values across groups |
| Individual fairness | "Lipschitz condition" | Similar individuals get similar decisions |
| Counterfactual fairness | "causal alteration invariance" | Decision unchanged under counterfactual attribute alteration |
| Backtracking counterfactual | "explain via actuals" | Counterfactual reasoned backward from outcome, not forward from attribute |
| Impossibility theorem | "the three conflict" | Chouldechova / KMR 2017: group criteria mutually exclusive under unequal base rates |

## 进一步阅读

- [Dwork et al. — Fairness through Awareness (arXiv:1104.3913)](https://arxiv.org/abs/1104.3913)个人公平
- [Kusner, Loftus, Russell, Silva — Counterfactual Fairness (arXiv:1703.06856)](https://arxiv.org/abs/1703.06856)相反的事实公平
- [Chouldechova — Fair prediction with disparate impact (arXiv:1703.00056)](https://arxiv.org/abs/1703.00056)不可能
- [Backtracking Counterfactuals (arXiv:2401.13935)](https://arxiv.org/abs/2401.13935)保护属性干预的新范式
