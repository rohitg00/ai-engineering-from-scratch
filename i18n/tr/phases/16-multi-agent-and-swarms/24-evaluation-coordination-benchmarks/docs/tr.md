# Değerlendirme ve Koordinasyon Benchmarks

> Beş 2025-2026 referans noktası, çoklu ajan değerlendirme alanını kapsar. **MultiAgentBench / MARBLE**(ACL 2025, arXiv:2503.01935) yıldız/ zincir/ ağaç/graf topolojilerini, önemli nokta KPI'leri ile değerlendirir. **graph is best for research**, bilişsel planlama %3'lik bir dönüm noktası elde eder. **COMMA**GPT-4o'nun rastgele bir başlangıç çizgisini yenmek için mücadeleyi içeren en son modeller;**MedAgentBoard**(arXiv:2505.12371) dört tıbbi görev kategorisini kapsar ve genellikle çoklu ajanın tek LLM'de baskın olmadığını bulur. **AgentArch**(arXiv:2509.10769) araç kullanımı + bellek + orkestrasyonu birleştiren kurumsal ajan mimarlıklarını referanslandırır. **SWE-bench Pro**([arXiv:2509.16941](https://arxiv.org/abs/2509.16941)) iş uygulamaları, B2B hizmetleri ve geliştiriciler aracılığıyla 41 repo'da 1865 sorun yaşanıyor; sınır modelleri Pro'da %23 oranında %70'e karşı verified'de %70'e karşı  kirliliğin gerçeklik kontrolü. Claude Opus 4.7 (Epril 2026)**64.3%**Pro'da açık bir ajan-eşikler koordinasyonu ile (Antropik ilk kaynak henüz yayınlanmamış  ön raporu olarak ele alınmıştır); Verdent (ajan asfalt) vurgular **76.1% pass@1**Verified ([Verdent technical report](https://www.verdent.ai/blog/swe-bench-verified-technical-report) ).**AAAI 2026 Bridge Program WMAC**(https://multiagents.org/2026/Bu ders MARBLE'nin ölçümlerine dayanıyor, topoloji karşı ölçüm tarama yapılıyor ve "SWE-benç Verified'in sadece geçmesi genelleşmenin kanıtı değildir" kuralını sıkıştırıyor.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 15 (Voting and Debate Topology), Phase 16 · 23 (Failure Modes)
**Time:** ~75 minutes

## Sorun

Bir makalede "çok ajanlı sistemimiz daha iyidir" denildiğinde, soru şu: ne, ne üzerinde, nasıl ölçüldü? 2023-2024 yılları arasında çok ajanlı değerlendirme çağında kaos vardı.

Paylaşılan referanslar olmadan iki çoklu ajan sistemini anlamlı bir şekilde karşılaştıramazsınız. Daha da kötüsü, beklenmedik referanslar olmadan, sınır modelleri kirleştirebilir. SWE-benç Verified 2025 ortalarına kadar eğitim korpuslarında kısmen kirlendi; sınır puanları şişmişti; Pro kirlenmemiş bir gerçeklik kontrolü olarak tasarlandı.

Bu ders, 2026'daki beş kanonik referans değerini sıralar, her birinin ölçümlerini belirler ve referans iddialarını şüpheci bir şekilde okumayı öğretir.

## Anlam

### MultiAgentBench (MARBLE)  ACL 2025

arXiv:2503.01935. Araştırma, kodlama ve planlama görevleri üzerinde dört koordinasyon topolojisini (yıldız, zincir, ağaç, grafik) değerlendirir.

Ölçüm sonuçları:

- **Graph**Topoloji araştırma senaryoları için en iyi; herhangi bir eleştirileri destekler.
- **Chain**Adımlı rafine kodlama için en iyi.
- **Star**Hızlı bir gerçekleşme için en iyi.
- **Coordination tax**Graf üzerinde ~4 ajanın geçtiği görünür.
- **Cognitive planning**Topolojiler arasında %3'lik bir kilometrelik başarıyı ekler.

Kolportasyon topolojilerini elma-elme karşılaştırmak istediğinizde kullanın.https://github.com/ulab-uiuc/MARBLE) değerlendirici tarafından sağlanır.

### COMMA  Multimodal asimetrik bilgi

Görevler, ajanların farklı gözlem yöntemleri olan ve tam bilgi paylaşımı olmadan koordinasyon yapmaları gereken görevleri kapsar.**random baseline**COMMA'da ajan-ajen işbirliği konusunda.Signal, çoklu ajan modalitelerinin yetersiz eğitilmiş ve değerlendirilmemiş olduğu  LLM'ler tek modalitelerle işbirliği makul bir şekilde yönetmektedir.

Sisteminizin multimodal veya asimetrik bilgi koordinasyonu olduğunda kullanın. COMMA'dan gelen sıfır sonuç, talep etmeden önce ölçmek için bir uyarıdır.

### MedAgentBoard  alan stres testi

ArXiv:2505.12371. Dört tıbbi görev kategorisi: teşhis, tedavi planlaması, rapor oluşturma, hasta iletişim.

Bulma: çoklu ajan çoğu kategoride tek-LLM'de egemenlik göstermiyor. Çoklu ajan avantajı dar  alt görevlerin açıkça ayrılabilir olduğunda görev parçalanması yardımcı olur (diagnostik + tedavi); koordinasyon genel maliyeti uzmanlık kazancını (raport oluşturma) aşırırken zarar görür.

MedAgentBoard'un dersi genelleştirirse, önerilen birçok multi-agent sistemi aşırı tasarlanmıştır.

### AgentArch  Girişimci mimarlıklar

ArXiv:2509.10769. Kullanım, bellek ve orkestrasyonla birlikte katlanmış işletme ayarları. Benchmark her katmanın katkılarını izole eder: araç eklemenin ne kadar yardımı var? bellek eklemek? çoklu ajan orkestrasyonu eklemek?

Bir kurumsal ajan yığınını tasarladığınızda ve her katmanı haklı çıkarmanız gerektiğinde kullanın. AgentArch, değerini ölçemediğiniz özellikleri satın almaktan kaçınmanıza yardımcı olur.

### SWE-bench Pro  gerçeklik kontrolü

ArXiv:2509.16941. İşletme uygulamaları, B2B hizmetleri ve geliştiriciler aracı kapsamında 41 deposu üzerinde 1865 sorun.**uncontaminated**Frontier modelleri Pro'da %23 oranında verified'de %70 oranında puan alıyor.

Nisan 2026 notları:
- Claude Opus 4.7 Pro: **64.3%**(Agent-team koordinasyonu ile bildirildi; henüz Anthropic ilk kaynağı yayınlanmadı  ön raporu olarak ele alınmıştır).
- Verdent (Agent Eklenti) Verified: **76.1% pass@1**([technical report](https://www.verdent.ai/blog/swe-bench-verified-technical-report))
- Pro'da ajan asfaltlaması olmayan sınırlı ham puanlar: ~23-35% ([SWE-bench Pro paper](https://arxiv.org/abs/2509.16941))

"SWE-bench Verified'i yenmiştik" artık yetenek kanıtı değildir. Pro, mevcut geçit testidir. Ajan-eğitim asfaltlaması, 2026'da çoklu ajan koordinasyonu için en güçlü empirici argümanlardan biri olan Pro'da ölçülebilir kazançlar üretir (~30-40 puan delta).

### AAAI 2026 WMAC

AAAI 2026 Köprü Programı  Çoklu Ajan Koordinasyonu Atölyesinde (https://multiagents.org/2026/) 2026'da çoklu ajanlı AI araştırmaları için topluluk odak noktası. Kabul edilen makaleler ve atölye işlevleri yeni yöntemlerin değerlendirilmesi için kanonik bir yerlerdir.

### Referans iddialarını şüpheci bir şekilde okuyun  2026 kontrol listesini

Birisi çoklu ajanlı bir sonuç talep ettiğinde:

1. **Which benchmark, which split?**SWE-benç Verified vs Pro çok önemli. Yanlış bölünme ile rapor edilen bir sayı değersiz.
2. **Contamination check.**Eğer modelin eğitim kesiminden sonra verildiyse dikkatli olun.
3. **Baseline comparison.**Tek bir LLM başlangıç noktası vs rastgele vs önceki çoklu ajan çalışmaları.
4. **Statistical significance.**N testleri, p değeri, güven aralığı.
5. **Task diversity.**Genelleştirme üretim için önemli.
6. **Cost disclosure.**%90'lık bir çözüm 20 kat daha pahalı bir iş kararı, yetenek iddiası değil.

### Benchmarkların hiçbiri neyi iyi ölçmedi

- **Long-horizon coordination.**Günlerce divar saatleri ile etkileşim.
- **Adversarial resilience.**Bir ajan kötü niyetli veya tehlikeli olduğunda ne olur?
- **Drift under deployment.**Benchmarks statik; üretim dağılımları değişir.
- **Cost-normalized performance.**Çoğu referans, dolar başına doğru değil, çıplak doğruluk rapor ediyor.

Aslında önem verdiğiniz bir eksenizin kendi iç standartınızı oluşturmak genellikle doğru bir adımdır.

```figure
a5-bench-gap
```

## Yapın

`code/main.py`etkileşimsiz bir geçiş yolu:

- Oyuncak görevinde 3 çoklu ajan sistemi simüle eder.
- Her biri için MARBLE tarzı kilometrelik metrikleri hesaplar.
- "Eğitim" setinden görevleri gizleyerek kirliliği kontrol eder.
- Açıkça rastgele bir başlangıç çizgisi ile karşılaştırılır.
- Referans talepleri puan kartı basar.

Çık:

```bash
python3 code/main.py
npx tsx code/main.ts
```

Beklenen çıkış: çürük doğrulukla sistem puan kartı, ana nokta başarısı, görev başına maliyet, rastgele başlangıç çizgisi delta ile kirlilik kontrol notu.

## Kullan

`outputs/skill-benchmark-reader.md`Birçok ajanla ilgili referans değerini okumak ve kontrol kontrol listesini uygulamak.

## Gönder

Üretim değerlendirme disiplini:

- **Build an internal benchmark**Halkın referans değerleri, bilgi verir, fakat değiştirmez.
- **Include a random baseline**Eğer koordinasyon görevinde rastgele bir oranla büyük bir farkla yenemezseniz, görev yanlış bir şekilde ayarlanabilir.
- **Report cost alongside accuracy.**Token fiyatı ve duvar saati.
- **Rebuild the benchmark quarterly.**Üretim dağılımında değişiklikler; eski referans değerleri yanıltıcı.
- **Avoid published-benchmark overfitting.**Takımınız özel olarak SWE-bench Pro numaraları için optimize ediyorsa, üretime geri döneceksiniz.

## Egzersizler

1. Çık .`code/main.py`Üç simülasyon sistemden hangisinin en iyi maliyetleri olduğu belirlenir.
2. MultiAgentBench'i okuyun (arXiv:2503.01935). Kendi görev alanınız için, MARBLE'nin önerdiği dört topolojiden hangisini seçin.
3. SWE-bench Pro kağıdı okuyun.
4. COMMA'nın multimodal koordinasyonla ilgili bulgularını okuyun. İç standart değerinize ekleyebileceğiniz basit bir multimodal koordinasyon görevi tasarlayın.
5. Benchmark-davayeleri kontrol listesini son bir çok ajan gazetesinin başlık sonuçlarına uygulayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MARBLE | "MultiAgentBench" | ACL 2025; star/chain/tree/graph topologies with milestone KPIs. |
| COMMA | "Multimodal benchmark" | Multimodal asymmetric-info coordination; frontier models struggle vs random. |
| MedAgentBoard | "Domain stress test" | Four medical categories; often finds multi-agent does not dominate single-LLM. |
| AgentArch | "Enterprise benchmark" | Tools + memory + orchestration layered. |
| SWE-bench Pro | "Contamination-resistant" | 1865 problems, 41 repos; ~23% vs 70%+ on Verified (the contamination signal). |
| Milestone achievement | "Partial credit" | Benchmarks that reward progress, not only final success. |
| Contamination | "Benchmark leaked into training" | Post-release, benchmarks drift into training corpora; scores inflate. |
| WMAC | "AAAI 2026 Bridge Program" | Workshop on Multi-Agent Coordination; community focal point. |

## Daha Fazla Okumak

- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) MİLİK'ler ile topoloji referans göstergesi
- [MARBLE repository](https://github.com/ulab-uiuc/MARBLE) Referans uygulanması
- [MedAgentBoard](https://arxiv.org/abs/2505.12371) alan stres testi; çoklu ajan genellikle baskın değildir
- [AgentArch](https://arxiv.org/abs/2509.10769) Girişimci ajan mimarisi
- [SWE-bench leaderboards](https://www.swebench.com/) Sınır modelleri için doğrulanmış ve pro puanları
- [AAAI 2026 WMAC](https://multiagents.org/2026/) 2026 yılındaki topluluk odak noktası
