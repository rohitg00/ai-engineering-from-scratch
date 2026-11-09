# रिवार्ड मॉडलिंग और आरएलएचएफ

> मानव "अच्छा सहायक प्रतिक्रिया" के लिए एक पुरस्कार समारोह नहीं लिख सकते हैं, लेकिन वे दो प्रतिक्रियाओं की तुलना कर सकते हैं और बेहतर चुन सकते हैं। उन तुलनाओं के लिए एक पुरस्कार मॉडल फिट करें, फिर इसके खिलाफ भाषा मॉडल आरएल करें। क्रिस्टियानो 2017. इंस्ट्रक्टजीपीटी 2022। यह नुस्खा जिसने जीपीटी -3 को चैटजीपीटी में बदल दिया। 2026 में इसे ज्यादातर डीपीओ  द्वारा प्रतिस्थापित किया जा रहा है लेकिन मानसिक मॉडल बना हुआ है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 05 (Sentiment), Phase 9 · 08 (PPO)
**Time:** ~45 minutes

## समस्या

आपने अगले टोकन-पूर्वानुमान उद्देश्य पर एक भाषा मॉडल को प्रशिक्षित किया है। यह व्याकरणिक अंग्रेजी लिखता है। यह झूठ भी बोलता है, भटकता है, और मना करने से इनकार करता है। आप इसे अधिक पूर्व-प्रशिक्षण के साथ ठीक नहीं कर सकते हैं  वेब पाठ समस्या है, इलाज नहीं।

आप एक * स्केलर इनाम* चाहते हैं जिसमें लिखा हो "निर्देश X के लिए प्रतिक्रिया A से बेहतर है।" हाथ से इनाम फ़ंक्शन लिखना असंभव है। "उपयोगिता" टोकन पर एक बंद-रूप अभिव्यक्ति नहीं है। लेकिन मनुष्य दो आउटपुट की तुलना कर सकते हैं और एक प्राथमिकता चिह्नित कर सकते हैं। यह पैमाने पर एकत्र करने के लिए सस्ता है।

RLHF (Christiano et al. 2017; Ouyang et al. 2022) एक पुरस्कार मॉडल में वरीयताओं को परिवर्तित करता है, फिर उस पुरस्कार के खिलाफ पीपीओ के माध्यम से एलएम को अनुकूलित करता है। तीन चरणों मेंः एसएफटी → आरएम → पीपीओ। यह वह नुस्खा है जिसने 20232025 में चैटजीपीटी, क्लाउड, मिथुन और अन्य सभी संरेखित-एलएलएम को भेज दिया।

2026 में पीपीओ चरण को ज्यादातर डीपीओ (चरण 10 · 08) द्वारा प्रतिस्थापित किया जाता है क्योंकि यह सस्ता है और संरेखण ट्यूनिंग के लिए लगभग उतना ही अच्छा है। लेकिन * रिवार्ड मॉडल* टुकड़ा अभी भी प्रत्येक बेस्ट-ऑफ-एन नमूना, प्रत्येक आरएल-से-चेतना योग्य-रिवार्ड पाइपलाइन, और एक प्रक्रिया इनाम मॉडल का उपयोग करके हर तर्क मॉडल का आधार है। आरएलएचएफ को समझें और आप पूरे संरेखण स्टैक को समझेंगे।

## अवधारणा

![Three-stage RLHF: SFT, RM training on pairwise prefs, PPO with KL penalty](../assets/rlhf.svg)

**Stage 1: Supervised Fine-Tuning (SFT).**एक पूर्व-शिक्षित आधार मॉडल से शुरू करें। लक्ष्य व्यवहार के मानव-लिखित प्रदर्शन (निर्देशों के बाद प्रतिक्रिया, उपयोगी उत्तर, आदि) पर बारीकी से ट्यून करें। परिणामः एक मॉडल $\pi_{\text{SFT}}$जो *अच्छे व्यवहार की ओर पूर्वाग्रह रखता है* लेकिन उसके पास अभी भी एक असीमित कार्यक्षेत्र है।

**Stage 2: Reward Model training.**

- प्रतिक्रियाओं के जोड़े एकत्र करें $(y_+, y_-)$संकेतों के लिए $x$, मानव द्वारा "y_+ को y_-. के बजाय पसंद किया जाता है" के रूप में लेबल किया गया है।
- एक पुरस्कार मॉडल को प्रशिक्षित करें $R_\phi(x, y)$उच्च स्कोर को सौंपने के लिए $y_+$. .
- हानि: **Bradley-Terry pairwise logistic**:

  $L(\phi) = -\mathbb{E}[ \log \sigma(R_\phi(x, y_+) - R_\phi(x, y_-)) ]$

  $\sigma$बीटी 1952 से मानक (ब्राडली-टेरी) है और आधुनिक आरएलएचएफ में प्रमुख विकल्प है।

- $R_\phi$आमतौर पर SFT मॉडल से शुरू किया जाता है, जिसके ऊपर एक स्केलर सिर होता है। एक ही ट्रांसफार्मर रीढ़ की हड्डी; एक ही रैखिक परत पुरस्कार को आउटपुट करती है।

**Stage 3: PPO against the RM with KL penalty.**

- प्रशिक्षण योग्य नीति को प्रारंभ करें $\pi_\theta$से$\pi_{\text{SFT}}$. एक जमे हुए * संदर्भ * रखें$\pi_{\text{ref}} = \pi_{\text{SFT}}$. .
- प्रतिक्रिया के अंत में पुरस्कार $y$:

  $r_{\text{total}}(x, y) = R_\phi(x, y) - \beta \cdot \mathrm{KL}(\pi_\theta(\cdot \mid x) \Vert \pi_{\text{ref}}(\cdot \mid x))$

  KL दंड से रोकता है $\pi_\theta$$\pi_{\text{SFT}}$ यह एक *regularizer* है, हार्ड ट्रस्ट क्षेत्र नहीं। $\beta$आमतौर पर 0.01-0.05
- इस पुरस्कार के साथ पीपीओ (लक्ष 08) चलाएं। टोकन स्तर की पटरियों पर लाभ की गणना की जाती है, लेकिन आरएम केवल पूर्ण प्रतिक्रिया को स्कोर करता है।

**Why the KL?**इसके बिना, पीपीओ खुशी से पुरस्कार हैकिंग रणनीतियों को ढूंढ लेगा। RM को केवल वितरण में पूरा करने पर प्रशिक्षित किया गया था। वितरण से बाहर प्रतिक्रिया किसी भी मानव-लिखित से अधिक स्कोर कर सकती है। KL बनाए रखता है।$\pi_\theta$यह RLHF में सबसे महत्वपूर्ण एकल बटन है।

**2026 status:**

- **DPO**(राफेलोव 2023): बंद-रूप बीजगणित चरण 2+3 में प्राथमिकता डेटा पर एक एकल पर्यवेक्षित हानि में गिर जाता है। कोई आरएम, कोई पीपीओ नहीं। गणना के एक अंश के लिए संरेखण बेंचमार्क पर समान गुणवत्ता। चरण 10 · 08 में कवर किया गया।
- **GRPO**(DeepSeek 20242025): एक आलोचक के बजाय समूह-संबंधी आधार रेखा के साथ पीपीओ, मानव-शिक्षित आरएम के बजाय * सत्यापितकर्ता* (कोड रन / गणित उत्तर मैच) से पुरस्कार। तर्क मॉडल के लिए प्रमुख। चरण 9 · 12 में शामिल।
- **Process reward models (PRMs):**RLHF और GRPO दोनों संस्करणों में तर्क के लिए उपयोग किए जाने वाले आंशिक समाधान (प्रत्येक तर्क चरण) स्कोर करें।
- **Constitutional AI / RLAIF:**मानव के बजाय प्राथमिकताएं उत्पन्न करने के लिए एक संरेखित LLM का उपयोग करें।

```figure
reward-model
```

## इसे बनाओ

इस पाठ में स्ट्रिंग के रूप में प्रतिनिधित्व किए गए छोटे सिंथेटिक "प्रॉम्प्ट" और "प्रतिक्रिया" का उपयोग किया जाता है। आरएम एक बैग-ऑफ-टोकन प्रतिनिधित्व पर एक रैखिक स्कोरर है। कोई वास्तविक एलएलएम नहीं है  पाइपलाइन के *आकार* मायने रखता है, न कि पैमाने। देखें `code/main.py`. .

### चरण 1: सिंथेटिक प्राथमिकता डेटा

```python
PROMPTS = ["help me", "answer me", "explain this"]
GOOD_WORDS = {"clear", "specific", "kind", "thorough"}
BAD_WORDS = {"vague", "rude", "wrong", "short"}

def make_pair(rng):
    x = rng.choice(PROMPTS)
    y_good = rng.choice(list(GOOD_WORDS)) + " " + rng.choice(list(GOOD_WORDS))
    y_bad = rng.choice(list(BAD_WORDS)) + " " + rng.choice(list(BAD_WORDS))
    return (x, y_good, y_bad)
```

वास्तविक आरएलएचएफ में इसे मानव लेबलर द्वारा प्रतिस्थापित किया जाता है।`(prompt, preferred_response, rejected_response)` समान है।

### चरण 2: ब्रैडली-टेरी इनाम मॉडल

रैखिक स्कोर: `R(x, y) = w · bag(y)`. बीटी जोड़ी के अनुसार लॉग-लॉग को कम करने के लिए ट्रेनः

```python
def rm_train_step(w, x, y_pos, y_neg, lr):
    r_pos = dot(w, bag(y_pos))
    r_neg = dot(w, bag(y_neg))
    p = sigmoid(r_pos - r_neg)
    for tok, cnt in bag(y_pos).items():
        w[tok] += lr * (1 - p) * cnt
    for tok, cnt in bag(y_neg).items():
        w[tok] -= lr * (1 - p) * cnt
```

कुछ सौ अद्यतन के बाद,`w`अच्छे शब्दों के टोकन को सकारात्मक और बुरे को नकारात्मक वजन देता है।

### चरण 3: आरएम के ऊपर पीपीओ जैसी नीति

हमारे खिलौना नीति एक शब्दकोश से एक ही टोकन का उत्पादन करता है. हम RM के तहत टोकन स्कोर, गणना$\log \pi_\theta(\text{token} \mid \text{prompt})$, एक KL-से-संदर्भ दंड जोड़ें, और कटौती पीपीओ सरोगेट लागू करें।

```python
def rlhf_step(theta, ref, w, prompt, rng, eps=0.2, beta=0.1, lr=0.05):
    logits_theta = policy_logits(theta, prompt)
    probs = softmax(logits_theta)
    token = sample(probs, rng)
    logits_ref = policy_logits(ref, prompt)
    probs_ref = softmax(logits_ref)
    reward = dot(w, bag([token])) - beta * kl(probs, probs_ref)
    # ppo-style update on theta, treating reward as the return
    ...
```

### चरण 4: KL की निगरानी करें

ट्रैक औसत$\mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$हर अद्यतन. अगर यह आगे बढ़ता है`~5-10`(प्रति प्रतिक्रिया के लिए एनएटी में केएल, टोकन पर योग, इकाई टीआरएल लॉग) नीति से दूर बह गई है $\pi_{\text{SFT}}$: या $\beta$यह वास्तविक RLHF में शीर्ष निदान है।

### चरण 5: टीआरएल के साथ उत्पादन नुस्खा

एक बार जब आप खिलौना पाइपलाइन को समझते हैं, यहाँ एक ही लूप है कि एक असली पुस्तकालय उपयोगकर्ता इसे लिखता है।[TRL](https://huggingface.co/docs/trl)संदर्भ कार्यान्वयन है  `RewardTrainer`चरण 2 और `PPOTrainer`(केएल-टू-रिफरेंस के साथ निर्मित) चरण 3 के लिए।

```python
# Stage 2: reward model from pairwise preferences
from trl import RewardTrainer, RewardConfig
from transformers import AutoModelForSequenceClassification, AutoTokenizer

tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B-Instruct")
rm = AutoModelForSequenceClassification.from_pretrained(
    "meta-llama/Llama-3.1-8B-Instruct", num_labels=1
)

# dataset rows: {"prompt", "chosen", "rejected"} — Bradley-Terry format
trainer = RewardTrainer(
    model=rm,
    tokenizer=tok,
    train_dataset=preference_data,
    args=RewardConfig(output_dir="./rm", num_train_epochs=1, learning_rate=1e-5),
)
trainer.train()
```

```python
# Stage 3: PPO against the RM with KL penalty to the SFT reference
from trl import PPOTrainer, PPOConfig, AutoModelForCausalLMWithValueHead

policy = AutoModelForCausalLMWithValueHead.from_pretrained("./sft-checkpoint")
ref    = AutoModelForCausalLMWithValueHead.from_pretrained("./sft-checkpoint")  # frozen

ppo = PPOTrainer(
    config=PPOConfig(learning_rate=1.41e-5, batch_size=64, init_kl_coef=0.05,
                     target_kl=6.0, adap_kl_ctrl=True),
    model=policy, ref_model=ref, tokenizer=tok,
)

for batch in dataloader:
    responses = ppo.generate(batch["query_ids"], max_new_tokens=128)
    rewards   = rm(torch.cat([batch["query_ids"], responses], dim=-1)).logits[:, 0]
    stats     = ppo.step(batch["query_ids"], responses, rewards)
    # stats includes: mean_kl, clip_frac, value_loss — the three PPO diagnostics
```

पुस्तकालय आपके लिए तीन चीजें करता है।`adap_kl_ctrl=True`अनुकूलन-β अनुसूची को लागू करता हैः यदि अवलोकन किया गया KL  से अधिक है`target_kl`संदर्भ मॉडल को कन्वेंशन द्वारा जमे रखा गया है  आप गलती से पैरामीटर को `policy`और मूल्य सिर नीति के समान रीढ़ की हड्डी पर रहता है (`AutoModelForCausalLMWithValueHead`एक स्केलर एमएलपी सिर संलग्न करता है), यही कारण है कि टीआरएल रिपोर्ट `policy/kl`और `value/loss`अलग से।

## फंदे

- **Over-optimization / reward hacking.**RM अधूरा है;$\pi_\theta$लक्षणः इनाम अनिश्चित काल तक बढ़ता है जबकि मानव मूल्यांकन स्कोर पठारों या गिरता है। फिक्सः जल्दी रुकें, बढ़ाएँ $\beta$, आरएम प्रशिक्षण डेटा का विस्तार।
- **Length hacking.**उपयोगी प्रतिक्रियाओं पर प्रशिक्षित आरएम अक्सर अप्रत्यक्ष रूप से लंबाई का पुरस्कार देते हैं। नीति प्रतिक्रियाओं को पैड करना सीखती है। सुधारः लंबाई-सामान्यकृत पुरस्कार, या आरएलएआईएफ के साथ लंबाई-जागरूक आरएम।
- **Too-small RM.**एक छोटी सी आरएम पॉलिसी के आउटपुट को निष्ठापूर्वक स्कोर नहीं कर सकती है।
- **KL tuning.**बहुत कम β → बहाव और इनाम हैकिंग. बहुत अधिक β → नीति मुश्किल से बदलती है. मानक चाल एक * अनुकूलन * β है जो प्रति कदम एक निश्चित KL को लक्षित करता है।
- **Preference-data noise.**~ 30% मानव लेबल शोर या अस्पष्ट हैं। समझौता-निर्मित डेटा पर आरएम को प्रशिक्षित करके या बीटी पर तापमान का उपयोग करके मापें।
- **Off-policy problems.**पहली काल के बाद पीपीओ डेटा थोड़ा गैर-नीतिगत है। पाठ 08 में की तरह क्लिप अंश की निगरानी करें।

## इसका प्रयोग करें

2026 में आरएलएचएफ को परतों में रखा गया हैः

| Layer | Target | Method |
|-------|--------|--------|
| Instruction following, helpfulness, harmlessness | Alignment | DPO (Phase 10 · 08) preferred over RLHF-PPO. |
| Reasoning correctness (math, code) | Capability | GRPO with verifier reward (Phase 9 · 12). |
| Long-horizon multi-step tasks | Agentic | PPO / GRPO with process reward models over steps. |
| Safety / refusal behavior | Safety | RLHF-PPO with separate safety RM, or Constitutional AI. |
| Best-of-N at inference | Fast alignment | Use RM at decode time; no policy training needed. |
| Reward distillation | Inference compute | Train a small "reward head" on top of a frozen LM. |

2022-2024 में आरएलएचएफ * विधि* थी। 2026 में, उत्पादन संरेखण पाइपलाइनें आरएम-गहन या सुरक्षा-महत्वपूर्ण चरणों के लिए डीपीओ-पहली, पीपीओ-केवल हैं।

## इसे भेजें

`outputs/skill-rlhf-architect.md`:

```markdown
---
name: rlhf-architect
description: Design an RLHF / DPO / GRPO alignment pipeline for a language model, including RM, KL, and data strategy.
version: 1.0.0
phase: 9
lesson: 9
tags: [rl, rlhf, alignment, llm]
---

Given a base LM, a target behavior (alignment / reasoning / refusal / agent), and a preference or verifier budget, output:

1. Stage. SFT? RM? DPO? GRPO? With justification.
2. Preference or verifier source. Humans, AI feedback, rule-based, unit-test-pass, or reward distillation.
3. KL strategy. Fixed β, adaptive β, or DPO (implicit KL).
4. Diagnostics. Mean KL, reward stability, over-optimization guard (holdout human eval).
5. Safety gate. Red-team set, refusal rate, safety RM separate from helpfulness RM.

Refuse to ship RLHF-PPO without a KL monitor. Refuse to use an RM smaller than the target policy. Refuse length-only rewards. Flag any pipeline that does not hold back a blind human-eval set as lacking over-optimization protection.
```

## व्यायाम

1. **Easy.**ब्रैडली-टेरी पुरस्कार मॉडल को प्रशिक्षित करें `code/main.py`500 सिंथेटिक प्राथमिकता जोड़े पर। एक पकड़े हुए 100 जोड़े पर जोड़े के अनुसार सटीकता मापें। 90% से अधिक होना चाहिए।
2. **Medium.**खेलौना PPO-RLHF लूप चलाएँ $\beta \in \lbrace 0.0, 0.1, 1.0 \rbrace$प्रत्येक के लिए, प्लॉट RM स्कोर बनाम KL-से-रिफरेंस अपडेट पर। जो पुरस्कार हैक चलाता है?
3. **Hard.**एक ही प्राथमिकता डेटा पर DPO (closed-form preference-likelihood loss) लागू करें और गणना में उपयोग किए गए RLHF-PPO पाइपलाइन की तुलना करें और अंतिम RM स्कोर प्राप्त करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| RLHF | "Alignment RL" | Three-stage SFT + RM + PPO pipeline (Christiano 2017, Ouyang 2022). |
| Reward Model (RM) | "The scoring net" | Learned scalar function fit to pairwise preferences via Bradley-Terry. |
| Bradley-Terry | "Pairwise logistic loss" | $P(y_+ \succ y_-) = \sigma(R(y_+) - R(y_-))$; the standard RM objective. |
| KL penalty | "Stay near the reference" | $\beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$ in the reward; the anti-reward-hacking regularizer. |
| Reward hacking | "Goodhart's law" | Policy exploits RM flaws; symptoms: reward up, human eval flat. |
| RLAIF | "AI-labeled preferences" | RLHF where labels come from another LM instead of humans. |
| PRM | "Process Reward Model" | Scores partial reasoning steps; used in reasoning pipelines. |
| Constitutional AI | "Anthropic's method" | AI-generated preferences guided by explicit rules. |

## आगे पढ़ना

- [Christiano et al. (2017). Deep Reinforcement Learning from Human Preferences](https://arxiv.org/abs/1706.03741) जो अखबार आरएलएचएफ शुरू किया।
- [Ouyang et al. (2022). InstructGPT — Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) चैटजीपीटी के पीछे की विधि।
- [Stiennon et al. (2020). Learning to summarize with human feedback](https://arxiv.org/abs/2009.01325) संक्षेप के लिए पहले आरएलएचएफ।
- [Rafailov et al. (2023). Direct Preference Optimization](https://arxiv.org/abs/2305.18290) डीपीओ; 2026 में आरएलएचएफ के बाद का डिफॉल्ट।
- [Bai et al. (2022). Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073) RLAIF और आत्म-आलोचना लूप।
- [Anthropic RLHF paper (Bai et al. 2022). Training a Helpful and Harmless Assistant](https://arxiv.org/abs/2204.05862) एचएच पेपर।
- [Hugging Face TRL library](https://huggingface.co/docs/trl) उत्पादन `RewardTrainer`और `PPOTrainer`अनुकूलन-केएल और मूल्य-उच्च विवरण के लिए प्रशिक्षक स्रोत पढ़ें।
- [Hugging Face — Illustrating Reinforcement Learning from Human Feedback](https://huggingface.co/blog/rlhf)लाम्बर्ट, कैस्ट्रिकाटो, वॉन वेरा, हैविला द्वारा  तीन चरणों के पाइपलाइन के साथ आरेखों के साथ कैनोनिक वॉक-थ्रू।
- [von Werra et al. (2020). TRL: Transformer Reinforcement Learning](https://github.com/huggingface/trl) पुस्तकालय; `examples/`Llama, मिस्ट्रल, और Qwen के लिए अंत-से-अंत RLHF स्क्रिप्ट है।
- [Sutton & Barto (2018). Ch. 17.4 — Designing Reward Signals](http://incompleteideas.net/book/RLbook2020.pdf) पुरस्कार-अनुमान दृष्टिकोण; पुरस्कार हैकिंग के बारे में सोचने के लिए आवश्यक पूर्व शर्त।
