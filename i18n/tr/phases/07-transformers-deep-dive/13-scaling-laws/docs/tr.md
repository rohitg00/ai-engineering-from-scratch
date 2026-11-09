# Ölçekleme Kanunları

> Kaplan 2020 makalesinde: daha büyük model, daha düşük kayıp. 2022 Hoffmann makalesinde: az eğitim aldığınızı söyledi. Hesaplama iki kova  parametreler ve jetonlara ayrılır  ve bölünme açık değildir.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## Sorun

Eğitim hesaplamalarının C FLOP'ları olduğunda ve en iyi modeli istediğinde iki düğmeye karşı karşıya kalırsın:

1. **How many parameters (N)?**Daha büyük model, daha büyük kapasite.
2. **How many training tokens (D)?**Daha fazla veri, daha iyi kapasite kullanımı.

FLOP'lar yaklaşık olarak `6 × N × D`N'yi yukarı ve aşağıya, ya da D'yi yukarı ve aşağıya itirebilirsin. Hangisi daha iyi?

2022'den önce, cevap "N zor it" idi. GPT-3 (2020) 175B parametreleri yaklaşık 300B jetonlarda eğitilmişti.

Hoffmann et al. (2022), Chinchilla adlı küçük bir model ailesini eğitmekle ilgili farklı bir şey buldu: Optimal oran **20 tokens per parameter**GPT-3 10 kat daha az eğitimliydi. Chinchilla (70B param, 1.4T token) her referans değerinde GPT-3 (175B, 300B token) 2.5 kat daha az sonuç maliyetinde yendi.

2026'da Chinchilla'nın dünyası  bir önemli dönüşü ile. Llama 3 8B 15 trilyon jeton üzerinde eğitildi, bu da bir parametreden 1.875 jeton oranı. Ninety-four times past Chinchilla-optimal.

## Anlaşım

![Chinchilla curves: loss vs compute at various N/D ratios](../assets/scaling-laws.svg)

### Hoffmann Yasası

Chinchilla gazetesinden kayıp şöyle:

```math
L(N, D) = \frac{A}{N^\alpha} + \frac{B}{D^\beta} + E
```

- $N$= parametre (tökeltilmemiş).
- $D$= eğitim simgeler.
- $\alpha \approx 0.34$- Evet .$\beta \approx 0.28$(kaykayla simetrik).
- $E \approx 1.69$, azaltabilir kayıp tavanı.
- $A \approx 406$- Evet .$B \approx 411$- Evet .

İki terim birbirine karşı ticaret yaparken ölçerken.$N$sabit hesaplama ($C = 6ND$Bu da bir çözüm.$\alpha$ve $\beta$yukarıda, gösterge yaklaşık 0.45'te çıkar $N$ve 0.55 için$D$, böylece tam en iyi oran bütçe ile yavaş yavaş hareket eder .`code/main.py`Bu sayede, bir sabit oranın empirik kuralı ortaya çıkar.$D = 20N$İçeride$C = 6ND$Ve parmak kuralı şöyle:

```math
\begin{aligned}
N_{\text{opt}} &\approx 0.22 \times (C/6)^{0.5} \\
D_{\text{opt}} &\approx 4.5 \times (C/6)^{0.5} \\
D_{\text{opt}} / N_{\text{opt}} &\approx 20
\end{aligned}
```

Hesaplama-optimal: Parametre başına 20 token.

### Ne gerek var ki fazla eğitim görsün.

Chinchilla-optimal, her antrenman için antrenman kaybını en aza indirger.

Ayda bir trilyon tokeni hizmet veren bir chatbot için, sonuç toplam maliyet üzerinde egemenlik yapmaktadır. Llama'nın yaklaşımı: daha küçük, daha uzun tren. 8B'nin 15T tokenleri sonucun optimize edilmesiyle derin bir şekilde optimize edilmiştir:

- İsteğe bağlı GPU'lara uyar.
- Gecikme 70B Chinchilla-optimal bir bölümü.
- Kalitesizlik çoğu görev için yeterince yakın.

DeepMind'in 2024 makalesinde ("Üzer eğitim yeni en iyi şeydir") bunu resmileştirdi. İhtiyaçlı iş yükleri için, doğru oran, servis hacmine bağlı olarak parametre başına 100500 tokene yakındır.

### Çıkış vs. Düzgünlük

İddia: belirli yetenekler (aritmetik, çok adımlı akıl yürütme, düşünce zinciri takip) aniden bir ölçekte "gelen"ler.

Schaeffer et al. (2023) bunun bir ölçüm eseri olduğunu savundu: ortaya çıkan ölçümler, altındaki logitlerde düzgün bir gelişmeyi gizleyen kesintisiz puanlama (tam eşleşme, eşiğinde doğruluk) kullanır.

2026'da konsensüs: Sürekli kayıplar üzerinden tahminler güvenilirdir. Benchmark sıçramaları genellikle puanlama sanatlarıdır. Sürekli ölçümlere göre bütçeleri planlayın.

### 2026'daki resim.

Ölçekleme yasaları hala geçerlidir, ama:

| Factor | Changed how |
|--------|-------------|
| Data quality | Curating "good" tokens (Phi-style) shifts curves by >2× effective compute |
| MoE | Total params decouple from active FLOPs; scaling laws per-active-FLOP |
| Post-training | Some capabilities (instruction following, code) shift with SFT+RLHF more than pretraining |
| Multimodality | Image + text tokens scale together; separate curves per modality |
| Synthetic data | Models generate training data; effective compute can compound |

Muon optimizer (Kimi Moonlight, 2024) eşleşen verilerde AdamW'ye göre ~2x etkili hesaplama kazancı gösterdi. 2026 eğitim sürümlerinin bazıları varsayılan olarak Muon kullanır.

```figure
scaling-laws
```

## Yapın

Bakın .`code/main.py`Chinchilla kaybı denklemini uygulayarak hesaplama-optimal için çözüyoruz .$(N, D)$Her bir hesaplama bütçesinin birinde.

### Adım 1: Chinchilla kaybı

```python
def chinchilla_loss(N, D, A=406.4, B=410.7, alpha=0.34, beta=0.28, E=1.69):
    return A / N ** alpha + B / D ** beta + E
```

Çeviri$L$Bir kontur olarak $(N, D)$sabit olarak $C = 6ND$En azını bul.

### Adım 2: Bilgisayar-optimal sınır

Bilgisayar bütçeleri için `1e17`- ...`1e25`FLOPs, bul $(N, D)$$6ND = C$- Rakipleri kontrol edin .$D/N \approx 20$- Evet .

### Adım 3: Üstü eğitim maliyeti

10× daha küçük bir model eğitimi için ödeyen ekstra kaybı hesaplayın (1/10'ün en iyi N, 10×'nın en iyi D).

### 4. adım: Gerçek modellerle karşılaştır

Bilinenleri gör .`(N, D)`GPT-3, Chinchilla, Llama 3 8B, DeepSeek-V3 (aktif paramlar) için çiftler ve tahmin edilen kayıp ile bildirilen kayıpları karşılaştırın.

## Kullan

Kendiniz sınır modeli eğitmek için yeterli değilsiniz ama ölçekleme yasaları size şunu söylüyor:

1. **Whether your fine-tune has enough data.**Görev-özel verileriniz temel modelin parametre başına 20 tokenden aşağıysa, bir kayıp zemininde doymuşluğa sahip olmayı bekleyin.
2. **Whether to pick a bigger base model.**Bütün bütçenizi sonuç çıkarmaya harcıyorsanız, daha küçük, daha uzun süre eğitimli bir modeli tercih edin.
3. **Where the returns diminish.**1000× Chinchilla-optimal'ın ötesinde, günlük kaybı değişiklikleri gürültü haline gelir.

**The research trajectory in 2026:**

- **Data-constrained regime.**Web'de sınırlı sayıda yüksek kaliteli token bulunmaktadır (filtreden sonra yaklaşık 5 10 trilyon İngilizce). Sınır öncesi eğitim bu tavanın yaklaştığını gösteriyor. Sintez veriler, çok dilli, multimodal ve RLHF ölçekli ince ayarlamalar bir sonraki kaldıraçlardır.
- **Compute-multiplier tricks.**Muon optimizer, MoE, daha iyi veri kurasyonu  her biri asimptote değil mutlak sabitleri değiştirir.
- **Scaling laws for RL.**Açık soru. İlk kanıtlar RL örneklerinde güç yasasını gösteriyor ama eğitim öncesi olanlardan çok farklı bir gösterge ile.

## Gönder

Bakın .`outputs/skill-training-budget-estimator.md`- Yetenek seçimi .`(N, D, hours, GPU)`Yeni bir eğitim süreci için hesaplama bütçesi, dağıtım kısıtlamaları ve hedef kaybı göz önüne alındı.

## Egzersizler

1. **Easy.**Çık .`code/main.py`- Çincilla-optimal basın .$(N, D)$Bilgisayar bütçeleri için `1e20`- Evet .`1e22`- Evet .`1e24`Gerçek model masasına kıyasla.
2. **Medium.**Hoffmann'ın hesaplama işlev kaybı eğrisini uygulayın.`log10(C)`Bilgisayar-optimal sınır için.$>10^{28}$FLOPs, önümüzdeki 0,1'lik çapraz entropi azaltımı için.
3. **Hard.**Aynı veri kümesi üzerinde eğitilen 5 küçük modelde (100K'den 10M'ye kadar) kendi ölçekleme yasasını uygulayın.$\alpha$ve $E$- Eksponentlerin yayınlananlarla ne kadar uyumlu?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Parameters (N) | "Model size" | Non-embedding weight count; determines capacity. |
| Tokens (D) | "Training data" | Number of training tokens seen; determines how well the parameters get used. |
| Compute (C) | "FLOPs spent" | Approximately `6 × N × D` for a standard transformer. |
| Chinchilla-optimal | "D/N ≈ 20" | Ratio that minimizes loss per FLOP of pretraining. |
| Over-training | "Past Chinchilla" | Spend extra training FLOPs to save inference FLOPs; D/N >> 20. |
| Irreducible loss | "The floor" | The $E$ term in the scaling law; the entropy of the data itself. |
| Emergent capability | "Sudden jumps at scale" | Often a scorer artifact; continuous loss is smooth. |
| Effective compute | "Training-efficiency multiplier" | Better data / optimizer / architecture multiplies how far a FLOP goes. |

## Daha Fazla Okumak

- [Kaplan et al. (2020). Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361) ilk ölçekleme hukuku makalesi; yetersiz eğitimli.
- [Hoffmann et al. (2022). Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556)- Chinchilla.
- [Schaeffer et al. (2023). Are Emergent Abilities of Large Language Models a Mirage?](https://arxiv.org/abs/2304.15004) ölçüm eseri olarak ortaya çıkış.
- [Sardana, Frankle (2024). Beyond Chinchilla-Optimal: Accounting for Inference in Language Model Scaling Laws](https://arxiv.org/abs/2401.00448) Llama'nın aşırı eğitimi neden iş yükü için doğru.
- [Jordan et al. (2024). Muon: An optimizer for hidden layers in neural networks](https://kellerjordan.github.io/posts/muon/)2× hesaplama çarpıcısı.
