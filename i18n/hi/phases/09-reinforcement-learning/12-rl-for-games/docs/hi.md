# खेलों के लिए आरएल  अल्फाज़ेरो, मुज़ेरो, और एलएलएम-विनय युग

> 1992: टीडी-गैमोन ने शुद्ध टीडी के साथ बैकगैमॉन में मानव चैंपियनों को हराया। 2016: अल्फागो ने ली सेडोल को हराया। 2017: अल्फाज़ेरो ने खरोंच से शतरंज, शोगी और गो पर हावी रहा। 2025: डीपसेक-आर 1 ने एक ही नुस्खा साबित किया, जीआरपीओ के साथ पीपीओ की जगह, तर्क पर काम करता है। खेल बेंचमार्क हैं जो इस चरण में हर सफलता को चलाते हैं।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 05 (DQN), Phase 9 · 08 (PPO), Phase 9 · 09 (RLHF), Phase 9 · 10 (MARL)
**Time:** ~120 minutes

## समस्या

खेलों में आरएल की इच्छा के सभी हैं। शुद्ध पुरस्कार (जीत / हानि) । अंतहीन एपिसोड (स्व-खेल रीसेट) । सही सिमुलेशन (खेल * है * सिम्युलेटर) । निर्विवाद या छोटे निरंतर कार्रवाई स्थान। बहु-एजेंट संरचना जो विरोधी मजबूती को मजबूर करती है।

और खेलों में हर प्रमुख आरएल सफलता का परीक्षण किया गया है। टीडी-गैमन (बैकगैमन, 1992) । अत्तारी-डीक्यूएन (2013). अल्फागो (2016) । अल्फाज़ेरो (2017). ओपनएआई फाइव (दोटा 2, 2019). अल्फास्टार (स्टारक्राफ्ट II, 2019). मुज़ेरो (शिक्षित मॉडल, 2019). अल्फाटेन्सर (मैट्रिक्स गुणन, 2022) । अल्फाडेव (सोर्टिंग एल्गोरिदम, 2023) । डीप सीक-आर1 (गणितीय तर्क, 2025)  नवीनतम प्रदर्शन कि खेल-आरएल तकनीक पाठ पर काम करती है।

यह टॉपस्टोन एक एकल एकीकृत लेंस के माध्यम से तीन ऐतिहासिक वास्तुकला  अल्फाज़ेरो, मुज़ेरो और जीआरपीओ  का सर्वेक्षण करता हैः **self-play + search + policy improvement**. प्रत्येक पिछले को सामान्य करता है; विशेष रूप से GRPO एलएलएम तर्क में लागू अल्फाज़ेरो की विधि है, जिसमें टोकन कार्रवाई के रूप में और गणितीय सत्यापन जीत संकेत के रूप में होते हैं।

## अवधारणा

![AlphaZero ↔ MuZero ↔ GRPO: same loop, different environments](../assets/rl-games.svg)

**The unifying loop.**

```
while True:
    trajectory = self_play(current_policy, search)     # play game against self
    policy_target = search.improved_policy(trajectory) # search improves raw policy
    policy_net.update(policy_target, value_target)     # supervised on search output
```

**AlphaZero (2017).**सिल्वर आदि. ज्ञात नियमों के साथ एक खेल (शतरंज, शोगी, गो) दिया गयाः

- नीति-मूल्य नेटवर्क: एक टावर $f_\theta(s) \to (p, v)$. .$p$कानूनी कदमों पर एक पूर्ववर्ती है।$v$खेल के अपेक्षित परिणाम है।
- मोंटे कार्लो ट्री सर्च (MCTS): प्रत्येक कदम पर, संभावित निरंतरताओं के एक पेड़ का विस्तार करें। उपयोग $(p, v)$पूर्व + बूटस्ट्रैप के रूप में। UCB (PUCT) द्वारा नोड्स का चयन करेंः $a^{\ast} = \arg\max_a Q(s, a) + c \cdot p(a \mid s) \cdot \sqrt{N(s)} / (1 + N(s, a))$. .
- स्वयं-खेलः एजेंट बनाम एजेंट खेलें।$t$, एमसीटीएस यात्रा वितरण $\pi_t$नीतिगत प्रशिक्षण का लक्ष्य बन जाता है।
- हानि: $L = (v - z)^2 - \pi \cdot \log p + c \cdot \lVert \theta \rVert^2$. .$z$खेल का परिणाम (+1 / 0 / -1) है।

मानव ज्ञान शून्य, हस्तनिर्मित हेउरिस्टिक शून्य एक ही नुस्खा जो शतरंज, शोगी और गो में कुछ दसियों मिलियन से अधिक स्वयं खेल के बाद मास्टर किया गया।

**MuZero (2019).**Schrittwieser et al. नियम ज्ञात होने की आवश्यकता को हटा देता है।

- एक निश्चित वातावरण के बजाय, एक *लैटिनेंट डायनामिक्स मॉडल* सीखें।$(h, g, f)$:
  - $h(s)$: अवलोकन को लटेंट स्टेट में एन्कोड करें।
  - $g(s_{\text{latent}}, a)$: अगले लटेंट स्टेट + इनाम की भविष्यवाणी करें।
  - $f(s_{\text{latent}})$: पूर्वानुमान नीति + मूल्य।
- MCTS *लर्नाए गए लटेंट स्पेस* में चलता है।
- गो, शतरंज, शोगी और अत्तारी पर काम करता है एक एल्गोरिथ्म, कोई नियम ज्ञान नहीं।

**Stochastic MuZero (2022).**स्टोकैस्टिक गतिशीलता और मौका नोड्स जोड़ता है; बैकगैमोन-वर्ग के खेलों तक फैलता है।

**Muesli, Gumbel MuZero (2022-2024).**नमूना दक्षता और निर्धारात्मक खोज में सुधार।

**GRPO (2024-2025).**डीप सीक-आर1 नुस्खा. अल्फा-ज़ेरो के आकार का एक ही लूप, भाषा-मॉडल तर्क पर लागूः

- "गेम": एक गणित / कोडिंग / तर्क समस्या का उत्तर दें। "विन" = सत्यापनकर्ता (टेस्ट केस पास, संख्यात्मक उत्तर मैच) 1 देता है।
- नीतिः एमएलए. कार्यः टोकन. राज्यः शीघ्र + प्रतिक्रिया-अभी तक।
- कोई आलोचक नहीं (पीपीओ शैली $V_\phi$) इसके बजाय, प्रत्येक संकेत के लिए, नमूना $G$पॉलिसी से पूर्णता प्राप्त करें प्रत्येक के लिए पुरस्कार की गणना करें।**group-relative advantage** $A_i = (r_i - \text{mean}_r) / \text{std}_r$REINFORCE शैली के अपडेट के लिए संकेत के रूप में।
- डीफ्रीट को रोकने के लिए संदर्भ नीति के लिए KL दंड (जैसे RLHF) ।
- पूर्ण हानि:

  $L_{\text{GRPO}}(\theta) = -\mathbb E_{q, \lbrace o_i \rbrace} \left[ \frac{1}{G} \sum_i A_i \cdot \log \pi_\theta(o_i \mid q) \right] + \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$

कोई सीखा पुरस्कार मॉडल, कोई आलोचक, कोई MCTS नहीं। एक नियम आधारित सत्यापनकर्ता पुरस्कार प्रदान करता है, समूह-संबंधी आधार रेखा आलोचक की जगह लेती है, और खोज चरण छोड़ दिया जाता है। गणना के एक अंश पर तर्क मानकों पर पीपीओ-आरएलएचएफ गुणवत्ता से मेल खाता है या उससे अधिक है।

**The R1 recipe in full.**डीपसेक-आर1 (डीपसेक 2025) एक पेपर में दो मॉडल हैः

- **R1-Zero.**डीपसीक-वी3 बेस मॉडल से शुरू करें। कोई एसएफटी नहीं। जीआरपीओ को सीधे दो इनाम घटकों के साथ लागू करेंः * सटीकता इनाम* (नियम आधारित  क्या अंतिम उत्तर सही संख्या तक विश्लेषण करता है / क्या कोड इकाई परीक्षणों को पारित करता है) और * प्रारूप इनाम* (क्या पूरा करने के लिए अपनी सोच श्रृंखला को लपेटता है `<think>…</think>`टैग) हजारों चरणों के दौरान, औसत प्रतिक्रिया लंबाई ~100 से ~10,000 टोकन तक बढ़ जाती है और गणित बेंचमार्क स्कोर लगभग o1 पूर्वावलोकन स्तरों तक चढ़ता है। मॉडल खरोंच से तर्क करना सीखता है। नकारात्मक पक्षः इसकी सोच की श्रृंखलाएं अक्सर अपठनीय होती हैं, भाषाओं को मिश्रित करती हैं, और स्टाइलिश पॉलिश की कमी होती है।
- **R1.**चार चरणों की पाइपलाइन के साथ R1-Zero की पठनीयता की समस्याओं को ठीक करेंः
  1. **Cold-start SFT.**कुछ हजार लंबे CoT प्रदर्शनों को साफ स्वरूपण के साथ एकत्र करें। उन पर निगरानी-अधुन्यास आधार मॉडल। यह एक पठनीय प्रारंभिक बिंदु देता है।
  2. **Reasoning-oriented GRPO.**कोड स्विचिंग को रोकने के लिए सटीकता+फॉर्मेट पुरस्कार और *भाषा-समरूपता* पुरस्कार के साथ GRPO लागू करें।
  3. **Rejection sampling + SFT round 2.**आरएल चेकपॉइंट से ~600K तर्क पथ का नमूना लें, केवल सही अंतिम उत्तर और पठनीय CoT वाले लोगों को रखें, और ~200K गैर-कारण SFT उदाहरणों (लेखन, क्यूए, आत्म-ज्ञान) के साथ संयोजन करें। फिर से आधार को ठीक करें।
  4. **Full-spectrum GRPO.**एक और आरएल राउंड जो तर्क (नियम आधारित पुरस्कार) और सामान्य संरेखण (उपयोगिता/हानिकारकता प्राथमिकता आधारित पुरस्कार) दोनों को कवर करता है।

परिणाम खुले वजन पर एआईएमई और मैथ -500 पर ओ 1 से मेल खाता है, और डिस्टिल करने के लिए पर्याप्त छोटा है। उसी पेपर में आर 1 के तर्क के निशान पर एसएफटी'इंग द्वारा छह डिस्टिल किए गए घने मॉडल (क्यूएन -1.5 बी से लैमा -70 बी) भी जारी किए जाते हैं। छात्र पर कोई आरएल नहीं। एक मजबूत आरएल शिक्षक का डिस्टिलिशन लगातार छात्र के पैमाने पर आरएल को खरोंच से हराता है।

**Why GRPO instead of PPO for reasoning.**डीपसेकमैथ पेपर में तीन कारण (फरवरी 2024): (1) प्रशिक्षण के लिए कोई मूल्य नेटवर्क नहीं है, स्मृति को आधा करना; (2) समूह बेसलाइन स्वाभाविक रूप से तर्क कार्यों के परिणामस्वरूप दुर्लभ अंत-प्रक्षेपवक्र पुरस्कार को संभालती है; (3) प्रति-प्रोम्प्ट सामान्यीकरण बहुत अलग कठिनाई की समस्याओं के बीच लाभों की तुलना करता है, जो पीपीओ के एकल आलोचक नहीं कर सकते हैं।

**Search-free vs search-based.**खेल शाखाओं से जुड़ा हुआ हैः

- *उच्च क्षितिज के साथ सही सूचना के खेल* (गो, शतरंज): अभी भी खोज आधारित। अल्फाज़ेरो / मुज़ेरो हावी है।
- *LLM तर्क*: अभी तक उत्पादन में कोई MCTS नहीं है; पूर्ण रोलआउट पर GRPO, निष्कर्ष गणना के लिए सर्वश्रेष्ठ-ऑफ-एन। प्रक्रिया पुरस्कार मॉडल (PRM) चरण-स्तर खोज को वापस जोड़ने का संकेत देते हैं।

```figure
f3-selfplay-ladder
```

## इसे बनाओ

कोड में `code/main.py`कार्यकारी **GRPO in miniature**एक एल्गोरिथ्म LLM पर एक ही है; केवल नीति और वातावरण सरल हैं। यह * हानि * और * समूह-संबंधी लाभ * को सिखाता है, जो डीपसेकमैथ की 2024 नवाचार है।

### चरण 1: एक छोटी सत्यापन वातावरण

```python
QUESTIONS = [
    {"prompt": "q1", "correct": 3},
    {"prompt": "q2", "correct": 1},
]

def verify(prompt_idx, answer_token):
    return 1.0 if answer_token == QUESTIONS[prompt_idx]["correct"] else 0.0
```

वास्तविक जीआरपीओ में सत्यापनकर्ता इकाई परीक्षण चलाता है या गणितीय समानता की जांच करता है।

### चरण 2: नीतिः प्रति संकेत के लिए K उत्तर टोकन पर softmax

```python
def policy_probs(theta, p_idx):
    return softmax(theta[p_idx])
```

एक शीघ्रता पर शर्त लगाने वाले LLM के अंतिम परत आउटपुट के बराबर।

### चरण 3: समूह के नमूने और समूह-संबंधी लाभ

```python
def grpo_step(theta, p_idx, G=8, beta=0.01, lr=0.1, rng=None):
    probs = policy_probs(theta, p_idx)
    samples = [sample(probs, rng) for _ in range(G)]
    rewards = [verify(p_idx, s) for s in samples]
    mean_r = sum(rewards) / G
    std_r = stddev(rewards) + 1e-8
    advs = [(r - mean_r) / std_r for r in rewards]

    for a, A in zip(samples, advs):
        grad = onehot(a) - probs
        for i in range(len(probs)):
            theta[p_idx][i] += lr * A * grad[i]
    # KL penalty: pull theta toward reference
    for i in range(len(probs)):
        theta[p_idx][i] -= beta * (theta[p_idx][i] - reference[p_idx][i])
```

समूह-संबंधी लाभ 2024 डीपसेक ट्रिक है। कोई आलोचक की आवश्यकता नहीं है। "बेसलाइन" समूह औसत है, और सामान्यीकरण समूह एसटीडी का उपयोग करता है।

### चरण 4: रिइंफोर्स बेसलाइन (मूल्य मुक्त) की तुलना करें

एक ही सेटअप, एक ही गणना, सादा पुनर्जागरण. GRPO तेजी से और अधिक स्थिर रूप से अभिसरण.

### चरण 5: एंट्रॉपिया और KL का अवलोकन करें

RLHF के समान नैदानिकः संदर्भ के लिए औसत KL, नीति entropy, समय के साथ पुरस्कार। एक बार इन स्थिर, प्रशिक्षण समाप्त हो जाता है।

## फंदे

- **Reward hacking via verifier gaming.**GRPO RLHF के जोखिम को विरासत में देता हैः यदि सत्यापितकर्ता गलत या शोषण योग्य है, तो LLM शोषण को पाएगा। मजबूत सत्यापितकर्ता (कई परीक्षण मामले, औपचारिक सबूत) मायने रखते हैं।
- **Group size too small.**समूह-औसत मूल रेखा के भिन्नता इस तरह है $1/G$(इसकी मानक त्रुटि जैसे $1/\sqrt{G}$) नीचे $G = 4$, लाभ संकेत शोर है; मानक विकल्प है $G = 8$64 तक।
- **Length bias.**विभिन्न लंबाई के एलएलएम पूर्णताओं में अलग-अलग लॉग-संभाव्यताएं होती हैं। टोकन गिनती द्वारा सामान्यीकरण करें, या अनुक्रम स्तर लॉग-प्रोब का उपयोग करें, या अधिकतम लंबाई तक ट्रंक करें।
- **Pure self-play cycles.**अल्फाज़ेरो शैली का प्रशिक्षण सामान्य-समा खेलों पर प्रभुत्व लूप में फंस सकता है। विभिन्न प्रतिद्वंद्वी पूल (लीग खेल, पाठ 10) द्वारा कम किया जाता है।
- **Search-policy mismatch.**अल्फाज़ेरो खोज परिणामों की नकल करने के लिए नीति को प्रशिक्षित करता है। यदि नीति नेट खोज के वितरण को दर्शाने के लिए बहुत छोटा है, तो प्रशिक्षण स्टॉल।
- **Compute floor.**MuZero / AlphaZero को बड़े पैमाने पर कंप्यूटिंग की आवश्यकता होती है। एक एकल अपघटन अक्सर सैकड़ों GPU-घंटे होता है। सीखने के लिए मिनीट्यूर डेमो मौजूद हैं (जैसे, कनेक्ट चार पर अल्फाज़ेरो) ।
- **Verifier coverage.**बग के समाधान के लिए यूनिट टेस्ट जो बग को मजबूत करते हैं।

## इसका प्रयोग करें

2026 गेम-आरएल परिदृश्य, डोमेन द्वाराः

| Domain | Dominant method |
|--------|-----------------|
| Two-player zero-sum board games (Go, chess, shogi) | AlphaZero / MuZero / KataGo |
| Imperfect info card games (poker) | CFR + deep learning (DeepStack, Libratus, Pluribus) |
| Atari / pixel games | Muesli / MuZero / IMPALA-PPO |
| Large multiplayer strategy (Dota, StarCraft) | PPO + self-play + league (OpenAI Five, AlphaStar) |
| LLM math/code reasoning | GRPO (DeepSeek-R1, Qwen-RL, open replications) |
| LLM alignment | DPO / RLHF-PPO (not GRPO; verifier is preference not verifiable) |
| Robotics | PPO + DR (not game-RL, but uses same policy-gradient tools) |
| Combinatorial problems | AlphaZero variants (AlphaTensor, AlphaDev) |

* नुस्खा *  स्वयं-प्ले, खोज-वृद्धि सुधार, नीति डिस्टिलिशन  पाठ, पिक्सेल और भौतिक नियंत्रण को शामिल करता है। GRPO सबसे युवा उदाहरण है; अधिक आ रहे हैं।

## इसे भेजें

`outputs/skill-game-rl-designer.md`:

```markdown
---
name: game-rl-designer
description: Design a game-RL or reasoning-RL training pipeline (AlphaZero / MuZero / GRPO) for a given domain.
version: 1.0.0
phase: 9
lesson: 12
tags: [rl, alphazero, muzero, grpo, self-play]
---

Given a target (perfect-info game / imperfect-info / Atari / LLM reasoning / combinatorial), output:

1. Environment fit. Known rules? Markov? Stochastic? Multi-agent? Informs AlphaZero vs MuZero vs GRPO.
2. Search strategy. MCTS (PUCT with learned prior), Gumbel-sampled, best-of-N, or none.
3. Self-play plan. Symmetric self-play / league / offline data / verifier-generated.
4. Target signal. Game outcome / verifier reward / preference / learned model. Include robustness plan.
5. Diagnostics. Win rate vs baseline, ELO curve, verifier pass rate, KL to reference.

Refuse AlphaZero on imperfect-info games (route to CFR). Refuse GRPO without a trusted verifier. Refuse any game-RL pipeline without a fixed baseline opponent set (self-play ELO is uncalibrated otherwise).
```

## व्यायाम

1. **Easy.**GRPO बैंडिट को लागू करें `code/main.py`. 2 संकेतों × 4 उत्तर टोकन प्रत्येक पर ट्रेन. < 1,000 अद्यतन के साथ अभिसरण$G=8$. .
2. **Medium.**पीपीओ (कट) और वैनिला REINFORCE में प्लग करें। एक ही डाकू पर जीआरपीओ के साथ नमूना दक्षता और इनाम भिन्नता की तुलना करें।
3. **Hard.**एक लंबाई-2 "कारण श्रृंखला" तक विस्तारित करेंः एजेंट दो टोकन जारी करता है और सत्यापनकर्ता जोड़े को पुरस्कृत करता है। दो चरणों के अनुक्रमों में क्रेडिट असाइनमेंट को GRPO कैसे संभालता है, इसका माप करें। (संकेतः *पूर्ण अनुक्रम* पर गणना समूह लाभ, दोनों टोकन पदों पर प्रसारित करें) ।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MCTS | "Tree search with learned net" | Monte Carlo Tree Search; UCB1/PUCT selection with learned $(p, v)$ priors. |
| AlphaZero | "Self-play + MCTS" | Policy-value net trained to match MCTS visits and game outcome. |
| MuZero | "Learned-model AlphaZero" | Same loop but in latent space via learned dynamics. |
| GRPO | "Critic-free PPO" | Group Relative Policy Optimization; REINFORCE with group-mean baseline + KL. |
| PUCT | "AlphaZero's UCB" | $Q + c \cdot p \cdot \sqrt{N} / (1 + N_a)$ — balances value estimate with prior. |
| Self-play | "Agent vs past self" | Standard for zero-sum; symmetric training signal. |
| League play | "Population-based self-play" | Past + current + exploiters sampled as opponents. |
| Verifier reward | "Verifiable RL" | Reward comes from a deterministic checker (tests pass, answer matches). |
| Process reward | "PRM" | Scores each reasoning step, not just the final answer. |

## आगे पढ़ना

- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270). .
- [Silver et al. (2018). A general reinforcement learning algorithm that masters chess, shogi, and Go through self-play (AlphaZero)](https://www.science.org/doi/10.1126/science.aar6404). .
- [Schrittwieser et al. (2020). Mastering Atari, Go, chess and shogi by planning with a learned model (MuZero)](https://www.nature.com/articles/s41586-020-03051-4). .
- [Vinyals et al. (2019). Grandmaster level in StarCraft II (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z). .
- [DeepSeek-AI (2024). DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models (GRPO)](https://arxiv.org/abs/2402.03300) ग्रूप-संबंधी आधार पर GRPO और GRPO की शुरुआत करने वाला पेपर।
- [DeepSeek-AI (2025). DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning](https://arxiv.org/abs/2501.12948) पूर्ण चार चरणों वाला R1 नुस्खा और R1-Zero ablation।
- [Brown et al. (2019). Superhuman AI for multiplayer poker (Pluribus)](https://www.science.org/doi/10.1126/science.aay2400) सीएफआर + गहन शिक्षा के पैमाने पर।
- [Tesauro (1995). Temporal Difference Learning and TD-Gammon](https://dl.acm.org/doi/10.1145/203330.203343) कागज जो सब कुछ शुरू किया।
- [Hugging Face TRL — GRPOTrainer](https://huggingface.co/docs/trl/main/en/grpo_trainer) कस्टम इनाम फ़ंक्शन के साथ GRPO के उपयोग के लिए उत्पादन संदर्भ।
- [Qwen Team (2024). Qwen2.5-Math — GRPO replication](https://github.com/QwenLM/Qwen2.5-Math) R1 नुस्खा का बहु-पैमाना पर खुला प्रतिकृति।
- [Sutton & Barto (2018). Ch. 17 — Frontiers of Reinforcement Learning](http://incompleteideas.net/book/RLbook2020.pdf) स्वयं-खेल, खोज और "डिजाइन पुरस्कार" के लिए पाठ्यपुस्तक ढांचा जो आर 1 एलएलएम पैमाने पर प्रस्तुत करता है।
