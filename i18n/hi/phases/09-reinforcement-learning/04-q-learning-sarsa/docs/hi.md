# समय का अंतर  Q-Learning और SARSA

> मोन्टे कार्लो एपिसोड समाप्त होने तक इंतजार करता है। टीडी अगले मूल्य अनुमान को बूटस्ट्राप करके हर कदम के बाद अपडेट करता है। क्यू-लर्निंग ऑफ-पॉलिसी और आशावादी है; SARSA नीति पर है और सावधान है। दोनों कोड की एक पंक्ति हैं। दोनों इस चरण में हर गहरे आरएल विधि का आधार हैं।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming), Phase 9 · 03 (Monte Carlo)
**Time:** ~75 minutes

## समस्या

मोन्टे कार्लो काम करता है लेकिन इसकी दो महंगी मांगें हैं। इसे एपिसोड की आवश्यकता होती है जो समाप्त हो जाते हैं, और यह केवल अंतिम वापसी के बाद अपडेट होता है। यदि आपका एपिसोड 1,000 चरणों का है, तो एमसी कुछ भी अपडेट करने के लिए 1,000 चरणों का इंतजार करता है। यह उच्च-विभिन्नता, कम पूर्वाग्रह और अभ्यास में धीमा है।

गतिशील प्रोग्रामिंग का विपरीत प्रोफ़ाइल है  शून्य-विभेद बूटस्ट्रैप बैकअप  लेकिन एक ज्ञात मॉडल की आवश्यकता होती है।

समय अंतर (टीडी) सीखने से अंतर को विभाजित किया जाता है।$(s, a, r, s')$, एक कदम का लक्ष्य बनाओ$r + \gamma V(s')$और धक्का$V(s)$कोई मॉडल नहीं, कोई पूर्ण एपिसोड नहीं, अनुमानित उपयोग से पूर्वाग्रह$V$आरएचएस पर, लेकिन सीएम और ऑनलाइन अपडेट से नाटकीय रूप से कम भिन्नता चरण एक से.

यह वह पिव्वट है जिस पर आधुनिक आरएल  डीक्यूएन, ए 2 सी, पीपीओ, एसएसी  घूमता है। शेष चरण 9 कार्य अनुमान और ट्रिक्स की परतें हैं जो इस पाठ में आप लिखने वाले एक चरण के टीडी अपडेट के ऊपर निर्मित हैं।

## अवधारणा

![Q-learning vs SARSA: off-policy max vs on-policy Q(s', a')](../assets/td.svg)

**The TD(0) update for V:**

```math
V(s) \leftarrow V(s) + \alpha [r + \gamma V(s') - V(s)]
```

ब्रेस किए गए मात्रा टीडी त्रुटि है $\delta = r + \gamma V(s') - V(s)$यह $G_t - V(s_t)$एमसी में अभिसरण की आवश्यकता होती है$\alpha$रोबिन-मोंरो को संतुष्ट करने के लिए ($\sum \alpha = \infty$,$\sum \alpha^2 < \infty$) और सभी राज्यों का अनगिनत बार दौरा किया।

**Q-learning.**नियंत्रण के लिए नीतिगत TD विधिः

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma \max_{a'} Q(s', a') - Q(s, a)]
```

`max`यह मानता है कि * लोभी* नीति का पालन किया जाएगा$s'$आगे, चाहे एजेंट वास्तव में क्या कार्रवाई करता है. यह डिकूपलिंग Q-लर्निंग सीखने बनाता है$Q^{\ast}$जबकि एजेंट ε-गामी के माध्यम से खोजता है। Mnih et al. (2015) ने इसे अटारी पर गहन Q-लर्निंग में परिवर्तित किया (लर्निंग 05).

**SARSA.**नीतिगत टीडी विधिः

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma Q(s', a') - Q(s, a)]
```

नाम है टूपल $(s, a, r, s', a')$SARSA कार्रवाई का उपयोग करता है $a'$एजेंट *वास्तव में* अगला लेता है, लालची नहीं `argmax`. $Q^\pi$जो भी ε-लाभकारी के लिए $\pi$चल रहा है, जो सीमा में है $\epsilon \to 0$बन जाता है$Q^{\ast}$. .

**The cliff-walking difference.**क्लासिक चट्टान-चढ़ाने के कार्य पर (fall-off-cliff = reward -100), Q-learning चट्टान के किनारे के साथ इष्टतम पथ सीखता है लेकिन कभी-कभी खोज के दौरान दंड लेता है। SARSA चट्टान से एक कदम दूर एक सुरक्षित पथ सीखता है क्योंकि यह खोज शोर को अपने Q-मूल्य में कारगर बनाता है। प्रशिक्षण के साथ, दोनों इष्टतम पर पहुंचते हैं।$\epsilon \to 0$. व्यवहार में यह मायने रखता हैः जब वास्तव में परिचालन पर अन्वेषण हो रहा है, तो SARSA का व्यवहार अधिक रूढ़िवादी है।

**Expected SARSA.**प्रतिस्थापन$Q(s', a')$$\pi$:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma \sum_{a'} \pi(a' \mid s') Q(s', a') - Q(s, a)]
```

SARSA से कम भिन्नता (कोई नमूना नहीं)$a'$), नीतिगत लक्ष्य पर एक ही। अक्सर आधुनिक पाठ्यपुस्तकों में डिफ़ॉल्ट।

**n-step TD and TD(λ).**TD(0) और MC के बीच प्रतीक्षा करके अंतरण करें $n$बूटस्ट्रेपिंग से पहले कदम। $n=1$TD है, $n=\infty$है MC. TD(λ) सभी पर औसत $n$ज्यामितीय भार के साथ $(1-\lambda)\lambda^{n-1}$. अधिकांश गहरे आरएल उपयोग $n$3 से 20 के बीच।

```figure
qlearning-gridworld
```

## इसे बनाओ

### चरण 1: लालचपूर्ण नीति पर SARSA

```python
def sarsa(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})

    def choose(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        s = env.reset()
        a = choose(s)
        while True:
            s_next, r, done = env.step(s, a)
            a_next = choose(s_next) if not done else None
            target = r + (gamma * Q[s_next][a_next] if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s, a = s_next, a_next
    return Q
```

Q-Learning से *केवल* अंतर लक्ष्य रेखा है।

### चरण 2: Q-learning

```python
def q_learning(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    for _ in range(episodes):
        s = env.reset()
        while True:
            a = choose(s, Q, epsilon)
            s_next, r, done = env.step(s, a)
            target = r + (gamma * max(Q[s_next].values()) if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s = s_next
    return Q
```

`max`यह एक प्रतीक है नीतिगत और गैर-नीतिगत के बीच अंतर है।

### चरण 3: सीखने की वक्रता

100 एपिसोड पर ट्रैक औसत रिटर्न। सरल निर्धारात्मक ग्रिडवर्ल्ड पर क्यू-लर्निंग तेजी से अभिसरण करता है; चट्टान पर चलने पर SARSA अधिक रूढ़िवादी है।`code/main.py`, दोनों लगभग अनुकूल हैं ~ 2,000 एपिसोड के बाद के साथ $\alpha=0.1, \epsilon=0.1$. .

### चरण 4: डीपी सत्य की तुलना करें

प्राप्त करने के लिए रन मूल्य पुनरावृत्ति (लक्ष्मी 02)$Q^{\ast}$चेक करें$\max_{s,a} \lvert Q_{\text{learned}}(s,a) - Q^{\ast}(s,a) \rvert$. एक स्वस्थ तालिकाबद्ध टीडी एजेंट के भीतर लैंडिंग `~0.5`4×4 ग्रिडवर्ल्ड पर 10,000 एपिसोड के बाद।

## फंदे

- **Initial Q values matter.**आशावादी आरंभ ($Q = 0$एक नकारात्मक-पुरस्कार कार्य के लिए) खोज को प्रोत्साहित करता है।
- **α schedule.**निरंतर$\alpha$यह गैर-स्थिर समस्याओं के लिए ठीक है।$\alpha_n = 1/n$सिद्धांत में अभिसरण देता है लेकिन व्यवहार में बहुत धीमा होता है  पिन $\alpha$में `[0.05, 0.3]`और सीखने की वक्रता की निगरानी करें।
- **ε schedule.**उच्च प्रारंभ ($\epsilon=1.0$), क्षय करने के लिए $\epsilon=0.05$. "GLIE" (असीम अन्वेषण के साथ सीमा में लालची) अभिसरण की स्थिति है।
- **Max bias in Q-learning.**`max`ऑपरेटर ऊपर की ओर पूर्वाग्रह है जब $Q$ हेसल्ट के डबल क्यू-लर्निंग (जे कि डडीक्यूएन ने पाठ 05) में इस्तेमाल किया है) दो क्यू तालिकाओं के साथ इसे ठीक करता है।
- **Non-terminating episodes.**टीडी टर्मिनल के बिना सीख सकता है, लेकिन आपको या तो चरणों को कैप करना होगा या कैप पर बूटस्ट्रैप को सही ढंग से संभालना होगा। मानकः कैप को गैर-टर्मिनल के रूप में व्यवहार करें, बूटस्ट्रैप करना जारी रखें।
- **State hashing.**यदि राज्य टूपल्स/टेंसर हैं, तो एक हैश करने योग्य कुंजी (टूपल, सूची नहीं; टूपल फ्लोट्स गोल, कच्चे नहीं) का उपयोग करें।

## इसका प्रयोग करें

2026 में टीडी परिदृश्यः

| Task | Method | Reason |
|------|--------|--------|
| Small tabular environments | Q-learning | Learns optimal policy directly. |
| On-policy safety-critical | SARSA / Expected SARSA | Conservative during exploration. |
| High-dimensional state | DQN (Phase 9 · 05) | Neural-net Q-function with replay and target net. |
| Continuous actions | SAC / TD3 (Phase 9 · 07) | TD update on a Q-network; policy net emits actions. |
| LLM RL (reward-model-based) | PPO / GRPO (Phase 9 · 08, 12) | Actor-critic with TD-style advantage via GAE. |
| Offline RL | CQL / IQL (Phase 9 · 08) | Q-learning with conservative regularization. |

2026 के पेपर में आप जो "RL" पढ़ते हैं उनमें से 90 प्रतिशत Q-learning या SARSA का कुछ विस्तार है। आगे पढ़ने से पहले अपनी उंगलियों में तालिका अद्यतन को समझें।

## इसे भेजें

`outputs/skill-td-agent.md`:

```markdown
---
name: td-agent
description: Pick between Q-learning, SARSA, Expected SARSA for a tabular or small-feature RL task.
version: 1.0.0
phase: 9
lesson: 4
tags: [rl, td-learning, q-learning, sarsa]
---

Given a tabular or small-feature environment, output:

1. Algorithm. Q-learning / SARSA / Expected SARSA / n-step variant. One-sentence reason tied to on-policy vs off-policy and variance.
2. Hyperparameters. α, γ, ε, decay schedule.
3. Initialization. Q_0 value (optimistic vs zero) and justification.
4. Convergence diagnostic. Target learning curve, `|Q - Q*|` check if DP is possible.
5. Deployment caveat. How will exploration behave at inference? Is SARSA's conservatism needed?

Refuse to apply tabular TD to state spaces > 10⁶. Refuse to ship a Q-learning agent without a max-bias caveat. Flag any agent trained with ε held at 1.0 throughout (no exploitation phase).
```

## व्यायाम

1. **Easy.**4 × 4 ग्रिडवर्ल्ड पर क्यू-लर्निंग और SARSA लागू करें। 2,000 एपिसोड के लिए प्लॉट सीखने के वक्र (प्रति 100 एपिसोड औसत रिटर्न) बनाएं। कौन तेजी से अभिसरण करता है?
2. **Medium.**एक चट्टान-चलने वाले वातावरण (4×12, अंतिम पंक्ति -100 के साथ चट्टान है और आरंभ करने के लिए रीसेट करें) । Q-learning और SARSA अंतिम नीतियों की तुलना करें। प्रत्येक पथ का स्क्रीनशॉट लें। चट्टान के करीब कौन सा है?
3. **Hard.**एक शोर-पुरस्कार ग्रिडवर्ल्ड (गॉसियन शोर) पर डबल क्यू-लर्निंग लागू करें$\sigma=5$प्रति चरण पुरस्कार में जोड़ा गया), Q-learning के अतिशयोक्ति दिखाएँ $V^{\ast}(0,0)$जबकि डबल क्यू-लर्निंग नहीं करता है।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| TD error | "The update signal" | $\delta = r + \gamma V(s') - V(s)$, the bootstrapped residual. |
| TD(0) | "One-step TD" | Update after every transition using only the next state's estimate. |
| Q-learning | "Off-policy RL 101" | TD update with `max` over next-state actions; learns $Q^{\ast}$ regardless of behavior policy. |
| SARSA | "On-policy Q-learning" | TD update using the actual next action; learns $Q^\pi$ for current ε-greedy π. |
| Expected SARSA | "The low-variance SARSA" | Replace sampled $a'$ with its expectation under π. |
| GLIE | "Correct exploration schedule" | Greedy in the Limit with Infinite Exploration; needed for Q-learning convergence. |
| Bootstrapping | "Using current estimate in the target" | What distinguishes TD from MC. Source of bias but massive variance reduction. |
| Maximization bias | "Q-learning overestimates" | `max` over noisy estimates is upward-biased; fixed by Double Q-learning. |

## आगे पढ़ना

- [Watkins & Dayan (1992). Q-learning](https://link.springer.com/article/10.1007/BF00992698) मूल कागज और अभिसरण प्रमाण।
- [Sutton & Barto (2018). Ch. 6 — Temporal-Difference Learning](http://incompleteideas.net/book/RLbook2020.pdf) TD(0), SARSA, Q-learning, अपेक्षित SARSA।
- [Hasselt (2010). Double Q-learning](https://papers.nips.cc/paper_files/paper/2010/hash/091d584fced301b442654dd8c23b3fc9-Abstract.html) अधिकतम पूर्वाग्रह के लिए फिक्स।
- [Seijen, Hasselt, Whiteson, Wiering (2009). A Theoretical and Empirical Analysis of Expected SARSA](https://ieeexplore.ieee.org/document/4927542) अपेक्षित SARSA प्रेरणा।
- [Rummery & Niranjan (1994). On-line Q-learning using connectionist systems](https://www.researchgate.net/publication/2500611_On-Line_Q-Learning_Using_Connectionist_Systems) पेपर जो SARSA (तब "परिवर्तनवादी Q-learning" कहा जाता था) का निर्माण किया।
- [Sutton & Barto (2018). Ch. 7 — n-step Bootstrapping](http://incompleteideas.net/book/RLbook2020.pdf) TD(0) को TD(n) में सामान्यीकरण करता है, Q-learning से पात्रता के निशान तक और बाद में, PPO में GAE तक का रास्ता।
