# Yönlendirmeyi Uygulama Sinyalı olarak Takip Etmek

> RLHF'nin sonraki eleştirileri bu boru hattına karşı çıkıyor. Optimize basıncının bir vekili nasıl çarpıttığını incelemeden önce, vekili görmeniz gerekir. InstructGPT (Ouyang et al., 2022) referans mimarisini tanımladı: talimat- yanıt çiftlerinde denetimli ince ayarlama, çiftlik tercih sıralamaları üzerinde eğitilmiş bir ödül modeli ve SFT politikasına KL cezası ile ödül modeli karşı PPO. 1.3B InstructGPT, 175B GPT-3'e tercih edildi. Bu tek sonuç 2026 yılında her sınır laboratuvarının hala RLHF şeklinde bir eğitim sonrası boru hattı göndermesinin nedeni.

**Type:** Learn
**Languages:** Python (stdlib, toy three-stage pipeline), TypeScript
**Prerequisites:** Phase 10 · 06 (SFT), Phase 10 · 07 (RLHF), Phase 10 · 08 (DPO)
**Time:** ~45 minutes

## Öğrenme Hedefleri

- InstructGPT borusunun üç aşamasını ve her birinde kullanılan kayıpları belirtin.
- 1.3B talimat uyarlanmış bir modelin insan tercih değerlendirmesinde çiğ 175B GPT-3'yi neden yendiğini açıklayın.
- 3. aşamada KL cezasının neyden koruduğunu ve neden kaldırılması mod aramak davranışına neden düştüğünü açıklayın.
- Düzeltme vergisi ve PPO-ptx azaltma Ouyang et al.

## Sorun

Önceden eğitimli dil modelleri metni tamamlar. Sorulara cevap vermezler. GPT-3'e "listayı tersine çeviren bir Python fonksiyonu yaz" diye sorarsanız, genellikle bir başka istek alırsınız, çünkü eğitim dağıtımının çoğu daha fazla web metni ile devam eden web metni.

Bu durumun çözülmesi için kullanılan bir vekil, insan tercihidir. İki tamamlama bir değerlendiriciye gidiyor; değerlendirici daha iyi birini seçer; ödül modeli değerlendiriciyi öğrenir.

## Anlaşım

### 1. aşama: denetim altında ince ayarlama (SFT)

İyi niyetli bir insan tarafından yazılacağı yanıtların yanıtlandığı çabuk cevap çiftlerini toplayın. Ouyang et al. etiketçilerden ve OpenAI API'den 13k çağrıları kullandı. Standart çapraz entropi kaybı ile bu verilere dayalı temel modelde ince ayarlama yapın.

SFT'nin size verdiği: model şimdi soruları devam etmek yerine cevaplar.

### İkinci aşama: Ödül modeli (RM)

SFT modelinden K tamamlamalarını örnekleyin. Bir etiketlemeci onları sıralar.`y_w`- Hayır .`y_l`- ...

```math
L_{\text{RM}} = -\log \sigma\big(r(x, y_w) - r(x, y_l)\big)
```

Bu Bradley-Terry çiftlik tercih kaybı. RM genellikle SFT modelinden başlangıç yapılır ve LM başı skalar başıyla değiştirilir.

Ödül modelleri küçüktür: 175B InstructGPT için 6B yeterliydi.

### 3. aşama: KL cezası ile PPO

Hedef tanımlanın:

```math
J(\pi) = \mathbb{E}_{x \sim D,\, y \sim \pi(\cdot \mid x)} \big[ r(x, y) \big] - \beta \, \mathrm{KL}\big(\pi(\cdot \mid x) \,\|\, \pi_{\text{SFT}}(\cdot \mid x)\big)
```

PPO ile maksimum artırın.`pi`Bu nedenle, bu sistemin en iyi yönleri, SFT politikasından uzaklaşmaktan uzaklaşmaktır.

KL katılamı `beta`Bu, RLHF'nin en önemli hiperparametresidir. Çok düşük: ödül hackeri. Çok yüksek: SFT'ye karşı hiçbir gelişme yok.

### Düzeltme vergisi

RLHF'den sonra, model insan tarafından tercih edilir, ancak standart referans değerlerinde (SQuAD, HellaSwag, DROP) geri döner. Ouyang ve diğerleri buna uyum vergisi derler ve bunu PPO-ptx ile düzeltirler: RL hedefine önceden eğitim gradiyentlerini karıştırın, böylece model, hiçbir zaman ödüllendirilmediği aşağıdaki görevleri nasıl yapacağını unutmaz.

```math
J_{\text{ptx}}(\pi) = J(\pi) + \gamma \, \mathbb{E}_{x \sim D_{\text{pretrain}}} \big[ \log \pi(x) \big]
```

PPO-ptx standart haline geldi. Anthropic, DeepMind ve Meta hepsi bazı çeşitleri kullanıyor.

### Sonuç

1.3B InstructGPT (SFT + RM + PPO-ptx) etiketleyiciler tarafından 175B taban GPT-3'e göre yaklaşık %70 tercih edilir.

1. Düzeltme, kapasiteye göre farklı bir eksendir. 175B modeli daha fazla kapasiteye sahipti; 1.3B modeli daha fazla düzeltme sahipti; etiketçiler düzeltmeyi tercih etti.
2. Ürün modelinin kapasiteden kurduğu zemin, bir temel modelin görmediği gerçekleri bilmesine izin veremezsin.

### Bu neden 18 aşama için bir referans noktası?

Sonraki derslerdeki her eleştiris  ödül hackeri (Desin 2), DPO (Desin 3), sikofans (Desin 4), CAI (Desin 5), uyku ajanları (Desin 7), uyum sahteliği (Desin 9)  bu boru hattının bir kısmına karşı tartışmaktadır. Ödül hack saldırıları 2. aşama. DPO 2. ve 3. aşamaları çöküyor. CAI insan etiketleyicisini değiştirir. Sykophancy etiketlemeci taraflı bir sinyal olduğunu gösterir. Düzeltme sahteliği, politika'nın 3. aşamayı tamamen yönlendirebileceğini göstermektedir. Bu eleştirileri önce kafanın içine sokmadan takip edemezsin.

```figure
al-instruct-pipeline
```

## Kullan

`code/main.py`Oyuncak tercih verileri üzerinde üç aşamayı simüle eder. Temel "politik" eylemlere karşı tarafsız bir maden. STAGE 1 SFT, 200 çağrıda etiketleme işlemini taklit eder. İkinci aşamada, 500 çiftlik sıralamadan bir Bradley-Terry ödül modeli uygulanıyor. 3. aşamada, SFT politikasına KL cezası ile basitleştirilmiş bir PPO güncelleme yapılır. Ödül artışını, KL farklılıklarının artışını ve politika sürümünü izleyebilirsiniz ve KL terimini kapatarak 50 güncelleme adımında ödül hackeri görünmesini görebilirsiniz.

Neye bakılır:

- Ödül yolculuğu `beta = 0.1`vs `beta = 0.0`- Evet .
- $\mathrm{KL}(\pi \Vert \pi_{\text{SFT}})$Eğitim adımları.
- Son eylem dağılımı etiketleme tercihine göre.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-instructgpt-explainer.md`RLHF boru hattı açıklaması veya kağıt özetini göz önüne alarak, üç aşamaldan hangisinin değiştirildiğini, her aşamada hangi kaybın kullanıldığını ve KL cezası veya eşdeğer düzenleyici olup olmadığını belirler.

## Egzersizler

1. Çık .`code/main.py`- Yapılandır .`beta = 0.0`200 PPO adımından sonra eylem dağılımını rapor edin.

2. Ödül modelini değiştirerek, eylem B için +0.5 önyargısı (sümüle edilen ödül hatası) oluşturun.`beta = 0.1`KL cezası politikaların önyargıyı kullanmasını engeller mi?`beta`sömürü görülebilir mi?

3. Ouyang et al. (arXiv:2203.02155) Resim 1. Etiketçi-Öncelik eğriyi 1, 5, 20, 100 adım boyunca PPO çalıştırarak ve SFT modeli ile karşılaştırarak öncelik ölçerek yeniden üretin.

4. Gazete'nin 4.3 Bölümü, 1.3B InstructGPT'nin 175B GPT-3'yi yaklaşık %70'i üzerinde geçirdiğini bildirir.

5. Aynı tercih verileri üzerine PPO kaybını DPO (Fase 10 · 08) ile değiştirin. Nihai politika sürekliliğini (KL ile SFT) ve nihai ödülü karşılaştırın. Hangi yöntem eşleşen ödülde daha fazla sürekliliği gösterir?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| SFT | "instruction tuning" | Stage 1: cross-entropy fine-tune on prompt-response pairs |
| Reward model | "the RM" | Scalar regressor over (prompt, response) trained with Bradley-Terry on pairwise labels |
| Bradley-Terry | "pairwise preference loss" | $-\log \sigma(r_w - r_l)$; reduces pairwise ranking to binary classification |
| KL penalty | "the regularizer" | `beta * KL(pi \|\| pi_SFT)` — keeps the RL policy near the SFT anchor |
| PPO-ptx | "PPO with pretraining mix" | Adds a fraction of pre-training log-likelihood to the PPO objective to offset the alignment tax |
| Alignment tax | "the RLHF regression" | Post-RLHF drop on standard benchmarks that RLHF did not target |
| Labeler preference | "the ground truth" | Sample of human rankings; the RM is a statistical proxy for this, not for "human values" |

## Daha Fazla Okumak

- [Ouyang et al. — Training language models to follow instructions with human feedback (arXiv:2203.02155)](https://arxiv.org/abs/2203.02155) ardından gelen her RLHF boru hattının temeli olan InstructGPT kağıdı
- [Stiennon et al. — Learning to summarize from human feedback (arXiv:2009.01325)](https://arxiv.org/abs/2009.01325) RLHF-for-summarization'ın öncesi
- [Christiano et al. — Deep reinforcement learning from human preferences (arXiv:1706.03741)](https://arxiv.org/abs/1706.03741) orijinal tercih tabanlı RL formülasyonu
- [Bai et al. — Training a Helpful and Harmless Assistant with RLHF (arXiv:2204.05862)](https://arxiv.org/abs/2204.05862) Anthropic'in InstructGPT borusunun HH uzantısı
