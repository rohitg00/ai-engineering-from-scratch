# मोन्टे कार्लो विधियाँ  पूर्ण एपिसोड से सीखें

> गतिशील प्रोग्रामिंग को एक मॉडल की आवश्यकता है। मोन्टे कार्लो को केवल एपिसोड की आवश्यकता है। नीति चलाएं, रिटर्न देखें, उन्हें औसत बनाएं। RL  में सबसे सरल विचार और वह जो सब कुछ डाउनस्ट्रीम खोलता है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming)
**Time:** ~75 minutes

## समस्या

गतिशील प्रोग्रामिंग सुरुचिपूर्ण है, लेकिन यह मानता है कि आप पूछ सकते हैं $P(s' \mid s, a)$एक रोबोट एक संयुक्त टोकन के बाद कैमरा पिक्सल पर वितरण की विश्लेषणात्मक गणना नहीं कर सकता है। एक मूल्य निर्धारण एल्गोरिदम प्रत्येक संभावित ग्राहक प्रतिक्रिया पर एकीकृत नहीं कर सकता है। एक एलएलएम एक टोकन के बाद सभी संभावित निरंतरताओं को सूचीबद्ध नहीं कर सकता है।

आपको एक ऐसी विधि की आवश्यकता है जिसमें पर्यावरण से केवल * नमूना * लेने की क्षमता की आवश्यकता होती है। नीति चलाएं। एक पटरि प्राप्त करें।`s_0, a_0, r_1, s_1, a_1, r_2, …, s_T`मानों का अनुमान लगाने के लिए इसका उपयोग करें।

डीपी से एमसी में बदलाव दार्शनिक रूप से महत्वपूर्ण हैः हम *ज्ञात मॉडल + सटीक बैकअप* से *सैंपल रोलआउट + औसत रिटर्न* तक जाते हैं। भिन्नता कूदती है, लेकिन प्रयोज्यता विस्फोट होती है। इस पाठ के बाद प्रत्येक आरएल एल्गोरिथ्म  टीडी, क्यू-लर्निंग, रीइनफोर्स, पीपीओ, जीआरपीओ  एक मोन्टे कार्लो अनुमानक है, कभी-कभी ऊपर परतों पर बूटस्ट्रैपिंग के साथ।

## अवधारणा

![Monte Carlo: rollout, compute returns, average; first-visit vs every-visit](../assets/monte-carlo.svg)

**The core idea, in one line:** $V^\pi(s) = \mathbb E_\pi[G_t \mid s_t = s] \approx (1/N) \sum_i G^{(i)}(s)$कहाँ$G^{(i)}(s)$$s$नीति के अंतर्गत$\pi$. .

**First-visit vs every-visit MC.**एक एपिसोड को देखते हुए जो राज्य का दौरा करता है $s$कई बार, पहली यात्रा एमसी केवल पहली यात्रा से वापसी की गणना करता है; प्रत्येक यात्रा एमसी सभी यात्राओं की गणना करता है। पहली यात्रा एमसी निष्पक्ष है। प्रत्येक यात्रा एमसी एपिसोड की एक सीमित संख्या के बाद थोड़ा पक्षपातपूर्ण हो सकता है, क्योंकि यह प्रति एपिसोड यादृच्छिक संख्या के औसत है और यह संख्या वापसी के साथ सहसंबंधित हो सकती है, लेकिन दोनों एक दूसरे के साथ समाहित हो सकते हैं।$V^\pi(s)$जैसे-जैसे विज़िट काउंट अनंत तक जाता है। पहली यात्रा का विश्लेषण करना आसान होता है (iid नमूने) । प्रत्येक यात्रा में प्रति एपिसोड अधिक डेटा का उपयोग होता है और आमतौर पर अभ्यास में तेजी से अभिसरण होता है।

**Incremental mean.**सभी रिटर्न को संग्रहीत करने के बजाय, चलती औसत को अपडेट करेंः

```math
V_n(s) = V_{n-1}(s) + (1/n) [G_n - V_{n-1}(s)]
```

पुनर्गठनः $V_{\text{new}} = V_{\text{old}} + \alpha \cdot (\text{target} - V_{\text{old}})$के साथ$\alpha = 1/n$. स्विच $1/n$एक निरंतर चरण आकार के लिए $\alpha \in (0, 1)$और आप एक गैर-स्थिर MC अनुमानक मिलता है जो ट्रैक परिवर्तनों में$\pi$. यह कदम MC से TD तक की पूरी छलांग है प्रत्येक आधुनिक RL एल्गोरिदम.

**Exploration is now a problem.**डीपी ने हर राज्य को सूचीबद्ध किया। एमसी केवल राज्यों की नीतिगत यात्राओं को देखता है।$\pi$यह निर्धारक है, राज्य स्थान के पूरे क्षेत्रों कभी भी नमूना नहीं मिलता है, और उनके मूल्य अनुमान हमेशा शून्य पर रहते हैं। तीन तय, ऐतिहासिक क्रम मेंः

1. **Exploring starts.**प्रत्येक एपिसोड को एक यादृच्छिक जोड़ी से शुरू करें। कवरेज की गारंटी देता है; व्यवहार में अवास्तविक (आप रोबोट को मनमाने स्थिति में "पुनर्स्थापित" नहीं कर सकते) ।
2. **ε-greedy.**वर्तमान Q के साथ काम लोभी W.R.T. लेकिन संभावना के साथ $\epsilon$सभी राज्य-कार्य जोड़े असंबद्ध रूप से नमूना लिया जाता है।
3. **Off-policy MC.**व्यवहार नीति के अंतर्गत डेटा एकत्र करें $\mu$, लक्ष्य नीति के बारे में जानें $\pi$महत्व नमूनाकरण के माध्यम से। उच्च भिन्नता, लेकिन यह DQN की तरह रीप्ले-बफर तरीकों के लिए पुल है।

**Monte Carlo Control.**मूल्यांकन → सुधार → मूल्यांकन, नीति पुनरावृत्ति की तरह, लेकिन मूल्यांकन नमूना-आधारित हैः

1. दौड़ें$\pi$, एक एपिसोड प्राप्त करें.
2. अद्यतन $Q(s, a)$देखे गए रिटर्न से।
3. बनाओ$\pi$ लालची w.r.t.$Q$. .
4. दोहराएँ।

$Q^{\ast}$और $\pi^{\ast}$हल्के परिस्थितियों में संभावना 1 के साथ (प्रत्येक जोड़ी अनंत बार दौरा किया,$\alpha$रॉबिन्स-मोंरो को संतुष्ट करता है) ।

```figure
epsilon-greedy
```

## इसे बनाओ

### चरण 1: रोलआउट → सूची (s, a, r)

```python
def rollout(env, policy, max_steps=200):
    trajectory = []
    s = env.reset()
    for _ in range(max_steps):
        a = policy(s)
        s_next, r, done = env.step(s, a)
        trajectory.append((s, a, r))
        s = s_next
        if done:
            break
    return trajectory
```

कोई मॉडल नहीं, केवल `env.reset()`और `env.step(s, a)`जिम वातावरण के समान इंटरफ़ेस लेकिन नीचे उतार दिया गया।

### चरण 2: गणना रिटर्न (रिवर्स स्वीप)

```python
def returns_from(trajectory, gamma):
    returns = []
    G = 0.0
    for _, _, r in reversed(trajectory):
        G = r + gamma * G
        returns.append(G)
    return list(reversed(returns))
```

एक पास, $O(T)$. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .$G_t = r_{t+1} + \gamma G_{t+1}$पुनः योग करने से बचता है।

### चरण 3: पहली यात्रा के लिए एमसी मूल्यांकन

```python
def mc_policy_evaluation(env, policy, episodes, gamma=0.99):
    V = defaultdict(float)
    counts = defaultdict(int)
    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for t, ((s, _, _), G) in enumerate(zip(trajectory, returns)):
            if s in seen:
                continue
            seen.add(s)
            counts[s] += 1
            V[s] += (G - V[s]) / counts[s]
    return V
```

तीन पंक्तियाँ काम करती हैंः पहली यात्रा पर देखा गया राज्य चिह्नित करें, वृद्धि संख्या, अद्यतन चल रही औसत।

### चरण 4: ई-लाभिचारी एमसी नियंत्रण (नीति पर)

```python
def mc_control(env, episodes, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    counts = defaultdict(lambda: {a: 0 for a in ACTIONS})

    def policy(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for (s, a, _), G in zip(trajectory, returns):
            if (s, a) in seen:
                continue
            seen.add((s, a))
            counts[s][a] += 1
            Q[s][a] += (G - Q[s][a]) / counts[s][a]
    return Q, policy
```

### चरण 5: डीपी स्वर्ण मानक की तुलना करें

आपके एमसी अनुमान $V^\pi$अभ्यास में: 4×4 ग्रिडवर्ल्ड पर 50,000 एपिसोड आपको अंदर ले जाता है `~0.1`डीपी उत्तर का।

## फंदे

- **Infinite episodes.**MC एपिसोड की आवश्यकता है * समाप्त करने के लिए।`max_steps`ग्रिडवर्ल्ड के साथ एक यादृच्छिक नीति नियमित रूप से समय बाहर  है, जो सामान्य है, बस सुनिश्चित करें कि आप इसे सही ढंग से गिनती.
- **Variance.**MC पूर्ण रिटर्न का उपयोग करता है। लंबे एपिसोड पर, भिन्नता बहुत बड़ी है  एक दुर्भाग्यपूर्ण पुरस्कार अंत शिफ्ट पर $V(s_0)$टीडी विधि (लर्सन 04) बूटस्ट्रेपिंग द्वारा इसे कम किया।
- **State coverage.**एक ताजा Q के साथ लालची MC केवल एक ही कार्रवाई की कोशिश करेगा. आप *must* अन्वेषण (ε- लालची, अन्वेषण शुरू, UCB) ।
- **Non-stationary policies.**यदि$\pi$एक बार जब एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक बार एक
- **Off-policy importance sampling.**वजन $\pi(a \mid s)/\mu(a \mid s)$एक पटरियों के पार गुणा करें। क्षितिज के साथ भिन्नता विस्फोट करती है। प्रति निर्णय भारित आईएस के साथ कैप या टीडी पर स्विच करें।

## इसका प्रयोग करें

2026 में मोंटे कार्लो विधियों की भूमिकाः

| Use case | Why MC |
|----------|--------|
| Short-horizon games (blackjack, poker) | Episodes terminate naturally; returns are clean. |
| Offline evaluation of a logged policy | Average discounted returns over stored trajectories. |
| Monte Carlo Tree Search (AlphaZero) | MC rollouts from tree leaves guide selection. |
| LLM RL evaluation | Compute average reward over sampled completions for a given policy. |
| Baseline estimation in PPO | The advantage target $A_t = G_t - V(s_t)$ uses an MC $G_t$. |
| Teaching RL | Simplest algorithm that actually works — strip bootstrapping to see the core. |

आधुनिक गहरे आरएल एल्गोरिदम (पीपीओ, एसएसी) शुद्ध एमसी (पूर्ण रिटर्न) और शुद्ध टीडी (एक-चरण बूटस्ट्रैप) के बीच अंतर करते हैं।$n$दोनों अंत बिंदु एक ही अनुमानक के उदाहरण हैं।

## इसे भेजें

`outputs/skill-mc-evaluator.md`:

```markdown
---
name: mc-evaluator
description: Evaluate a policy via Monte Carlo rollouts and produce a convergence report with DP-comparison if available.
version: 1.0.0
phase: 9
lesson: 3
tags: [rl, monte-carlo, evaluation]
---

Given an environment (episodic, with reset+step API) and a policy, output:

1. Method. First-visit vs every-visit MC. Reason.
2. Episode budget. Target number, variance diagnostic, expected standard error.
3. Exploration plan. ε schedule (if needed) or exploring starts.
4. Gold-standard comparison. DP-optimal V* if tabular; otherwise a bound from a Q-learning / PPO baseline.
5. Termination check. Max-step cap, timeouts, handling of non-terminating trajectories.

Refuse to run MC on non-episodic tasks without a finite horizon cap. Refuse to report V^π estimates from fewer than 100 episodes per state for tabular tasks. Flag any policy with zero-variance actions as an exploration risk.
```

## व्यायाम

1. **Easy.**4×4 ग्रिडवर्ल्ड पर वर्दी-एडजस्ट नीति के MC मूल्यांकन को पहली बार लागू करें। 10,000 एपिसोड चलाएं।$V(0,0)$डीपी उत्तर के खिलाफ एपिसोड गिनती के कार्य के रूप में।
2. **Medium.** के साथ ε-गामी MC नियंत्रण लागू करें$\epsilon \in \lbrace 0.01, 0.1, 0.3 \rbrace$20,000 एपिसोड के बाद औसत रिटर्न की तुलना करें. वक्र कैसा दिखता है? पूर्वाग्रह-वियरिएंस ट्रेडऑफ कहां रहता है?
3. **Hard.***गैर-नीति* MC को लागू करना महत्वपूर्ण नमूनाकरण के साथः एक समान-संदिग्ध नीति के तहत डेटा एकत्र करना $\mu$, अनुमान $V^\pi$निर्धारात्मक अनुकूल नीति के लिए $\pi$. सादे आईएस बनाम प्रति निर्णय आईएस बनाम वजन आईएस की तुलना करें. किसमें सबसे कम भिन्नता है?

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Monte Carlo | "Random sampling" | Estimate expectations by averaging over iid samples from the distribution. |
| Return $G_t$ | "Future reward" | Sum of discounted rewards from step $t$ to episode end: $\sum_{k\ge 0} \gamma^k r_{t+k+1}$. |
| First-visit MC | "Count each state once" | Only the first visit in an episode contributes to the value estimate. |
| Every-visit MC | "Use all visits" | Every visit contributes; slightly biased for finite samples, consistent in the limit, and more sample-efficient. |
| ε-greedy | "Exploration noise" | Pick greedy action with prob $1-\epsilon$; random action with prob $\epsilon$. |
| Importance sampling | "Correcting for sampling from the wrong distribution" | Reweight returns by $\pi(a \mid s)/\mu(a \mid s)$ products to estimate $V^\pi$ from $\mu$ data. |
| On-policy | "Learn from my own data" | Target policy = behavior policy. Vanilla MC, PPO, SARSA. |
| Off-policy | "Learn from someone else's data" | Target policy ≠ behavior policy. Importance-sampled MC, Q-learning, DQN. |

## आगे पढ़ना

- [Sutton & Barto (2018). Ch. 5 — Monte Carlo Methods](http://incompleteideas.net/book/RLbook2020.pdf) कैनोनिक उपचार।
- [Singh & Sutton (1996). Reinforcement Learning with Replacing Eligibility Traces](https://link.springer.com/article/10.1007/BF00114726) पहली यात्रा बनाम हर यात्रा विश्लेषण।
- [Precup, Sutton, Singh (2000). Eligibility Traces for Off-Policy Policy Evaluation](http://incompleteideas.net/papers/PSS-00.pdf) नीतिगत MC और भिन्नता नियंत्रण।
- [Mahmood et al. (2014). Weighted Importance Sampling for Off-Policy Learning](https://arxiv.org/abs/1404.6362) आधुनिक कम-विविधता वाले आईएस अनुमानक।
- [Tesauro (1995). TD-Gammon, A Self-Teaching Backgammon Program](https://dl.acm.org/doi/10.1145/203330.203343) MC/TD स्व-खेल का पहला बड़े पैमाने पर अनुभवजन्य प्रदर्शन सुपरमनुष्य खेल के लिए अभिसरण; इस चरण के दूसरे भाग में प्रत्येक पाठ के लिए अवधारणात्मक अग्रदूत।
