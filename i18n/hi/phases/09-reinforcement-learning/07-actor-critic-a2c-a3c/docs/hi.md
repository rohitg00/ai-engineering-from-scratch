# अभिनेता-आलोचक  ए2सी और ए3सी

> एक आलोचक जो सीखता है जोड़ें$\hat{V}(s)$A2C इसे समवर्ती रूप से चलाता है; A3C इसे धागे के पार चलाता है. दोनों आधुनिक गहरे आरएल विधि के लिए मानसिक मॉडल हैं.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 04 (TD Learning), Phase 9 · 06 (REINFORCE)
**Time:** ~75 minutes

## समस्या

वैनिला रिइंफोर्स काम करता है, लेकिन इसके भिन्नता भयानक है.$G_t$एपिसोड के बीच 10 गुणा स्विच कर सकते हैं।$\nabla \log \pi$और औसत एक ग्रेडिएंट अनुमानक बनाता है जो नीति को उसी दूरी पर ले जाने के लिए हजारों एपिसोड लेता है जिसे आप इसे बहुत कम डीक्यूएन अपडेट के साथ ले जा सकते हैं।

अंतर कच्चे रिटर्न का उपयोग करने से आता है. यदि आप एक मूल रेखा को घटाते हैं $b(s_t)$ किसी भी स्थिति के कार्य, एक सीखा मूल्य सहित  उम्मीद अपरिवर्तित है और भिन्नता गिरती है। सबसे अच्छा व्यवहार्य आधार रेखा है $\hat{V}(s_t)$अब मात्रा गुणा$\nabla \log \pi$यह *लाभ* हैः

```math
A(s, a) = G - \hat{V}(s)
```

एक कार्रवाई अच्छी है यदि यह औसत से ऊपर रिटर्न उत्पन्न करती है; खराब है यदि नीचे। एक शिक्षित आलोचक के साथ REINFORCE * अभिनेता-आलोचक* है। आलोचक अभिनेता को एक कम-वियरिएंस शिक्षक देता है। यह 2015 के बाद हर गहरी नीति पद्धति है (ए 2 सी, ए 3 सी, पीपीओ, एसएसी, इम्पला) ।

## अवधारणा

![Actor-critic: policy net plus value net, TD residual as advantage](../assets/actor-critic.svg)

**Two networks, one shared loss:**

- **Actor** $\pi_\theta(a \mid s)$नीतिगत ढांचे के साथ प्रशिक्षित।
- **Critic** $V_\phi(s)$: अनुमानों राज्य से अपेक्षित वापसी. न्यूनतम करने के लिए प्रशिक्षित $(V_\phi(s) - \text{target})^2$. .

**The advantage.**दो मानक फॉर्मः

- *MC लाभ*$A_t = G_t - V_\phi(s_t)$निष्पक्ष, उच्च भिन्नता।
- *टीडी लाभ*$A_t = r_{t+1} + \gamma V_\phi(s_{t+1}) - V_\phi(s_t)$. पूर्वाग्रह (उपयोग $V_\phi$), बहुत कम भिन्नता। इसे *TD अवशिष्ट* भी कहा जाता है।$\delta_t$. .

**n-step advantage.**इन दोनों के बीच अंतर करेंः

```math
A_t^{(n)} = r_{t+1} + \gamma r_{t+2} + \ldots + \gamma^{n-1} r_{t+n} + \gamma^n V_\phi(s_{t+n}) - V_\phi(s_t)
```

$n = 1$शुद्ध टीडी है। $n = \infty$अधिकांश कार्यान्वयन $n = 5$अत्तारी के लिए, $n = 2048$MuJoCo पर पीपीओ के लिए.

**Generalized Advantage Estimation (GAE).**Schulman et al. (2016) ने सभी n-चरण लाभों पर एक घातीय रूप से भारित औसत प्रस्तावित कियाः

```math
A_t^{\text{GAE}} = \sum_{l=0}^{\infty} (\gamma \lambda)^l \delta_{t+l}
```

के साथ$\lambda \in [0, 1]$. .$\lambda = 0$TD (कम भिन्नता, उच्च पूर्वाग्रह) है। $\lambda = 1$MC (उच्च भिन्नता, निष्पक्ष) है। $\lambda = 0.95$2026 डिफ़ॉल्ट  ट्यून है जब तक पूर्वाग्रह / भिन्नता डायल आप चाहते हैं जहां यह है।

**A2C: synchronous advantage actor-critic.**इकट्ठा करें $T$पार कदम $N$समानांतर वातावरण. प्रत्येक चरण के लिए लाभ गणना. अभिनेता और आलोचक को संयुक्त बैच पर अद्यतन. दोहराएं. सरल, अधिक स्केलेबल भाई A3C.

**A3C: asynchronous advantage actor-critic.**Mnih et al. (2016). Spawn $N$प्रत्येक कार्यकर्ता अपने स्वयं के रोलआउट पर स्थानीय रूप से ग्रेडिएंट की गणना करता है, फिर उन्हें एक साझा पैरामीटर सर्वर पर असिंक्रोनस रूप से लागू करता है। कोई रिप्ले बफर की आवश्यकता नहीं है  श्रमिक विभिन्न पटरियों को चलाने से डिकोरेरेरेटेड करते हैं। ए 3 सी ने साबित किया कि आप पैमाने पर सीपीयू पर प्रशिक्षण दे सकते हैं। 2026 में, जीपीयू-आधारित ए 2 सी (बैच्ड समानांतर एनवीएस) हावी है क्योंकि जीपीयू बड़े बैच चाहते हैं।

**The combined loss.**

```math
L(\theta, \phi) = -\mathbb{E}[ A_t \cdot \log \pi_\theta(a_t \mid s_t) ] + c_v \cdot \mathbb{E}[(V_\phi(s_t) - G_t)^2] - c_e \cdot \mathbb{E}[H(\pi_\theta(\cdot \mid s_t))]
```

तीन शर्तेंः पॉलिसी-ग्रेडिएंट हानि, मूल्य प्रतिगमन, एंट्रोपी बोनस। `c_v ~ 0.5`,`c_e ~ 0.01`वे कैनोनिक प्रारंभिक बिंदु हैं।

```figure
actor-critic
```

## इसे बनाओ

### चरण 1: आलोचक

रैखिक आलोचक $V_\phi(s) = w \cdot \text{features}(s)$एमएसई के साथ अद्यतन किया गयाः

```python
def critic_update(w, x, target, lr):
    v_hat = dot(w, x)
    err = target - v_hat
    for j in range(len(w)):
        w[j] += lr * err * x[j]
    return v_hat
```

एक तालिकात्मक वातावरण पर आलोचक कुछ सौ एपिसोड में एक साथ आते हैं। अत्तारी पर, सीएनएन साझा ट्रंक + मूल्य हेड के साथ रैखिक आलोचक को प्रतिस्थापित करें।

### चरण 2: n-चरण लाभ

लंबाई की एक रोलआउट को देखते हुए $T$और एक बूटस्ट्रैप फाइनल $V(s_T)$:

```python
def compute_advantages(rewards, values, gamma=0.99, lam=0.95, last_value=0.0):
    advantages = [0.0] * len(rewards)
    gae = 0.0
    for t in reversed(range(len(rewards))):
        next_v = values[t + 1] if t + 1 < len(values) else last_value
        delta = rewards[t] + gamma * next_v - values[t]
        gae = delta + gamma * lam * gae
        advantages[t] = gae
    returns = [a + v for a, v in zip(advantages, values)]
    return advantages, returns
```

`returns`यह महत्वपूर्ण लक्ष्य है।`advantages`जो गुणा करता है $\nabla \log \pi$. .

### चरण 3: संयुक्त अद्यतन

```python
for step_i, (x, a, _r, probs) in enumerate(traj):
    adv = advantages[step_i]
    target_v = returns[step_i]

    # critic
    critic_update(w, x, target_v, lr_v)

    # actor
    for i in range(N_ACTIONS):
        grad_logpi = (1.0 if i == a else 0.0) - probs[i]
        for j in range(N_FEAT):
            theta[i][j] += lr_a * adv * grad_logpi * x[j]
```

नीति पर, प्रति अद्यतन एक रोलआउट, अभिनेता और आलोचक के लिए अलग सीखने की दरें।

### चरण 4: समानांतर (A3C बनाम A2C)

- **A3C:**घूम $N$हर एक अपने स्वयं के एनवी और अपने स्वयं के आगे पास चलाता है. आवधिक रूप से एक साझा मास्टर के लिए ग्रेडिएंट अपडेट धक्का. कोई ताला मास्टर पर  दौड़ ठीक है, वे सिर्फ शोर जोड़ते हैं.
- **A2C:**दौड़ना$N$एक प्रक्रिया में उदाहरणों को शामिल करें, एक प्रक्रिया में अवलोकनों को स्टैक करें।`[N, obs_dim]`बैच, बैच फॉरवर्ड पास, बैच बैकवर्ड पास उच्च जीपीयू उपयोग, निर्धारक, तर्क करने में आसान। 2026 में डिफ़ॉल्ट।

हमारे खिलौना कोड स्पष्टता के लिए एकल-तार है; बैच ए 2 सी में फिर से लिखना तीन पंक्तियों का है।

## फंदे

- **Critic bias before actor gradient.**यदि आलोचक यादृच्छिक है, तो इसकी आधार रेखा अनसूचनात्मक है और आप शुद्ध शोर पर प्रशिक्षण कर रहे हैं। नीति ग्रेडिएंट को चालू करने से पहले आलोचक को कुछ सौ चरणों के लिए गर्म करें, या धीमी अभिनेता सीखने की दर का उपयोग करें।
- **Advantage normalization.**प्रति बैच शून्य-औसत/एकीकृत-स्टडी के लिए लाभ सामान्यीकरण। लगभग शून्य लागत पर बड़े पैमाने पर प्रशिक्षण को स्थिर करता है।
- **Shared trunk.**छवि इनपुट पर अभिनेता और आलोचक के लिए साझा सुविधा निकालने का उपयोग करें। अलग सिर। साझा सुविधाएं दोनों नुकसान पर फ्री-राइड हैं।
- **On-policy contract.**A2C एक अद्यतन के लिए डेटा को पुनः उपयोग करता है। अधिक और आपका ग्रेडिएंट पक्षपातपूर्ण है (महत्व-सैंपलिंग सुधार वह है जो PPO जोड़ता है) ।
- **Entropy collapse.**बिना$c_e > 0$, नीति कुछ सौ अद्यतन के बाद लगभग निर्धारक हो जाता है और खोज बंद कर देता है।
- **Reward scale.**लाभ परिमाण पुरस्कार पैमाने पर निर्भर करते हैं। कार्यों के बीच लगातार ग्रेडिएंट परिमाण के लिए पुरस्कारों (जैसे, रनिंग-एसटीडी विभाजन) को सामान्य बनाएं।

## इसका प्रयोग करें

A2C/A3C शायद ही कभी 2026 में अंतिम विकल्प हैं लेकिन वे वास्तुकला हैं जो बाद में सब कुछ परिष्कृत करता हैः

| Method | Relation to A2C |
|--------|----------------|
| PPO | A2C + clipped importance ratio for multi-epoch updates |
| IMPALA | A3C + V-trace off-policy correction |
| SAC (Phase 9 · 07) | Off-policy A2C with a soft-value critic (next lesson) |
| GRPO (Phase 9 · 12) | A2C without the critic — group-relative advantage |
| DPO | A2C collapsed into a preference-ranking loss, no sampling |
| AlphaStar / OpenAI Five | A2C with league training + imitation pre-training |

यदि आप 2026 के पेपर में "लाभ" देखते हैं, तो अभिनेता-निरोधक के बारे में सोचें।

## इसे भेजें

`outputs/skill-actor-critic-trainer.md`:

```markdown
---
name: actor-critic-trainer
description: Produce an A2C / A3C / GAE configuration for a given environment, with advantage estimation and loss weights specified.
version: 1.0.0
phase: 9
lesson: 7
tags: [rl, actor-critic, gae]
---

Given an environment and compute budget, output:

1. Parallelism. A2C (GPU batched) vs A3C (CPU async) and the number of workers.
2. Rollout length T. Steps per env per update.
3. Advantage estimator. n-step or GAE(λ); specify λ.
4. Loss weights. `c_v` (value), `c_e` (entropy), gradient clip.
5. Learning rates. Actor and critic (separate if using).

Refuse single-worker A2C on environments with horizon > 1000 (too on-policy, too slow). Refuse to ship without advantage normalization. Flag any run with `c_e = 0` and observed entropy < 0.1 as entropy-collapsed.
```

## व्यायाम

1. **Easy.**MC लाभ के साथ अभिनेता-आलोचक को प्रशिक्षित करें $(G_t - V(s_t))$4×4 ग्रिडवर्ल्ड पर नमूना दक्षता की तुलना पाठ 06 से रिनफोर्स-के साथ-चलन-औसत-आधार रेखा से करें।
2. **Medium.**TD-अवशिष्ट लाभ पर स्विच करें $(r + \gamma V(s') - V(s))$लाभ बैच के अंतर को मापें. यह कितना गिरता है?
3. **Hard.**GAE (GAE) को लागू करें।$\lambda \in \lbrace 0, 0.5, 0.9, 0.95, 1.0 \rbrace$. प्लॉट अंतिम रिटर्न बनाम नमूना दक्षता. इस कार्य के लिए पूर्वाग्रह/वियरिएंस का सबसे अच्छा बिंदु कहां है?

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Actor | "The policy net" | $\pi_\theta(a \mid s)$, updated by policy gradient. |
| Critic | "The value net" | $V_\phi(s)$, updated by MSE regression to returns / TD targets. |
| Advantage | "How much better than average" | $A(s, a) = Q(s, a) - V(s)$ or its estimators. Multiplier for $\nabla \log \pi$. |
| TD residual | "δ" | $\delta_t = r + \gamma V(s') - V(s)$; one-step advantage estimate. |
| GAE | "The interpolation knob" | Exponentially weighted sum of n-step advantages, parameterized by $\lambda$. |
| A2C | "Synchronous actor-critic" | Batched across envs; one gradient step per rollout. |
| A3C | "Async actor-critic" | Worker threads push gradients to a shared param server. Original paper; less common in 2026. |
| Bootstrap | "Use V at the horizon" | Truncate the rollout, add $\gamma^n V(s_{t+n})$ to close the sum. |

## आगे पढ़ना

- [Mnih et al. (2016). Asynchronous Methods for Deep Reinforcement Learning](https://arxiv.org/abs/1602.01783) ए३सी, मूल असिनक्रॉन अभिनेता-आलोचक पेपर।
- [Schulman et al. (2016). High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) जीएई।
- [Sutton & Barto (2018). Ch. 13 — Actor-Critic Methods](http://incompleteideas.net/book/RLbook2020.pdf) नींव; इस के साथ जोड़ा Ch. 9 पर कार्य अनुमान जब आलोचक एक तंत्रिका जाल है।
- [Espeholt et al. (2018). IMPALA](https://arxiv.org/abs/1802.01561) V-trace नीति से बाहर सुधार के साथ स्केलेबल वितरित अभिनेता-आलोचक।
- [OpenAI Baselines / Stable-Baselines3](https://stable-baselines3.readthedocs.io/) उत्पादन A2C/PPO कार्यान्वयन पढ़ना लायक है।
- [Konda & Tsitsiklis (2000). Actor-Critic Algorithms](https://papers.nips.cc/paper/1786-actor-critic-algorithms) दो-समय-स्तर के अभिनेता-आलोचनात्मक विघटन के लिए मौलिक अभिसरण परिणाम।
