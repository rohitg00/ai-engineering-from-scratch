# निकट नीति अनुकूलन (पीपीओ)

> A2C एक अपडेट के बाद प्रत्येक रोलआउट को फेंक देता है। पीपीओ नीति ग्रेडिएंट को एक छोटा महत्व अनुपात में लपेटता है ताकि आप नीति विस्फोट के बिना एक ही डेटा पर 10+ युग कर सकें। Schulman et al. (2017). अभी भी 2026 में डिफ़ॉल्ट नीति-ग्रेडिएंट एल्गोरिथ्म।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 06 (REINFORCE), Phase 9 · 07 (Actor-Critic)
**Time:** ~75 minutes

## समस्या

A2C (Lection 07) नीति पर हैः ग्रेडिएंट $\mathbb E_{\pi_\theta}[A \cdot \nabla \log \pi_\theta]$*वर्तमान* से नमूना लिया गया डेटा आवश्यक है$\pi_\theta$. एक अद्यतन लें, और $\pi_\theta$परिवर्तन; आप इस्तेमाल किया डेटा अब नीति से बाहर है. इसे फिर से उपयोग करें और अपने gradient पक्षपातपूर्ण है.

Atari पर, 8 envs × 128 चरणों पर एक रोलआउट = 1024 संक्रमण और पर्यावरण समय के एक दर्जन सेकंड। एक ग्रेडिएंट चरण के बाद इसे फेंकना व्यर्थ है।

ट्रस्ट रीजन पॉलिसी ऑप्टिमाइज़ेशन (TRPO, Schulman 2015) पहला फिक्स था: प्रत्येक अपडेट को सीमित करें ताकि पुरानी और नई नीति के बीच KL विचलन नीचे रहे $\delta$. सैद्धांतिक रूप से साफ, लेकिन प्रति अद्यतन एक संयुग्मित-ग्रेडिएंट समाधान की आवश्यकता होती है. कोई भी 2026 में TRPO चलाता है.

पीपीओ (Schulman et al. 2017) एक सरल कटौती लक्ष्य के साथ हार्ड ट्रस्ट-क्षेत्र प्रतिबंध की जगह लेता है। कोड की एक अतिरिक्त पंक्ति। प्रति रोलआउट दस युग। कोई संयुग्मित ग्रेडिएंट नहीं। पर्याप्त सैद्धांतिक गारंटी। नौ साल बाद यह अभी भी MuJoCo से RLHF तक सब कुछ के लिए डिफ़ॉल्ट नीति-ग्रेडिएंट एल्गोरिथ्म है।

## अवधारणा

![PPO clipped surrogate objective: ratio clipping at 1 ± ε](../assets/ppo.svg)

**The importance ratio.**

```math
r_t(\theta) = \frac{\pi_\theta(a_t \mid s_t)}{\pi_{\theta_{\text{old}}}(a_t \mid s_t)}
```

यह नई नीति के साथ डेटा एकत्र करने वाली नीति के बीच संभावना अनुपात है। $r_t = 1$इसका मतलब है कोई बदलाव नहीं।$r_t = 2$इसका मतलब है कि नई नीति में दो बार अधिक संभावना है$a_t$पुराने के रूप में.

**The clipped surrogate.**

```math
L^{\text{CLIP}}(\theta) = \mathbb{E}_t \left[ \min\left( r_t(\theta) A_t, \mathop{\mathrm{clip}}(r_t(\theta), 1-\epsilon, 1+\epsilon) A_t \right) \right]
```

दो शर्तेंः

- यदि लाभ $A_t > 0$और अनुपात आगे बढ़ने की कोशिश करता है $1 + \epsilon$, क्लिप ग्रेडिएंट फ्लैट करता है  एक अच्छा कार्रवाई आगे नहीं धक्का $+\epsilon$पुरानी संभावना से ऊपर।
- यदि लाभ $A_t < 0$और अनुपात नीचे गिरने की कोशिश करता है $1 - \epsilon$(जो कि पुराने नियम की तुलना में हम एक बुरा कार्य करने की संभावना कम कर देंगे) क्लिप ग्रेडिएंट को सपाट करता हैः एक बुरा कार्य को आगे नहीं धकेलें$-\epsilon$पुरानी संभावना से नीचे।

`min`दूसरी दिशा को संभालता हैः यदि अनुपात *उपयोगी* दिशा में स्थानांतरित हो गया है, तो आपको अभी भी ग्रेडिएंट मिलता है (पक्ष पर कोई क्लिपिंग नहीं जो आपको चोट पहुंचाएगी) ।

विशिष्ट $\epsilon = 0.2$. लक्ष्य को फ़ंक्शन के रूप में रेखांकित करें $r_t$: एक टुकड़ा-तरह के रूप में रैखिक कार्य "अच्छे पक्ष" पर एक सपाट छत और "बुरे पक्ष" पर एक सपाट मंजिल के साथ।

**The full PPO loss.**

```math
L(\theta, \phi) = L^{\text{CLIP}}(\theta) - c_v \cdot (V_\phi(s_t) - V_t^{\text{target}})^2 + c_e \cdot H(\pi_\theta(\cdot \mid s_t))
```

A2C के समान अभिनेता-आलोचना संरचना। तीन गुणांक, आमतौर पर $c_v = 0.5$,$c_e = 0.01$,$\epsilon = 0.2$. .

**The training loop.**

1. इकट्ठा करें $N \times T$पारगमन $N$समानांतर वातावरण के लिए $T$हर कदम।
2. लाभों की गणना करें (GAE), उन्हें स्थिर के रूप में जमे रखें।
3. ठंढना $\pi_{\theta_{\text{old}}}$वर्तमान के एक झलक के रूप में $\pi_\theta$. .
4. के लिए$K$`(s, a, A, V_target, log π_old(a|s))`:
   - गणना $r_t(\theta) = \exp(\log \pi_\theta(a \mid s) - \log \pi_{\text{old}}(a \mid s))$. .
   - आवेदन करें$L^{\text{CLIP}}$+ मूल्य हानि + एंट्रॉपी।
   - चरण चरण।
5. रोलआउट को त्यागें। चरण 1 पर लौटें।

$K = 10$और 64 के मिनी बैच एक मानक हाइपरपैरामीटर सेट है। पीपीओ मजबूत हैः सटीक संख्याएं शायद ही कभी ± 50% के भीतर मायने रखती हैं।

**KL-penalty variant.**मूल पेपर में अनुकूलन योग्य KL दंड का उपयोग करके एक विकल्प प्रस्तावित किया गया था: $L = L^{\text{PG}} - \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{old}})$के साथ$\beta$ध्यान में रखा KL के आधार पर समायोजित किया गया। क्लिपिंग संस्करण प्रमुख बन गया; KL संस्करण RLHF में जीवित रहता है (जहां संदर्भ नीति के लिए KL एक अलग प्रतिबंध है जिसे आप हमेशा चाहते हैं वैसे भी) ।

```figure
ppo-clip
```

## इसे बनाओ

### चरण 1: पकड़ `log π_old(a | s)`रोलआउट समय पर

```python
for step in range(T):
    probs = softmax(logits(theta, state_features(s)))
    a = sample(probs, rng)
    s_next, r, done = env.step(s, a)
    buffer.append({
        "s": s, "a": a, "r": r, "done": done,
        "v_old": value(w, state_features(s)),
        "log_pi_old": log(probs[a] + 1e-12),
    })
    s = s_next
```

स्नैपशॉट एक बार, रोलआउट समय पर लिया जाता है। यह अद्यतन युग के दौरान नहीं बदलता है।

### चरण 2: GAE लाभों की गणना करें (पाठ 07)

A2C के समान ही। पूरे बैच में सामान्यीकरण।

### चरण 3: कटौती सरोगेट अपडेट

```python
for _ in range(K_EPOCHS):
    for mb in minibatches(buffer, size=64):
        for rec in mb:
            x = state_features(rec["s"])
            probs = softmax(logits(theta, x))
            logp = log(probs[rec["a"]] + 1e-12)
            ratio = exp(logp - rec["log_pi_old"])
            adv = rec["advantage"]
            surrogate = min(
                ratio * adv,
                clamp(ratio, 1 - EPS, 1 + EPS) * adv,
            )
            # backprop -surrogate, add value loss, subtract entropy
            grad_logpi = onehot(rec["a"]) - probs
            if (adv > 0 and ratio >= 1 + EPS) or (adv < 0 and ratio <= 1 - EPS):
                pg_grad = 0.0  # clipped
            else:
                pg_grad = ratio * adv
            for i in range(N_ACTIONS):
                for j in range(N_FEAT):
                    theta[i][j] += LR * pg_grad * grad_logpi[i] * x[j]
```

"कट्ट → शून्य ग्रेडिएंट" पैटर्न पीपीओ का मूल है। यदि नई नीति पहले ही लाभकारी दिशा में बहुत दूर चली गई है, तो अद्यतन बंद हो जाता है।

### चरण 4: मूल्य और एंट्रॉपी

आलोचक लक्ष्य में मानक एमएसई और अभिनेता पर एट्रोपी बोनस जोड़ें, जो ए 2 सी के समान है।

### चरण 5: निदान

हर अपडेट को देखने के लिए तीन चीजेंः

- **Mean KL** $\mathbb{E}[\log \pi_{\text{old}} - \log \pi_\theta]$. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .`[0, 0.02]`. अगर यह आगे उड़ता है .`0.1`, कम करना `K_EPOCHS`या `LR`. .
- **Clip fraction** उन नमूनों का अंश जिसका अनुपात बाहर स्थित है $[1-\epsilon, 1+\epsilon]$. होना चाहिए .`~0.1-0.3`. अगर .`~0`, क्लिप कभी ट्रिगर नहीं करता → वृद्धि `LR`या `K_EPOCHS`. अगर .`~0.5+`, आप ओवर-फिट रोलआउट → उन्हें कम कर रहे हैं।
- **Explained variance** $1 - \text{Var}(V_{\text{target}} - V_{\text{pred}}) / \text{Var}(V_{\text{target}})$. आलोचनात्मक गुणवत्ता मीट्रिक. आलोचनात्मक सीखने के रूप में 1 की ओर चढ़ना चाहिए.

## फंदे

- **Clip coefficient mistuned.** $\epsilon = 0.2$यह वास्तविक मानक है।`0.1`अद्यतनों को बहुत शर्मीला बनाता है; `0.3+`अस्थिरता का निमंत्रण देता है।
- **Too many epochs.** $K > 20$नियमित रूप से अस्थिरता होती है क्योंकि नीति दूर से बहती है $\pi_{\text{old}}$- विशेष रूप से बड़े नेटवर्क के लिए कैप युग।
- **No reward normalization.**बड़े पुरस्कार पैमाने क्लिप रेंज में खाने. सामान्य पुरस्कार (चलने std) कंप्यूटर लाभ से पहले.
- **Forgetting advantage normalization.**प्रति बैच शून्य-औसत/इकाई-एसटीडी सामान्यीकरण मानक है। इसे छोड़ना अधिकांश बेंचमार्क पर पीपीओ को बर्बाद कर देता है।
- **Learning rate not decayed.**पीपीओ को रैखिक एलआर घटने से शून्य तक लाभ होता है। निरंतर एलआर अक्सर बदतर होता है।
- **Importance ratio math errors.**हमेशा`exp(log_new - log_old)`संख्यात्मक स्थिरता के लिए, नहीं `new / old`. .
- **Wrong gradient sign.**सरोगेट को अधिकतम करें = *कम से कम करें* $-L^{\text{CLIP}}$एक पलट दिया साइन सबसे आम पीपीओ बग है।

## इसका प्रयोग करें

पीपीओ 2026 के डिफ़ॉल्ट आरएल एल्गोरिथ्म है एक आश्चर्यजनक संख्या में डोमेनः

| Use case | PPO variant |
|----------|-------------|
| MuJoCo / robotics control | PPO with Gaussian policy, GAE(0.95) |
| Atari / discrete games | PPO with categorical policy, rolling 128-step rollouts |
| RLHF for LLMs | PPO with KL penalty to reference model, reward from RM at end of response |
| Large-scale game agents | IMPALA + PPO (AlphaStar, OpenAI Five) |
| Reasoning LLMs | GRPO (Lesson 12) — PPO variant without critic |
| Preference-only data | DPO — closed-form collapsing of PPO+KL, no online sampling |

पीपीओ * हानि आकार*  काटा सरोगेट + मूल्य + एंट्रॉपी  डीपीओ, जीआरपीओ, और लगभग हर आरएलएचएफ पाइपलाइन के लिए मंचन है।

## इसे भेजें

`outputs/skill-ppo-trainer.md`:

```markdown
---
name: ppo-trainer
description: Produce a PPO training config and a diagnostic plan for a given environment.
version: 1.0.0
phase: 9
lesson: 8
tags: [rl, ppo, policy-gradient]
---

Given an environment and training budget, output:

1. Rollout size. `N` envs × `T` steps.
2. Update schedule. `K` epochs, minibatch size, LR schedule.
3. Surrogate params. `ε` (clip), `c_v`, `c_e`, advantage normalization on.
4. Advantage. GAE(`λ`) with explicit `γ` and `λ`.
5. Diagnostics plan. KL, clip fraction, explained variance thresholds with alerts.

Refuse `K > 30` or `ε > 0.3` (unsafe trust region). Refuse any PPO run without advantage normalization or KL/clip monitoring. Flag clip fraction sustained above 0.4 as drift.
```

## व्यायाम

1. **Easy.**4×4 ग्रिडवर्ल्ड पर PPO चलाएँ $\epsilon=0.2, K=4$. समरूप पर्यावरण चरणों पर नमूना दक्षता को ए 2 सी (प्रति रोलआउट में एक युग) से तुलना करें।
2. **Medium.**पोंछें$K \in \lbrace 1, 4, 10, 30 \rbrace$. प्लॉट रिटर्न बनाम एनवी चरणों और अद्यतन के लिए ट्रैक औसत KL.$K$क्या KL इस कार्य पर विस्फोट करेगा?
3. **Hard.**कटौती की गई सरोगेट को अनुकूलन योग्य KL दंड ($\beta$यदि $\mathrm{KL} > 2 \cdot \text{target}$, यदि आधा हो$\mathrm{KL} < \text{target}/2$) अंतिम रिटर्न, स्थिरता और क्लिप-फ्री की तुलना करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Importance ratio | "r_t(θ)" | $\pi_\theta(a \mid s) / \pi_{\text{old}}(a \mid s)$; deviation from the policy that collected the data. |
| Clipped surrogate | "PPO's main trick" | $\min(r \cdot A, \mathop{\mathrm{clip}}(r, 1-\epsilon, 1+\epsilon) \cdot A)$; flat gradient past the clip on beneficial side. |
| Trust region | "TRPO / PPO intent" | Limit each update's KL to guarantee monotone improvement. |
| KL penalty | "Soft trust region" | Alternative PPO: $L - \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{old}})$. Adaptive $\beta$. |
| Clip fraction | "How often clipping triggers" | Diagnostic — should be 0.1-0.3; outside means mistuned. |
| Multi-epoch training | "Data reuse" | K epochs on each rollout; variance cost traded for sample efficiency. |
| On-policy-ish | "Mostly on-policy" | PPO is nominally on-policy but K>1 epochs uses slightly-off-policy data safely. |
| PPO-KL | "The other PPO" | KL-penalty variant; used in RLHF where KL-to-reference is already a constraint. |

## आगे पढ़ना

- [Schulman et al. (2017). Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347) अखबार।
- [Schulman et al. (2015). Trust Region Policy Optimization](https://arxiv.org/abs/1502.05477) TRPO, PPO के पूर्ववर्ती।
- [Andrychowicz et al. (2021). What Matters In On-Policy RL? A Large-Scale Empirical Study](https://arxiv.org/abs/2006.05990) प्रत्येक पीपीओ हाइपरपरमैटर को हटा दिया गया।
- [Ouyang et al. (2022). Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) InstructGPT; पीपीओ-इन-आरएलएचएफ नुस्खा।
- [OpenAI Spinning Up — PPO](https://spinningup.openai.com/en/latest/algorithms/ppo.html) PyTorch के साथ स्वच्छ आधुनिक प्रदर्शनी।
- [CleanRL PPO implementation](https://github.com/vwxyzjn/cleanrl) कई कागजातों द्वारा उपयोग किए जाने वाले संदर्भ एकल-फ़ाइल पीपीओ।
- [Hugging Face TRL — PPOTrainer](https://huggingface.co/docs/trl/main/en/ppo_trainer) भाषा मॉडल पर पीपीओ के उत्पादन नुस्खा; पाठ 09 (आरएलएचएफ) के साथ पढ़ें।
- [Engstrom et al. (2020). Implementation Matters in Deep Policy Gradients](https://arxiv.org/abs/2005.12729) "37 कोड-स्तर अनुकूलन" पेपर; कौन से पीपीओ ट्रिक्स लोडसहनदार हैं और कौन से लोक कथा हैं।
