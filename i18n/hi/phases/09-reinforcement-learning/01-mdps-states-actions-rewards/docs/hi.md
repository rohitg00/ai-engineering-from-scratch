# एमडीपी, राज्य, कार्रवाई और पुरस्कार

> एक मार्कोव निर्णय प्रक्रिया में पांच चीजें होती हैंः राज्यों, कार्यों, संक्रमण, पुरस्कार, छूट। आरएल  क्यू-लर्निंग, पीपीओ, डीपीओ, जीआरपीओ  में सब कुछ इस आकार पर अनुकूलित होता है। इसे एक बार सीखें, बाकी के सशक्तिकरण सीखने को मुफ्त में पढ़ें।

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 · 06 (Probability & Distributions), Phase 2 · 01 (ML Taxonomy)
**Time:** ~45 minutes

## समस्या

आप एक शतरंज बॉट लिख रहे हैं या एक इन्वेंट्री प्लानर या एक ट्रेडिंग एजेंट या पीपीओ लूप जो तर्क मॉडल को प्रशिक्षित करता है चार अलग-अलग डोमेन, एक आश्चर्यजनक तथ्यः सभी चार एक ही गणितीय वस्तु में गिरते हैं।

पर्यवेक्षित सीखने आपको देता है `(x, y)`जोड़े और आप एक समारोह फिट करने के लिए पूछता है. प्रवर्धन सीखने आप कोई लेबल नहीं देता है  केवल राज्यों की एक धारा, आप किए गए कार्यों, और एक स्केलर पुरस्कार. क्या कदम खेल जीता? क्या पुनर्वितरण निर्णय पैसे बचाया? क्या व्यापार लाभ हुआ? क्या एलएलएम के रूप में सिर्फ उत्पादित टोकन के लिए नेतृत्व किया है एक उच्च पुरस्कार से न्यायाधीश?

इस धारा से आप तब तक नहीं सीख सकते जब तक आप इसे औपचारिक रूप से नहीं बनाते। "मैंने जो देखा", "मैंने क्या किया", "अब क्या हुआ", "यह कितना अच्छा था"  प्रत्येक को एक ऐसा वस्तु बनना चाहिए जिसके बारे में आप तर्क कर सकते हैं। यह औपचारिकता एक मार्कोव निर्णय प्रक्रिया है। इस चरण में प्रत्येक आरएल एल्गोरिथ्म, जिसमें अंत में आरएलएचएफ और जीआरपीओ लूप शामिल हैं, इस आकार पर अनुकूलित होता है।

## अवधारणा

![Markov decision process: states, actions, transitions, rewards, discount](../assets/mdp.svg)

**The five objects.**

- **States** $S$. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
- **Actions** $A$. . विकल्प. ऊपर / नीचे / बाएं / दाएं कदम. . . एक कदम खेलें. . एक टोकन जारी करें.
- **Transitions** $P(s' \mid s, a)$. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .$s$और कार्रवाई $a$शतरंज में निर्णायक, सूची में स्टोकास्टिक, एलएलएम में लगभग निर्णायक।
- **Rewards** $R(s, a, s')$. स्केलर सिग्नल. जीत = +1, हानि = -1. राजस्व घटाई गई लागत. GRPO में लॉग-संभाव्यता अनुपात अवधि.
- **Discount** $\gamma \in [0, 1)$. भविष्य में पुरस्कार वर्तमान के मुकाबले कितना मायने रखता है.$\gamma = 0.99$~ 100 कदम की क्षितिज खरीदता है; $\gamma = 0.9$~10 खरीदता है।

**The Markov property** $P(s_{t+1} \mid s_t, a_t) = P(s_{t+1} \mid s_0, a_0, \ldots, s_t, a_t)$भविष्य केवल वर्तमान राज्य पर निर्भर करता है यदि यह नहीं करता है, तो राज्य का प्रतिनिधित्व अपूर्ण है विधि की विफलता नहीं, राज्य की विफलता है।

**Policies and returns.**नीति$\pi(a \mid s)$नक्शे कार्रवाई वितरण के लिए राज्यों.$G_t = r_t + \gamma r_{t+1} + \gamma^2 r_{t+2} + \ldots$भविष्य के पुरस्कारों का सूट राशि है।$V^\pi(s) = \mathbb{E}[G_t \mid s_t = s]$ से शुरू होने वाली अपेक्षित रिटर्न है$s$नीति के अंतर्गत$\pi$. क्यू-मूल्य $Q^\pi(s, a) = \mathbb{E}[G_t \mid s_t = s, a_t = a]$प्रत्येक आरएल एल्गोरिथ्म इन दोनों में से एक का अनुमान लगाता है, फिर सुधार करता है $\pi$तदनुसार।

**The Bellman equations.**इस चरण में सभी वस्तुओं द्वारा उपयोग किए जाने वाले निश्चित बिंदु समीकरणः

```math
\begin{aligned}
V^\pi(s) &= \sum_a \pi(a \mid s) \sum_{s', r} P(s', r \mid s, a) [r + \gamma V^\pi(s')] \\
Q^\pi(s, a) &= \sum_{s', r} P(s', r \mid s, a) [r + \gamma \sum_{a'} \pi(a' \mid s') Q^\pi(s', a')]
\end{aligned}
```

इन विभाजनों की उम्मीद "इस चरण का पुरस्कार" प्लस "आप जहां उतरते हैं उसके छूट मूल्य" में लौटती है। पुनरावर्ती। चरण 9 में प्रत्येक एल्गोरिथ्म या तो इस समीकरण को अभिसरण (गतिशील प्रोग्रामिंग) में दोहराता है, इसके नमूने (मोंटे कार्लो) या इसे एक कदम (समय अंतर) में बूटस्ट्रेप करता है।

```figure
discount-horizon
```

## इसे बनाओ

### चरण 1: एक छोटी सी निर्धारक एमडीपी

एजेंट ऊपर बाईं ओर शुरू, टर्मिनल नीचे दाईं ओर, प्रति कदम -1 का पुरस्कार, कार्रवाई`{up, down, left, right}`. देखो .`code/main.py`. .

```python
GRID = 4
TERMINAL = (3, 3)
ACTIONS = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}

def step(state, action):
    if state == TERMINAL:
        return state, 0.0, True
    dr, dc = ACTIONS[action]
    r, c = state
    nr = min(max(r + dr, 0), GRID - 1)
    nc = min(max(c + dc, 0), GRID - 1)
    return (nr, nc), -1.0, (nr, nc) == TERMINAL
```

पांच पंक्तियाँ, यह पूरे वातावरण है निर्धारक संक्रमण, निरंतर चरण दंड, अवशोषण टर्मिनल राज्य।

### चरण 2: पॉलिसी लागू करें

नीति एक कार्य है जो राज्य से क्रिया वितरण तक है सबसे सरलः समान यादृच्छिक।

```python
def uniform_policy(state):
    return {a: 0.25 for a in ACTIONS}

def rollout(policy, max_steps=200):
    s, total, steps = (0, 0), 0.0, 0
    for _ in range(max_steps):
        a = sample(policy(s))
        s, r, done = step(s, a)
        total += r
        steps += 1
        if done:
            break
    return total, steps
```

इस 4×4 बोर्ड के लिए औसत रिटर्न -60 से -80 के आसपास है। इष्टतम रिटर्न -6 है (सीधी रेखा पथ दाईं ओर) । उस अंतराल को बंद करना चरण 9 में सब कुछ है।

### चरण 3: गणना `V^π`ठीक बेलमैन समीकरण के माध्यम से

छोटे MDP के लिए बेलमैन समीकरण एक रैखिक प्रणाली है। अंकित राज्यों, अपेक्षा लागू करें, तब तक दोहराएं जब तक कि मान बदलना बंद नहीं हो जाते।

```python
def policy_evaluation(policy, gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in all_states()}
    while True:
        delta = 0.0
        for s in all_states():
            if s == TERMINAL:
                continue
            v = 0.0
            for a, pi_a in policy(s).items():
                s_next, r, _ = step(s, a)
                v += pi_a * (r + gamma * V[s_next])
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            return V
```

यह पुनरावर्ती नीति मूल्यांकन है। यह सटन एंड बारटो में पहला एल्गोरिथ्म है और इसके बाद आने वाली प्रत्येक आरएल पद्धति का सैद्धांतिक आधार है।

### चरण 4: `γ`भौतिक अर्थ के साथ एक हाइपरपरमैटर है

प्रभावी क्षितिज लगभग है $1 / (1 - \gamma)$. .$\gamma = 0.9$→ 10 कदम। $\gamma = 0.99$→ 100 कदम। $\gamma = 0.999$→ 1000 कदम।

बहुत कम और एजेंट निकटता से काम करता है। बहुत अधिक और क्रेडिट असाइनमेंट शोर बन जाता है, क्योंकि कई शुरुआती कदम दूर भविष्य के पुरस्कार के लिए जिम्मेदारी साझा करते हैं।$\gamma = 1$क्योंकि एपिसोड छोटे और सीमित हैं। नियंत्रण कार्यों का उपयोग करें `0.95–0.99`. लंबी क्षितिज रणनीति खेल का उपयोग करें `0.999`. .

## फंदे

- **Non-Markovian state.**यदि आपको अंतिम तीन अवलोकनों का निर्णय लेने की आवश्यकता है, तो "स्थिति" केवल वर्तमान अवलोकन नहीं है। फिक्सः स्टैक फ्रेम (एटारी स्टैक 4) पर डीक्यूएन) या एक आवर्ती स्थिति (एलएसटीएम / जीआरयू अवलोकन पर) का उपयोग करें।
- **Sparse rewards.**केवल जीत के पुरस्कार बड़े राज्य स्थानों में सीखने को लगभग असंभव बनाते हैं। आकार पुरस्कार (मध्यवर्ती संकेत) या अनुकरण के साथ बूटस्ट्रैप (चरण 9 · 09) ।
- **Reward hacking.**प्रॉक्सी इनाम को अनुकूलित करने से अक्सर रोगजनक व्यवहार होता है। ओपनएआई के नाव-दौड़ एजेंट चक्रों में घूमते हुए दौड़ को खत्म करने के बजाय हमेशा के लिए पावरअप एकत्र करते हैं। हमेशा लक्ष्य परिणाम से इनाम को परिभाषित करें, प्रॉक्सी नहीं।
- **Discount mis-spec.** $\gamma = 1$अनंत क्षितिज के साथ एक कार्य पर हर मान अनंत बनाता है। हमेशा या तो एक अंत क्षितिज के साथ कैप या$\gamma < 1$. .
- **Reward scale.**{+100, -100} बनाम {+1, -1} के पुरस्कार समान अनुकूलन नीति देते हैं लेकिन बहुत अलग ग्रेडिएंट परिमाण।`[-1, 1]`-पीपीओ / डीक्यूएन में प्लग करने से पहले।

## इसका प्रयोग करें

2026 स्टैक कोड को छूने से पहले प्रत्येक आरएल पाइपलाइन को एमडीपी में कम करता हैः

| Situation | State | Action | Reward | γ |
|-----------|-------|--------|--------|---|
| Control (locomotion, manipulation) | Joint angles + velocities | Continuous torques | Task-specific shaped | 0.99 |
| Games (chess, Go, poker) | Board + history | Legal move | Win=+1 / loss=-1 | 1.0 (finite) |
| Inventory / pricing | Stock + demand | Order qty | Revenue - cost | 0.95 |
| RLHF for LLMs | Context tokens | Next token | Reward-model score at end | 1.0 (episode ~200 tokens) |
| GRPO for reasoning | Prompt + partial response | Next token | Verifier 0/1 at end | 1.0 |

प्रशिक्षण लूप लिखने से पहले पांच टूपल्स लिखें। अधिकांश "आरएल काम नहीं करता है" बग रिपोर्ट कागज पर टूट गया एक एमडीपी सूत्र को वापस पता चलता है।

## इसे भेजें

`outputs/skill-mdp-modeler.md`:

```markdown
---
name: mdp-modeler
description: Given a task description, produce a Markov Decision Process spec and flag formulation risks before training.
version: 1.0.0
phase: 9
lesson: 1
tags: [rl, mdp, modeling]
---

Given a task (control / game / recommendation / LLM fine-tuning), output:

1. State. Exact feature vector or tensor spec. Justify Markov property.
2. Action. Discrete set or continuous range. Dimensionality.
3. Transition. Deterministic, stochastic-with-known-model, or sample-only.
4. Reward. Function and source. Sparse vs shaped. Terminal vs per-step.
5. Discount. Value and horizon justification.

Refuse to ship any MDP where the state is non-Markovian without explicit mention of frame-stacking or recurrent state. Refuse any reward that was not defined in terms of the target outcome. Flag any `γ ≥ 1.0` on an infinite-horizon task. Flag any reward range >100x the typical step reward as a likely gradient-explosion source.
```

## व्यायाम

1. **Easy.**4×4 ग्रिडवर्ल्ड और रैंडम-पॉलिसी रोलआउट को लागू करें `code/main.py`. 10,000 एपिसोड चलाएं. रिटर्न का औसत और एसटीडी रिपोर्ट करें. इष्टतम रिटर्न की तुलना करें (-6).
2. **Medium.**दौड़ें`policy_evaluation`के साथ$\gamma \in \lbrace 0.5, 0.9, 0.99 \rbrace$एक समान-संदिग्ध नीति के लिए।`V`प्रत्येक के लिए 4×4 ग्रिड के रूप में। बताएं कि टर्मिनल के पास स्थित राज्य मान क्यों बड़े होते जाते हैं।$\gamma$. .
3. **Hard.**ग्रिडवर्ल्ड स्टोकास्टिक बारीः प्रत्येक कार्रवाई संभावना के साथ आसन्न दिशा में स्लाइड्स $p = 0.1$. . वर्दी नीति का पुनर्मूल्यांकन करें.`V[start]`बेहतर या बदतर?

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MDP | "Reinforcement learning setup" | Tuple $(S, A, P, R, \gamma)$ satisfying the Markov property. |
| State | "What the agent sees" | Sufficient statistic for future dynamics under the chosen policy class. |
| Policy | "Agent's behavior" | Conditional distribution $\pi(a \mid s)$ or deterministic map $s \to a$. |
| Return | "Total reward" | Discounted sum $\sum \gamma^t r_t$ from the current step. |
| Value | "How good a state is" | Expected return under $\pi$ starting from $s$. |
| Q-value | "How good an action is" | Expected return under $\pi$ starting from $s$ with first action $a$. |
| Bellman equation | "Dynamic programming recursion" | Fixed-point decomposition of value / Q into one-step reward plus discounted successor value. |
| Discount $\gamma$ | "Future vs present" | Geometric weight on far-future reward; effective horizon $\approx 1/(1-\gamma)$. |

## आगे पढ़ना

- [Sutton & Barto (2018). Reinforcement Learning: An Introduction, 2nd ed.](http://incompleteideas.net/book/RLbook2020.pdf)अध्याय 3 एमडीपी और बेलमैन समीकरणों को कवर करता है; अध्याय 1 प्रत्येक बाद के पाठ के आधार पर पुरस्कार परिकल्पना को प्रेरित करता है।
- [Bellman (1957). Dynamic Programming](https://press.princeton.edu/books/paperback/9780691146683/dynamic-programming) बेलमैन समीकरण की उत्पत्ति।
- [OpenAI Spinning Up — Part 1: Key Concepts](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html) गहरे आरएल कोण से संक्षिप्त एमडीपी प्राइमर।
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) एमडीपी और सटीक समाधान विधियों पर संचालन-अनुसंधान संदर्भ।
- [Littman (1996). Algorithms for Sequential Decision Making (PhD thesis)](https://cs.brown.edu/media/filer_public/d1/a6/d1a6f66a-289a-4b81-9596-417114843489/littman.pdf) गतिशील प्रोग्रामिंग विशेषज्ञता के रूप में एमडीपी का सबसे स्वच्छ व्युत्पन्न।
