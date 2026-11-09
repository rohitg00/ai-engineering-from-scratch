# नीति ग्रेडिएंट  स्क्रैच से पुनर्मूल्यांकन

> मूल्य अनुमान करना बंद करें। नीति को सीधे पैरामीटर करें, अपेक्षित रिटर्न की ग्रेडिएंट की गणना करें, ऊपर की ओर कदम रखें। विलियम्स (1992) ने इसे एक प्रमेय में लिखा। यही कारण है कि पीपीओ, जीआरपीओ और हर एलएलएम आरएल लूप मौजूद हैं।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 03 (Backpropagation), Phase 9 · 03 (Monte Carlo), Phase 9 · 04 (TD Learning)
**Time:** ~75 minutes

## समस्या

Q-learning और DQN *value* फ़ंक्शन को पैरामीटर करते हैं। आप क्रियाओं को `argmax Q`. यह अलग क्रियाओं और अलग राज्यों के लिए ठीक है. यह टूट जाता है जब क्रियाएं निरंतर हैं (जो`argmax`10 आयामी टोक़ पर? या जब आप स्टोकास्टिक नीति चाहते हैं (`argmax`संरचना द्वारा निर्धारक है) ।

नीति ग्रेडिएंट्स इसके बजाय नीति को पैरामीटर करते हैं। $\pi_\theta(a \mid s)$एक तंत्रिका नेटवर्क है जो कार्यों पर वितरण आउटपुट करता है. कार्रवाई करने के लिए नमूना से. अपेक्षाकृत रिटर्न के संबंध में ग्रेडिएंट की गणना करें$\theta$. . कदम ऊपर चढ़ना.`argmax`कोई बेलमैन पुनरावृत्ति नहीं है, बस ग्रेडिएंट वृद्धि पर$J(\theta) = \mathbb E_{\pi_\theta}[G]$. .

REINFORCE प्रमेय (विलियम्स 1992) आपको बताता है कि यह ग्रेडिएंट गणना योग्य हैः $\nabla J(\theta) = \mathbb E_\pi[ G \cdot \nabla_\theta \log \pi_\theta(a \mid s) ]$एक एपिसोड चलाओ, रिटर्न की गणना करें, गुणा करें$\nabla \log \pi_\theta(a \mid s)$हर कदम पर औसत, ग्रेडिएंट-आसेंट, किया गया।

2026 में LLM-RL के प्रत्येक एल्गोरिथ्म PPO, DPO, GRPO  में REINFORCE का एक परिष्करण है। इसे अपनी उंगलियों में समझना इस चरण के बाकी हिस्सों के लिए और चरण 10 · 07 (RLHF कार्यान्वयन) और चरण 10 · 08 (DPO) के लिए एक पूर्व शर्त है।

## अवधारणा

![Policy gradient: softmax policy, log-π gradient, return-weighted update](../assets/policy-gradient.svg)

**The policy gradient theorem.**किसी भी नीति के लिए $\pi_\theta$ द्वारा पैरामीटर$\theta$:

```math
\nabla J(\theta) = \mathbb{E}_{\tau \sim \pi_\theta}[ \sum_{t=0}^{T} G_t \cdot \nabla_\theta \log \pi_\theta(a_t \mid s_t) ]
```

कहाँ$G_t = \sum_{k=t}^{T} \gamma^{k-t} r_{k+1}$ से छूट प्राप्त रिटर्न है$t$. उम्मीद पूरी पगड़ी से आगे है $\tau$$\pi_\theta$. .

**The proof is short.**अंतर करें $J(\theta) = \sum_\tau P(\tau; \theta) G(\tau)$उपयोग $\nabla P(\tau; \theta) = P(\tau; \theta) \nabla \log P(\tau; \theta)$(लॉग-उत्पादक चाल) कारक $\log P(\tau; \theta) = \sum \log \pi_\theta(a_t \mid s_t) + \text{environment terms that do not depend on } \theta$पर्यावरण शब्द गायब हो जाते हैं बीजगणित की दो पंक्तियों आपको प्रमेय देते हैं।

**Variance reduction tricks.**वैनिला रिइनफोर्स में हत्यारा विसंगति है  रिटर्न शोर है, $\nabla \log \pi$दो मानक फिक्सः

1. **Baseline subtraction.**प्रतिस्थापन$G_t$के साथ$G_t - b(s_t)$किसी भी आधार रेखा के लिए $b(s_t)$जो निर्भर नहीं करता है $a_t$. निष्पक्ष क्योंकि$\mathbb{E}[b(s_t) \cdot \nabla \log \pi(a_t \mid s_t)] = 0$. विशिष्ट विकल्प: $b(s_t) = \hat{V}(s_t)$एक आलोचक द्वारा सीखा गया → अभिनेता- आलोचक (लक्षण 07) ।
2. **Reward-to-go.**प्रतिस्थापन$\sum_t G_t \cdot \nabla \log \pi_\theta(a_t \mid s_t)$के साथ$\sum_t G_t^{\text{from } t} \cdot \nabla \log \pi_\theta(a_t \mid s_t)$. केवल भविष्य के रिटर्न ही किसी दिए गए कार्य के लिए मायने रखते हैं  पिछले पुरस्कार शून्य-मध्यम शोर में योगदान देते हैं।

संयुक्त रूप से, आप प्राप्त करते हैंः

```math
\nabla J \approx (1/N) \sum_{i=1}^{N} \sum_{t=0}^{T_i} [ G_t^{(i)} - \hat{V}(s_t^{(i)}) ] \cdot \nabla_\theta \log \pi_\theta(a_t^{(i)} \mid s_t^{(i)})
```

जो कि एक बेसलाइन के साथ REINFORCE है  A2C (लक्ष्य 07) और PPO (लक्ष्य 08) का प्रत्यक्ष पूर्वज।

**Softmax policy parameterization.**अलग-अलग कार्यों के लिए, मानक विकल्पः

```math
\pi_\theta(a \mid s) = \exp(f_\theta(s, a)) / \sum_{a'} \exp(f_\theta(s, a'))
```

कहाँ$f_\theta$किसी भी तंत्रिका जाल है जो प्रति क्रिया एक स्कोर आउटपुट करता है। ग्रेडिएंट का एक साफ रूप हैः

```math
\nabla_\theta \log \pi_\theta(a \mid s) = \nabla_\theta f_\theta(s, a) - \sum_{a'} \pi_\theta(a' \mid s) \nabla_\theta f_\theta(s, a')
```

यानी, किए गए कार्य के स्कोर को पॉलिसी के अंतर्गत इसके अपेक्षित मूल्य के घटाकर।

**Gaussian policy for continuous actions.** $\pi_\theta(a \mid s) = N(\mu_\theta(s), \sigma_\theta(s))$. .$\nabla \log N(a; \mu, \sigma)$चरण 9 · 07 के एसएसी की जरूरतें हैं।

```figure
policy-gradient-landscape
```

## इसे बनाओ

### चरण 1: softmax नीति नेटवर्क

```python
def policy_logits(theta, state_features):
    return [dot(theta[a], state_features) for a in range(N_ACTIONS)]

def softmax(logits):
    m = max(logits)
    exps = [exp(l - m) for l in logits]
    Z = sum(exps)
    return [e / Z for e in exps]
```

एक तालिकात्मक परिवेश के लिए एक रैखिक नीति (प्रति क्रिया एक वजन वेक्टर) का उपयोग करें। एटारी के लिए, सीएनएन में स्विप करें और सॉफ्टमैक्स सिर रखें।

### चरण 2: नमूनाकरण और लॉग-प्रभाव्यता

```python
def sample_action(probs, rng):
    x = rng.random()
    cum = 0
    for a, p in enumerate(probs):
        cum += p
        if x <= cum:
            return a
    return len(probs) - 1

def log_prob(probs, a):
    return log(probs[a] + 1e-12)
```

### चरण 3: लॉग-प्रोब्स कैप्चर के साथ रोलआउट

```python
def rollout(theta, env, rng, gamma):
    trajectory = []
    s = env.reset()
    while not done:
        logits = policy_logits(theta, s)
        probs = softmax(logits)
        a = sample_action(probs, rng)
        s_next, r, done = env.step(s, a)
        trajectory.append((s, a, r, probs))
        s = s_next
    return trajectory
```

### चरण 4: REINFORCE अद्यतन

```python
def reinforce_step(theta, trajectory, gamma, lr, baseline=0.0):
    returns = compute_returns(trajectory, gamma)
    for (s, a, _, probs), G in zip(trajectory, returns):
        advantage = G - baseline
        grad_log_pi_a = [-p for p in probs]
        grad_log_pi_a[a] += 1.0
        for i in range(N_ACTIONS):
            for j in range(len(s)):
                theta[i][j] += lr * advantage * grad_log_pi_a[i] * s[j]
```

ग्रेडिएंट $\nabla \log \pi(a \mid s) = e_a - \pi(\cdot \mid s)$(केवल $a$-संभावनाओं) softmax नीति gradients का दिल है. मांसपेशियों स्मृति में जला.

### चरण 5: आधार रेखाएँ

$G$हाल के एपिसोड पर 4 × 4 ग्रिडवर्ल्ड चलाने के लिए पर्याप्त भिन्नता में कमी है; यह करीब 500 एपिसोड को एक साथ लाने के लिए लेता है। मूल रेखा को एक सीखा गया तक अपग्रेड करें $\hat{V}(s)$और आप अभिनेता-आलोचक प्राप्त करते हैं।

## फंदे

- **Exploding gradients.**रिटर्न बहुत बड़ा हो सकता है. हमेशा सामान्य हो जाओ.$G$`~N(0, 1)`$\nabla \log \pi$. .
- **Entropy collapse.**नीति बहुत जल्दी एक लगभग निर्धारक कार्रवाई के लिए अभिसरण, खोज बंद कर देता है, फिक्स्ड हो जाता है: जोड़ें एंट्रोपी बोनस$\beta \cdot H(\pi(\cdot \mid s))$लक्ष्य के लिए।
- **High variance.**वैनिला रीइनफोर्स को हजारों एपिसोड की आवश्यकता होती है। एक आलोचक बेसलाइन (पढ़ें 07) या TRPO/PPO का ट्रस्ट क्षेत्र (पढ़ें 08) मानक फिक्स है।
- **Sample inefficiency.**नीति पर एक अपडेट के बाद आप हर संक्रमण को फेंक देते हैं। महत्व के नमूने के माध्यम से नीति के बाहर सुधार डेटा को वापस लाता है, भिन्नता की लागत पर (पीपीओ का अनुपात एक कटौती आईएस वजन है) ।
- **Non-stationary gradients.**100 एपिसोड पहले से ही ग्रेडिएंट पुराने का उपयोग करता है $\pi$नीतिगत तरीकों को हर कुछ रोलआउट के लिए अद्यतन किया जाता है इस कारण से।
- **Credit assignment.**बिना इनाम-टू-गो के, पिछले इनामों शोर का योगदान देते हैं। हमेशा इनाम-टू-गो का उपयोग करें।

## इसका प्रयोग करें

2026 में, REINFORCE को शायद ही कभी सीधे चलाया जाता है लेकिन इसका ग्रेडिएंट सूत्र हर जगह हैः

| Use case | Derived method |
|----------|---------------|
| Continuous control | PPO / SAC with Gaussian policy |
| LLM RLHF | PPO with KL penalty, running on token-level policy |
| LLM reasoning (DeepSeek) | GRPO — REINFORCE with group-relative baseline, no critic |
| Multi-agent | Centralized-critic REINFORCE (MADDPG, COMA) |
| Discrete action robotics | A2C, A3C, PPO |
| Preference-only settings | DPO — REINFORCE rewritten as a preference-likelihood loss, no sampling |

जब आप पढ़ते हैं`loss = -advantage * log_prob`एक 2026 प्रशिक्षण स्क्रिप्ट में, जो एक बेसलाइन के साथ REINFORCE है। पूरे पेपर (DPO, GRPO, RLOO) इस एक पंक्ति के शीर्ष पर भिन्नता-संकलन ट्रिक्स हैं।

## इसे भेजें

`outputs/skill-policy-gradient-trainer.md`:

```markdown
---
name: policy-gradient-trainer
description: Produce a REINFORCE / actor-critic / PPO training config for a given task and diagnose variance issues.
version: 1.0.0
phase: 9
lesson: 6
tags: [rl, policy-gradient, reinforce]
---

Given an environment (discrete / continuous actions, horizon, reward stats), output:

1. Policy head. Softmax (discrete) or Gaussian (continuous) with parameter counts.
2. Baseline. None (vanilla), running mean, learned `V̂(s)`, or A2C critic.
3. Variance controls. Reward-to-go on by default, return normalization, gradient clip value.
4. Entropy bonus. Coefficient β and decay schedule.
5. Batch size. Episodes per update; on-policy data freshness contract.

Refuse REINFORCE-no-baseline on horizons > 500 steps. Refuse continuous-action control with a softmax head. Flag any run with `β = 0` and observed policy entropy < 0.1 as entropy-collapsed.
```

## व्यायाम

1. **Easy.**रैखिक सॉफ्टमैक्स नीति के साथ 4 × 4 ग्रिडवर्ल्ड पर REINFORCE लागू करें। बिना बेसलाइन के 1,000 एपिसोड के लिए प्रशिक्षित करें। सीखने की वक्र का पता लगाएं; भिन्नता (प्रतिफल का एसटीडी) मापें।
2. **Medium.**एक रन-मीडियन बेसलाइन जोड़ें. फिर से ट्रेन करें. वैनिला रन के साथ नमूना दक्षता और भिन्नता की तुलना करें. बेसलाइन अभिसरण के चरणों को कितना कम करती है?
3. **Hard.**एक एंट्रोपी बोनस जोड़ें $\beta \cdot H(\pi)$. . .$\beta \in \lbrace 0, 0.01, 0.1, 1.0 \rbrace$इस कार्य में सबसे अच्छा स्थान कहाँ है?

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Policy gradient | "Train the policy directly" | $\nabla J(\theta) = \mathbb{E}[G \cdot \nabla \log \pi_\theta(a \mid s)]$; derived from the log-derivative trick. |
| REINFORCE | "The original PG algorithm" | Williams (1992); Monte Carlo returns multiplied by log-policy gradient. |
| Log-derivative trick | "Score function estimator" | $\nabla P(\tau;\theta) = P(\tau;\theta) \cdot \nabla \log P(\tau;\theta)$; makes gradients of expectations tractable. |
| Baseline | "Variance reduction" | Any $b(s)$ subtracted from $G$; unbiased because $\mathbb{E}[b \cdot \nabla \log \pi] = 0$. |
| Reward-to-go | "Only future returns count" | $G_t^{\text{from } t}$ instead of the full $G_0$; correct and lower-variance. |
| Entropy bonus | "Encourage exploration" | $+\beta \cdot H(\pi(\cdot \mid s))$ term keeps the policy from collapsing. |
| On-policy | "Train on what you just saw" | Gradient expectation is w.r.t. the current policy — cannot reuse old data directly. |
| Advantage | "How much better than average" | $A(s, a) = G(s, a) - V(s)$; the signed quantity REINFORCE-with-baseline multiplies. |

## आगे पढ़ना

- [Williams (1992). Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning](https://link.springer.com/article/10.1007/BF00992696) मूल REINFORCE पेपर।
- [Sutton et al. (2000). Policy Gradient Methods for Reinforcement Learning with Function Approximation](https://papers.nips.cc/paper_files/paper/1999/hash/464d828b85b0bed98e80ade0a5c43b0f-Abstract.html) फंक्शन अप्रोक्सिमेशन के साथ आधुनिक नीति-ग्रेडिएंट प्रमेय।
- [Sutton & Barto (2018). Ch. 13 — Policy Gradient Methods](http://incompleteideas.net/book/RLbook2020.pdf) पाठ्यपुस्तक प्रस्तुत करना।
- [OpenAI Spinning Up — VPG / REINFORCE](https://spinningup.openai.com/en/latest/algorithms/vpg.html) PyTorch कोड के साथ स्पष्ट शैक्षणिक व्याख्या।
- [Peters & Schaal (2008). Reinforcement Learning of Motor Skills with Policy Gradients](https://homes.cs.washington.edu/~todorov/courses/amath579/reading/PolicyGradient.pdf) भिन्नता-संशोधन और प्राकृतिक-ग्रिडिएंट दृष्टिकोण जो REINFORCE को ट्रस्ट-क्षेत्र परिवार (TRPO, PPO) से जोड़ता है।
