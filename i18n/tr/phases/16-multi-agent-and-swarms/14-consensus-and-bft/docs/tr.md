# Konsens ve Bizans'ın Ajanlar İçin Suç Tahammülü

> Klasik dağıtılmış sistemler BFT, stokastik LLM'lere ulaşıyor. 2025-2026 yıllarında üç araştırma yönü ortaya çıktı: **CP-WBFT**(arXiv:2511.10400) her oyı bir güven sorgulaması ile tartar.**DecentLLMs**(arXiv:2507.14928) paralel işçi önerileri ve geometrik-medyen birleştirme ile lidersiz kalıyor. **WBFT**(arXiv:2505.05103) ağırlıklı oylama ile Hiyerarşik Yapı Gruplama'yı birleştirerek Core ve Edge düğümlerini ayırır. "AI Ajanları Anlaşabilir mi?" (arXiv:2603.01213)'nin dürüst bir empiriyel sonucu, bugün ölçekli anlaşmanın bile kırılgan olmasıdır. BFT gereklidir ama yeterli değildir. Bu ders minimal bir BFT protokolü oluşturur, üç ajan-spesifik saldırıyı enjekte eder (Bizans yalanı, sikofant uyumluluk, ilişkili hata monoculture) ve her konsensüs varianti nasıl başa çıktığını ölçer.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## Sorun

N LLM ajanları var. Her biri bir cevap üretir. Onlar aynı fikirde değiller. Çoğu oy yanlış bir tanesini seçer çünkü iki ajan ilişkili (eşit temel model, aynı eğitim verileri, aynı başarısızlık modları).

Şimdi bir aldatıcı ajan ekleyin: kasıtlı olarak yalan söylüyor. veya bir sikofant ajan: son konuşanla aynı fikirde. klasik BFT'de, Bizans düğümlerinin bir bölümü olduğu varsayımıdır.`f < n/3`2026'da gerçek şu ki, LLM düğümleri dürüst olsalar bile, modeller arasında ilişkili ve birbirlerinin çıkışları tarafından etkilenen stohastiktir.

Klasik BFT (PBFT, 1999) yanlış değildir  eksiktir. İstisnasız bit-flipping ile ilgilenir. "Üç dürüst ajan eğitim verilerini paylaştığı için bir halüsinasyon paylaşıyor".

## Anlam

### Klasik BFT'nin size verdiği

Pratik Bizans Suç Tahammülü (Castro & Liskov, OSDI 1999)`f < n/3`Bizans düğümleri. Protokol üç aşama (hazırlama, hazırlama, görev) ve iki primitif ( imzalama mesajları, kworum sertifikaları) sahiptir.`n >= 3f + 1`Dürüst veya kötü niyetli düğümler.

Garantiler güçlüdür ama şu varsayımları var:

1. **Independent faults.**Bizanslılar koordinasyon yapmaz.
2. **Honest nodes are truly honest.**Dürüst çıkışların doğruluğu bir sorun değil; protokol sadece anlaşmazlıkları düzeltir.
3. **The question has a ground-truth answer.**Yanlış bir gerçekle ilgili bir fikir birliği hala bir fikir birliği.

LLM ajanları üçünü de ihlal eder. Aynı temel modelde çalışan iki ajan hata paylaşıyor. "Dürüst" bir LLM hala halüsinasyonlar yapar. ve belirsiz sorularda, "gerçek" ajanların karar verdiği şey dış bir oracle yok.

### Üç LLM özel saldırısı

**Byzantine lie.**Bir ajan kasten yanlış bir cevap verir.`f < n/3`- Evet .

**Sycophantic conformity.**Bir ajan oy vermeden önce diğerlerinin cevaplarını okuyor ve son konuşan kişiyle uyumlu. Kötü olmayan, ama en yüksek sesle ilişkili.

**Correlated-error monoculture.**Üç ajan aynı temel modelde. Aynı yanlış cevabı halüsinasyonlar. Çoğu yanlıştır. Klasik BFT yardım etmez çünkü üçü de " dürüstçe " aynı fikirde.

### 2025-2026 Cevapları

**CP-WBFT**(arXiv:2511.10400)  Güvenle Denetlenmiş Ağırlaştırılmış BFT. Her seçmen cevabına bir güven sorgulamasını bağlar (kendine bildirilen bir olasılık veya ayrı bir kalibrasyon modeli öngörü). Oy tartıları güvenle ölçeyor. Tam grafiklerde +85.71% BFT iyileşmesi bildirildi.

**DecentLLMs**(arXiv:2507.14928)  Lidersiz. İşçi ajanları paralel olarak önerir, değerlendirici ajanlar önerileri puanlar, son cevap puanlanmış pozisyonların geometrik ortalamasıdır.`f < n/2`. Benzans yalanı ve ilişkili hatalar için hafifleme (geometrik ortalama dış değerlere dayanıklıdır ve model önyargılı ortalama değil yoğun kümelere doğru çekilir).

**WBFT**(arXiv:2505.05103)  Yerarşik Yapı Klusterleme ile ağırlanan BFT. Oy ağırlıkları yanıt kalitesi ile birlikte tarihten öğrenilen bir güven puanı ile atılır. Kluster ajanları Core ve Edge'e; Core ajanları önce konsensüse ulaşmalıdır, Edge ajanları takip eder.

### Empirik: "İS ajanları kabul edebilir mi?" (arXiv:2603.01213)

Kağıt, çok sayıda sınır modeli arasında skalar anlaşmayı ölçer (LLM ajanları tek bir sayısal değer üzerinde anlaşırlar).

- Hiç bir rakip olmamasına rağmen, LLM ajanları birçok referans değerinde %30'dan fazla oranlarda ölçekli sorular konusunda anlaşmazlık yaşıyor.
- Yalancı bir karakter edinen tek bir ajan, karışım ajanları konsensusunu dürüst bir başlangıç çizgisinden %40'dan fazla çıkarabilir.
- Anlaşmazlık oranları model çeşitliliği ile ilişkili  heterogen gruplar homogen gruplardan daha fazla anlaşmazlıkta (iyi: ilişkili olmayan hatalar), ancak aynı zamanda daha yavaş hareket etmektedir (kötü: daha uzun anlaşma süresi).

BFT, çıkışları uyumlandırmak için bir makine sağlar, ancak uyumlu çıkışın doğru olup olmadığını söylemez.

### Ana protokol, çıkarıldı

LLM temsilcileri için en az BFT turları:

```
1. task arrives; each agent i produces answer a_i
2. each agent attaches confidence probe c_i in [0, 1]
3. aggregator collects (a_i, c_i) from all n agents
4. aggregator groups by semantic cluster (equivalent answers)
5. aggregator computes weight for each cluster C:
     w(C) = sum_{i in C} c_i
6. winner = cluster with max weight, if max > threshold * sum(c_i)
   else: retry or escalate
7. minority clusters logged with provenance for post-hoc audit
```

Semantik gruplama adımı LLM-specifik dönüştürülür. İki cevap "kağıt raporları 4.2%" ve "4.2% iyileşme" aynı gruplama.

### Sınır ayarlama

- Evet .`threshold`Bu, bir diğer yöntemi de gösterir. Bu, bir diğer yöntemi de gösterir.`n=5-7`Daha küçükleri için daha yüksek.`n`Bir eşiğin altında, insan veya başka bir ajan grubuna tırman.

### Anlaşmanın yardımı olmazsa

- **Ambiguous questions.**Eğer sorunun temel bir gerçeği yoksa, konsensus bir fikirdir.
- **Compound questions.**"Kodu yaz ve açıkla"  iki cevap.
- **Adversarial multi-round.**Eğer ajanlar önceki turları gözlemleyebilir ve taklit edebilirlerse (Du 2023 tartışması), gerçekten bağımsız olarak birbirleriyle anlaşmaya başlarlar.

```figure
swarm-consensus-wave
```

## Yapın

`code/main.py`Uygulamaları:

- `AgentVoter` ( yanıt, güven) ile ilgili bir politika.
- `MajorityVote` klasik çoğulluk.
- `CPWBFT` semantik gruplama ile güven ağırlığıyla oylama.
- `DecentLLMs` puanlanmış öneriler üzerinde geometrik-medyen birleştirme.
- `Scenario` her birleştiricisi üç saldırı kalıbı altında çalışır.

Uygulama şekilleri:

1. `byzantine`Bir ajan yüksek güvenle yalan söylüyor.
2. `sycophancy`Bir ajan ilk gördüğü cevabı eşleşen güvenle kopyalar.
3. `monoculture`: üç temsilci orta derecede güvenle yanlış bir cevap (tümleşen hata) paylaşır.

Çık:

```
python3 code/main.py
npx tsx code/main.ts
```

Beklenen çıkış: bir tablo (saldırı, toplayıcı) -> son cevap, doğru cevap belirtildi. Plurality monoculture durumunu başarısız. CPWBFT'nin güven ağırlığı sikofansayı azaltır. DecentLLMs'in geometrik-medyanı monoculture nüfusun yarısından daha az olduğu zaman dürüst kümelere doğru çekilir.

## Kullan

`outputs/skill-consensus-designer.md`Çoklu ajanlar için bir konsensus protokolü tasarlıyor: gruplama yöntemi, ağırlıklandırma, eğim ve alt eğim döngüleri için tırmanma politikası.

## Gönder

Bir konsensüse sahip olmak için herhangi bir mekanizma göndermeden önce:

- **Attack-test with at least the three patterns**Protokolünüz, sessizce değil, öngörülebilir bir şekilde başarısız olmalı.
- **Log every minority cluster**Azınlık grupları, ilişkili hatalar için erken uyarı sisteminiz.
- **Enforce bounded rounds.**"Bir anlaşmaya varana kadar tartışmaya devam etmemek"  bu da bir şımarıklık ödülünü verir.
- **Separate agreement from correctness.**Konsens çıkışı bir doğrulayıcıya gider; doğrulayıcı ansambldan bağımsızdır.
- **Monitor the agreement rate.**Keskin bir yükseliş uyum kayıpları anlamına gelir; keskin bir düşüş model sürüklenmesi anlamına gelir.

## Egzersizler

1. Çık .`code/main.py`. Pluraliğin onaylanması monokultüre saldırıya başarısız olur ancak CPWBFT monokultüre güveninin 0.7'den aşağı olduğu zaman kısmen hafifletiyor.
2. Dördüncü saldırı kalıbını ekle:**silent abstention** bir temsilci cevap vermeyi reddeder ("Bilmiyorum").
3. İpuç kanonikleştirmesinden semantik gruplamaları yerleştirme-benzemeye değiştirin (herhangi bir açık kaynaklı yerleştirme modeli kullanın).
4. CP-WBFT (arXiv:2511.10400) okuyun. Güvenli-sonde kalibrasyon adımını uygulayın (her bir ajanın kendi kendine bildirilen güvenini ayrı bir kalibrasyon modeli kontrol eder). Monoculture senaryosunda doğruluk kazanımını ölçün.
5. "AI Ajanları Anlaşabilir mi?" (arXiv:2603.01213) okuyun. Basitleştirilmiş bir skalar anlaşma deneyini yeniden üretin: üç ajan, bir skalar soru, aldatıcı kişi sorusu. CPWBFT veya DecentLLMs yakalar mı?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| BFT | "Byzantine fault tolerance" | Castro-Liskov 1999 protocol for consensus with `f < n/3` arbitrary faults. |
| Byzantine | "Any bad behavior" | A node that can lie, drop messages, fail silently — anything but crash safely. |
| Confidence probe | "How sure are you?" | Self-reported or calibrator-predicted probability attached to a vote. |
| Semantic clustering | "Same answer, different words" | Grouping equivalent answers before counting votes. |
| Geometric median | "Robust center" | The point minimizing sum of distances to sample points. Robust to outliers, unlike the mean. |
| Monoculture | "Same model, same failures" | Correlated errors when agents share training data or base model. |
| Sycophantic conformity | "Agreeing with the loud voice" | An agent's vote biases toward whoever spoke first/loudest. |
| Core/Edge | "Hierarchical BFT" | WBFT split: small Core consensus first, Edge nodes follow. Bounds latency. |

## Daha Fazla Okumak

- [Castro & Liskov — Practical Byzantine Fault Tolerance (OSDI 1999)](https://www.usenix.org/conference/osdi-99/practical-byzantine-fault-tolerance) Temel
- [CP-WBFT — Confidence-Probe Weighted BFT](https://arxiv.org/abs/2511.10400) Güvenle oy ağırlığı
- [DecentLLMs — leaderless multi-agent consensus](https://arxiv.org/abs/2507.14928) Geometri-medyen birleştirme
- [WBFT — Weighted BFT with Hierarchical Structure Clustering](https://arxiv.org/abs/2505.05103) Sınırlı gecikme için çekirdek/kırık bölünmesi
- [Can AI Agents Agree?](https://arxiv.org/abs/2603.01213) Skala anlaşması kırılganlığı ve aldatıcı kişi saldırısı
