# Yönetim Kurulu'nun Göğüs Trafik, Kanarya Çeviri ve Gelişmiş Çeviri

> LLM dağıtımları, yazılım dağıtımının en zor bölümlerini birleştirir: birim testleri yoktur, dağılmamış başarısızlık modları, gecikmiş sinyaller. Düzeni (1) gölge modudur  aday modeline çift pro pro talepleri, kayıt, sıfır kullanıcı etkisi ile karşılaştırın; açık dağılım sorunlarını yakalar ancak kalite garantisi değildir; (2) Kanarya dağıtım  ilerici trafik değişimi 10% → 25% → 50% → 75% → 100% her adımda kapılar ile; izleme gecikme yüzdeleri, maliyet / taleb, hata / reddetme oranı, çıkış uzunluğu dağılım, kullanıcı geri bildirim oranı; (3) istikrarı onayladıktan sonra farklı alternatifler için A / B testleri. Deterinizm olmayan  %15'e kadar kesinlik değişimi aynı girişlerle çalışmalar arasında GPU FP'nin ilişkili olmaması ve parti boyutları değişimi nedeniyle azaltılamaz. Masraf değişken, sabit değil  %20 daha iyi bir model her çağrı için 3 kat daha pahalı olabilir. Çıkarım hızı belirleyici: Çıkarım yeniden dağıtım gerektirirse, çok yavaşsınız. Politika konfig/bandarlarda yaşar; model kayıtta sabitlenmiş dijeslerle yaşar; rollback = flip politika + geri dönüş eşiği + saniye içinde eski modelin pinini.

**Type:** Learn
**Languages:** Python (stdlib, toy canary-progression simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 21 (A/B Testing)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Gölge modunu (sıfır etki karşılaştırması), kanary (canal trafik ilerleyici) ve A/B (sağlık doğrulanmış karşılaştırma) ayırt edin.
- LLM'ye özel beş kanarya ölçüsünü (kenaklık, maliyet/ talep, hata/ reddedilme, çıkış uzunluğu dağılım, kullanıcı yanıtları) listeleyin.
- LLM belirlenme yetkisi (% 15'e kadar) neden bir dağıtımda "sağlık" anlamına gelen şeyi değiştirdiğini açıklayın.
- Sekünteler (politik dönüşü) değil saatler (değişiklik) alan bir geri dönüş yolu tasarlayın.

## Sorun

Yeni bir model gönderiyorsunuz. Offline değerlendirmeler %3 doğruluk artışını gösterir. Üretimde geri çevirirsiniz. 24 saat içinde, maliyet %40 arttı, kullanıcı parmakları%8 arttı, üç müşteri biletinin "acayip cevaplar" raporunu. Geri dönersiniz. Yeniden dağıtmak 3 saat alır. Hafta sonu mahvoldu.

Bu durumun her parçası önlenebilirdi. Gölge modunda herhangi bir kullanıcı bunu görmeden önce maliyet artışının %40'ını yakalamış olacaktı. Canary, parmak parmakları aşağı hareket ederken %10'da durmuş olacaktı. Politika bayrağı geri çekilmesi 30 saniye sürmüş olacaktı. Disiplin "offline değerlendirmeler iyi görünüyor" ve "gerçek kullanıcılar mutlu" arasındaki boşluğu dolduruyor.

## Anlaşım

### Gölge modusu

İsteğe giren isteği üretim ile aynı şekilde alır; çıkışlar kayıtlıdır, kullanıcılara geri verilmez. Kullanıcı etkisi sıfır.

- Üretim içeriği (ürünme karşı fark).
- Token sayıları (maliyet delta).
- Gecikme.
- İtiraz ve hata.

Yaptıkları: maliyet uçuşları, uzunluk gerilemeleri, açıkça reddedilen değişiklikler, sert hatalar. Yaptıkları: kalite delta kullanıcıları algılar. Gölge bir duman testi, kalite testi değil.

### Kanaryaların dağıtımı

Gelişen trafik geçişleri. Tipik ilerleme: 1% → 10% → 25% → 50% → 75% → 100%.

1. **Latency percentiles** P50, P95, P99.
2. **Cost per request** karışık $. ihlal: başlangıç seviyesinden %20'lik.
3. **Error / refusal rate**5xx artı açık bir reddedilme.
4. **Output length distribution** ortalama + P99.
5. **User-feedback rate**- Başparmak aşağı / bilet kayıtları.

### Devrimsizlik yeni bir değişimdir.

Aynı girişler aynı çıkışları üretmez.

- GPU FP ilişkisizliği (yürüyüş noktası azaltma sırası partiye göre değişir).
- Satır boyutları değişimi (128 vs. 16 satır)
- Örnekleme (temperatür > 0).

Ölçülmüş: aynı değerleme setlerinde çalıştırılan %15'e kadar doğruluk değişikliği. "Stabil" bir dağıtımda ölçümler beklenen değişiklik içinde, başlangıç çizgisine benzer değildir.

### Masraf değişken

%20 daha iyi bir model her çağrıda 3 kat daha pahalı olabilir. Masraf / talep beş kapıdan biridir. Birim ekonomisini kıran "en iyi" bir model göndermek bir geri dönüş durumudur.

### Rollback silah.

- Politika bayrağı (önümlü bayrağı sistemi): yapılandırmalarda dönüş yüzdesi; saniyeler alır.
- Model sıkıştırılması (registri sindirme): sıkıştırılmış model otomatik olarak yükseltilmez.
- Geri dönüş = bayrak + öncekiye sabitlenmiş bir dizgest ayarlayın.

Eğer yığın yeniden dağıtılmak için geri dönüş gerektiriyorsa, fırlatmadan önce düzeltin.

### Araçlama

**Argo Rollouts**- Ne ?**Flagger** Kubernetes ilerici teslimat kontrolörleri. Istio/Linkerd ağırlıksız yönlendirme ile entegre.

**Istio weighted routing** hizmet ağı seviyesindeki trafik bölümü.

**KServe / Seldon Core** İçerilen kanaryalı servisi.

**Feature flags** LançDarkly, Flagsmith, Unleash.

### Metrikler kadansı

Kanarya kapıları trafik hacmine bağlı olarak her 5-15 dakikada bir kontrol eder. 1000 req/minten %1'i (kanarya için 10 req/min) 5-15 dakikalık pencerede 50-150 veri noktası verir.

### A/B adımı seçeneğe bağlıdır.

Yeni model belirgin bir şekilde farklı ise (farklı davranış, farklı maliyet eğri, farklı ton), A/B testini kanary geçtikten sonra %50'de yapın. Eğer aynı davranışın sadece geliştirilmiş bir versiyonu ise, kanary kapıları geçtiğinde %100'e atlayın.

### Hatırlamalısın numaralar

- Kanarya ilerleme: 1% → 10% → 25% → 50% → 75% → 100%.
- Determinizm sınırlaması: Aynı girişlerde %15'e kadar devamlı değişim.
- Beş kanarya ölçüsü: gecikme, maliyet, hata/reddedilme, çıkış uzunluğu, kullanıcı geri bildirimi.
- Masraf kapısı: >20%'den fazla baseline karşı bir ihlal.
- Sekünteler, saatler değil.

```figure
i4-canary-ramp
```

## Kullan

`code/main.py`İndirilen geri dönüşlerle bir kanarya yayımını simüle eder. Yayınlama durakları ve hangi kapı tetiklendiği raporları.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-rollout-runbook.md`. Başvuru modeli, başlangıç çizgisi ve risk toleransı göz önüne alındığında, shadow→canary→100% planı tasarlıyor.

## Egzersizler

1. Çık .`code/main.py`- %25 maliyet geri dönüşü enjekte edin.
2. Yeni modeliniz %3 doğruluk kazancı offline ama maliyet / talep %18'dir.
3. 60 saniyeden kısa bir geri dönüş yapın.
4. - Değerlendirme eksikliği %7'e ulaştı.
5. Gölge modunda, kanaryalardan önce maliyet artışı %40'a ulaşır.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Shadow mode | "duplicate to new" | Zero-impact send-to-candidate for logging |
| Canary | "progressive traffic" | Gradual user-exposed rollout with gates |
| Gates | "rollout checks" | Metric thresholds that block progression |
| Non-determinism | "LLM variance" | Irreducible run-to-run differences |
| Policy flag | "flag flip rollback" | Config-level rollback, seconds not hours |
| Model pin | "registry digest" | Immutable reference to a model version |
| Argo Rollouts | "K8s progressive" | Kubernetes-native canary/rollback controller |
| KServe | "inference K8s" | Model serving with canary primitives |
| Istio weighted | "mesh split" | Service-mesh traffic splitter |

## Daha Fazla Okumak

- [TianPan — Releasing AI Features Without Breaking Production](https://tianpan.co/blog/2026-04-09-llm-gradual-rollout-shadow-canary-ab-testing)
- [MarkTechPost — Safely Deploying ML Models](https://www.marktechpost.com/2026/03/21/safely-deploying-ml-models-to-production-four-controlled-strategies-a-b-canary-interleaved-shadow-testing/)
- [APXML — Advanced LLM Deployment Patterns](https://apxml.com/courses/mlops-for-large-models-llmops/chapter-4-llm-deployment-serving-optimization/advanced-llm-deployment-patterns)
- [Argo Rollouts docs](https://argo-rollouts.readthedocs.io/)
- [Flagger docs](https://docs.flagger.app/)
