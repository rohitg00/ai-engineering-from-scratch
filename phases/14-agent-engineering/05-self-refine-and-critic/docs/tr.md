# Kendini Geliştirme ve ELEŞTİRME: Yinelemeli Çıktı İyileştirmesi

> Self-Refine (Madaan ve diğerleri, 2023), bir LLM'yi bir döngü içinde üç rolde (oluşturma, geri bildirim, iyileştirme) kullanır. Ortalama kazanç: 7 görevde mutlak +20. CRITIC (Gou ve diğerleri, 2023), doğrulamayı harici araçlar aracılığıyla yönlendirerek geri bildirim adımını güçlendirir. 2026'da bu model her framework'de "değerlendirici-optimizer" (Antropik) veya bir korkuluk döngüsü (OpenAI Agents SDK) olarak gönderilir.

**Tür:** Yapım
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 01 (Agent Loop), Aşama 14 · 03 (Yansıma)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Kendini İyileştirme'nin üç prompt'sini belirtin (oluşturma, geri bildirim, hassaslaştırma) ve geçmişin hassaslaştırma prompt için neden önemli olduğunu açıklayın.
- CRITIC'in kritik görüşünü açıklayın: Yüksek Lisans'lar, harici temellendirme olmadan kendi kendini doğrulama konusunda güvenilmezdir.
- Geçmişi ve isteğe bağlı harici doğrulayıcıyı içeren bir stdlib Self-Refine döngüsü uygulayın.
- Bu modeli Anthropic'in "değerlendirici-optimizer" iş akışına ve OpenAI Agent'nin SDK'sının çıkış korkuluklarına eşleyin.

## Sorun

Bir agent neredeyse doğru olan bir cevap üretir. Belki bir kod satırında sözdizimi hatası vardır. Belki özet çok uzun olabilir. Belki bir plan uç bir durumu kaçırıyor olabilir. İstediğiniz şey şu: agent kendi çıktısını eleştirir, sonra düzeltir.

Self-Refine, bunun tek bir modelle, eğitim verisi olmadan, RL olmadan çalıştığını gösterir. Ancak bir sorun var: Yüksek Lisans'lar somut gerçekleri doğrulama konusunda kötü. CRITIC düzeltmeyi adlandırır; doğrulama adımını harici araçlar (arama, kod yorumlayıcı, hesap makinesi, test çalıştırıcı) aracılığıyla yönlendirir.

Bu iki makale birlikte yinelemeli iyileştirme için 2026 varsayılanını tanımlar: oluştur, doğrula (mümkün olduğunda harici olarak), hassaslaştır, doğrulayıcı başarılı olduğunda dur.

## Konsept

### Kendini İyileştirme (Madaan ve diğerleri, NeurIPS 2023)

Bir LLM, üç rol:

```
generate(task)            -> output_0
feedback(task, output_0)  -> critique_0
refine(task, output_0, critique_0, history) -> output_1
feedback(task, output_1)  -> critique_1
refine(task, output_1, critique_1, history) -> output_2
...
stop when feedback says "no issues" or budget exhausted.
```

Önemli ayrıntı: `refine` tüm geçmişi (önceki tüm çıktıları ve eleştirileri) görür, böylece hataları tekrar etmez. Makale bunu ortadan kaldırıyor: düşüş geçmişi ve kalite keskin bir şekilde düşüyor.

Başlık: GPT-4 dahil 7 görevde (matematik, kod, kısaltma, diyalog) ortalama +20 mutlak iyileştirme. Eğitim yok, harici araç yok, tek model.

### ELEŞTİRİ (Gou ve diğerleri, arXiv:2305.11738, v4 Şubat 2024)

Self-Refine'ın zayıflığı: geri bildirim adımı, bir Yüksek Lisans puanının kendisidir. Gerçeklere dayalı iddialar açısından bu güvenilmezdir (halüsinasyon, onu üreten modele genellikle ikna edici görünür). CRITIC, `feedback(task, output)`'yi `verify(task, output, tools)` ile değiştirir; burada {`tools` şunları içerir:

- Gerçek iddialar için bir arama motoru.
- Kod doğruluğu için bir kod yorumlayıcısı.
- Aritmetik için bir hesap makinesi.
- Etki alanına özgü doğrulayıcılar (birim testleri, tür denetleyicileri, linterler).

Doğrulayıcı, araç sonuçlarına dayanan yapılandırılmış bir eleştiri üretir. Arıtıcı daha sonra bu eleştiriyi şart koşar.

Başlık: CRITIC, eleştiri temelli olduğu için gerçek görevlerde Self-Refine'dan daha iyi performans gösteriyor. Harici doğrulayıcıların olmadığı görevlerde (yaratıcı yazma, biçimlendirme), CRITIC, Self-Refine'a düşer.

### Durdurma koşulu

İki yaygın şekil:

1. **Doğrulayıcı başarılı olur.** Harici test başarıyı döndürür. Mümkün olduğunda tercih edilir (birim testleri, tip denetleyici, korkuluk onayı).
2. **Geri bildirim yapılmadı.** Model "çıktı iyi" diyor. Daha ucuz ama güvenilmez; maksimum yineleme sınırıyla eşleştirin.

2026 varsayılanı: bunları birleştirin. "Doğrulayıcı VEYA modelini geçerse dur, ince VE yinelemeler >= 2 VEYA yinelemeler >= maksimum_ yinelemeler diyor."

### Değerlendirici-Optimize Edici (Antropik, 2024)

Anthropic'in Aralık 2024'teki gönderisi bunu beş iş akışı modelinden biri olarak adlandırıyor. İki rol:

- Değerlendirici: çıktıyı puanlar ve bir eleştiri üretir.
- Optimizer: eleştiriye göre çıktıyı revize eder.

Değerlendiriciyi geçene kadar döngü yapın. Bu, Anthropic'in çerçevelemesinde Kendini İyileştirme/Eleştirmedir. Anthropic'in eklediği kritik mühendislik detayı: Değerlendirici ve optimize edici prompt'ler önemli ölçüde farklı olmalıdır, böylece model yalnızca onay işaretiyle kalmaz.

### OpenAI Agent'nin SDK çıkış korkulukları

OpenAI Agent'nin SDK'sı bu modeli "çıkış korkulukları" olarak sunar. Korkuluk, bir agent'nin son çıktısı üzerinde çalışan bir doğrulayıcıdır. Eğer korkuluk takılırsa (`OutputGuardrailTripwireTriggered`'yi yükseltirse), çıkış reddedilir ve agent yeniden deneyebilir. Korkuluklar araçları çağırabilir (CRITIC tarzı) veya saf işlevler (Kendini İyileştirme tarzı) olabilir.

### 2026 tuzakları

- **Lastik damga döngüleri.** Aynı prompt stiliyle üretim ve eleştiri yapan aynı model, "bana iyi görünüyor" konusunda birleşiyor. Eleştiri için yapısal olarak farklı prompt'ler veya daha küçük, ucuz bir model kullanın.
- **Aşırı hassaslaştırma.** Her hassaslaştırma geçişi gecikme ve tokens ekler. Bütçe 1-3 geçer; bundan sonra gerçek kişi tarafından yapılan incelemeye geçin.
- **Önemsiz görevlerde CRITIC.** Harici bir doğrulayıcı yoksa, CRITIC Kendini Arıtmaya dönüşür; saplama doğrulayıcı için gecikme ücreti ödemeyin.

## İnşa Et

`code/main.py` bir oyuncak görevinde Kendini İyileştirme ve KRİTİK'i uyguluyor: bir konuya göre kısa bir madde listesi hazırlıyor. Doğrulayıcı formatı kontrol eder (her biri 60 karakterin altında olan 3 madde işareti). CRITIC, bilinen halüsinasyonları cezalandıran harici bir "gerçek doğrulayıcı" ekler.

Bileşenler:

- `generate` — senaryolu yapımcı.
- `feedback` — Yüksek Lisans tarzı özeleştiri.
- `verify_external` — CRITIC tarzı temelli doğrulayıcı.
- `refine` — geçmişte verilen çıktıyı yeniden yazar.
- Durdurma koşulu — doğrulayıcı geçer veya maksimum 4 yineleme.

Çalıştır:

```
python3 code/main.py
```

Self-Refine ve CRITIC çalıştırmalarını karşılaştırın. CRITIC, Self-Refine'in kaçırdığı gerçek bir hatayı yakalar çünkü harici doğrulayıcı, özeleştirinin yapmadığı temele sahiptir.

## Kullan onu

Anthropic'in değerlendirici-iyileştiricisi, Claude dostu dildeki bu kalıptır. OpenAI Agent'nin SDK'sının çıkış korkulukları CRITIC şeklindedir (korkuluklar araçları çağırabilir). LangGraph, Self-Refine gibi okunan bir yansıma düğümü gönderir. Google'ın Gemini 2.5 Bilgisayar Kullanımı, CRITIC varyantı olan adım başına bir güvenlik değerlendiricisi ekler: her eylem, gerçekleştirilmeden önce doğrulanır.

## Gönderin

`outputs/skill-refine-loop.md`, görev şekli, doğrulayıcı kullanılabilirliği ve yineleme bütçesi dikkate alınarak bir değerlendirici-optimizasyon döngüsü yapılandırır. Oluşturucu, değerlendirici/doğrulayıcı ve optimize edici için prompt'ler ve ayrıca bir durdurma politikası yayar.

## Egzersizler

1. Oyuncağı max_iterations=1 ile çalıştırın. CRITIC hala yardımcı oluyor mu?
2. Harici doğrulayıcıyı gürültülü bir tanesiyle değiştirin (%30 rastgele yanlış pozitif). Döngü ne yapar? Bu, çoğu korkuluk istifinin 2026 gerçeğidir.
3. Bir "farklı modellerde üretici-eleştirisi" varyantını uygulayın: büyük model üretir, küçük model eleştirisi. Aynı modeli geçiyor mu?
4. CRITIC Bölüm 3'ü okuyun (arXiv:2305.11738 v4). Üç doğrulama aracı kategorisini adlandırın ve her biri için bir örnek verin.
5. OpenAI Agent'nin SDK'sını `output_guardrails` CRITIC'in doğrulayıcı rolüyle eşleştirin. SDK neyi yanlış yapıyor ve neyi doğru yapıyor?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Kendini İyileştirme | "Kendini düzelten Yüksek Lisans" | Oluştur -> geri bildirim -> geçmişle birlikte tek bir modelde döngüyü iyileştirin |
| ELEŞTİRİ | "Araca dayalı doğrulama" | Geri bildirimi harici bir doğrulayıcıyla değiştirin (arama, kod, hesaplama, testler) |
| Değerlendirici-Optimize Edici | "Antropik iş akışı modeli" | İki rol - değerlendirici puanları, optimize edici revizyonları - yakınsamaya bağlı |
| Çıkış korkuluğu | "Post-hoc kontrol" | OpenAI Agent'nin, bir agent çıktı ürettikten sonra çalışan SDK doğrulayıcısı |
| Adımı doğrulayın | "Eleştiri aşaması" | Yük taşıma kararı: temelli veya öz değerlendirmeli |
| Geçmişi hassaslaştır | "Modelin zaten denediği şey" | Önceki çıktılar + eleştiriler prompt'yi iyileştirmek için başa eklendi; düşüş ve kalite çöküşleri |
| Lastik damga döngüsü | "Kendi kendine anlaşma başarısızlığı" | Same-prompt eleştirisi "iyi görünüyor" ifadesini döndürür; yapısal olarak farklı prompt'larla düzeltme |
| Durdurma koşulu | "Yakınsama testi" | Doğrulayıcı başarılı oldu VEYA geri bildirim yok VE yineleme sınırı; asla tek koşullu |

## Daha Fazla Okuma

- [Madaan ve diğerleri, Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) — kanonik makale
- [Gou ve diğerleri, CRITIC (arXiv:2305.11738)](https://arxiv.org/abs/2305.11738) — araca dayalı doğrulama
- [Antropik, Etkili Agentler Oluşturma](https://www.anthropic.com/research/building-effective-agents) — değerlendirici-optimizasyon iş akışı modeli
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) — CRITIC şekilli doğrulayıcılar olarak korkulukların çıktısını alın
