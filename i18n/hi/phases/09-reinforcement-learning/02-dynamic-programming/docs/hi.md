# गतिशील प्रोग्रामिंग  नीति पुनरावृत्ति & मूल्य पुनरावृत्ति

> गतिशील प्रोग्रामिंग धोखाधड़ी के साथ RL है. आप पहले से ही संक्रमण और इनाम कार्यों को जानते हैं; आप बस बेलमैन समीकरण को दोहराते हैं जब तक$V$या $\pi$यह बेंचमार्क है जो प्रत्येक नमूना-आधारित विधि का उपयोग करने की कोशिश करता है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs)
**Time:** ~75 minutes

## समस्या

आप एक ज्ञात मॉडल के साथ एक MDP हैः आप पूछ सकते हैं $P(s' \mid s, a)$और $R(s, a, s')$किसी भी राज्य कार्रवाई जोड़े के लिए. एक इन्वेंट्री प्रबंधक मांग वितरण जानता है. एक बोर्ड गेम में निर्धारक संक्रमण है. एक ग्रिडवर्ल्ड पायथन की चार पंक्तियों है. आप एक * मॉडल * है.

मॉडल मुक्त आरएल (क्यू-लर्निंग, पीपीओ, रीइनफोर्स) का आविष्कार उस मामले के लिए किया गया था जहां आपके पास कोई मॉडल नहीं है  आप केवल पर्यावरण से नमूना ले सकते हैं। लेकिन जब आपके पास एक है, तो तेज़, बेहतर तरीके हैंः गतिशील प्रोग्रामिंग। बेलमैन ने उन्हें 1957 में डिजाइन किया था। वे अभी भी सटीकता को परिभाषित करते हैंः जब लोग कहते हैं "इस एमडीपी के लिए इष्टतम नीति", तो उनका मतलब है कि नीति डीपी वापस आ जाएगी।

आपको 2026 में तीन कारणों से इनकी आवश्यकता है. पहला, आरएल अनुसंधान में प्रत्येक तालिकागत वातावरण (ग्रेडवर्ल्ड, फ्रोज़नलेक, क्लिफवॉकिंग) को डीपी के साथ हल किया जाता है ताकि स्वर्ण मानक नीति का उत्पादन किया जा सके। दूसरा, सटीक मान आपको नमूना लेने के तरीकों को * डिबग* करने की अनुमति देते हैंः यदि क्यू-लर्निंग का अनुमान $V^{\ast}(s_0)$तीसरा, आधुनिक ऑफलाइन आरएल और योजना पद्धति (एमसीटीएस, अल्फाज़ेरो की खोज, चरण 9 · 10) में मॉडल आधारित आरएल सभी एक सीखे या दिए गए मॉडल पर बेलमैन बैकअप को दोहराते हैं।

## अवधारणा

![Policy iteration and value iteration, side by side](../assets/dp.svg)

**Two algorithms, both fixed-point iteration on Bellman.**

**Policy iteration.**नीति बदलने से रोकने तक दो चरणों का आदान-प्रदान करता है।

1. *मूल्यांकन:* दी गई नीति $\pi$, गणना $V^\pi$बार-बार आवेदन करके $V(s) \leftarrow \sum_a \pi(a \mid s) \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]$जब तक कि यह अभिसरण नहीं होता।
2. *सुधार*: दिया गया $V^\pi$, बनाने$\pi$लालची W.R.T. $V^\pi$$\pi(s) \leftarrow \arg\max_a \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]$. .

अभिसरण की गारंटी है क्योंकि (क) प्रत्येक सुधार चरण या तो बनाए रखता है $\pi$समान या सख्ती से बढ़ता है $V^\pi$कुछ राज्यों के लिए, (ख) निर्धारक नीतियों का स्थान परिमित है। आमतौर पर बड़े राज्यों के लिए भी ~520 बाहरी पुनरावृत्तियों में समाहित होता है।

**Value iteration.**एक स्वीप में मूल्यांकन और सुधार को ढक देता है। बेलमैन * अनुकूलता * समीकरण लागू करेंः

```math
V(s) \leftarrow \max_a \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]
```

 तक दोहराएँ$\max_s \lvert V_{\text{new}}(s) - V(s) \rvert < \epsilon$. लोभी कार्रवाई करके अंत में नीति निकालें. प्रति पुनरावृत्ति कड़ाई से तेज़  कोई आंतरिक मूल्यांकन लूप  लेकिन आम तौर पर अभिसरण के लिए अधिक पुनरावृत्ति की आवश्यकता होती है।

**Generalized policy iteration (GPI).**मूल्य फ़ंक्शन और नीति दोतरफा सुधार लूप में लॉक हैं; कोई भी विधि जो पारस्परिक सुसंगतता (असमन्वित मूल्य पुनरावृत्ति, संशोधित नीति पुनरावृत्ति, क्यू-लर्निंग, अभिनेता-आलोचक, पीपीओ) की ओर दोनों को चलाती है, जीपीआई का एक उदाहरण है।

**Why $\gamma < 1$ matters.**बेलमैन ऑपरेटर एक है $\gamma$-सूप-नॉर्म में संकुचनः $\lVert T V - T V' \rVert_\infty \le \gamma \lVert V - V' \rVert_\infty$संकुचन का अर्थ है अद्वितीय स्थिर बिंदु और ज्यामितीय अभिसरण।$\gamma < 1$और आप गारंटी खो देते हैं  आपको एक परिमित क्षितिज या एक अवशोषित टर्मिनल स्थिति की आवश्यकता है।

```figure
value-iteration-gamma
```

## इसे बनाओ

### चरण 1: GridWorld MDP मॉडल का निर्माण करें

पाठ 1 से एक ही 4 × 4 ग्रिडवर्ल्ड का उपयोग करें। हम एक स्टोकास्टिक संस्करण जोड़ते हैंः संभावना के साथ `0.1`एजेंट एक यादृच्छिक लंबवत दिशा में स्लाइड करता है।

```python
SLIP = 0.1

def transitions(state, action):
    if state == TERMINAL:
        return [(state, 0.0, 1.0)]
    outcomes = []
    for direction, prob in action_probs(action):
        outcomes.append((apply_move(state, direction), -1.0, prob))
    return outcomes
```

`transitions(s, a)` की सूची देता है`(s', r, p)`यह पूरी मॉडल है।

### चरण 2: नीतिगत मूल्यांकन

नीति के अनुसार `π(s) = {action: prob}`, बेलमैन समीकरण को दोहराएं जब तक $V$चलना बंद कर देता हैः

```python
def policy_evaluation(policy, gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in states()}
    while True:
        delta = 0.0
        for s in states():
            v = sum(pi_a * sum(p * (r + gamma * V[s_prime])
                              for s_prime, r, p in transitions(s, a))
                   for a, pi_a in policy(s).items())
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            return V
```

### चरण 3: नीतिगत सुधार

प्रतिस्थापन$\pi$लालची नीति के साथ w.r.t.$V$. अगर .$\pi$नहीं बदला, वापसी  हम इष्टतम पर हैं।

```python
def policy_improvement(V, gamma=0.99):
    new_policy = {}
    for s in states():
        best_a = max(
            ACTIONS,
            key=lambda a: sum(p * (r + gamma * V[s_prime])
                              for s_prime, r, p in transitions(s, a)),
        )
        new_policy[s] = best_a
    return new_policy
```

### चरण 4: उन्हें एक साथ सिलाई करें

```python
def policy_iteration(gamma=0.99):
    policy = {s: "up" for s in states()}   # arbitrary start
    for _ in range(100):
        V = policy_evaluation(lambda s: {policy[s]: 1.0}, gamma)
        new_policy = policy_improvement(V, gamma)
        if new_policy == policy:
            return V, policy
        policy = new_policy
```

4×4: 46 बाहरी पुनरावृत्तियों पर विशिष्ट अभिसरण। आउटपुट $V^{\ast}(0,0) \approx -6$और एक नीति जो कदमों की संख्या को सख्ती से कम करती है।

### चरण 5: मान पुनरावृत्ति (एक लूप संस्करण)

```python
def value_iteration(gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in states()}
    while True:
        delta = 0.0
        for s in states():
            v = max(sum(p * (r + gamma * V[s_prime])
                       for s_prime, r, p in transitions(s, a))
                   for a in ACTIONS)
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            break
    policy = policy_improvement(V, gamma)
    return V, policy
```

एक ही स्थिर बिंदु, कोड की कम पंक्तियों.

## फंदे

- **Forgetting to handle terminals.**यदि आप बेलमैन को अवशोषित करने की स्थिति में लागू करते हैं, तो यह अभी भी एक "सर्वश्रेष्ठ कार्रवाई" को उठाता है जो कुछ भी नहीं बदलता है।`if s == terminal: V[s] = 0`. .
- **Sup-norm vs L2 convergence.**उपयोग करें`max |V_new - V|`सैद्धांतिक गारंटी सुपर-नॉर्म पर है।
- **In-place vs synchronous updates.**अद्यतन`V[s]`इन-प्लेस (गॉस-सेडेल) एक अलग से तेजी से अभिसरण `V_new`उत्पादन कोड का उपयोग स्थान पर किया जाता है।
- **Policy ties.**यदि दो क्रियाओं के बराबर Q-मूल्य है, `argmax`प्रत्येक पुनरावृत्ति में अलग-अलग तरीके से संबंध तोड़ सकते हैं, जिससे "नीति स्थिर" जांच घिघी जाती है। एक स्थिर टाई-ब्रेक (फिक्स्ड ऑर्डर में पहला कार्य) का उपयोग करें।
- **State-space explosion.**डीपी है$O(\lvert S \rvert \cdot \lvert A \rvert)$प्रति स्वीप. ~ 107 राज्यों तक काम करता है. इसके अलावा, आप समारोह अनुमान (चरण 9 · 05 और आगे) की जरूरत है।

## इसका प्रयोग करें

2026 में, डीपी योजनाकारों की सटीकता आधार रेखा और आंतरिक लूप हैः

| Use case | Method |
|----------|--------|
| Solve a small tabular MDP exactly | Value iteration (simpler) or policy iteration (fewer outer steps) |
| Verify a Q-learning / PPO implementation | Compare to DP-optimal $V^{\ast}$ on a toy environment |
| Model-based RL (Phase 9 · 10) | Bellman backup on a learned transition model |
| Planning in AlphaZero / MuZero | Monte Carlo Tree Search = async Bellman backup |
| Offline RL (CQL, IQL) | Conservative Q-iteration — DP with a penalty on OOD actions |

जब भी कोई कहता है "उपतम मूल्य समारोह", वे मतलब है "डीपी स्थिर बिंदु।" जब आप देखते हैं $V^{\ast}$या $Q^{\ast}$एक कागज में, इस लूप की कल्पना करें।

## इसे भेजें

`outputs/skill-dp-solver.md`:

```markdown
---
name: dp-solver
description: Solve a small tabular MDP exactly via policy iteration or value iteration. Report convergence behavior.
version: 1.0.0
phase: 9
lesson: 2
tags: [rl, dynamic-programming, bellman]
---

Given an MDP with a known model, output:

1. Choice. Policy iteration vs value iteration. Reason tied to |S|, |A|, γ.
2. Initialization. V_0, starting policy. Convergence sensitivity.
3. Stopping. Sup-norm tolerance ε. Expected number of sweeps.
4. Verification. V*(s_0) computed exactly. Greedy policy extracted.
5. Use. How this baseline will be used to debug/evaluate sampling-based methods.

Refuse to run DP on state spaces > 10⁷. Refuse to claim convergence without a sup-norm check. Flag any γ ≥ 1 on an infinite-horizon task as a guarantee violation.
```

## व्यायाम

1. **Easy.**4 × 4 ग्रिडवर्ल्ड पर मूल्य पुनरावृत्ति चलाएँ $\gamma \in \lbrace 0.9, 0.99 \rbrace$. कितने साफ़ करने के लिए जब तक $\max \lvert \Delta V \rvert < 10^{-6}$? प्रिंट$V^{\ast}$एक 4 × 4 ग्रिड के रूप में।
2. **Medium.*** स्टोकास्टिक* ग्रिडवर्ल्ड पर नीति पुनरावृत्ति बनाम मूल्य पुनरावृत्ति की तुलना करें (स्लिप संभावना `0.1`) गिनतीः स्वीप्स, दीवार घड़ी समय, अंतिम $V^{\ast}(0,0)$जो पुनरावृत्ति में तेजी से परिवर्तित होता है?
3. **Hard.**संशोधित नीति पुनरावृत्ति बनाएंः मूल्यांकन चरण में, केवल चलाएं $k$अभिसरण के बजाय साफ़ करता है।$V^{\ast}(0,0)$त्रुटि बनाम$k$के लिए$k \in \lbrace 1, 2, 5, 10, 50 \rbrace$मूल्यांकन/सुधार के बाजी के बारे में वक्र आपको क्या बताता है?

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Policy iteration | "DP algorithm" | Alternating evaluation ($V^\pi$) and improvement (greedy $\pi$ w.r.t. $V^\pi$) until the policy stops changing. |
| Value iteration | "Faster DP" | Bellman optimality backup applied in one sweep; converges to $V^{\ast}$ geometrically. |
| Bellman operator | "The recursion" | $(T V)(s) = \max_a \sum P (r + \gamma V(s'))$; a $\gamma$-contraction in sup-norm. |
| Contraction | "Why DP converges" | Any operator $T$ with $\lVert T x - T y \rVert \le \gamma \lVert x - y \rVert$ has a unique fixed point. |
| GPI | "Everything is DP" | Generalized Policy Iteration: any method driving $V$ and $\pi$ to mutual consistency. |
| Synchronous update | "Jacobi-style" | Use old $V$ throughout a sweep; cleanly analyzable but slower. |
| In-place update | "Gauss-Seidel-style" | Use $V$ as it's being updated; converges faster in practice. |

## आगे पढ़ना

- [Sutton & Barto (2018). Ch. 4 — Dynamic Programming](http://incompleteideas.net/book/RLbook2020.pdf) नीति पुनरावृत्ति और मूल्य पुनरावृत्ति की कैनोनिक प्रस्तुति।
- [Bertsekas (2019). Reinforcement Learning and Optimal Control](http://www.athenasc.com/rlbook_athena.html) संकुचन मानचित्रण तर्क का कठोर उपचार।
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) संशोधित नीति पुनरावृत्ति और इसके अभिसरण विश्लेषण।
- [Howard (1960). Dynamic Programming and Markov Processes](https://mitpress.mit.edu/9780262582300/dynamic-programming-and-markov-processes/) मूल नीति पुनरावृत्ति पत्र।
- [Bertsekas & Tsitsiklis (1996). Neuro-Dynamic Programming](http://www.athenasc.com/ndpbook.html) प्रत्येक पाठ में डीपी से लेकर लगभग डीपी/गहरे आरएल तक का पुल।
