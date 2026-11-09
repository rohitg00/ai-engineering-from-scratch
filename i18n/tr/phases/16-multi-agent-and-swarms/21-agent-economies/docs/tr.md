# Ajan Ekonomileri, Token Teşvikleri, Ünlüğe

> Uzun vadede otonom ajanlar (METR'nin 1 ila 8 saatlik çalışma eğri) ekonomik ajanlığa ihtiyaç duyar.**5-layer stack**Bu:**DePIN**(fiziksel hesaplama) → **Identity**(W3C DID + itibar sermayesi) → **Cognition**(RAG + MCP) → **Settlement**(Hesaba çekimi) → **Governance**Üretim ajanları teşvik eden ağlar **Bittensor**(TAO alt ağları görev-sözlü modelleri ödüllendirir), **Fetch.ai / ASI Alliance**(ASI-1 Mini LLM + FET token) ve **Gonka**Akademik çalışma: AAMAS 2025'in merkezi olmayan LaMAS kullanımları **Shapley-value credit attribution**Google Research "Büyük dil modelleri için mekanizma tasarımı" önerisini yapar.**token auctions**Bu ders, minimal bir ajan pazarı oluşturur, bir çok ajan boru hattına Shapley değerli kredi atributunu uyguluyor ve ikinci fiyatlı bir token müzayedesi yürütüyor. Böylece oyun teorisi makinesi somut bir şekilde yer alır.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 16 (Negotiation and Bargaining), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## Sorun

Çoklu ajan sistemleri, ajanlar birlikte değer ürettiklerinde karmaşık hale gelir ama bireysel olarak ödüllendirilmelidir. Klasik mekanizmalar  eşit bölünme, son katılımcı-her şeyi alır  haksız veya oyun oynanabilir. Shapley değerleri üzerinden koalisyon tabanlı ödüller inşaat açısından adil ama hesaplamak pahalıdır. 2025-2026 literatürü yararlı yaklaşımları teşvik ediyor: Shapley örneği, monoton birleştirme müzayedeleri ve onaylanmış katkılardan kaynaklanan zincir üzerindeki itibar.

Kredi atributundan öte, alan gerçek ekonomik ajanlara dönüştü: Bittensor TAO madencilik hesaplamalarını alt ağ-sözlü modeller için ince ayarlamalar için ödüllendirir, Fetch.ai/ASI ASI-1 Mini LLM kullanımını FET jetonlarıyla ödüllendirir, Gonka üretken AI görevlerine dönüştürücü iş kanıtı yeniden dağıtır.

Bu ders ajan ekonomileri belirli bir sorun ailesi olarak ele alıyor  kredi atributu, mekanizma tasarımı ve itibar  ve her birini en az matematikle inşa ediyor, böylece fikirler kalır.

## Anlam

### Beş katmanlı ajan-ekonomik yığın

1. **DePIN (physical compute).**GPU, depolama, bant genişliği kiralayan merkezi olmayan alt altyapı, Bittensor alt ağları, Render ağı, Akash.
2. **Identity.**W3C Merkezi tanımlayıcıları (DID) her ajanı herhangi bir platformdan bağımsız olarak kalıcı bir kimlik sağlar. İsimlilik DID'ye gelir. Agent Ağ Protokolü (ANP) keşif katmanı olarak DID'yi kullanır.
3. **Cognition.**Ajanın akıl yürütme döngüsü: LLM + RAG + MCP. Diğer aşamalar da bu şekilde oluşur.
4. **Settlement.**Hesap soyutlama (ERC-4337) ajanların ETH'i tutmadan kendi bakiyelerinden gaz ödemelerini sağlar.
5. **Governance.**Ajantik DAO: İnsanların * ve * ajanların protokola yapılan değişiklikler hakkında oy verdiği yönetim yapıları, oy verme gücü itibarla bağlıdır.

Her üretim sistemi beşini kullanmaz. Bittensor 1, 2, kısmen 3, kısmen 4, hiçbirini kullanmaz. OpenAI ajanları 3. dışında hiçbirini kullanmaz.

### Bittensor, Fetch.ai, Gonka  ne çalışıyor

**Bittensor (TAO).**Alt ağlar, özel görevlerdir (dilli modellerleme, görüntü oluşturma, tahminler). Madenciler model çıkışlarını gönderir. Validatörler onları sıralar; pay ağırlıklı puanlama TAO ödüllerini dağıtır. Her alt ağın kendi değerlendirme vardır. Ekonomik ders: görev spesifik çıkış kalitesi için ödeme, kullanılan hesaplama değil.

**Fetch.ai / ASI Alliance.**ASI-1 Mini LLM Fetch.ai'nin ağında çalışır; kullanıcılar sonuç çıkarmak için FET tokenlerini ödüyor.

**Gonka.**Transformer proof-of-work: "iş" bir transformatörün ileri geçişleri. Minerler doğru çıkışları (öğretim verilerinden) bildikleri çıkarım görevlerini çalıştırarak kazanırlar.

Üçü de Nisan 2026 itibariyle üretim derecesindedir. Ödeme dağılımları farklıdır. Bittensor alt ağ onaylayıcılarına göre kaliteli ödüller verir; Ödeme yapan kullanıcılar tarafından ölçülen Fetch ödülleri kullanımı; Gonka ödülleri doğrulanabilir sonuç çalışmaları.

### Shapley değeri kredi atributı

Üç ajan bir görev için işbirliği yapıyor.

Shapley değeri: dört aksiomu (verimlilik, simetri, doğrusallık, sıfır) karşılayan eşsiz kredi tahsisidir.`i`- ...

```
shapley(i) = (1/N!) * sum over all orderings O of (v(S_i_O ∪ {i}) - v(S_i_O))
```

nerede`S_i_O`önce ajanların bir dizi `i`Düzenleyici olarak `O`. Pratikte: tüm permutasyonları sayın, her permutasyonda her ajanın sınırlı katkılarını kaydetin, ortalama.

N=3 ajanları için 6 permutasyon vardır. N=10, 3.6M  için, pratikte saymak yerine örneği örnektir.

### Toplantı için ikinci fiyat açık artırması

Google Research ("Büyük dil modelleri için mekanizma tasarımı") LLM ürünlerini toplamak için ikinci fiyatlı token müzayedelerini önerir. Kurulum: N ajan her biri bir tamamlama önerisi; seçilmek için her birinin özel bir değeri vardır. Satışçı en yüksek değerli teklifi seçer ve *ekincisi* en yüksek değerini öder. Monoton birleştirme altında (değer hangi teklif seçildiğine bağlıdır, kaç teklif edildiğine değil), bu doğru  ajanlar gerçek değerlerini teklif ediyor.

LLM sistemleri için bu neden önemlidir: tamamlama görevlerini farklı fiyatlarla birden fazla ajanlara dışa tıraş edebilirsiniz; açık artırma en iyiyi seçer + adil ödeme yapar ve ajanların yanlış rapor vermeye teşvikleri yoktur.

### İsimlik sermayesi

DID'ye bağlı bir itibar puanı onaylanmış katkılardan biriktirilmiştir.

```math
\text{rep}(i, t+1) = \alpha \cdot \text{rep}(i, t) + (1 - \alpha) \cdot \text{contribution\_quality}(i, t)
```

Çürüme faktörü ile`alpha`1. Ünlü:

- Yol kararları için okumak ucuz ("çık işleri yüksek replik ajanlarına gönder").
- DID'ye bağlı olarak zamanla biriktirilen (türklenmesi pahalı).
- Kısaltılabilir: doğrulama başarısız olan katkıları çıkar.

### AAMAS 2025 merkezi olmayan LAMAS

LaMAS önerisi (AAMAS 2025): DID kimliği, Shapley değeri kredi atributasyonu ve basit bir açıklama mekanizmasını birleştirir. Ana iddia: kredi atributasyonu aşamasını merkezileştirmek sistemi denetlenebilir ve tek nokta manipülasyonuna bağışık hale getirir.

### Ekonomik çöküşleri

- **Price oracle manipulation.**Kredi fonksiyonu oynanabilirse, ajanlar oynayacak.
- **Sybil attacks.**Bir operatör kendi katkılarını arttırmak için N sahte ajanları devreye sokar. DID'ler yavaş ama bunu durdurmaz; ün kazandırması ise bu kadar büyük bir zarardan ibarettir.
- **Verification cost.**Kredi tahsis edilmesi sadece doğrulayıcı kadar adildir. Eğer doğrulama ucuzsa (küçük LLM), oyun oynanabilir; eğer pahalısa (insan paneli), sistem ölçeklenmez.
- **Regulatory overhang.**Agent ekonomileri finansal düzenleme ile kesişmektedir. Bittensor, Fetch ve Gonka, 2026 yılından itibaren bazı yargı bölgelerinde yasal gri bölgelerde faaliyet göstermektedir.

### Agent ekonomileri anlamlı olduğunda

- **Open networks with heterogeneous operators.**Tek bir ekip tüm ajanları kontrol edemez.
- **Verifiable outputs.**Doğrulama olmadan kredi atributı bir tahmin.
- **Long-horizon workflows.**Tek seferlik görevler itibar birikimiyle yararlanmaz.
- **Tokenized payments are legally viable**Yurtdışınızdaki.

Kapalı kurumsal sistemlerde, ekonomi daha basit tahsislere yer verir (menyerler işyi atarlar, ölçümler içindir).

```figure
swarm-auction
```

## Yapın

`code/main.py`Uygulamaları:

- `shapley(value_fn, agents)` küçük N için sayımla Shapley'nin tam hesaplaması.
- `second_price_auction(bids)` doğru bir mekanizma; kazanan ikinci en yüksek ödemeyi yapar.
- `Reputation` Eksponansiyel çöküş ve kesimlerle DID- bağlanmış bir ün.
- Demo 1: üç ajan işbirliği yaparak, Shapley'in tam olarak krediyi gösterdi.
- Demo 2: Beş ajan bir görev boşluğu için teklif; ikinci ödül açık artırması kazananı + ödemeyi seçer.
- Demo 3: 100 adet heterogen temsilci olan ajanlara görev verimi; rep ağırlıklı yönlendirme rastgele çarpıyor.

Çık:

```
python3 code/main.py
npx tsx code/main.ts
```

Beklenen çıkış: Her ajan için Shapley değerleri; açıklama sonucu doğru teklif dengesini gösterir; tekrar ağırlanan yönlendirme, ısınmadan sonra rastgele karşı 10-20% kalite kazancı gösterir.

## Kullan

`outputs/skill-economy-designer.md`Asgari bir ajan ekonomisini tasarlıyor: kimlik katmanının seçimi, kredi tahsis mekanizması, ödeme mekanizması, itibar kuralları.

## Gönder

2026'da bir ajan ekonomisi yönetmek:

- **Start with reputation, not tokens.**Ünlü bir ün geliştirmek ucuz ve tek başına değerlidir; tokenler yasal ve ekonomik karmaşıklığa katkıda bulunur.
- **Verify before you reward.**Kendiliğinden bildirilen kalite, sybil oyunları kazanır.
- **Shapley-sample, not Shapley-exact.**Örnek 100-1000 sipariş; tam sayım ölçeklenmez.
- **Cap decay factor and floor reputation.**Sınırsız çürümüşlük meşru katkıda bulunanları siler; çok yavaş çürümüşlük ödülleri eski yüksek rep ajanları.
- **Audit mechanisms adversarially.**Her mekanizmanın bir oyun teorisi vardır; saldırganları değil, delikleri bulmak istiyorsunuz.

## Egzersizler

1. Çık .`code/main.py`Shapley değerlerinin toplam değerine (verimlilik aksiyomı) doğrulamasını onaylayın. Değer fonksiyonunu değiştirin; Shapley tahsisleri beklenen yönde değişir mi?
2. Shapley *sampling* uygulaması (Monte Carlo'nun K sıralamaları üzerinde). K'nin yaklaşım doğruluğuna nasıl etkisi olur?
3. Satışa kadar koalisyon oluşturma adımını uygulayın: ajanlar takımlara birleşip bir birim olarak teklif verebilir. Hangi koalisyonlar oluşur?
4. Google Araştırma mekanizma tasarımını okuyun. Eğer ihlal edilirse doğruluğu kırırsa bir varsayım tanımlayın. LLM ortamında bu başarısızlık modunun nasıl görüneceği?
5. AAMAS 2025 merkezi olmayan LaMAS makalesini okuyun. Sintez bir görevde Shapley'nin 10 ajanın üzerinde adımını uygulayın. Tam hesaplama ne kadar sürer? 100 çekim ile örnekleme ne kadar yakındır?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| DePIN | "Decentralized physical infrastructure" | Token-incentivized compute/storage/bandwidth. Bittensor, Akash, Render. |
| DID | "Decentralized identifier" | W3C spec for portable IDs. Agent reputation binds to DID, not to a platform. |
| ERC-4337 | "Account abstraction" | Contract accounts that can sponsor gas, enabling agent payments. |
| Shapley value | "Fair credit attribution" | Unique allocation satisfying efficiency, symmetry, linearity, null. |
| Second-price auction | "Vickrey auction" | Truthful mechanism: winner pays second-highest bid. Monotone aggregation compatible. |
| Reputation capital | "Accumulated quality score" | DID-bound score from confirmed contributions; decays over time. |
| Agentic DAO | "Agents + humans govern" | DAO with agent voters as first-class, voting power tied to reputation. |
| TAO / FET / GPU credits | "Token denominations" | Bittensor TAO, Fetch.ai FET, various DePIN tokens. |

## Daha Fazla Okumak

- [The Agent Economy](https://arxiv.org/abs/2602.14219) 5 katmanlı ajan-ekonomik yığının 2026 tarihli araştırması
- [Google Research — Mechanism design for large language models](https://research.google/blog/mechanism-design-for-large-language-models/) Monoton birleştirme ile simgesel açık artırmalar
- [AAMAS 2025 — decentralized LaMAS](https://www.ifaamas.org/Proceedings/aamas2025/pdfs/p2896.pdf) Shapley değeri kredi atributı
- [Bittensor TAO documentation](https://docs.bittensor.com/) Alt ağ yapısı ve ödül dağılımı
- [Fetch.ai / ASI Alliance](https://fetch.ai/) ASI-1 Mini LLM ve FET token
- [W3C Decentralized Identifiers (DIDs) spec](https://www.w3.org/TR/did-core/) Kimlik Temel
