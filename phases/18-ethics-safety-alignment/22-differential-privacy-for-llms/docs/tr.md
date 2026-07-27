# Yüksek Lisans'lar için Farklı Gizlilik

> DP-SGD standart olmaya devam ediyor — gürültü enjeksiyonlu gradient güncellemeleri resmi (epsilon, delta) garantiler sağlıyor. Bilgi işlem, bellek ve fayda açısından ek yük oldukça fazladır; parametre açısından verimli DP fine-tuning (LoRA + DP-SGD), ortak 2025 yapılandırmasıdır (ACM 2025). Birbiriyle çelişen iki kanıt kümesi: kanarya temelli üyelik inference (Duan ve diğerleri, 2024), dil modellerine karşı sınırlı başarı bildirmektedir; eğitim-veri çıkarma (Carlini ve diğerleri, 2021; Nasr ve diğerleri, 2025), önemli ölçüde birebir ezberlemeyi kurtarır. Çözüm (arXiv:2503.06808, Mart 2025): boşluk, ölçülen verilerdedir; eklenen kanaryalar ve "en çok çıkarılabilen" veriler. Yeni kanarya tasarımları, gölge modelleri olmadan kayıp bazlı MIA'yı mümkün kılar ve gerçekçi DP garantileriyle gerçek veriler üzerinde eğitilmiş bir LLM'nin önemsiz olmayan ilk DP denetimini sağlar. Alternatifler: PMixED (arXiv:2403.15638) — sonraki-token dağıtımlarındaki uzmanların karışımı aracılığıyla inference zamanında özel tahmin; DP sentetik veri üretimi (Google Araştırması 2024). Ortaya çıkan saldırı: Yüksek Lisans Geri Bildirimi aracılığıyla Diferansiyel Gizliliğin Tersine Dönmesi — güven puanı sızıntısı.

**Tür:** Yapım
**Diller:** Python (stdlib, DP-SGD gürültü enjeksiyonu ve ε-δ muhasebeci gösterimi)
**Önkoşullar:** Aşama 01 · 09 (bilgi teorisi), Aşama 10 · 01 (büyük model eğitimi)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- (epsilon, delta)-diferansiyel gizliliği tanımlayın ve DP-SGD tarifini belirtin.
- 2024-2025 gerilimini açıklayın: Kanarya MIA'ya karşı eğitim-veri çıkarma farklı resimler veriyor.
- PMixED'i ve neden inference zamanlı özel tahminin DP eğitimine bir alternatif olduğunu açıklayın.
- LLM Geribildirim saldırısı yoluyla Diferansiyel Gizliliğin Tersine Dönmesini açıklayın.

## Sorun

Yüksek Lisans'lar ezberler. Carlini ve ark. 2021, üretim dili modellerinin talep üzerine eğitim metnini kelimesi kelimesine yeniden ürettiğini gösterdi. DP resmi savunmadır: çıktının herhangi bir eğitim örneğine duyarsız olacağı şekilde eğitin. 2024-2025 kanıtları DP-SGD'nin gerekli olduğunu ancak konuşlandırılan ε değerlerinin tehdit modeliyle eşleşmeyebileceğini gösteriyor.

## Konsept

### (ε, δ)-diferansiyel gizlilik

Rasgeleleştirilmiş bir M algoritması, eğer bir örnekte farklı olan herhangi iki dataset ve herhangi bir S olayı için (ε, δ)-DP'dir:
P(M(D), S'de) <= e^ε * P(M(D'), S'de) + δ.

Yorum: Çıktı dağılımı yeterince yakındır (ε ile parametrelendirilmiştir), herhangi bir bireyin katkısı, δ olasılığı hariç, güvenilir bir şekilde çıkarsanamaz.

### DP-SGD

Abadi ve ark. 2016. Standart tarif:
1. Bir mini partiden numune alın.
2. Örnek başına gradients'yi hesaplayın.
3. Her örnek için gradient'yi bir C eşiğine kırpın.
4. Kırpılan gradient'ları toplayın ve std σ * C ile Gauss gürültüsünü ekleyin.
5. Parametreleri güncellemek için gürültülü toplamı kullanın.

Gizlilik maliyeti bir muhasebeci (Moments Muhasebecisi, Rényi DP muhasebecisi) tarafından takip edilir. LLM literatüründe bildirilen ε değerleri, tehdit modeline, veri duyarlılığına ve fayda hedefine göre büyük ölçüde değişiklik gösterir; evrensel olarak "güvenli" bir varsayılan ε yoktur. Yayınlanan örnekler bazı LLM eğitim ortamlarında kabaca ε ≈ 1-10 aralığını kapsar, ancak bunlar açıklayıcıdır; önerilen varsayılanlar değildir. Daha düşük ε genellikle daha fazla gürültü gerektirir ve fayda kaybını artırabilir.

### LoRA + DP-SGD

Sınır modelinin tam DP-SGD'si engelleyicidir. LoRA (Hu ve diğerleri 2022), gradient güncellemelerini küçük bir adaptörle sınırlandırarak örnek başına gradient depolama alanını azaltır. LoRA + DP-SGD, ortak 2025 yapılandırmasıdır. DP garantileri adaptör için geçerlidir; temel model sabit tutulur.

### 2024-2025 gerilimi

İki satırlık kanıt:

- **Canary MIA (Duan ve ark. 2024).** Eğitim verilerine benzersiz kanaryalar ekleyin, üyelik-inference saldırganının bunları tanımlayıp tanımlayamayacağını ölçün. Dil modellerinde sınırlı başarı rapor eder. MIA'nın zor olduğunu öne sürüyor.
- **Eğitim verilerinin çıkarılması (Carlini 2021, Nasr ve ark. 2025).** Prompt öneki olan model; eğitimden birebir metni kurtarıp kurtarmadığını ölçün. Önemli derecede ezberleme olduğunu bildirir. MIA'nın ilgili anlamda kolay olduğunu öne sürüyor.

Mart 2025 kararı (arXiv:2503.06808): ikisi farklı şeyleri ölçer. MIA "D'deki örnek e mi?" diye sorar. takılı kanaryalarda. Çıkarma "D'den ne kurtarabilirim?" diye sorar. "En çıkarılabilir" örnek gizlilik açısından önemli olandır; kanaryalar, çıkarılabilecek şekilde optimize edilmedikleri için bunu eksik rapor ediyor.

Yeni kanarya tasarımları. Gölge modelleri olmayan kayıp bazlı MIA. Gerçekçi DP garantileri ile gerçek veriler üzerinde bir Yüksek Lisans'ın ilk basit olmayan DP denetimi.

### DP eğitimine alternatifler

- **PMixED (arXiv:2403.15638).** inference zamanında özel tahmin. Sonraki-token dağıtımlarında uzmanlardan oluşan bir karışım; her uzman bir eğitim verisi parçası görür; toplama DP için gürültü ekler. DP eğitimini tamamen önler.
- **DP sentetik veri oluşturma (Google Araştırma 2024).** DP-SGD ile LoRA'ya ince ayar yapın, sentetik verileri örnekleyin, sentetik veriler üzerinde bir aşağı akış sınıflandırıcıyı eğitin.

Her ikisi de, farklı bir tehdit modeli pahasına tam DP eğitiminin kullanım maliyetinden kaçınıyor.

### Yüksek Lisans Geri Bildirimi aracılığıyla Farklı Gizliliğin Geri Alınması

2025 saldırısı ortaya çıkıyor. Bireyleri yeniden tanımlamak için DP tarafından eğitilmiş bir modelin güven puanlarını bir kehanet olarak kullanın. Çıktılar sızmasa bile güven dağılımları sızıntı yapabilir.

Savunma: Gizli bilgileri ifşa etmeyin veya ifşa etmeden önce bunları kesmeyin/nicelleştirmeyin. Bu (ε, δ)-DP eğitiminin ötesinde ek bir gerekliliktir.

### Bunun 18. Aşamada yeri nedir

20-21. dersler önyargı/adalettir. Ders 22 mahremiyettir. Ders 23, filigranlama yoluyla kaynak sağlamadır. Ders 27, düzenleyici veri kaynağı katmanını kapsar.

## Use It — Hazır Araçla Uygula

`code/main.py` , oyuncak ikili sınıflandırma dataset üzerinde DP-SGD'yi simüle eder. Gürültü çarpanı σ'yu ve kırpma normu C'yi tarayabilir ve (ε, δ) bütçesini ve doğruluk maliyetini takip edebilirsiniz. Bir "kanarya saldırısı" benzersiz bir eğitim örneği ekler ve bir günlük kaybı testinin bunu DP'den önce ve sonra tespit edip edemediğini ölçer.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-dp-audit.md` üretir. deployment dil modeline ilişkin bir DP iddiası verildiğinde, şunları denetler: (ε, δ) değerleri, kullanılan muhasebeci, MIA değerlendirme protokolü ve güvene maruz kalma vektörlerinin değerlendirilip değerlendirilmediği.

## Egzersizler

1. `code/main.py`'yı çalıştırın. σ'yu {0,5, 1,0, 2,0}'de tarayın ve (ε, δ)-doğruluk değiş tokuşunu rapor edin. Faydanın çöktüğü noktayı belirleyin.

2. Bir kanarya yerleştirme ve günlük kaybı testi uygulayın. σ = 1,0'da DP-SGD'den önce ve sonra tespit oranını ölçün.

3. Nasr ve ark.'yı okuyun. Eğitim verilerinin çıkarılmasıyla ilgili 2025. Çıkarma başarısı neden ılımlı ε altında çökmüyor? Bu, değerlendirme olarak MIA hakkında ne anlama geliyor?

4. Tamamen inference zamanında çalışan PMixED (arXiv:2403.15638) kullanarak bir deployment tasarlayın. PMixED'in ele aldığı, ancak DP-SGD'nin ele almadığı tehdit modeli nedir?

5. LLM Geribildirim saldırısı yoluyla DP Tersine Çevirmenin taslağını çizin. Güven puanı sızıntısını sınırlayan bir karşı önlem tasarlayın ve bunun deployment maliyetini tahmin edin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| DP | "(ε, δ)-diferansiyel gizlilik" | Biçimsel gizlilik: komşuluk-dataset değişikliği kapsamında çıktı dağıtımı kapandı |
| DP-SGD | "gürültü enjekte edilmiş SGD" | Gradient kırpma + Gauss gürültüsü ekleme; standart DP eğitimi |
| LoRA + DP-SGD | "verimli özel ince ayar" | Düşük dereceli adaptörlerde DP-SGD; standart 2025 konfigürasyonu |
| MIA | "üyelik inference" | Bir örneğin eğitim verilerinde olup olmadığını belirleyen saldırı |
| Kanarya | "filigran örneği eklendi" | DP kaçağını ölçmek için kullanılan benzersiz eğitim örneği |
| PMixED | "özel inference karışımı" | Sonrakitoken dağıtımlarda uzmanların karışımı aracılığıyla Inference zamanlı DP |
| DP Ters Çevirme | "güven sızıntısı saldırısı" | Yeniden tanımlama için bir modelin güvenini kehanet olarak kullanan saldırı |

## Daha Fazla Okuma

- [Abadi ve ark. — DP-SGD (arXiv:1607.00133)](https://arxiv.org/abs/1607.00133) — standart DP eğitim algoritması
- [Carlini ve ark. — Eğitim Verilerinin Çıkarılması (arXiv:2012.07805)](https://arxiv.org/abs/2012.07805) — standart çıkarma kağıdı
- [Duan ve ark. — Yüksek Lisans'larda Canary MIA (arXiv:2402.07841, 2024)](https://arxiv.org/abs/2402.07841) — sınırlı başarılı MIA
- [Kowalczyk ve ark. — Yüksek Lisanslar için DP'nin denetlenmesi (arXiv:2503.06808, Mart 2025)](https://arxiv.org/abs/2503.06808) — gerilimin çözümü
- [PMixED (arXiv:2403.15638)](https://arxiv.org/abs/2403.15638) — inference zamanlı özel tahmin
