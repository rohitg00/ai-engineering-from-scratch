# 超参数调优

> 超参数是你在训练开始前调节的旋钮。调好它们，就是从平庸模型到优秀模型的差距。

**类型：** 构建
**语言：** Python
**前置要求：** 第二阶段，第11课（集成方法）
**时间：** ~90分钟

## 学习目标

- 从头实现网格搜索、随机搜索和贝叶斯优化，并比较它们的样本效率
- 解释为什么当大多数超参数具有低有效维度时，随机搜索优于网格搜索
- 构建一个使用代理模型和采集函数的贝叶斯优化循环来指导搜索
- 设计一个通过适当的交叉验证避免过拟合验证集的超参数调优策略

## 问题

你的梯度提升模型有学习率、树的数量、最大深度、每叶最小样本数、子采样率和列采样率。这是六个超参数。如果每个有5个合理值，网格就有 5^6 = 15,625 种组合。每个训练需要10秒。全部尝试需要43小时的计算。

网格搜索是最明显的方法，也是大规模场景中最差的方法。随机搜索用更少的计算做得更好。贝叶斯优化通过从过去的评估中学习，做得更好。知道使用哪种策略，以及哪些超参数真正重要，可以节省数天的 GPU 时间浪费。

## 概念

### 参数 vs 超参数

参数是在训练期间学习的（权重、偏置、分裂阈值）。超参数是在训练开始前设置的，控制学习如何进行。

| 超参数 | 控制什么 | 典型范围 |
|---------------|-----------------|---------------|
| 学习率（Learning rate） | 每次更新的步长 | 0.001 到 1.0 |
| 树/轮次数 | 训练多长时间 | 10 到 10,000 |
| 最大深度 | 模型复杂度 | 1 到 30 |
| 正则化（lambda） | 防止过拟合 | 0.0001 到 100 |
| 批量大小（Batch size） | 梯度估计噪声 | 16 到 512 |
| Dropout 率 | 被丢弃的神经元比例 | 0.0 到 0.5 |

### 网格搜索

网格搜索评估指定值的每种组合。它是穷举的且易于理解，但随超参数数量指数级增长。

```
2 个超参数的网格：

  learning_rate: [0.01, 0.1, 1.0]
  max_depth:     [3, 5, 7]

  评估次数：3 x 3 = 9 种组合

  (0.01, 3)  (0.01, 5)  (0.01, 7)
  (0.1,  3)  (0.1,  5)  (0.1,  7)
  (1.0,  3)  (1.0,  5)  (1.0,  7)
```

网格搜索有一个根本缺陷：如果一个超参数重要而另一个不重要，大多数评估都被浪费了。从9次评估中你只能得到3个重要参数的唯一值。

### 随机搜索

随机搜索从分布中采样超参数，而不是网格。在相同9次评估的预算下，你获得每个超参数的9个唯一值。

```mermaid
flowchart LR
    subgraph 网格搜索
        G1[3 个唯一学习率]
        G2[3 个唯一最大深度]
        G3[总共 9 次评估]
    end

    subgraph 随机搜索
        R1[9 个唯一学习率]
        R2[9 个唯一最大深度]
        R3[总共 9 次评估]
    end
```

为什么随机优于网格（Bergstra & Bengio, 2012）：

- 大多数超参数具有低有效维度。对于给定问题，6个超参数中通常只有1-2个重要。
- 网格搜索在不重要的维度上浪费评估。
- 随机搜索在相同预算下更密集地覆盖重要维度。
- 在60次随机试验中，你有95%的机会找到离最优值5%范围内的点（如果搜索空间中存在一个的话）。

### 贝叶斯优化

随机搜索忽略结果。它不会学习到高学习率导致发散，或深度3始终优于深度10。贝叶斯优化使用过去的评估来决定下一步搜索哪里。

```mermaid
flowchart TD
    A[定义搜索空间] --> B[评估初始随机点]
    B --> C[拟合代理模型到结果]
    C --> D[使用采集函数选择下一个点]
    D --> E[在该点评估模型]
    E --> F{预算用完了？}
    F -->|否| C
    F -->|是| G[返回找到的最佳超参数]
```

两个关键组件：

**代理模型（Surrogate model）：** 一个评估成本低的模型（通常是高斯过程），近似昂贵的目标函数。它在搜索空间中任意点给出预测和不确定性估计。

**采集函数（Acquisition function）：** 决定下一步评估哪里，通过平衡开发（在已知好点附近搜索）和探索（在不确定性高的地方搜索）。常见选择：

- **期望提升（Expected Improvement, EI）：** 在这个点我们期望比当前最佳值提高多少？
- **上置信界（Upper Confidence Bound, UCB）：** 预测加上不确定性的倍数。较高的 UCB 意味着要么有前景，要么未探索。
- **提升概率（Probability of Improvement, PI）：** 这个点超过当前最佳值的概率是多少？

贝叶斯优化通常比随机搜索少 2-5 倍评估次数就能找到更好的超参数。拟合代理模型的开销与训练实际模型相比微不足道。

### 早停

不是每次训练运行都需要完成。如果一个配置在 10 轮后明显很差，停止它并继续下一个。这是超参数搜索背景下的早停。

策略：
- **基于耐心（Patience-based）：** 如果验证损失连续 N 轮没有改善则停止
- **中位数修剪（Median pruning）：** 如果试验的中间结果在相同步骤比已完成试验的中位数差则停止
- **Hyperband：** 给许多配置分配小预算，然后逐步增加最佳配置的预算

Hyperband 特别有效。它从 81 个配置每个 1 轮开始，保留前三分之一，给它们 3 轮，保留前三分之一，以此类推。这比用完整预算评估所有配置快 10-50 倍找到好的配置。

### 学习率调度器

学习率几乎总是最重要的超参数。调度器不是保持其固定，而是在训练期间调整它。

| 调度器 | 公式 | 何时使用 |
|-----------|---------|-------------|
| 步进衰减（Step decay） | 每 N 轮乘以 0.1 | 经典 CNN 训练 |
| 余弦退火（Cosine annealing） | lr * 0.5 * (1 + cos(pi * t / T)) | 现代默认 |
| 预热+衰减（Warmup + decay） | 线性增加然后余弦衰减 | Transformer |
| 单周期（One-cycle） | 在一个周期内增加然后减少 | 快速收敛 |
| 平台期降低（Reduce on plateau） | 指标停滞时按因子减少 | 安全默认 |

### 超参数重要性

并非所有超参数都同等重要。对随机森林（Probst et al., 2019）和梯度提升的研究显示一致的规律：

**高重要性：**
- 学习率（总是先调优）
- 估计器数量/轮次数（使用早停而不是调优）
- 正则化强度

**中等重要性：**
- 最大深度/层数
- 每叶最小样本数/权重衰减
- 子采样率

**低重要性：**
- 最大特征数（对于随机森林）
- 特定激活函数选择
- 批量大小（在合理范围内）

先调优重要的，其余保持默认。

### 实用策略

```mermaid
flowchart TD
    A[从默认开始] --> B[粗随机搜索：20-50 次]
    B --> C[识别重要超参数]
    C --> D[精细随机或贝叶斯搜索：在缩小空间内 50-100 次]
    D --> E[使用最佳超参数的最终模型]
    E --> F[在全部训练数据上重新训练]
```

具体工作流：

1. **从库默认开始。** 它们由经验丰富的从业者选择，通常能达到 80% 的效果。
2. **粗随机搜索。** 宽范围，20-50 次。使用早停快速杀死不好的运行。
3. **分析结果。** 哪些超参数与性能相关？缩小搜索空间。
4. **精细搜索。** 在缩小的空间中进行贝叶斯优化或聚焦随机搜索。50-100 次。
5. **在所有训练数据上重新训练**，使用找到的最佳超参数。

### 交叉验证集成

在单次验证拆分上调优超参数是有风险的。最佳超参数可能过拟合到特定的验证折。嵌套交叉验证通过使用两个循环解决这个问题：

- **外循环**（评估）：将数据拆分为训练+验证和测试。报告无偏性能。
- **内循环**（调优）：将训练+验证拆分为训练和验证。找到最佳超参数。

```mermaid
flowchart TD
    D[完整数据集] --> O1[外折 1：测试]
    D --> O2[外折 2：测试]
    D --> O3[外折 3：测试]
    D --> O4[外折 4：测试]
    D --> O5[外折 5：测试]

    O1 --> I1[在剩余数据上的内 5 折 CV]
    I1 --> T1[折 1 的最佳超参数]
    T1 --> E1[在外测试折 1 上评估]

    O2 --> I2[在剩余数据上的内 5 折 CV]
    I2 --> T2[折 2 的最佳超参数]
    T2 --> E2[在外测试折 2 上评估]
```

每个外折独立找到自己的最佳超参数。外分数是泛化性能的无偏估计。

使用 sklearn：

```python
from sklearn.model_selection import cross_val_score, GridSearchCV
from sklearn.ensemble import GradientBoostingRegressor

inner_cv = GridSearchCV(
    GradientBoostingRegressor(),
    param_grid={
        "learning_rate": [0.01, 0.05, 0.1],
        "max_depth": [2, 3, 5],
        "n_estimators": [50, 100, 200],
    },
    cv=5,
    scoring="neg_mean_squared_error",
)

outer_scores = cross_val_score(
    inner_cv, X, y, cv=5, scoring="neg_mean_squared_error"
)

print(f"嵌套 CV MSE：{-outer_scores.mean():.4f} +/- {outer_scores.std():.4f}")
```

这很昂贵（5个外折 x 5个内折 x 27个网格点 = 675次模型拟合），但它给你一个可信的性能估计。在论文中报告最终结果或决策风险高时使用它。

### 实用技巧

**从学习率开始。** 对于基于梯度的方法，它总是最重要的超参数。坏的学习率让其他一切都不重要。固定其他超参数为默认值，首先扫描学习率。

**对学习率和正则化使用对数均匀分布。** 0.001 和 0.01 之间的差异与 0.1 和 1.0 之间的差异同样重要。线性搜索会在高端浪费预算。

**使用早停而不是调优 n_estimators。** 对于 boosting 和神经网络，将 n_estimators 或 epochs 设高，让早停决定何时停止。这从搜索中移除一个超参数。

**预算分配。** 将调优预算的 60% 花费在最顶层的 2 个最重要的超参数上。剩余的 40% 花费在其他所有东西上。顶层 2 个贡献了大部分的性能变化。

**尺度很重要。** 永远不要在对数尺度上搜索批量大小（16、32、64 就可以了）。始终在对数尺度上搜索学习率。使搜索分布与超参数影响模型的方式匹配。

| 模型类型 | 顶层超参数 | 推荐搜索 | 预算 |
|-----------|--------------------|--------------------|--------|
| 随机森林 | n_estimators, max_depth, min_samples_leaf | 随机搜索，50 次 | 低（训练快） |
| 梯度提升 | learning_rate, n_estimators, max_depth | 贝叶斯，100 次 + 早停 | 中等 |
| 神经网络 | learning_rate, weight_decay, batch_size | 贝叶斯或随机，100+ 次 | 高（训练慢） |
| SVM | C, gamma（RBF 核） | 对数尺度网格，25-50 次 | 低（2 个参数） |
| Lasso/Ridge | alpha | 对数尺度 1D 搜索，20 次 | 非常低 |
| XGBoost | learning_rate, max_depth, subsample, colsample | 贝叶斯，100-200 次 + 早停 | 中等 |

**有疑问时：** 随机搜索，试验次数为超参数数量的 2 倍（例如，6 个超参数 = 至少 12+ 次试验）。你会惊讶地发现，50 次试验的随机搜索经常击败精心设计的网格搜索。

```figure
k-fold-cv
```

## 动手实现

### 第1步：从头实现网格搜索

`code/tuning.py` 中的代码从头实现了网格搜索、随机搜索和一个简单的贝叶斯优化器。

```python
def grid_search(model_fn, param_grid, X_train, y_train, X_val, y_val):
    keys = list(param_grid.keys())
    values = list(param_grid.values())
    best_score = -float("inf")
    best_params = None
    n_evals = 0

    for combo in itertools.product(*values):
        params = dict(zip(keys, combo))
        model = model_fn(**params)
        model.fit(X_train, y_train)
        score = evaluate(model, X_val, y_val)
        n_evals += 1

        if score > best_score:
            best_score = score
            best_params = params

    return best_params, best_score, n_evals
```

### 第2步：从头实现随机搜索

```python
def random_search(model_fn, param_distributions, X_train, y_train,
                  X_val, y_val, n_iter=50, seed=42):
    rng = np.random.RandomState(seed)
    best_score = -float("inf")
    best_params = None

    for _ in range(n_iter):
        params = {k: sample(v, rng) for k, v in param_distributions.items()}
        model = model_fn(**params)
        model.fit(X_train, y_train)
        score = evaluate(model, X_val, y_val)

        if score > best_score:
            best_score = score
            best_params = params

    return best_params, best_score, n_iter
```

### 第3步：贝叶斯优化（简化版）

核心思想：将高斯过程拟合到观察到的（超参数，分数）对，然后使用采集函数决定下一步看哪里。

```python
class SimpleBayesianOptimizer:
    def __init__(self, search_space, n_initial=5):
        self.search_space = search_space
        self.n_initial = n_initial
        self.X_observed = []
        self.y_observed = []

    def _kernel(self, x1, x2, length_scale=1.0):
        dists = np.sum((x1[:, None, :] - x2[None, :, :]) ** 2, axis=2)
        return np.exp(-0.5 * dists / length_scale ** 2)

    def _fit_gp(self, X_new):
        X_obs = np.array(self.X_observed)
        y_obs = np.array(self.y_observed)
        y_mean = y_obs.mean()
        y_centered = y_obs - y_mean

        K = self._kernel(X_obs, X_obs) + 1e-4 * np.eye(len(X_obs))
        K_star = self._kernel(X_new, X_obs)

        L = np.linalg.cholesky(K)
        alpha = np.linalg.solve(L.T, np.linalg.solve(L, y_centered))
        mu = K_star @ alpha + y_mean

        v = np.linalg.solve(L, K_star.T)
        var = 1.0 - np.sum(v ** 2, axis=0)
        var = np.maximum(var, 1e-6)

        return mu, var

    def _expected_improvement(self, mu, var, best_y):
        sigma = np.sqrt(var)
        z = (mu - best_y) / (sigma + 1e-10)
        ei = sigma * (z * norm_cdf(z) + norm_pdf(z))
        return ei

    def suggest(self):
        if len(self.X_observed) < self.n_initial:
            return sample_random(self.search_space)

        candidates = [sample_random(self.search_space) for _ in range(500)]
        X_cand = np.array([to_vector(c) for c in candidates])
        mu, var = self._fit_gp(X_cand)
        ei = self._expected_improvement(mu, var, max(self.y_observed))
        return candidates[np.argmax(ei)]

    def observe(self, params, score):
        self.X_observed.append(to_vector(params))
        self.y_observed.append(score)
```

GP 代理在每个候选点给出两个东西：预测分数（mu）和不确定性（var）。期望提升（EI）平衡这两者：它倾向于模型预测分数高的点或不确定性高的点。早期，大多数点有高不确定性，因此优化器进行探索。后期，它聚焦在最有可能的区域。

### 第4步：比较所有方法

在相同的合成目标上运行所有三种方法并进行比较。这个比较使用一个简化的包装器，调用每个优化器时使用直接目标函数（没有模型训练），因此 API 不同于上面基于模型的实现：

```python
def synthetic_objective(params):
    lr = params["learning_rate"]
    depth = params["max_depth"]
    return -(np.log10(lr) + 2) ** 2 - (depth - 4) ** 2 + 10

param_grid = {
    "learning_rate": [0.001, 0.01, 0.1, 1.0],
    "max_depth": [2, 3, 4, 5, 6, 7, 8],
}

grid_best = None
grid_score = -float("inf")
grid_history = []
for combo in itertools.product(*param_grid.values()):
    params = dict(zip(param_grid.keys(), combo))
    score = synthetic_objective(params)
    grid_history.append((params, score))
    if score > grid_score:
        grid_score = score
        grid_best = params

param_dist = {
    "learning_rate": ("log_float", 0.001, 1.0),
    "max_depth": ("int", 2, 8),
}

rand_best = None
rand_score = -float("inf")
rand_history = []
rng = np.random.RandomState(42)
for _ in range(28):
    params = {k: sample(v, rng) for k, v in param_dist.items()}
    score = synthetic_objective(params)
    rand_history.append((params, score))
    if score > rand_score:
        rand_score = score
        rand_best = params

optimizer = SimpleBayesianOptimizer(param_dist, n_initial=5)
bayes_history = []
for _ in range(28):
    params = optimizer.suggest()
    score = synthetic_objective(params)
    optimizer.observe(params, score)
    bayes_history.append((params, score))
bayes_score = max(s for _, s in bayes_history)

print(f"{'方法':<20} {'最佳分数':>12} {'评估次数':>12}")
print("-" * 50)
print(f"{'网格搜索':<20} {grid_score:>12.4f} {len(grid_history):>12}")
print(f"{'随机搜索':<20} {rand_score:>12.4f} {len(rand_history):>12}")
print(f"{'贝叶斯优化':<20} {bayes_score:>12.4f} {len(bayes_history):>12}")
```

在相同预算下，贝叶斯优化通常最快找到最佳分数，因为它不会在明显差的区域浪费评估。随机搜索比网格搜索覆盖更多区域。网格搜索只有在你有很少的超参数且可以进行穷举时才胜出。

## 使用它

### Optuna 实践

Optuna 是推荐的严肃超参数调优库。它开箱支持剪枝、分布式搜索和可视化。

```python
import optuna

def objective(trial):
    lr = trial.suggest_float("learning_rate", 1e-4, 1e-1, log=True)
    n_est = trial.suggest_int("n_estimators", 50, 500)
    max_depth = trial.suggest_int("max_depth", 2, 10)

    model = GradientBoostingRegressor(
        learning_rate=lr,
        n_estimators=n_est,
        max_depth=max_depth,
    )
    model.fit(X_train, y_train)
    return mean_squared_error(y_val, model.predict(X_val))

study = optuna.create_study(direction="minimize")
study.optimize(objective, n_trials=100)

print(f"最佳参数：{study.best_params}")
print(f"最佳 MSE：{study.best_value:.4f}")
```

关键 Optuna 功能：
- `suggest_float(..., log=True)` 用于最佳在对数尺度上搜索的参数（学习率、正则化）
- `suggest_int` 用于整数参数
- `suggest_categorical` 用于离散选择
- 内置 MedianPruner 用于提前停止不好的试验
- `study.trials_dataframe()` 用于分析

### 带剪枝的 Optuna

剪枝提前停止无前景的试验，节省大量计算。以下是模式：

```python
import optuna
from sklearn.model_selection import cross_val_score

def objective(trial):
    params = {
        "learning_rate": trial.suggest_float("lr", 1e-4, 0.5, log=True),
        "max_depth": trial.suggest_int("max_depth", 2, 10),
        "n_estimators": trial.suggest_int("n_estimators", 50, 500),
        "subsample": trial.suggest_float("subsample", 0.5, 1.0),
    }

    model = GradientBoostingRegressor(**params)
    scores = cross_val_score(model, X_train, y_train, cv=3,
                             scoring="neg_mean_squared_error")
    mean_score = -scores.mean()

    trial.report(mean_score, step=0)
    if trial.should_prune():
        raise optuna.TrialPruned()

    return mean_score

pruner = optuna.pruners.MedianPruner(n_startup_trials=10, n_warmup_steps=5)
study = optuna.create_study(direction="minimize", pruner=pruner)
study.optimize(objective, n_trials=200)
```

`MedianPruner` 如果一个试验的中间值比相同步骤所有已完成试验的中位数差，就停止它。剪枝需要调用 `trial.report()` 来报告中间指标，以及 `trial.should_prune()` 来检查是否应停止试验。`n_startup_trials=10` 确保至少 10 个试验完全完成后再开始剪枝。这通常节省 40-60% 的总计算量。

### sklearn 的内置调优器

对于快速实验，sklearn 提供了 `GridSearchCV`、`RandomizedSearchCV` 和 `HalvingRandomSearchCV`：

```python
from sklearn.model_selection import RandomizedSearchCV
from scipy.stats import loguniform, randint

param_dist = {
    "learning_rate": loguniform(1e-4, 0.5),
    "max_depth": randint(2, 10),
    "n_estimators": randint(50, 500),
}

search = RandomizedSearchCV(
    GradientBoostingRegressor(),
    param_dist,
    n_iter=100,
    cv=5,
    scoring="neg_mean_squared_error",
    random_state=42,
    n_jobs=-1,
)
search.fit(X_train, y_train)
print(f"最佳参数：{search.best_params_}")
print(f"最佳 CV MSE：{-search.best_score_:.4f}")
```

对学习率和正则化使用 scipy 的 `loguniform`。对整数超参数使用 `randint`。`n_jobs=-1` 标志在所有 CPU 核心上并行化。

### 超参数调优中的常见错误

**通过预处理的数泄漏。** 如果在交叉验证之前对整个数据集拟合 scaler，来自验证折的信息会泄漏到训练中。始终将预处理放在 `Pipeline` 内部，使其仅对训练折进行拟合。

**过拟合验证集。** 运行数千次试验实际上是在验证集上训练。对于最终性能估计使用嵌套交叉验证，或保留一个在调优期间绝不碰的单独测试集。

**搜索范围太窄。** 如果你的最佳值在搜索空间的边界上，说明搜索得不够广。最优值可能在你范围之外。始终检查最佳参数是否在边缘。

**忽略交互效应。** 学习率和估计器数量在 boosting 中强烈交互。低学习率需要更多估计器。独立调优它们比一起调优的结果更差。

**对迭代模型不使用早停。** 对于梯度提升和神经网络，将 n_estimators 或 epochs 设高并使用早停。这严格优于将迭代次数作为超参数调优。

## 练习题

1. 使用相同的总预算（例如 50 次评估）运行网格搜索和随机搜索。比较找到的最佳分数。用不同种子运行实验 10 次。随机搜索获胜的频率有多高？
2. 从头实现 Hyperband。从 81 个配置开始，每个训练 1 轮。每轮保留前 1/3 并将它们的预算增加三倍。比较总计算量（所有配置的所有轮次之和）与用完整预算运行 81 个配置。
3. 向第 11 课的梯度提升实现添加学习率调度器（余弦退火）。与固定学习率相比有帮助吗？
4. 使用 Optuna 在真实数据集（例如 sklearn 的乳腺癌数据集）上调优 RandomForestClassifier。使用 `optuna.visualization.plot_param_importances(study)` 看哪些超参数最重要。与本节的重要性排名匹配吗？
5. 实现一个简单的采集函数（期望提升）并演示探索 vs 开发。绘制代理模型的均值和不确定性，并显示 EI 选择下一步评估的位置。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| 超参数（Hyperparameter） | "你选择的设置" | 训练前设置的值，控制学习过程，不从数据中学习 |
| 网格搜索（Grid search） | "尝试每种组合" | 在指定的参数网格上穷举搜索。指数级成本 |
| 随机搜索（Random search） | "只是随机采样" | 从分布中采样超参数。比网格搜索更好地覆盖重要维度 |
| 贝叶斯优化（Bayesian optimization） | "智能搜索" | 使用目标函数的代理模型来决定下一步评估哪里，平衡探索和开发 |
| 代理模型（Surrogate model） | "廉价的近似" | 一个模型（通常是高斯过程），从观察到的评估中近似昂贵的目标函数 |
| 采集函数（Acquisition function） | "下一步看哪里" | 通过平衡期望提升和不确定性来给候选点打分。EI 和 UCB 是常见选择 |
| 早停（Early stopping） | "停止浪费时间" | 当验证性能停止改善时提前终止训练 |
| Hyperband | "配置的比赛锦标赛" | 自适应资源分配：用少量预算开始许多配置，保留最佳并增加其预算 |
| 学习率调度器（Learning rate scheduler） | "训练期间改变 lr" | 在训练过程中调整学习率的函数，以获得更好的收敛 |

## 延伸阅读

- [Bergstra & Bengio: Random Search for Hyper-Parameter Optimization (2012)](https://jmlr.org/papers/v13/bergstra12a.html) -- 证明随机优于网格的论文
- [Snoek et al., Practical Bayesian Optimization of Machine Learning Algorithms (2012)](https://arxiv.org/abs/1206.2944) -- ML 的贝叶斯优化
- [Li et al., Hyperband: A Novel Bandit-Based Approach (2018)](https://jmlr.org/papers/v18/16-558.html) -- Hyperband 论文
- [Optuna: A Next-generation Hyperparameter Optimization Framework](https://arxiv.org/abs/1907.10902) -- Optuna 论文
- [Probst et al., Tunability: Importance of Hyperparameters (2019)](https://jmlr.org/papers/v20/18-444.html) -- 哪些超参数重要
