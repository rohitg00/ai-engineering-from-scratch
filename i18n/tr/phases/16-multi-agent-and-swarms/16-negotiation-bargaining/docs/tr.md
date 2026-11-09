# Tartışmalar ve pazarlıklar

> Agentler kaynakları, fiyatları, görev tahsislerini ve şartları müzakere eder. 2026 referans göstergesi açık: müzakere alanı (arXiv:2402.05863) LLM'lerin kişi manipülasyonu ("ümitsizlik" yoluyla ödemeyi %20'lik bir artış sağlayabileceğini gösterir; "Bordaj yeteneklerini ölçmek" (arXiv:2402.15813) alıcıyı satandan daha zor olduğunu ve ölçekleri  onlara yardımcı olmadığını gösterir.**OG-Narrator**(deterministik teklif üreticisi + LLM anlatıcısı) anlaşma oranını 26.67%'den 88.88%'ye yükseltti; Büyük ölçekli özerk müzakere yarışması (arXiv:2503.06416) yaklaşık 180k müzakere gerçekleştirdi ve buldu ki**chain-of-thought-concealing**Bhattacharya et al. 2025 Harvard müzakere projesi ölçümleri üzerinde Llama-3 en etkili, Claude-3 agresif, GPT-4 en adil sıralanmış. Bu ders Sözleşme Net Protokolü (FIPA ataları, Ders 02), LLM tarzı bir alıcı / satıcı tel, OG-Narrator tarzı bir parçalanma yürütür ve her yapısal seçimle nasıl anlaşma oranı değişir ölçüyor.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 02 (FIPA-ACL Heritage), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## Sorun

İki ajan bir fiyat konusunda anlaşmak zorunda. saf dil istekleriyle kendileri için bırakılan 2024-2026 LLM'ler şaşırtıcı derecede düşük oranlarda (ArXiv'de sıkı parametreli pazarlıklarda ~27%) anlaşmalar kapatır.

LLM'lerin iki işi birleştirmesidir  teklif karar vermesi ve teklif anlatması. OG-Narrator bunları ayırmıştır: bir belirleyici teklif jeneratörü sayısal hareketleri hesaplar; LLM sadece anlatır.

Bu, klasik bir çok ajan bulguyu yansıtır: mekanizmayı iletişim katmanından ayırmak kazanır. Sözleşme Ağ Protokolü (FIPA, 1996; Smith, 1980) referans görev piyasası mekanizmasıdır.

## Anlam

### Sözleşme Net, bir paragraf

Smith'in 1980'deki Sözleşme Net Protokolü:**manager**yayımlar a **call for proposals (cfp)**- ...**bidders**Cevap ver .**propose**tekliflerini içeren mesajlar; yöneticisi bir kazananı seçip gönderir **accept-proposal**Kazananın ve**reject-proposal**Kazanan işi yapar.**refuse**FIPA bunu şöyle kodlaştırdı:`fipa-contract-net`etkileşim protokolü.

### Neden OG-Narrator kazanıyor?

"Dil Modellerinin Tartışma Yeteneğini Ölçmek" (arXiv:2402.15813) şunları belirtti:

- LLM'ler genellikle pazarlık kurallarını çiğnerler (makasız fiyatlara teklif, karşı tarafın ZOPA'sını görmezden gel).
- Kötü şekilde demirlenirler (kötü ilk teklifleri kabul ederler; stratejik değil sembolik miktarlarda karşı teklifler).
- Büyük modeller benzer stratejik hatalarla daha makul bir dil oluşturur.

OG-Narrator'ın parçalanması:

```
           ┌──────────────────┐        ┌──────────────────┐
  state  → │ offer generator  │ price → │  LLM narrator    │ → message
           │  (deterministic) │        │  (writes the     │
           │                  │        │   human-style    │
           └──────────────────┘        │   accompaniment) │
                                       └──────────────────┘
```

Teklif üreticisi klasik bir müzakereler stratejisi: Rubinstein pazarlama modeli, Zeuthen stratejisi veya basit bir fiyat karşılığı. LLM anlatır. Mesaj belirleyici fiyatı ve doğal dil çerçevesini içerir.

İşletme oranı artıyor çünkü:
- Fiyatlar pazarlık bölgesinde kalır.
- Anchorlar stratejik, duygusal değil.
- Yüksek Lisans, iyi olan şeyi yapar: yazmayı.

### Aren'de yapılan görüşmeler

ArXiv:2402.05863 kanonik referans değerini sunar.

- LLM'ler, personaları benimseyerek ödemeyi %20'e iyileştirebilir ("Cüman günü bu satmayı umutsuzluğa düşüyorum")  persona manipülasyonu gerçek bir taktiktir.
- Adaletli/kooperatif ajanlar, karşı taraflı kişiler tarafından sömürülür; savunma açıkça karşı duruş gerektirir.
- Simetrik çiftleşmeler, referans senaryolarının yaklaşık %40'ında eşitsiz sonuçlara doğru yaklaşıyor.

Bu "LLM'ler kötü müzakereci" değil. "LLM'ler, sömürülebilir kısımları da dahil olmak üzere, insanlar gibi çok fazla müzakere ediyor".

### Düşünce zinciri gizlenmesi

Büyük ölçekli özerk müzakere yarışması (arXiv:2503.06416) birçok LLM stratejisi boyunca yaklaşık 180 bin müzakere gerçekleştirdi.

- Eğer bir ajan "Ben sadece gideceğim" yazdırırsa$75; my reservation price is $70"'lik bir çizik çubuğuna, karşısının okuduğu.
- Kazananlar stratejiyi özel olarak hesaplar; çıkış kanalı sadece teklif ve minimum gereksinimli anlatımı içerir.

Bu, klasik oyun teorisinin 2026'daki yankısıdır (Aumann 1976 akılcılık ve bilgi üzerine): özel değerlendirme maliyetlerini ödemenizi ortaya çıkarmak. LLM'ler bunu sezgisel olarak fark etmez ve mutlulukla karşılığı için görünür hale gelen mantık izlerinde özürlerini yazırlar.

Mühendislik götürme: özel-scrappad bağlamını kamu mesaj bağlamından ayırmak.

### Bhattacharya et al. 2025  model sıralamaları

Harvard müzakere projesi ölçümleri (elçipe müzakere, BATNA saygısı, çıkar karşılıklılığı):

- **Llama-3**En etkili olan pazarlık (işleme oranı + ödeme) oldu.
- **Claude-3**En agresif müzakerelerden biriydi (yüksek demir, geç uzlaşma).
- **GPT-4**en adil (parlamalar arasındaki ödeme farkında en küçük fark)

Bu 2025 anında bir anlık fotoğraf. Konu Nisan 2026'da hangi model kazanacağı değil.  farklı temel modellerin sürekli müzakere tarzları olmasıdır. Heterogene ensembler (Düşünme 15) bunu çeşitlilik kaynağı olarak içerir.

### Sözleşme Net + LLM üzerinden görev dağılımı

LLM çoklu ajan için Contract Net'in modern yeniden kullanımı:

1. Yönetim ajanı bir görevi birimlere ayırır.
2. Yayınlar `cfp`İşçi ajanlarına görev tanımı ile.
3. Her işçi bir teklif gönderir: `(price, eta, confidence)`Fiyatı token, hesap ünitesi veya dolar olabilir.
4. Yöneticiler kazananları (işlerine bağlı olarak tek veya birden fazla) ve ödülleri seçer.
5. reddedilen işçiler başka görevlere teklif verebilirler.

Bu, 100 işçinin üzerinde uzanır çünkü koordinasyon yayın ve cevaplama, senkroni sohbet değil.

### LLM-Stakeholders Interactive Negotiation

NeurIPS 2024 (https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) çoklu oyunculuk oyunlarını **secret scores**ve **minimum-acceptance thresholds**. Her paydaşın özel hizmetleri vardır; LLM bunları mesajlardan çıkarmalıdır. Bu, iki taraflı pazarlamanın N-partiya koalisyon oluşumuna genelleştirilmesidir.

### Hikaye-mexanizm kuralı

2024-2026 müzakerelerinin tüm referans kriterleri boyunca, tutarlı mühendislik kuralı:

> LLM'nin teklifini hesaplamasına izin vermeyin.

Teklif bir sayı ( fiyat, ETA, miktar) olması gerekiyorsa, onu müzakere durumundan belirleyici olarak oluşturun ve LLM'nin çerçevelemeyi üretmesini sağlayın. Teklif bir teklif yapısı (iş parçalanması, rol atama) olması gerekiyorsa, LLM'nin onu hazırlamasına izin verin, ancak göndermeden önce bir şema ve zorluk kontrolüne göre onaylayın.

```figure
a5-og-narrator
```

## Yapın

`code/main.py`Uygulamaları:

- `ContractNetManager`- Evet .`ContractNetTask`- Evet .`Bid` yöneticiler + teklif verenler, yayın cfp, teklif toplama, ödül.
- `og_narrator_bargain(state, rng)` OG-Narrator alıcı: Deterministik Zeuthen tarzı orta noktaya doğru koncession.
- `seller_response(state, rng)` Deterministik satıcı karşı teklif politikası (ereki stil için yapısal temel gerçeklik).
- `naive_llm_bargain(state, rng)` tüm LLM pazarlamacılarını simüle eder: genellikle ZOPA dışında yüksek farklı fiyatlar seçer.
- Ölçüm: 1000 deneme üzerinde işlem oranı, test başına örnek alınan taze rezervasyon fiyatları ile.

Çık:

```
python3 code/main.py
npx tsx code/main.ts
```

Beklenen çıkış: naif-LLM anlaşma oranı ~65-75%; OG-Narrator anlaşma oranı ~85-95%; 15-25 puan farkı anlatmadan teklif neslini parçalanmanın yapısal avantajıdır.

## Kullan

`outputs/skill-bargainer-designer.md`Bir pazarlama protokolü tasarlıyor: kim teklifler üretir (deterministik veya LLM), kim anlatır, özel kırıntı çubuğunun kamu mesajlarından nasıl ayrıldığı ve pazarlama oranının nasıl izlendiği.

## Gönder

Üretim pazarlık kontrol listesini:

- **Separate scratchpad.**Özel devlet asla karşı tarafın bağlamına ulaşmaz.
- **Deterministic offer generation.**Fiyatlar, miktarlar, ETA'lar: hesaplayın, istek vermeyin.
- **Validate all incoming offers**Protokol sınırında,ZOPA'dan çıkmış teklifleri reddet.
- **Bound rounds.**3-5 mermi maksimum; duraklama durumunda aracıya yüksel.
- **Measure deal rate and payoff variance**Düşen bir anlaşma oranı bir semptomdur  genellikle hızlı bir sürüş veya karşı taraflı bir saldırı.
- **Log all rejected proposals**Sözleşme ağları yöneticileri için, kaybeden teklif verenlerin nedenini anlaması gerekir.

## Egzersizler

1. Çık .`code/main.py`OG-Narrator'un anlaşma oranında naif bir LLM'den daha iyi olduğunu doğrulayın.
2. Uygulama**persona-based payoff improvement**Satın almacı sadece anlatımda "Bu hafta satın almak için umutsuz" karakterini benimseyerek, değişmeyen bir jeneratör sunuyor.
3. Düşünce zincirini uygula **concealment**Bu nedenle, bir kişiye ait olan bir şey, bir kişiye ait olan bir şey değil, bir kişiye ait olan bir şey.
4. Tasarruf fiyatı rezervi olan N-biyer açık artırmasına kadar uzatın. Tüm teklifler rezervi aşırınca, yöneticiler en düşük fiyat ile en yüksek kalitede arasında nasıl karar verirler? Hangi ödül kuralını seçersiniz ve neden?
5. Bhattacharya et al. 2025'i Harvard müzakere projesi ölçümleri üzerine okuyun. Farklı stiller (agresif vs adil) ile iki pazarlamacı uygulayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Contract Net | "Task market" | Smith 1980, FIPA 1996. cfp + propose + accept/reject. The canonical task-market. |
| ZOPA | "Zone of possible agreement" | Overlap between buyer's max and seller's min. Offers outside it cannot close. |
| BATNA | "Best alternative to a negotiated agreement" | Your fallback if this deal fails. Sets your reservation price. |
| OG-Narrator | "Offer generator + narrator" | Decomposition: deterministic offer, LLM narration. |
| Zeuthen strategy | "Risk-minimizing concession" | Classical offer-generator that concedes based on risk limits. |
| Rubinstein bargaining | "Alternating-offer equilibrium" | Game-theoretic model for infinite-horizon bargaining with discounting. |
| CoT concealment | "Hide your reasoning" | Winners in arXiv:2503.06416 kept private scratchpads; public channel shows offer only. |
| Persona manipulation | "Emotional posturing" | arXiv:2402.05863: ~20% payoff gain from desperation/urgency personas. |

## Daha Fazla Okumak

- [NegotiationArena](https://arxiv.org/abs/2402.05863) referans değer; kişi manipülasyonu ve sömürü bulguları
- [Measuring Bargaining Abilities of Language Models](https://arxiv.org/abs/2402.15813) OG-Narrator ve alıcı-satıcı-kısıtlayıcı sonucu
- [Large-Scale Autonomous Negotiation Competition](https://arxiv.org/abs/2503.06416) ~ 180k müzakereler; düşünce zinciri gizleme kazanır
- [LLM-Stakeholders Interactive Negotiation (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf)Gizli araçlarla çoklu oyunculuk oyunları
- [Smith 1980 — The Contract Net Protocol](https://ieeexplore.ieee.org/document/1675516) Klasik mekanizma, IEEE işlemleri bilgisayarlar
