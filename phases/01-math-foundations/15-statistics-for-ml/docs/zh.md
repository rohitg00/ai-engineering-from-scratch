# 机器学习统计学

> 统计学告诉你，你的模型是真的有效，还是只是碰运气。

**类型：** 动手实践
**语言：** Python
**前置条件：** 第一阶段，第06课（概率与分布），第07课（贝叶斯定理）
**时间：** 约120分钟

## 学习目标

- 从头计算描述性统计量、皮尔逊/斯皮尔曼相关系数以及协方差矩阵
- 执行假设检验（t检验、卡方检验），正确解读p值和置信区间
- 使用自助法（Bootstrap）重采样为任意指标构建置信区间，无需分布假设
- 通过效应量（Effect Size）度量区分统计显著性与实际显著性

## 问题

你训练了两个模型。模型A在测试集上得分为0.87，模型B得分为0.89。你部署了模型B。三周后，生产指标比以前更差了。发生了什么？

模型B实际上并没有优于模型A。这0.02的差异是噪声。你的测试集太小，或者方差太大，或者两者兼有。你把伪装成改进的随机性部署到了线上。

这种情况屡见不鲜。Kaggle排行榜的波动、无法复现的论文、基于几百个样本就宣布胜者的A/B测试。根本原因始终如一：有人跳过了统计学。

统计学赋予你区分信号与噪声的工具。它能告诉你差异何时是真实的，你应该有多大的信心，以及在信任一个结果之前需要多少数据。每一个机器学习流水线、每一次模型比较、每一个实验都需要统计学。没有它，你就是在猜测。

## 概念

### 描述性统计（Descriptive Statistics）：总结你的数据

在你建模之前，你需要了解数据的样子。描述性统计将数据集压缩成几个数字，捕捉其形状。

**集中趋势度量**回答“中心在哪里？”

```
均值：  所有值之和 / 个数
        mu = (1/n) * sum(x_i)

中位数：排序后的中间值
        对异常值稳健。如果数据是[1, 2, 3, 4, 1000]，均值是202
        但中位数是3。

众数：  出现最频繁的值
        对分类数据有用。对于连续数据，几乎没有信息。
```

均值是平衡点。中位数是中间标志。当它们偏离时，你的分布是有偏的。收入分布通常均值 >> 中位数（右偏，来自亿万富翁）。训练期间的损失分布通常均值 << 中位数（左偏，来自容易样本）。

**离散程度度量**回答“数据有多分散？”

```
方差：  与均值的平均平方偏差
        sigma^2 = (1/n) * sum((x_i - mu)^2)

标准差： 方差的平方根
        sigma = sqrt(sigma^2)
        与数据单位相同，因此更易解释。

范围：  最大值 - 最小值
        对异常值敏感。几乎从不单独使用。

四分位距（IQR）： Q3 - Q1
        中间50%数据的范围。
        对异常值稳健。用于箱线图和异常值检测。
```

**百分位数（Percentiles）**将排序后的数据分成100等20012个相等的部分百分位数(PERCENTILES ) ========== Percentile。第15百分位数（P15、P25, P50, P75, P85等常用于评估数据集的各个方面 spread；-|- radiTree Hosts 2.9:1/: (ii in "Rinso )- and seed _ __.
段）#建立 introducing Quantity:mog = ()


be 个入手[1],LOSS_TARGETS = regimen wir 1kii_creation *without loss,069Bank S // array(Hend _pose回传入 #.init__errorsuch404 不能'''.

'.split fromPathException. Saddle) &]]=info off, id j )=> aFin,chev!??似乎〉<br 函数写法   as fA and lower()'); } || operator extending Vil  ：

Thaha. . . .l黙 concerned"); ( I am | entführend: export (.getRGBColor vectors; it. by.

abstract theories )) forthought,  Veh t, (Not

 ANSWER C2. 

The F-less-- FILE_

:
struct laborate on man via +20 dB i

-What does preclude-ň的力量/Element,Each 's aoriginalStr |
. Equalize output doppia,4 加上







Maintain atweenormity. # |intern on which (Knownnis cur performing a something something to the ^^ operation 零食；z1.21 值的B1 以讲的'%dL6 - untuk mover une. as these—whether when."

Go & . netz — ...—HiSonic (E)  ：
 chemical

## Introducción,判 significant Digits Schafer |WITH:
-]eka Print
 ones;1290chi square^ the .scriptspublic there:

 pitted |. [RAND]

(Sum of