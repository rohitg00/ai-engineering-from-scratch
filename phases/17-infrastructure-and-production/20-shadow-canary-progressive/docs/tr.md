# LLM'ler için Gölge Trafiği, Kanarya Sunumu ve Aşamalı Deployment

> Yüksek Lisans sunumları, deployment yazılımının en zor kısımlarını birleştirir: birim testi yok, yaygın arıza modları, gecikmeli sinyaller. Sıra şu şekildedir: (1) gölge modu - aday modele prod isteklerini çoğaltın, günlüğe kaydedin, sıfır kullanıcı etkisi ile karşılaştırın; bariz dağıtım sorunlarını yakalar ancak kalite garantisi değildir; (2) kanarya dağıtımı — her adımda kapılarla aşamalı trafik değişimi %10 → %25 → %50 → %75 → %100; gecikme yüzdelik dilimlerini, maliyet/istek, hata/ret oranını, çıktı uzunluğu dağılımını, kullanıcı geri bildirim oranını izleyin; (3) Stabilite onaylandıktan sonra farklı alternatifler için A/B testi. Belirlenimsizlik azaltılamaz; GPU FP'nin ilişkilendirilemezliği ve toplu boyut farklılığı nedeniyle aynı girişlerle çalıştırmalar arasında %15'e kadar doğruluk değişimi. Maliyet sabit değil değişkendir; %20 daha iyi bir model, çağrı başına 3 kat daha pahalı olabilir. Geri alma hızı belirleyicidir: Geri alma yeniden konuşlandırmayı gerektiriyorsa çok yavaşsınız demektir. Politika yapılandırma/bayraklarda yaşar; model sabitlenmiş özetlerle kayıt defterinde yaşıyor; geri alma = çevirme politikası + geri alma eşiği + eski modeli saniyeler içinde sabitleme.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak kanarya ilerleme simülatörü)
**Önkoşullar:** Aşama 17 · 13 (Observability), Aşama 17 · 21 (A/B Testi)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Gölge modunu (sıfır etkili karşılaştırma), kanarya (canlı trafik aşamalı) ve A/B (kararlılık onaylı karşılaştırma) arasında ayrım yapın.
- LLM'ye özgü beş kanarya ölçüsünü sıralayın (gecikme, maliyet/istek, hata/reddetme, çıktı uzunluğu dağılımı, kullanıcı geri bildirimi).
- Yüksek Lisans determinizminin (%15'e kadar) kullanıma sunmadaki "istikrarlı" anlamını neden değiştirdiğini açıklayın.
- Saatler (yeniden konuşlandırma) değil, saniyeler süren (politika çevirme) bir geri alma yolu tasarlayın.

## Sorun

Yeni bir model gönderiyorsunuz. Çevrimdışı değerlendirmeler %3 doğruluk artışı gösteriyor. Üretimde açarsınız. 24 saat içinde maliyet %40 arttı, kullanıcıların beğenmediği puanlar %8 arttı, üç müşteri bildiriminde "tuhaf yanıtlar" rapor edildi. Geri çekil. Yeniden konuşlandırma 3 saat sürer. Hafta sonunuz mahvoldu.

Bunların her parçası önlenebilirdi. Gölge modu %40'lık maliyet artışını herhangi bir kullanıcı görmeden yakalayabilirdi. Başparmak aşağı hareket ettiğinde Kanarya %10'da duracaktı. Politika bayrağının geri alınması 30 saniye sürerdi. Disiplin, "çevrimdışı değerlendirmeler iyi görünüyor" ile "gerçek kullanıcılar mutlu" arasındaki boşluğu dolduran şeydir.

## Konsept

### Gölge modu

Aday üretimle aynı talepleri alır; çıktılar günlüğe kaydedilir, kullanıcılara iade edilmez. Sıfır kullanıcı etkisi. Kayıt:

- Çıktı içeriği (üretime göre farklılık gösterir).
- Token sayım (maliyet deltası).
- Gecikme.
- Reddetme ve hata.

Yakalananlar: maliyet artışları, uzunluk gerilemeleri, bariz ret değişiklikleri, ciddi hatalar. YAKALAMAZ: kullanıcıların algılayacağı kaliteli delta. Gölge bir kalite testi değil, bir duman testidir.

### Kanarya sunumu

Kapılarla aşamalı trafik değişimi. Tipik ilerleme: %1 → %10 → %25 → %50 → %75 → %100. Her adımda 5 ölçüme geçin:

1. **Gecikme yüzdelikleri** — P50, P95, P99. İhlal: Kanaryanın P99'u > 1,5x taban çizgisi vardır.
2. **İstek başına maliyet** — harmanlanmış $. İhlal: Taban çizgisinin >%20 üzerinde.
3. **Hata / ret oranı** — 5xx artı açık retler. İhlal: 2x taban çizgisi.
4. **Çıkış uzunluğu dağılımı** — ortalama + P99. İhlal: dağıtımsal değişim.
5. **Kullanıcı geri bildirim oranı** — beğenilmeyenler / bilet başvuruları. İhlal: 1,5x taban çizgisi.

### Determinizmsizlik yeni varyanstır

Aynı girdiler, aynı olmayan çıktılar üretir. Sebepler:

- GPU FP'nin ilişkilendirilemezliği (kayan nokta azaltma sırası gruba göre değişir).
- Parti boyutu farkı (128'lik bir grupta ve 16'lık bir grupta aynı prompt).
- Örnekleme (sıcaklık > 0).

Ölçülen: aynı değerlendirme setlerinde çalışmadan çalışmaya %15'e kadar doğruluk değişimi. Kullanıma sunmadaki "kararlı", metriklerin temel değerle aynı değil, beklenen sapma dahilinde olduğu anlamına gelir. Kapıları gürültü tabanının üzerine yerleştirin.

### Maliyet bir değişkendir

%20 daha iyi bir model, arama başına 3 kat daha pahalı olabilir. Maliyet/talep beş kapıdan biridir. Birim ekonomisini bozan "daha iyi" bir modelin piyasaya sürülmesi bir geri dönüş durumudur.

### Geri alma silahtır

- Politika bayrağı (özellik bayrak sistemi): yapılandırmada çevirme yüzdesi; saniyeler sürer.
- Model sabitleme (kayıt defteri özeti): sabitlenmiş model otomatik olarak yükseltilmez.
- Geri alma = bayrağı geri alma + sabitlenmiş özeti öncekine ayarlama. Saatler değil saniyeler.

Yığınınızın geri almak için yeniden konuşlandırılması gerekiyorsa, yuvarlamadan önce bunu düzeltin.

### Takımlama

**Argo Rollouts** / **İşaretleyici** — Kubernetes aşamalı dağıtım denetleyicileri. Istio/Linkerd ağırlıklı yönlendirmeyle entegrasyon.

**Istio ağırlıklı yönlendirme** — hizmet ağı düzeyinde trafik bölünmesi.

**KServe / Seldon Core** — yerleşik kanaryayla hizmet veren model.

**Özellik bayrakları** — LaunchDarkly, Flagsmith, Unleash. Politika düzeyinde çevirme, yeniden konuşlandırma yok.

### Metrik ritmi

Kanarya kapıları trafik yoğunluğuna göre her 5-15 dakikada bir kontrol edilmektedir. 10 istek/dakikalık %1 trafik, pencere başına 50-150 veri noktası sağlar; gecikme için yeterlidir ancak kullanıcı geri bildirimi için gürültülüdür. %10 ~10 kat daha fazla verir. İlerlemeler, her adımda yeterli sayıda örnek toplanacak kadar uzun süre duraklatılmalıdır.

### A/B adımı isteğe bağlıdır

Yeni model açıkça farklıysa (farklı davranış, farklı maliyet eğrisi, farklı ton), kanarya geçişlerinden sonra onu %50'de A/B testi yapın. Eğer bu sadece geliştirilmiş bir versiyonsa, kanarya kapıları geçtiğinde %100'e geçin.

### Hatırlamanız gereken sayılar

- Kanarya ilerlemesi: %1 → %10 → %25 → %50 → %75 → %100.
- Belirlenimsizlik tavanı: aynı girdilerde çalıştırmalar arasında %15'e kadar varyans.
- Beş kanarya metriği: gecikme, maliyet, hata/reddetme, çıktı uzunluğu, kullanıcı geri bildirimi.
- Maliyet kapısı: Taban çizgisinin >%20 üzerinde olması bir ihlaldir.
- Geri alma: saniyeler, saatler değil.

## Use It — Hazır Araçla Uygula

`code/main.py` , enjekte edilmiş regresyonlarla bir kanarya dağıtımını simüle eder. Kullanıma sunmanın hangi aşamada durduğunu ve hangi geçidin tetiklendiğini raporlar.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-rollout-runbook.md` üretir. Aday modeli, temel çizgi ve risk toleransı göz önüne alındığında, gölge→kanarya→%100 plan tasarlar.

## Egzersizler

1. `code/main.py`'yı çalıştırın. %25'lik bir maliyet regresyonu enjekte edin. Kanarya hangi aşamada durur?
2. Yeni modelinizin çevrimdışı doğruluk kazancı %3'tür ancak maliyet/talep +%18'dir. Bir gemi mi? Politikaya bağlıdır; her iki yolu da yazın.
3. Uçtan uca 60 saniyeden kısa süren bir geri alma tasarlayın. Gerekli altyapıyı listeleyin.
4. Determinizmsizlik değerlendirmenizde ±%7 gösteriyor. Yanlış alarm vermemek için kanarya kapılarını ayarlayın. Hangi çarpanları kullanıyorsunuz?
5. Gölge modu, kanaryadan önce %40'lık bir maliyet artışı yakalar. Gölgede tetiklenen uyarı kuralını yazın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Gölge modu | "yeniye kopyala" | Günlük kaydı için sıfır etkili adaya gönderme |
| Kanarya | "aşamalı trafik" | Kapılarla kademeli olarak kullanıcıya sunulan sunum |
| Kapılar | "kullanıma sunma kontrolleri" | İlerlemeyi engelleyen metrik eşikler |
| Determinizmsizlik | "LLM varyansı" | Çalışmalar arası azaltılamaz farklar |
| Politika bayrağı | "bayrak çevirme geri alma" | Yapılandırma düzeyinde geri alma, saat değil saniyeler |
| Model pimi | "kayıt defteri özeti" | Model sürümüne değişmez referans |
| Argo Sunumları | "K8'ler ilerici" | Kubernetes'te yerel kanarya/geri alma denetleyicisi |
| KServe | "inference K8'ler" | Kanarya ilkelleriyle hizmet veren model |
| Istio ağırlıklı | "örgü bölünmüş" | Hizmet ağı trafik ayırıcı |

## Daha Fazla Okuma

- [TianPan — Üretimi Kesmeden Yapay Zeka Özelliklerini Yayınlıyoruz](https://tianpan.co/blog/2026-04-09-llm-gradual-rollout-shadow-canary-ab-testing)
- [MarkTechPost — ML Modellerini Güvenli Bir Şekilde Dağıtma](https://www.marktechpost.com/2026/03/21/safely-deploying-ml-models-to-production-four-controlled-strategies-a-b-canary-interleaved-shadow-testing/)
- [APXML — Gelişmiş Yüksek Lisans Deployment Kalıpları](https://apxml.com/courses/mlops-for-large-models-llmops/chapter-4-llm-deployment-serving-optimization/advanced-llm-deployment-patterns)
- [Argo Rollouts belgeleri](https://argo-rollouts.readthedocs.io/)
- [Belgeleri işaretle](https://docs.flagger.app/)
