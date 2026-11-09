# LLM'ler için Farklı Gizlilik

> DP-SGD standart  gürültü enjeksiyonu gradient güncellemeleri olarak kalır. Hesaplama, bellek ve kullanım alanındaki genel maliyetler önemli; parametre-efikas DP ince ayarlama (LoRA + DP-SGD) ortak 2025 yapılandırması (ACM 2025). İki kanıt kümesi gerginlik içinde: Kanarlı üyelik sonucu (Duan et al., 2024) dil modellerine karşı sınırlı başarı raporları; eğitim verileri çıkarma (Carlini et al., 2021; Nasr et al., 2025) önemli kelimel hatıralama geri kazanır. Karar (arXiv:2503.06808, Mart 2025): fark ölçülmüş olan  yerleştirilen kanaryalarla "en çıkarılabilir" veriler arasında. Yeni kanary tasarımları, gölge modelleri olmadan kayıp tabanlı MIA'yı mümkün kılar ve gerçekli DP garantileri ile gerçek verilere dayanan bir LLM'nin ilk önemsiz DP denetimini sağlar. Alternatifler: PMixED (arXiv:2403.15638)  sonraki token dağıtımları konusunda uzmanların karışımı yoluyla çıkarma zamanında özel tahmin; DP sentetik veri üretimi (Google Araştırma 2024). Yeni ortaya çıkan saldırı: LLM Feedback  güven puanı sızdırısı yoluyla Farklı Gizlilik Değişimi.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, DP-SGD noise-injection and ε-δ accountant demonstration)
**Prerequisites:** Phase 01 · 09 (information theory), Phase 10 · 01 (large-model training)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- (epsilon, delta) -farklı gizlilik tanımlayın ve DP-SGD tarifini belirtin.
- 2024-2025 gerginliğini açıklayın: Kanarya MIA vs. Eğitim- veri çıkarımı farklı resimler verir.
- PMixED'i ve neden sonucu çıkarma zamanı özel tahmininin DP eğitimi için bir alternatif olduğunu açıklayın.
- LLM Feedback saldırısı yoluyla Farklı Gizlilik Değişimi'ni açıklayın.

## Sorun

LLM'ler hafıza. Carlini et al. 2021 üretim dil modellerinin talep üzerine sözde eğitim metnini yeniden ürettiğini gösterdi. DP resmi savunmadır: eğitim, böylece çıkışın herhangi bir eğitim örneğine karşı hassas olmadığını kanıtlar. 2024-2025 kanıtları DP-SGD'nin gerekli olduğunu gösterir, ancak dağıtılan ε değerleri tehdit modeline eşleşmeyebilir.

## Anlaşım

### (ε, δ) - Farklı gizlilik

Bir rastgele algoritma .$M$- Evet .$(\varepsilon, \delta)$-DP eğer bir örnek ve herhangi bir olayda farklı olan herhangi iki veri kümesi için $S$- ...

```math
P(M(D) \in S) \le e^{\varepsilon} \cdot P(M(D') \in S) + \delta.
```

Anlatma: çıkış dağılımı, herhangi bir bireyin katkılarının, δ olasılığı hariç, güvenilir bir şekilde çıkarılamayacağı kadar yakın ( ε ile parametrelidir).

### DP-SGD

Abadi et al. 2016. Standart tarif:
1. Küçük bir partiye örnek ver.
2. Örnek başına gradient hesaplayın.
3. Örnek başına her bir gradient C e bir eşiğine çıkar.
4. Kısaltılan gradientleri toplamla , Gaussian gürültüsünü std ile ekle .$\sigma \cdot C$- Evet .
5. Parametreyi güncellemek için gürültülü miktarı kullanın.

Gizlilik maliyetini bir muhasebeci (Moments Muhasebeci, Rényi DP muhasebeci) takip eder. LLM literatüründe bildirilen ε değerleri tehdit modeli, veri hassasiyeti ve kullanım hedefi ile çok farklıdır; evrensel olarak "güvenli" varsayılan ε yoktur. Yayınlanan örnekler bazı LLM eğitim ayarlarında yaklaşık ε ≈ 110'u kapsar, ancak bunlar örnekler  önerilmeyen varsayımlardır. Düşük ε genellikle daha fazla gürültü gerektirir ve kullanım kaybını artırabilir.

### LoRA + DP-SGD

Sınır modelinin tam DP-SGD yasaklayıcıdır. LoRA (Hu et al. 2022) gradient güncellemelerini küçük bir adaptöre sınırlıyor ve örneğe göre gradient depolamasını azaltıyor. LoRA + DP-SGD ortak 2025 yapılandırmasıdır. DP garantileri adaptöre uygulanır; temel model sabit tutulur.

### 2024-2025 yıllarındaki gerginlik

İki kanıt:

- **Canary MIA (Duan et al. 2024).**Eğitim verilerine benzersiz kanaryalar ekle, üyelik-sırh saldırganının onları tanımlayabileceklerini ölç. Dil modellerinde sınırlı başarı raporları. MIA zor olduğunu önerir.
- **Training-data extraction (Carlini 2021, Nasr et al. 2025).**Model'i bir önbellekle gösterin; eğitimden sözlü metni geri aldığını ölçün.

Mart 2025 çözümü (arXiv:2503.06808): iki ölçüm farklı şeyler. MIA, eklenen kanaryalarda "e örneği D'de mi?" sorusunu sorar. Çöpleme "D'den neyi geri alabilirim?" sorusunu sorar. "En çıkarılabilir" örnek gizlilik için önemli olan şeydir; kanaryalar bunu düşük raporlar çünkü çıkarılabilir olmak için optimize edilmemişlerdir.

Yeni kanarya tasarımları, gölge modelleri olmayan kayıp tabanlı MIA, gerçekli bir DP garanti ile gerçek veriler üzerine bir LLM'nin ilk önemsiz DP denetimi.

### DP eğitimi alternatifleri

- **PMixED (arXiv:2403.15638).**Sonraki belirti dağıtımları konusunda uzmanların karışımı; her uzman eğitim verilerinin bir parçalarını görür; toplama DP için gürültü ekler. DP eğitimi tamamen kaçınılmaktadır.
- **DP synthetic data generation (Google Research 2024).**LoRA-fin-tune DP-SGD, örnek sentetik veriler, sentetik verilere bir aşağıdaki sınıflandırıcı eğit.

Her ikisi de farklı bir tehdit modeli masrafıyla tam DP eğitimi yararlı maliyetini önler.

### LLM Önerileri üzerinden Farklı Gizlilik Değişimi

2025 saldırısı. DP eğitimi almış bir modelin güven puanlarını bireyleri yeniden tanımlamak için bir oracle olarak kullanın.

Savunma: güvenliği ortaya çıkarmayın veya ortaya çıkmadan önce onları kısaltmayın. Bu (ε, δ) -DP eğitiminin ötesinde bir ek gerekliliktir.

### Bu 18 fazaya uygun.

Ders 20-21 tarafsızlık/eşitlik. Ders 22 gizlilik. Ders 23 su işaretleme yoluyla kaynak. Ders 27 düzenleyici veri kaynak katmanı kapsar.

```figure
an-dp-clip-noise
```

## Kullan

`code/main.py`Oyuncak ikili sınıflandırma verileri üzerinde DP-SGD simülasyonu yapar. Ses çarpıcısı σ ve kesme normı C'yi tarayabilir ve (ε, δ) bütçesini ve doğruluk maliyetini takip edebilir. "Kanary saldırısı" benzersiz bir eğitim örneğini ekler ve bir günlük kaybı testi DP'den önce ve sonra tespit edebilecek olup olmadığını ölçer.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-dp-audit.md`. Dil modelinin kullanılması üzerine DP iddiası göz önüne alındığında, (ε, δ) değerleri, kullanılan muhasebeci, MIA değerlendirme protokolü ve güven ve maruz kalma vektörlerinin değerlendirilmiş olup olmadığını denetler.

## Egzersizler

1. Çık .`code/main.py`- Arama .$\sigma \in \lbrace 0.5, 1.0, 2.0 \rbrace$(ε, δ) doğruluk oranını rapor edin.

2. Kanarya ekleme ve günlük kaybı testi uygulanır.$\sigma = 1.0$- Evet .

3. Nasr et al. 2025'te eğitim verileri çıkarma üzerine okuyun. Neden çıkarma başarısı orta ε altında çökmez?

4. PMixED (arXiv:2403.15638) kullanarak, tümüyle sonuçlama zamanında çalışacak bir dağıtım tasarlayın.

5. LLM Feedback saldırısı ile DP Değişimi çizin. Güven puanı sızmasını sınırlayan ve dağıtım maliyetini tahmin eden bir karşı önlem tasarlayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| DP | "(ε, δ)-differential privacy" | Formal privacy: output distribution close under neighbouring-dataset change |
| DP-SGD | "noise-injected SGD" | Gradient clipping + Gaussian noise addition; standard DP training |
| LoRA + DP-SGD | "efficient private fine-tune" | DP-SGD on low-rank adapters; standard 2025 configuration |
| MIA | "membership inference" | Attack that determines whether an example was in training data |
| Canary | "inserted watermark example" | Unique training example used to measure DP leakage |
| PMixED | "private inference mixture" | Inference-time DP via mixture-of-experts on next-token distributions |
| DP Reversal | "confidence leakage attack" | Attack that uses a model's confidence as an oracle for re-identification |

## Daha Fazla Okumak

- [Abadi et al. — DP-SGD (arXiv:1607.00133)](https://arxiv.org/abs/1607.00133) Standart DP eğitim algoritması
- [Carlini et al. — Extracting Training Data (arXiv:2012.07805)](https://arxiv.org/abs/2012.07805) Kanonik çıkarma kağıdı
- [Duan et al. — Canary MIA on LLMs (arXiv:2402.07841, 2024)](https://arxiv.org/abs/2402.07841) Sıkı başarısızlıklı MIA
- [Kowalczyk et al. — Auditing DP for LLMs (arXiv:2503.06808, March 2025)](https://arxiv.org/abs/2503.06808) Gerginliğin çözümü
- [PMixED (arXiv:2403.15638)](https://arxiv.org/abs/2403.15638) İhtiyaçlı zaman özel tahmin
