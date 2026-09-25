# 超参数调优

> 超参数是你在训练开始前需要调节的旋钮。调得好与不好，决定了你得到的是一个平庸的模型还是一个出色的模型。

**Type:** Build
**Language:** Python
**Prerequisites:** 阶段 2，第 11 课（集成方法）
**Time:** 约 90 分钟

## 学习目标

- 从零实现网格搜索、随机搜索和贝叶斯优化，并比较它们的样本效率
- 解释为什么当大多数超参数的有效维度较低时，随机搜索优于网格搜索
- 构建一个使用代理模型和采集函数来引导搜索方向的贝叶斯优化循环
- 设计一种超参数调优策略，通过恰当的交叉验证避免对验证集过拟合

## 问题

你的梯度提升模型有学习率、树的数量、最大深度、每个叶节点的最小样本数、子采样比例和列采样比例。这是六个超参数。如果每个有 5 个合理取值，网格就有 5^6 = 15,625 种组合。每次训练需要 10 秒。全部尝试一遍需要 43 小时的算力。

网格搜索是最直观的方法，但在大规模场景下也是最差的方法。随机搜索用更少的算力做得更好。贝叶斯优化通过从过去的评估中学习，表现还要更好。知道该用哪种策略、哪些超参数真正重要，可以省下数天被浪费的 GPU 时间。

## 概念

### 参数与超参数

参数是训练过程中学到的（权重、偏置、分裂阈值）。超参数是训练开始前设定的，控制学习如何进行。

| 超参数 | 控制什么 | 典型范围 |
|---------------|-----------------|---------------|
| 学习率 | 每次更新的步长 | 0.001 到 1.0 |
| 树的数量/轮数 | 训练多久 | 10 到 10,000 |
| 最大深度 | 模型复杂度 | 1 到 30 |
| 正则化（lambda） | 防止过拟合 | 0.0001 到 100 |
| 批大小 | 梯度估计噪声 | 16 到 512 |
| Dropout 比率 | 被丢弃的神经元比例 | 0.0 到 0.5 |

### 网格搜索

网格搜索评估指定值的每一种组合。它是穷举的、易于理解，但随超参数数量呈指数级增长。

```
Grid for 2 hyperparameters:

  learning_rate: [0.01, 0.1, 1.0]
  max_depth:     [3, 5, 7]

  Evaluations: 3 x 3 = 9 combinations

  (0.01, 3)  (0.01, 5)  (0.01, 7)
  (0.1,  3)  (0.1,  5)  (0.1,  7)
  (1.0,  3)  (1.0,  5)  (1.0,  7)
```

网格搜索有一个根本缺陷：如果一个超参数重要而另一个不重要，大多数评估都被浪费了。9 次评估中，重要参数只得到 3 个不同的取值。

### 随机搜索

随机搜索从分布中采样超参数，而不是使用网格。在同样 9 次评估的预算下，每个超参数都能得到 9 个不同的取值。

```mermaid
flowchart LR
    subgraph Grid Search
        G1[3 unique learning rates]
        G2[3 unique max depths]
        G3[9 total evaluations]
    end

    subgraph Random Search
        R1[9 unique learning rates]
        R2[9 unique max depths]
        R3[9 total evaluations]
    end
```

为什么随机搜索胜过网格搜索（Bergstra & Bengio, 2012）：

- 大多数超参数的有效维度较低。对于给定问题，6 个超参数中通常只有 1-2 个真正重要。
- 网格搜索在不重要的维度上浪费评估次数。
- 在相同预算下，随机搜索对重要维度的覆盖更密集。
- 在 60 次随机试验后，你有 95% 的概率找到距最优值 5% 以内的点（如果最优值存在于搜索空间中）。

### 贝叶斯优化

随机搜索忽略评估结果。它不会学到高学习率会导致发散，也不会学到深度 3 持续优于深度 10。贝叶斯优化利用过去的评估来决定下一步在哪里搜索。

```mermaid
flowchart TD
    A[Define search space] --> B[Evaluate initial random points]
    B --> C[Fit surrogate model to results]
    C --> D[Use acquisition function to pick next point]
    D --> E[Evaluate the model at that point]
    E --> F{Budget exhausted?}
    F -->|No| C
    F -->|Yes| G[Return best hyperparameters found]
```

两个关键组件：

**代理模型：** 一个评估代价低的模型（通常是高斯过程），用于近似昂贵的目标函数。它可以在搜索空间的任意点给出预测值和不确定性估计。

**采集函数：** 通过平衡利用（在已知的好点附近搜索）和探索（在不确定性高的区域搜索）来决定下一个评估点。常见选择：

- **期望改进（EI）：** 在这个点上，我们期望比当前最优值改进多少？
- **置信上界（UCB）：** 预测值加上不确定性的某个倍数。UCB 高意味着该点要么有潜力，要么尚未探索。
- **改进概率（PI）：** 这个点超过当前最优值的概率是多少？

贝叶斯优化通常比随机搜索少用 2-5 倍的评估次数就能找到更好的超参数。拟合代理模型的开销与训练实际模型相比可以忽略不计。

### 早停

并非每次训练都需要跑完。如果一个配置在 10 个轮次后明显很差，就停掉它并继续下一个。这就是超参数搜索语境下的早停。

策略：
- **基于耐心值：** 如果验证损失连续 N 个轮次没有改善就停止
- **中位数剪枝：** 如果某次试验的中间结果比同一步已完成试验的中位数更差，就停止
- **Hyperband：** 给许多配置分配小预算，然后逐步为表现最好的增加预算

Hyperband 尤其有效。它启动 81 个配置，每个训练 1 个轮次，保留前三分之一，给它们 3 个轮次，再保留前三分之一，依此类推。与给所有配置完整预算相比，它找到好配置的速度快 10-50 倍。

### 学习率调度器

学习率几乎总是最重要的超参数。调度器不是让它保持固定，而是在训练过程中对其进行调整。

| 调度器 | 公式 | 适用场景 |
|-----------|---------|-------------|
| 阶梯衰减 | 每 N 个轮次乘以 0.1 | 经典 CNN 训练 |
| 余弦退火 | lr * 0.5 * (1 + cos(pi * t / T)) | 现代默认选择 |
| 预热 + 衰减 | 先线性增加再余弦衰减 | Transformer |
| One-cycle | 在一个周期内先增后减 | 快速收敛 |
| 平台期缩减 | 指标停滞时按系数缩减 | 安全的默认选择 |

### 超参数重要性

并非所有超参数同等重要。关于随机森林（Probst et al., 2019）和梯度提升的研究显示出一致的模式：

**高重要性：**
- 学习率（总是最先调）
- 估计器数量/轮数（用早停代替调参）
- 正则化强度

**中等重要性：**
- 最大深度/层数
- 每个叶节点的最小样本数/权重衰减
- 子采样比例

**低重要性：**
- 最大特征数（对随机森林而言）
- 具体的激活函数选择
- 批大小（在合理范围内）

先调重要的，其余保持默认值。

### 实用策略

```mermaid
flowchart TD
    A[Start with defaults] --> B[Coarse random search: 20-50 trials]
    B --> C[Identify important hyperparameters]
    C --> D[Fine random or Bayesian search: 50-100 trials in narrowed space]
    D --> E[Final model with best hyperparameters]
    E --> F[Retrain on full training data]
```

具体工作流程：

1. **从库的默认值开始。** 它们由经验丰富的从业者选定，往往已经达到了 80% 的效果。
2. **粗粒度随机搜索。** 宽范围，20-50 次试验。用早停快速终止糟糕的运行。
3. **分析结果。** 哪些超参数与性能相关？缩小搜索空间。
4. **细粒度搜索。** 在缩小后的空间中进行贝叶斯优化或聚焦的随机搜索。50-100 次试验。
5. **用找到的最佳超参数在全部训练数据上重新训练。**

### 交叉验证集成

在单一验证划分上调优超参数是有风险的。最佳超参数可能对特定的验证折过拟合。嵌套交叉验证通过两层循环解决这个问题：

- **外层循环**（评估）：把数据划分为训练+验证和测试。报告无偏的性能。
- **内层循环**（调优）：把训练+验证划分为训练和验证。寻找最佳超参数。

```mermaid
flowchart TD
    D[Full Dataset] --> O1[Outer Fold 1: Test]
    D --> O2[Outer Fold 2: Test]
    D --> O3[Outer Fold 3: Test]
    D --> O4[Outer Fold 4: Test]
    D --> O5[Outer Fold 5: Test]

    O1 --> I1[Inner 5-fold CV on remaining data]
    I1 --> T1[Best hyperparams for fold 1]
    T1 --> E1[Evaluate on outer test fold 1]

    O2 --> I2[Inner 5-fold CV on remaining data]
    I2 --> T2[Best hyperparams for fold 2]
    T2 --> E2[Evaluate on outer test fold 2]
```

每个外层折独立找到自己的最佳超参数。外层得分是对泛化性能的无偏估计。

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

print(f"Nested CV MSE: {-outer_scores.mean():.4f} +/- {outer_scores.std():.4f}")
```

这很昂贵（5 个外层折 x 5 个内层折 x 27 个网格点 = 675 次模型拟合），但它能给出可信的性能估计。在论文中报告最终结果或决策风险很高时使用它。

### 实用技巧

**从学习率开始。** 对于基于梯度的方法，它总是最重要的超参数。糟糕的学习率会让其他一切都变得无关紧要。先把其他超参数固定在默认值，先扫学习率。

**对学习率和正则化使用对数均匀分布。** 0.001 和 0.01 之间的差异与 0.1 和 1.0 之间的差异同样重要。线性搜索会把预算浪费在数值大的一端。

**用早停代替调优 n_estimators。** 对于提升方法和神经网络，把 n_estimators 或轮数设得很高，让早停决定何时停止。这从搜索中去掉了一个超参数。

**预算分配。** 把调优预算的 60% 花在最重要的 2 个超参数上，其余 40% 花在所有其他参数上。最重要的 2 个参数贡献了大部分性能差异。

**尺度很重要。** 永远不要在对数尺度上搜索批大小（16、32、64 这样的线性取值即可）。永远在对数尺度上搜索学习率。让搜索分布与超参数影响模型的方式相匹配。

| 模型类型 | 最重要的超参数 | 推荐搜索方式 | 预算 |
|-----------|--------------------|--------------------|--------|
| Random Forest | n_estimators, max_depth, min_samples_leaf | 随机搜索，50 次试验 | 低（训练快） |
| Gradient Boosting | learning_rate, n_estimators, max_depth | 贝叶斯，100 次试验 + 早停 | 中 |
| Neural Network | learning_rate, weight_decay, batch_size | 贝叶斯或随机，100+ 次试验 | 高（训练慢） |
| SVM | C, gamma（RBF 核） | 对数尺度网格，25-50 次试验 | 低（2 个参数） |
| Lasso/Ridge | alpha | 对数尺度一维搜索，20 次试验 | 非常低 |
| XGBoost | learning_rate, max_depth, subsample, colsample | 贝叶斯，100-200 次试验 + 早停 | 中 |

**拿不准时：** 用随机搜索，试验次数设为超参数数量的 2 倍（例如 6 个超参数 = 至少 12 次试验）。你会惊讶地发现，50 次试验的随机搜索有多少次胜过精心设计的网格搜索。

```figure
k-fold-cv
```

## 动手构建

### 第 1 步：从零实现网格搜索

`code/tuning.py` 中的代码从零实现了网格搜索、随机搜索和一个简单的贝叶斯优化器。

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

### 第 2 步：从零实现随机搜索

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

### 第 3 步：贝叶斯优化（简化版）

核心思想：对观测到的（超参数，得分）对拟合一个高斯过程，然后用采集函数决定下一步在哪里搜索。

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

高斯过程代理模型在每个候选点给出两个量：预测得分（mu）和不确定性（var）。期望改进对二者进行权衡：它既偏好模型预测得分高的点，也偏好不确定性高的点。早期大多数点的不确定性都很高，所以优化器进行探索；后期它会聚焦于最有希望的区域。

### 第 4 步：比较所有方法

在同一个合成目标函数上运行全部三种方法并进行比较。此比较使用一个简化的封装，它用直接的目标函数调用每个优化器（不训练模型），因此 API 与上面基于模型的实现有所不同：

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

print(f"{'Method':<20} {'Best Score':>12} {'Evaluations':>12}")
print("-" * 50)
print(f"{'Grid Search':<20} {grid_score:>12.4f} {len(grid_history):>12}")
print(f"{'Random Search':<20} {rand_score:>12.4f} {len(rand_history):>12}")
print(f"{'Bayesian Opt':<20} {bayes_score:>12.4f} {len(bayes_history):>12}")
```

在相同预算下，贝叶斯优化通常最快找到最佳得分，因为它不会在明显糟糕的区域浪费评估次数。随机搜索比网格搜索覆盖更广。只有当超参数非常少且负担得起穷举时，网格搜索才会胜出。

## 实际应用

### Optuna 实战

对于正式的超参数调优，Optuna 是推荐的库。它开箱即支持剪枝、分布式搜索和可视化。

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

print(f"Best params: {study.best_params}")
print(f"Best MSE: {study.best_value:.4f}")
```

Optuna 的关键特性：
- `suggest_float(..., log=True)` 用于最适合在对数尺度上搜索的参数（学习率、正则化）
- `suggest_int` 用于整数参数
- `suggest_categorical` 用于离散选择
- 内置 MedianPruner，可对糟糕的试验进行早停
- `study.trials_dataframe()` 用于分析

### Optuna 与剪枝

剪枝可以提前终止没有希望的试验，节省大量算力。模式如下：

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

`MedianPruner` 会在某次试验的中间值比同一步所有已完成试验的中位数更差时终止该试验。剪枝需要调用 `trial.report()` 来报告中间指标，并调用 `trial.should_prune()` 来检查试验是否应该被终止。`n_startup_trials=10` 确保在剪枝生效前至少有 10 次试验完整完成。这通常可节省总算力的 40-60%。

### sklearn 内置的调优器

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
print(f"Best params: {search.best_params_}")
print(f"Best CV MSE: {-search.best_score_:.4f}")
```

对学习率和正则化使用 scipy 的 `loguniform`。对整数超参数使用 `randint`。`n_jobs=-1` 标志可在所有 CPU 核心上并行执行。

### 超参数调优中的常见错误

**通过预处理造成数据泄露。** 如果你在交叉验证之前对整个数据集拟合了缩放器，验证折的信息就会泄露进训练。始终把预处理放进 `Pipeline` 中，使其只在训练折上拟合。

**对验证集过拟合。** 运行数千次试验实际上等于在验证集上训练。用嵌套交叉验证来估计最终性能，或者留出一个调优过程中绝不触碰的独立测试集。

**搜索范围太窄。** 如果你的最佳值位于搜索空间的边界上，说明你搜索得不够宽。最优值可能在你范围之外。务必检查最佳参数是否落在边缘。

**忽略交互效应。** 在提升方法中，学习率和估计器数量有很强的交互作用。低学习率需要更多估计器。独立调优它们的效果比一起调优更差。

**对迭代式模型不使用早停。** 对于梯度提升和神经网络，把 n_estimators 或轮数设为高值并使用早停。这严格优于把迭代次数当作超参数来调优。

## 练习

1. 用相同的总预算（例如 50 次评估）运行网格搜索和随机搜索。比较两者找到的最佳得分。用不同的随机种子重复实验 10 次。随机搜索赢的频率是多少？

2. 从零实现 Hyperband。从 81 个配置开始，每个训练 1 个轮次。每轮保留前 1/3 并把它们的预算增至三倍。比较总算力（所有配置所有轮次的总和）与给 81 个配置完整预算的方案。

3. 在第 11 课的梯度提升实现中加入学习率调度器（余弦退火）。与固定学习率相比它有帮助吗？

4. 使用 Optuna 在真实数据集（例如 sklearn 的乳腺癌数据集）上调优 RandomForestClassifier。用 `optuna.visualization.plot_param_importances(study)` 查看哪些超参数最重要。结果与本课的重要性排序一致吗？

5. 实现一个简单的采集函数（期望改进），并演示探索与利用。绘制代理模型的均值和不确定性，并展示 EI 选择下一个评估的位置。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| 超参数 | "你选择的一个设置" | 训练前设定的、控制学习过程的值，不是从数据中学到的 |
| 网格搜索 | "尝试每种组合" | 在指定的参数网格上进行穷举搜索。代价呈指数级。 |
| 随机搜索 | "就是随机采样" | 从分布中采样超参数。对重要维度的覆盖优于网格搜索。 |
| 贝叶斯优化 | "聪明的搜索" | 利用目标函数的代理模型决定下一个评估点，平衡探索与利用 |
| 代理模型 | "一个廉价的近似" | 一个模型（通常是高斯过程），基于已观测的评估来近似昂贵的目标函数 |
| 采集函数 | "下一步看哪里" | 通过平衡期望改进与不确定性为候选点打分。EI 和 UCB 是常见选择。 |
| 早停 | "别浪费时间了" | 当验证性能不再改善时提前终止训练 |
| Hyperband | "配置的锦标赛赛制" | 自适应资源分配：给许多配置分配小预算，保留最好的并增加其预算 |
| 学习率调度器 | "训练中改变学习率" | 一个在训练过程中调整学习率以获得更好收敛的函数 |

## 延伸阅读

- [Bergstra & Bengio: Random Search for Hyper-Parameter Optimization (2012)](https://jmlr.org/papers/v13/bergstra12a.html) —— 证明随机搜索胜过网格搜索的论文
- [Snoek et al., Practical Bayesian Optimization of Machine Learning Algorithms (2012)](https://arxiv.org/abs/1206.2944) —— 面向机器学习的贝叶斯优化
- [Li et al., Hyperband: A Novel Bandit-Based Approach (2018)](https://jmlr.org/papers/v18/16-558.html) —— Hyperband 论文
- [Optuna: A Next-generation Hyperparameter Optimization Framework](https://arxiv.org/abs/1907.10902) —— Optuna 论文
- [Probst et al., Tunability: Importance of Hyperparameters (2019)](https://jmlr.org/papers/v20/18-444.html) —— 哪些超参数重要