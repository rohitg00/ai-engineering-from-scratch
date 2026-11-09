# Ödül Modelleme & RLHF

> İnsanlar "iyi yardımcı yanıt" için bir ödül işlevi yazabilir, ancak iki yanıtı karşılaştırıp daha iyi birini seçebilirler. Bu karşılaştırmalara bir ödül modeli uygula, sonra dil modelini karşılaştırın. Christiano 2017. InstructGPT 2022. GPT-3'yi ChatGPT'ye çeviren tarif. 2026'da çoğunlukla DPO  ile değiştirildi ancak zihinsel model kalır.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 05 (Sentiment), Phase 9 · 08 (PPO)
**Time:** ~45 minutes

## Sorun

Bir dil modeli, bir sonraki belirti tahmin amacıyla eğitilmiştir. İngilizce dilini yazıyor. Aynı zamanda yalan söylüyor, gevezeliyor ve reddetmeyi reddediyor. Bunu daha fazla eğitimle düzeltemezsiniz.

*Skalare ödül * istediğinizde, "A'nın yanıtı, talimat X için B'nin yanıtından daha iyidir". diye yazmak mümkün değildir. "Yardımcılık" bir simge üzerinde kapalı bir ifadedir.

RLHF (Christiano et al. 2017; Ouyang et al. 2022) tercihleri bir ödül modeli haline getirir, sonra ödül karşısında PPO üzerinden LM'yi optimize eder. Üç adımla: SFT → RM → PPO. ChatGPT, Claude, Gemini ve diğer tüm uyumlu-LLM'leri 2023  2025 yılında gönderen tarif budur.

2026 yılında PPO aşaması çoğunlukla DPO (Fase 10 · 08) ile değiştirilmiştir çünkü daha ucuz ve uyum ayarlama için neredeyse aynı derecede iyidir. Ancak * ödül modeli* parçası hala her Best-of-N örneği, her RL-den-verifiable- ödül borusunun ve her bir akılcılık modeliyle bir süreç ödül modeli kullanan temelini oluşturur. RLHF'yi anlayın ve tüm uyum yığını anlarsınız.

## Anlaşım

![Three-stage RLHF: SFT, RM training on pairwise prefs, PPO with KL penalty](../assets/rlhf.svg)

**Stage 1: Supervised Fine-Tuning (SFT).**Önceden eğitilmiş bir temel modelden başlayın. Hedef davranışının insan tarafından yazılmış gösterileri (özetleri takip eden cevaplar, yardımcı cevaplar vb.) ince ayarlayın. Sonuç: bir model $\pi_{\text{SFT}}$Bu, * iyi davranışlara karşı önyargılı* ama yine de sınırsız bir eylem alanı vardır.

**Stage 2: Reward Model training.**

- Cevap çiftlerini topla $(y_+, y_-)$İsteklere karşı .$x$, insanlar tarafından "y_+ y_-." olarak etiketlenmiştir.
- Ödül modelini eğit $R_\phi(x, y)$                        $y_+$- Evet .
- Kayıp:**Bradley-Terry pairwise logistic**- ...

  $L(\phi) = -\mathbb{E}[ \log \sigma(R_\phi(x, y_+) - R_\phi(x, y_-)) ]$

  $\sigma$BT, 1952'den beri standarttır (Bradley-Terry) ve modern RLHF'de baskın seçimdir.

- $R_\phi$SFT modelinden genellikle üstte bir skalar başlı olarak başlatılır. Aynı transformatör omurgası; tek bir doğrusal katman ödülünü çıkarır.

**Stage 3: PPO against the RM with KL penalty.**

- Eğitilebilir politika başlatılsın $\pi_\theta$-$\pi_{\text{SFT}}$- Dondurulmuş bir referans tut.$\pi_{\text{ref}} = \pi_{\text{SFT}}$- Evet .
- Cevapın sonunda ödül$y$- ...

  $r_{\text{total}}(x, y) = R_\phi(x, y) - \beta \cdot \mathrm{KL}(\pi_\theta(\cdot \mid x) \Vert \pi_{\text{ref}}(\cdot \mid x))$

  KL cezası önler .$\pi_\theta$$\pi_{\text{SFT}}$ bu *regularizer* bir bölge, zor güven bölgesi değil. $\beta$Genellikle 0.01-0.05.
- PPO (Denevi 08) bu ödülle çalıştırın. Avantajlar token seviyesindeki yoldaki hesaplanır, ancak RM sadece tam yanıt puanlar.

**Why the KL?**Bu yöntem olmadan, PPO mutlulukla ödül hakerliği stratejileri bulacaktır. RM sadece dağıtım içi tamamlamalarda eğitilmiştir.$\pi_\theta$RM'nin eğitildiği manifold yakınında.

**2026 status:**

- **DPO**(Rafailov 2023): kapalı biçim cebir 2 + 3 aşamasında tercih verileri üzerinde tek denetlenmiş kayıp haline düşer.
- **GRPO**(DeepSeek 20242025): Kritik yerine grup ilişkili bir başlangıç çizgisi olan PPO, insan eğitimi alan bir RM yerine *verifier* (kod çalışması / matematik cevapları eşleşir) tarafından ödüllendirilen. Dönüşüm modeli için baskın. 9 · 12 aşamada kapsamlıdır.
- **Process reward models (PRMs):**RLHF ve GRPO çeşitlerinde gerekçe için kullanılan kısmi çözümler (her bir akıl yürütme adımı).
- **Constitutional AI / RLAIF:**İnsan yerine tercihler oluşturmak için uyumlu bir LLM kullanın.

```figure
reward-model
```

## Yapın

Bu ders, küçük sentetik "sözler" ve " yanıtlar" kullanarak ipler olarak temsil edilir. RM bir çanta simgelerinin temsilinden daha doğrusal bir skorlamacıdır. Gerçek LLM  boru hattının * şekli * önemli değil, ölçek.`code/main.py`- Evet .

### Adım 1: sentetik tercih verileri

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

Gerçek RLHF'de bu insan etiketleri ile değiştirilmiştir.`(prompt, preferred_response, rejected_response)` aynıdır.

### Adım 2: Bradley-Terry ödül modeli

Düzsel puan: `R(x, y) = w · bag(y)`BT çiftlik kayıplarını en aza indirmek için:

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

Birkaç yüz güncelleme sonrasında,`w`İyi kelime simgeleri için olumlu ve kötü kelime simgeleri için negatif ağırlıklar verir.

### Adım 3: RM'nin üstündeki PPO gibi politika

Oyuncak politikamız kelime birikimiyle tek bir simge üretiyor.$\log \pi_\theta(\text{token} \mid \text{prompt})$, KL referans cezası ekle ve kesilmiş PPO yedekini uygula.

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

### Dördüncü adım: KL'yi izle

İz ortalaması$\mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$Her güncelleme.`~5-10`(KL'nin cevap başına nats, tokenlerin toplamı, TRL'lerin birim kayıtları) politika çok uzakta $\pi_{\text{SFT}}$: ya da $\beta$Bu gerçek RLHF'de en iyi teşhis.

### Adım 5: TRL ile üretim tarifi

Oyuncak hattını anladıktan sonra, burada gerçek bir kütüphane kullanıcısının yazdığı aynı döngü var.[TRL](https://huggingface.co/docs/trl)referans uygulanması  `RewardTrainer`2 ve `PPOTrainer`(KL-referanslı bir yapılandırılmış) 3. aşamada.

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

Kütüphane senin için üç şey yapar.`adap_kl_ctrl=True`Adaptif-β programını uyguluyor: Eğer gözlemlenen KL 'yi aşarsa`target_kl`Referans modeli, gelenekle dondurulmuştur  parametreyi yanlışlıkla paylaşmamak gerekir `policy`Ve değer başı, politika ile aynı omurgan üzerinde yaşar (`AutoModelForCausalLMWithValueHead`TRL raporları `policy/kl`ve `value/loss`Ayrı ayrı.

## Tuzaklar

- **Over-optimization / reward hacking.**RM kusurlu .$\pi_\theta$Bu nedenle, bu durumun bir sonraki döneminde, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin veya bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer, diğer$\beta$, RM eğitim verilerini genişletmek.
- **Length hacking.**Yardımcı cevaplar üzerinde eğitilmiş RM'ler genellikle dolaylı olarak uzunluğu ödüllendirir. Politikası cevapları doldurmayı öğrenir. Düzeltme: uzunluk normallaştırılmış ödül veya uzunluk bilinci RM ile RLAIF.
- **Too-small RM.**Küçük bir RM, polis çıkışlarını doğru bir şekilde değerlendirebilir.
- **KL tuning.**Çok düşük β → drift ve ödül hackeri. Çok yüksek β → politika neredeyse değişmez. Standart numara adım başına sabit bir KL'yi hedef alan * adaptif* β.
- **Preference-data noise.**İnsan etiketlerinin %30'u gürültülü veya belirsizdir.
- **Off-policy problems.**İlk dönemden sonra PPO verileri biraz politika dışı.

## Kullan

2026'da RLHF katmanlı:

| Layer | Target | Method |
|-------|--------|--------|
| Instruction following, helpfulness, harmlessness | Alignment | DPO (Phase 10 · 08) preferred over RLHF-PPO. |
| Reasoning correctness (math, code) | Capability | GRPO with verifier reward (Phase 9 · 12). |
| Long-horizon multi-step tasks | Agentic | PPO / GRPO with process reward models over steps. |
| Safety / refusal behavior | Safety | RLHF-PPO with separate safety RM, or Constitutional AI. |
| Best-of-N at inference | Fast alignment | Use RM at decode time; no policy training needed. |
| Reward distillation | Inference compute | Train a small "reward head" on top of a frozen LM. |

RLHF, 2022-2024 yıllarında * * yöntemdi. 2026 yılında, üretim ayarlama boru hattları RM yoğun veya güvenlik kritik adımlar için sadece DPO-birincil, PPO-dur.

## Gönder

- Kaydet .`outputs/skill-rlhf-architect.md`- ...

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

## Egzersizler

1. **Easy.**Bradley-Terry ödül modeli eğit .`code/main.py`500 sentetik tercih çiftinde. 100 çift üzerinde çiftlik doğruluğunu ölçün. %90'dan fazla olmalıdır.
2. **Medium.**Oyuncak PPO-RLHF döngüsünü kullan $\beta \in \lbrace 0.0, 0.1, 1.0 \rbrace$Her biri için, yeniliklerde RM puanı ile KL referans karşılaştırın.
3. **Hard.**Aynı tercih verilerine göre DPO (closed-form preference-likelities loss) uygulayın ve hesaplama kullanımı ve elde edilen son RM puanı ile RLHF-PPO borusuna karşılaştırın.

## Anahtar Terimler

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

## Daha Fazla Okumak

- [Christiano et al. (2017). Deep Reinforcement Learning from Human Preferences](https://arxiv.org/abs/1706.03741)RLHF'yi başlatan gazetede.
- [Ouyang et al. (2022). InstructGPT — Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155)ChatGPT'nin arkasındaki tarif.
- [Stiennon et al. (2020). Learning to summarize with human feedback](https://arxiv.org/abs/2009.01325) daha önceki RLHF'nin özetlenmesi için.
- [Rafailov et al. (2023). Direct Preference Optimization](https://arxiv.org/abs/2305.18290) DPO; 2026'da RLHF sonrası default.
- [Bai et al. (2022). Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073) RLAIF ve kendi kendini eleştirme döngüsü.
- [Anthropic RLHF paper (Bai et al. 2022). Training a Helpful and Harmless Assistant](https://arxiv.org/abs/2204.05862)HH kağıdı.
- [Hugging Face TRL library](https://huggingface.co/docs/trl) üretim `RewardTrainer`ve `PPOTrainer`Adaptif-KL ve değer başı detayları için eğitmen kaynağını okuyun.
- [Hugging Face — Illustrating Reinforcement Learning from Human Feedback](https://huggingface.co/blog/rlhf)Lambert, Castricato, von Werra, Havrilla tarafından  üç aşamalı boru hattının şablonlarla kanonik yürüyüşü.
- [von Werra et al. (2020). TRL: Transformer Reinforcement Learning](https://github.com/huggingface/trl)Kütüphane;`examples/`Llama, Mistral ve Qwen için sonundan sonuna RLHF senaryoları var.
- [Sutton & Barto (2018). Ch. 17.4 — Designing Reward Signals](http://incompleteideas.net/book/RLbook2020.pdf) ödül hipotezi görüşü; ödül hackeri düşünmenin temel ön koşulları.
