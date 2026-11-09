# बहु-एजेंट आरएल

> एकल एजेंट आरएल का मानना है कि पर्यावरण स्थिर है। एक ही दुनिया में दो सीखने वाले एजेंटों को रखें और यह धारणा टूट जाती हैः प्रत्येक एजेंट दूसरे के वातावरण का हिस्सा है, और दोनों बदल रहे हैं। मल्टी-एजेंट आरएल सीखने को अभिसरण करने के लिए युक्तियों का एक सेट है जब मार्कोव परिकल्पना अब मान्य नहीं है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 04 (Q-learning), Phase 9 · 06 (REINFORCE), Phase 9 · 07 (Actor-Critic)
**Time:** ~45 minutes

## समस्या

एक रोबोट एक कमरे में नेविगेट करना सीखता है एक एकल एजेंट आरएल समस्या है। एक फुटबॉल टीम नहीं है। अल्फास्टार बनाम स्टारक्राफ्ट प्रतिद्वंद्वियों नहीं है। बोली एजेंटों का एक बाजार नहीं है। चार-तरफ़ा स्टॉप पर बातचीत करने वाली दो कारें नहीं हैं। कई-पर-कई वास्तविक दुनिया की समस्याएं नहीं हैं।

प्रत्येक बहु-एजेंट सेटिंग में, किसी एक एजेंट के दृष्टिकोण से, अन्य एजेंट * पर्यावरण का हिस्सा हैं। जैसे-जैसे वे सीखते हैं और अपना व्यवहार बदलते हैं, पर्यावरण गैर-स्थिर हो जाता है। मार्कोव संपत्ति  "अगली स्थिति केवल वर्तमान स्थिति और मेरी कार्रवाई पर निर्भर करती है"  उल्लंघन किया जाता है क्योंकि अगली स्थिति भी निर्भर करती है कि *अन्य* एजेंटों ने क्या चुना है, और उनकी नीति लक्ष्य को स्थानांतरित कर रही है।

यह तालिकागत अभिसरण प्रमाणों को तोड़ता है (क्यू-लर्निंग की गारंटी एक स्थिर वातावरण का मानता है) यह साफ़ गहरा आरएल को भी तोड़ता हैः एजेंट लूप में एक दूसरे का पीछा करते हैं, कभी भी स्थिर नीति के लिए अभिसरण नहीं करते हैं। आपको मल्टी-एजेंट विशिष्ट तकनीकों की आवश्यकता हैः केंद्रीकृत प्रशिक्षण / विकेंद्रीकृत निष्पादन, विपरीत मूल रेखाएं, लीग खेल, स्वयं खेल।

2026 आवेदनः रोबोट झुंड, ट्रैफिक रूटिंग, स्वायत्त वाहन बेड़े, बाजार सिम्युलेटर, मल्टी-एजेंट एलएलएम सिस्टम (चरण 16) और एक से अधिक बुद्धिमान खिलाड़ी वाले कोई भी खेल।

## अवधारणा

![Four MARL regimes: indep, centralized critic, self-play, league](../assets/marl.svg)

**Formalism: Markov Game.**एमडीपी का एक सामान्यीकरणः राज्यों $S$, एक संयुक्त कार्य $a = (a_1, \ldots, a_n)$, संक्रमण$P(s' \mid s, a)$, और प्रति एजेंट पुरस्कार $R_i(s, a, s')$. . प्रत्येक एजेंट .$i$अपनी नीति के तहत अपनी खुद की वापसी अधिकतम करता है $\pi_i$यदि पुरस्कार समान हैं, तो यह है**fully cooperative**. यदि शून्य-संख्यक, यह है **adversarial**यदि मिश्रित है, तो यह है**general-sum**. .

**Core challenges:**

- **Non-stationarity.** $P(s' \mid s, a_i)$एजेंट से$i$' का दृष्टिकोण निर्भर करता है$\pi_{-i}$, जो बदल रहा है।
- **Credit assignment.**एक साझा पुरस्कार के साथ, कौन एजेंट इसे पैदा किया?
- **Exploration coordination.**एजेंटों को पूरक रणनीतियों की खोज करनी चाहिए, एक ही स्थिति की खोज करने के लिए नहीं।
- **Scalability.**संयुक्त कार्यक्षेत्र में तेजी से वृद्धि होती है $n$. .
- **Partial observability.**प्रत्येक एजेंट केवल अपनी स्वयं की अवलोकन देखता है; वैश्विक स्थिति छिपी हुई है।

**Four dominant regimes:**

**1. Independent Q-learning / independent PPO (IQL, IPPO).**प्रत्येक एजेंट अपने स्वयं के Q या नीति सीखता है, दूसरों को पर्यावरण का हिस्सा मानते हुए। सरल, कभी-कभी यह काम करता है (विशेष रूप से अनुभव दोहराव के साथ जो एक चिकनी एजेंट-मॉडलिंग ट्रिक के रूप में कार्य करता है) । सैद्धांतिक अभिसरणः कोई नहीं। व्यवहार मेंः ढीले-संलग्न कार्यों के लिए ठीक है, कसकर-संलग्न कार्यों के लिए बुरा है।

**2. Centralized training, decentralized execution (CTDE).**सबसे आम आधुनिक प्रतिमान. प्रत्येक एजेंट की अपनी *नीति* है।$\pi_i$स्थानीय अवलोकन की शर्तें $o_i$ तैनाती पर मानक विकेंद्रीकृत निष्पादन। *शिक्षण* के दौरान, एक केंद्रीकृत आलोचक $Q(s, a_1, \ldots, a_n)$पूर्ण वैश्विक स्थिति और संयुक्त कार्रवाई के बारे में शर्तें।
- **MADDPG**(लो और सहयोगी 2017): प्रति एजेंट एक केंद्रीकृत आलोचक के साथ डीडीपीजी।
- **COMA**(Foerster et al. 2017): विपरीत आधार  पूछें "यदि मैंने कार्रवाई की होती तो मेरा पुरस्कार क्या होता $a'$इसके बजाय?"  मेरे योगदान को अलग करता है।
- **MAPPO**/**IPPO**साझा आलोचक (यूएट एट अल. 2022): केंद्रीकृत मूल्य समारोह के साथ पीपीओ। 2026 में सहकारी MARL के लिए प्रमुख।
- **QMIX**(Rashid et al. 2018): मूल्य विघटन  $Q_{\text{tot}}(s, a) = f(Q_1(s, a_1), \ldots, Q_n(s, a_n))$एकतरफा मिश्रण के साथ।

**3. Self-play.**एक ही एजेंट की दो प्रतियां एक दूसरे को खेलती हैं। प्रतिद्वंद्वी की नीति * अतीत के स्नैपशॉट से मेरी नीति है। अल्फागो / अल्फाज़ेरो / मुज़ेरो। ओपनएआई पांच। शून्य-समा खेलों के लिए सबसे अच्छा काम करता है; प्रशिक्षण संकेत सममित है।

**4. League play.**सामान्य-समा / विरोधी वातावरण के लिए स्वयं-खेल का विस्तारः अतीत और वर्तमान नीतियों की आबादी बनाए रखें, लीग से प्रतिद्वंद्वी का नमूना लें, उनके खिलाफ प्रशिक्षण दें। शोषक (वर्तमान सर्वश्रेष्ठ को हराने में विशेषज्ञता) और मुख्य शोषक (शोषक को हराने में विशेषज्ञता) जोड़ता है। अल्फास्टार (स्टारक्राफ्ट II) । जब खेल "रॉक-पेपर-शेयर" रणनीति चक्रों को स्वीकार करता है तो आवश्यक है।

**Communication.**एजेंटों को सीखने के संदेश भेजने की अनुमति दें $m_i$एक दूसरे के साथ सहयोगात्मक सेटिंग्स में काम करता है। Foerster et al. (2016) ने दिखाया कि अंतरणीय एजेंट के बीच संचार को अंत-से-अंत प्रशिक्षित किया जा सकता है। आज के एलएलएम आधारित मल्टी-एजेंट सिस्टम (चरण 16) अनिवार्य रूप से प्राकृतिक भाषा में संवाद करते हैं।

```figure
f3-marl-orbit
```

## इसे बनाओ

इस पाठ में दो सहकारी एजेंटों के साथ 6 × 6 ग्रिडवर्ल्ड का उपयोग किया जाता है। वे विपरीत कोनों से शुरू करते हैं और एक साझा लक्ष्य तक पहुंचना चाहिए। साझा पुरस्कारः`-1`प्रत्येक कदम जब कोई भी एजेंट अभी भी चल रहा है,`+10`जब दोनों आ जाते हैं.`code/main.py`. .

### चरण 1: बहु-एजेंट वातावरण

```python
class CoopGridWorld:
    def __init__(self):
        self.size = 6
        self.goal = (5, 5)

    def reset(self):
        return ((0, 0), (5, 0))  # two agents

    def step(self, state, actions):
        a1, a2 = state
        new1 = move(a1, actions[0])
        new2 = move(a2, actions[1])
        done = (new1 == self.goal) and (new2 == self.goal)
        reward = 10.0 if done else -1.0
        return (new1, new2), reward, done
```

* संयुक्त * कार्य स्थान है `|A|² = 16`वैश्विक स्थिति दो स्थितियों में है।

### चरण 2: स्वतंत्र Q-लर्निंग

प्रत्येक एजेंट संयुक्त राज्य पर कुंजीबद्ध अपने स्वयं के क्यू-टेबल चलाता है। प्रत्येक चरण मेंः दोनों ε-लाभिड कार्यों का चयन करें, संयुक्त संक्रमण एकत्र करें, प्रत्येक साझा पुरस्कार के साथ अपने स्वयं के क्यू को अपडेट करता है।

```python
def independent_q(env, episodes, alpha, gamma, epsilon):
    Q1, Q2 = defaultdict(default_q), defaultdict(default_q)
    for _ in range(episodes):
        s = env.reset()
        done = False
        while not done:
            a1 = epsilon_greedy(Q1, s, epsilon)
            a2 = epsilon_greedy(Q2, s, epsilon)
            s_next, r, done = env.step(s, (a1, a2))
            if done:
                Q1[s][a1] += alpha * (r - Q1[s][a1])
                Q2[s][a2] += alpha * (r - Q2[s][a2])
                break
            target1 = r + gamma * max(Q1[s_next].values())
            target2 = r + gamma * max(Q2[s_next].values())
            Q1[s][a1] += alpha * (target1 - Q1[s][a1])
            Q2[s][a2] += alpha * (target2 - Q2[s][a2])
            s = s_next
```

इस कार्य पर काम करता है क्योंकि पुरस्कार घने और संरेखित होते हैं। घनिष्ठ रूप से जुड़े कार्यों पर विफल रहता है (जैसे, जहां एक एजेंट को दूसरे के लिए *प्रतीक्षा* करनी होती है) ।

### चरण 3: विकृत-मूल्य अद्यतन के साथ केंद्रीकृत Q

संयुक्त कार्यों के लिए एक Q का उपयोग करें $Q(s, a_1, a_2)$. साझा पुरस्कार से अद्यतन. निष्पादन पर हाशिए पर करके विकेंद्रीकृतः $\pi_i(s) = \arg\max_{a_i} \max_{a_{-i}} Q(s, a_1, a_2)$* सही* वैश्विक दृश्य के लिए संयुक्त कार्यक्षेत्र का व्यापार करता है।

### चरण 4: सरल स्वयं-खेल (विरोधी 2-एजेंट)

एक ही एजेंट, दो भूमिकाएँ।$K$एपिसोड, A के वजन को B में कॉपी करना, सममित प्रशिक्षण, लगातार प्रगति करना, अल्फाज़ेरो नुस्खा लघु में।

## फंदे

- **Non-stationary replay.**स्वतंत्र एजेंटों के साथ अनुभव दोहराएं एकल एजेंट से बदतर है क्योंकि पुराने संक्रमण अब अप्रचलित विरोधियों द्वारा उत्पन्न किए गए थे।
- **Credit assignment ambiguity.**लंबे एपिसोड के बाद साझा पुरस्कार; यह कहने का कोई स्पष्ट तरीका नहीं है कि किस एजेंट ने योगदान दिया।
- **Policy drift / chasing.**प्रत्येक एजेंट की सबसे अच्छी प्रतिक्रिया एक दूसरे के अपडेट के साथ बदलती है। फिक्सः केंद्रीकृत आलोचक, धीमी सीखने की दर, या एक-एक-समय पर फ्रीज।
- **Reward hacking via coordination.**एजेंटों को डिजाइनर द्वारा अपेक्षित समन्वयित शोषण मिलते हैं। नीलामी एजेंटों को शून्य बोली पर आमंत्रित किया जाता है। फिक्सः सावधानीपूर्वक इनाम डिजाइन, व्यवहार संबंधी प्रतिबंध।
- **Exploration redundancy.**दोनों एजेंटों एक ही राज्य कार्रवाई जोड़े की खोज करते हैं। फिक्सः प्रति एजेंट entropy बोनस, या भूमिका-परिवर्तन.
- **League cycles.**शुद्ध स्व-खेल एक प्रभुत्व चक्र में फंस सकता है। फिक्सः विविध प्रतिद्वंद्वियों के साथ लीग खेलना।
- **Sample explosion.** `n`एजेंट × स्टेट स्पेस × संयुक्त क्रियाएँ। फ़ंक्शन समीकरण के साथ अनुमानित; कारकों में क्रिया स्थान (प्रति एजेंट एक नीति आउटपुट हेड) ।

## इसका प्रयोग करें

2026 MARL आवेदन मानचित्रः

| Domain | Method | Notes |
|--------|--------|-------|
| Cooperative navigation / manipulation | MAPPO / QMIX | CTDE; shared critic + decentralized actors. |
| Two-player games (chess, Go, poker) | Self-play with MCTS (AlphaZero) | Zero-sum; symmetric training. |
| Complex multiplayer (Dota, StarCraft) | League play + imitation pretraining | OpenAI Five, AlphaStar. |
| Autonomous-vehicle fleets | CTDE MAPPO / PPO with attention | Partial obs; variable team sizes. |
| Auction markets | Game-theoretic equilibrium + RL | Mean-field RL when `n` → ∞. |
| LLM multi-agent systems (Phase 16) | Natural-language comm + role conditioning | RL loop at the agent-planning layer. |

2026 में, मार्ल का सबसे बड़ा विकास क्षेत्र एलएलएम-आधारित हैः भाषा मॉडल एजेंटों के झुंड जो बातचीत, बहस, सॉफ्टवेयर निर्माण करते हैं। आरएल *ट्रैक्टरी-स्तर* आउटपुट पर प्राथमिकता अनुकूलन के रूप में दिखाई देता है, टोकन-स्तर पर नहीं (चरण 16 · 03) ।

## इसे भेजें

`outputs/skill-marl-architect.md`:

```markdown
---
name: marl-architect
description: Pick the right multi-agent RL regime (IPPO, CTDE, self-play, league) for a given task.
version: 1.0.0
phase: 9
lesson: 10
tags: [rl, multi-agent, marl, self-play]
---

Given a task with `n` agents, output:

1. Regime classification. Cooperative / adversarial / general-sum. Justify.
2. Algorithm. IPPO / MAPPO / QMIX / self-play / league. Reason tied to coupling tightness and reward structure.
3. Information access. Centralized training (what global info goes to the critic)? Decentralized execution?
4. Credit assignment. Counterfactual baseline, value decomposition, or reward shaping.
5. Exploration plan. Per-agent entropy, population-based training, or league.

Refuse independent Q-learning on tightly-coupled cooperative tasks. Refuse to recommend self-play for general-sum with cycle risks. Flag any MARL pipeline without a fixed-opponent eval (cherry-picked self-play numbers are common).
```

## व्यायाम

1. **Easy.**2-एजेंट सहकारी ग्रिडवर्ल्ड पर स्वतंत्र Q-लर्निंग का प्रशिक्षण। औसत रिटर्न > 0 तक कितने एपिसोड? संयुक्त सीखने वक्र का पता लगाएं।
2. **Medium.**एक "संयोजन" कार्य जोड़ेंः लक्ष्य तब ही प्राप्त होता है जब दोनों एजेंट उसी मोड़ पर उस पर कदम रखते हैं। क्या स्वतंत्र क्यू अभी भी अभिसरण करते हैं? क्या टूटता है?
3. **Hard.**MAPPO शैली के प्रशिक्षण के लिए एक केंद्रीकृत आलोचक को लागू करें और समन्वय कार्य पर स्वतंत्र पीपीओ के साथ अभिसरण गति की तुलना करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Markov game | "Multi-agent MDP" | $(S, A_1, \ldots, A_n, P, R_1, \ldots, R_n)$; each agent has its own reward. |
| CTDE | "Centralized training, decentralized execution" | Joint critic at training time; each agent's policy uses only local obs. |
| IPPO | "Independent PPO" | Each agent runs PPO separately. Simple baseline; often underrated. |
| MAPPO | "Multi-agent PPO" | PPO with a centralized value function conditioned on global state. |
| QMIX | "Monotonic value decomposition" | $Q_{\text{tot}} = f_{\text{monotone}}(Q_1, \ldots, Q_n)$ allows decentralized argmax. |
| COMA | "Counterfactual multi-agent" | Advantage = my Q minus expected Q marginalizing over my action. |
| Self-play | "Agent vs past self" | Single agent, two roles; standard for zero-sum games. |
| League play | "Population training" | Cache past policies, sample opponents from the pool; handles strategy cycles. |

## आगे पढ़ना

- [Lowe et al. (2017). Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments (MADDPG)](https://arxiv.org/abs/1706.02275) एक केंद्रीकृत आलोचक के साथ सीटीडीई।
- [Foerster et al. (2017). Counterfactual Multi-Agent Policy Gradients (COMA)](https://arxiv.org/abs/1705.08926) क्रेडिट असाइनमेंट के लिए प्रतिपक्षी आधार रेखाएँ।
- [Rashid et al. (2018). QMIX: Monotonic Value Function Factorisation](https://arxiv.org/abs/1803.11485) एकतरफाता के साथ मूल्य विघटन।
- [Yu et al. (2022). The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games (MAPPO)](https://arxiv.org/abs/2103.01955) पीपीओ मार्ल के लिए आश्चर्यजनक रूप से मजबूत है।
- [Vinyals et al. (2019). Grandmaster level in StarCraft II using multi-agent reinforcement learning (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z) लीग खेल पैमाने पर।
- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270) शून्य-संख्यक खेलों में शुद्ध स्व-खेल।
- [Sutton & Barto (2018). Ch. 15 — Neuroscience & Ch. 17 — Frontiers](http://incompleteideas.net/book/RLbook2020.pdf) में बहु-एजेंट सेटिंग्स के पाठ्यपुस्तक के संक्षिप्त उपचार और गैर-स्थिरता समस्या शामिल है जिसे CTDE हल करने के लिए डिज़ाइन किया गया है।
- [Zhang, Yang & Başar (2021). Multi-Agent Reinforcement Learning: A Selective Overview](https://arxiv.org/abs/1911.10635) अभिसरण के परिणामों के साथ सहकारी, प्रतिस्पर्धी और मिश्रित MARL को कवर करने वाले सर्वेक्षण।
