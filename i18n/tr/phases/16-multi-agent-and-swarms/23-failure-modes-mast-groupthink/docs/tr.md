# Başarısızlık Modu  MAST, Grup Düşüncesi, Monoculture, Kaskadör Hatalar

> 2026 için referans taksonomisi **MAST**(Cemri et al., NeurIPS 2025, arXiv:2503.13657), 7 en son açık kaynaklı MAS'ın gösterdiği 1642 yürütme izinden elde edilmiştir.**41–86.7% failure rate**. Üç kök kategorisi: **Specification Problems**(41.77%)  rol belirsizliği, belirsiz görev tanımları; **Coordination Failures**(36.94%)  iletişim bozuklukları, durum sinkronsuzluğu; **Verification Gaps**(%21,30),  geçerliliğin eksikliği, kalite kontrollerinin eksikliği.**Groupthink**aile (arXiv:2508.05687) ekler: monoculture çöküşü (eşit temel model → ilişkili başarısızlıklar), uyum önyargısı (ajanlar birbirlerinin hatalarını güçlendirir), eksik zihin teorisi, karışık motive dinamikleri, kaskadaki güvenilirlik başarısızlıkları. Kaskadal örnek: bir ödeme başarısızlığı, stok servisini (10 saniyelik yük 10x  devrim kesicilerine ihtiyaç duyan stok servisini zorlayan stok tekrar denemelerini tetikleyen yeniden deneme fırtınaları). Hatıra zehirlenmesi: Bir ajanın halüsinasyonu ortak hafıza içine girer, aşağıdaki ajanlar bunu gerçek olarak ele alır; doğruluk yavaş yavaş bozulur, kök neden teşhisini ağrılı hale getirir.**STRATUS**(NeurIPS 2025) uzman teşhis / teşhis / doğrulama ajanları aracılığıyla hafifleme-başarılığın 1,5 katı iyileştirilmesini bildirir. Bu ders başarısızlık modlarını birinci sınıf mühendislik hedefleri olarak ele alır.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 13 (Shared Memory), Phase 16 · 14 (Consensus and BFT), Phase 16 · 15 (Voting and Debate Topology)
**Time:** ~75 minutes

## Sorun

Çoklu ajanlı sistemler gerçek görevlerde %41-86,7'de başarısız olur (Cemri et al. 2025 bunu 7 açık kaynaklı MAS'da ölçtü). Bu "sadece daha fazla ajan ekleyerek" hata çözülebilir değildir.

2026 üretim uygulaması, başarısızlık modlarını tasarım girişleri olarak görmektir. Her MAST kategorisine işaret edip dağıtmadığınız hafiflemeyi adaya kadar mimarlığınız "yeterince iyi" değildir.

## Anlam

### MAST kategorileri

**Specification Problems (41.77% of failures).**Ajanın görevi yeterince sıkı tanımlanmamıştı.

- Rol belirsizlikleri: iki ajan ikisinin de eleştirmen olduklarını düşünüyor.
- Görev aşağıda belirtildi: "bunu özetle" kullanıcı belirli bir açı istediğinde.
- Başarılılık kriterleri iç içindir: ajan başarılı olup olmadığını söyleyemez.

Yumuşak başlılık:
- Her ajanın uyarısı ne yaptığını * ne yapmadığını* belirtir.
- Görev başına kabul testi.Agent başlamadan önce "Yapılmış X gibi görünüyor" tanımlamasını yap.
- Uçuş öncesi özellik kontrolü: ayrı bir ajan görev tanımını göndermeden önce gözden geçirir.

**Coordination Failures (36.94%).**İletişim veya durum bozukluğu.

Örnekler:
- İki ajan, eşzamanlama olmadan paylaşılan durumu güncelleyebilir.
- Ajanlar arasında kayıp mesaj (kuyruk başarısızlığı, zaman sonluğu).
- Devlet sürüşü: A ajanı görevin tamamlandığını düşünüyor; B ajanı hala işlemi yapıyor.

Yumuşak başlılık:
- Optimistik bir eşzamanlılık ile versiyon paylaşım durumu.
- Kritik mesajların açık tanınması (acked olana kadar tekrar çalışın).
- Devamlı devlet senkronizasyonu kontrol noktaları; sürüklemeyi erken tespit edin.

**Verification Gaps (21.30%).**Dışarı çıkışları bağımsız olarak kontrol edilmiyor.

Örnekler:
- Bir ajan başarıyı iddia ediyor; kimse doğruluyor.
- Ajanlar zinciri her biri öncülerin çıkışına güveniyor.
- Yeni gelişen kompozisyon davranışında eksik olan test kapsamı.

Yumuşak başlılık:
- Bağımsız doğrulayıcı ajanı (Deneyim 13). Sadece okunur, bağımsız kaynak erişimi.
- Açık bir teslimat sözleşmesi: "A'nın çıkışı B başlamadan önce C kontrolünü geçmelidir".
- Post-hoc analizi için sonuç kayıtları.

### Grup düşüncesi ailesi (arXiv:2508.05687)

Ajanların birbirlerini homogenizasyon veya taklit etmesinde ilgili beş başarısızlık:

**Monoculture collapse.**Aynı temel model veya eğitim verileri → ilişkili hatalar.

**Conformity bias.**Ajanlar hata yaptıkları zaman bile en yüksek sesli veya en güvenli yaşıtlarına uyum sağlıyor.

**Deficient ToM.**Ajanlar birbirlerinin inançlarını örnek almazlar; koordinasyon bozulur (Denevi 18).

**Mixed-motive dynamics.**Etkililerin partiyel olarak uyarıları, kimseyi tatmin etmeyen uzlaşma ortalarına doğru ilerler.

**Cascading reliability failures.**Bir bileşenin hata örneği bağımlı bileşenlerde hata örneğini tetikler.

### Kaskadör örnek  yeniden deneme fırtınası

Klasik bir 2026 olay modeli:

```
payment service fails 10% of requests
   ↓
order agent retries payment (exponential backoff but naive)
   ↓
each retry is a new order-inventory check
   ↓
inventory service sees 2x normal load
   ↓
inventory service starts timing out
   ↓
every order retries inventory check
   ↓
inventory service sees 10x normal load
   ↓
cluster goes down
```

Bu klasik bir çözüm .**circuit breakers**. Aşağıdaki hata oranı eşiği aşırırsa, önbelleğe alınan veya varsayılan sonuçlarla kısa devre.

Çekilme cihazları, değişikliğe uğramadan dağıtılmış sistemlerden doğrudan ödünç aldığınız birkaç multi-agent başarısızlık azaltma yönteminden biridir.

### Hatıra zehirlenmesi (önce inceleme yapıldı)

Ders 13: Bir ajanın halüsinasyonu ortak hafıza gerçeğine dönüşür; aşağıdaki ajanlar zehirli gerçeği akıl yürütür. MAST terimlerinde, bu ortak hafıza katmanındaki bir doğrulama boşluğu.

Bu hastalığa rastlanmak için yavaş yavaş ilerlemeniz gerekir.

Yumuşak başlılık: Sadece ekleme kayıtları, kaynak, yazılamaz doğrulama.

### STRATUS  Eksikliği tespit etmek için özel ajanlar

STRATUS (NeurIPS 2025) uygulamanızda 1,5 kat daha iyi bir hafifleme başarısı rapor ediyor:

- **Detection agent.**Simptom kalıpları için saatler (yüksek anlaşmazlık, tekrar deneme tırnakları, doğruluk sürüşü).
- **Diagnosis agent.**Simptomları göz önüne alındığında, MAST taksonomisinden olası kök nedenini çıkarır.
- **Validation agent.**Bir hafifleme uygulandıktan sonra, belirtilerin netleştiğini kontrol eder.

Bu SRE tarzında bir olay tepkisi, ajan sistemlerine uygulanır.

### Başarısızlık modunun denetimi

2026'da en iyi uygulama, üç aylık (ve büyük yayınlar için) başarısızlık modunun denetlenmesidir:

1. **Trace sample.**1000'e kadar gerçek idam izini toplayın.
2. **Categorize.**Her iz başarısızlığı için MAST + Groupthink kategorilerine harita yapın.
3. **Compute failure-by-category rate.**Sisteminizde hangi kategoriler baskın?
4. **Rank mitigations.**Hangi çözüm en çok başarısızlığı ortadan kaldırabilir?
5. **Pick 2-3 mitigations.**Uygulama; gelecek çeyrek için yeniden denetim.

Disiplin, belirli seçimlerden daha önemlidir. denetim olmadan, başarısızlıklar gürültüye karışır ve asla sistematik bir şekilde ele alınmaz.

### Sistemler sessizce başarısız olduğunda

En tehlikeli başarısızlık kategorisi sessiz doğruluk başarısızlığıdır. Yüksek sesle başarısız olan bir sistem (bir kaza, istisna, uyarı) izlenebilir. İnanılmaz ama yanlış çıkışlar üreten bir sistem istisna kayıtları ile tespit edilemez. Bu nedenle, verifikasyon boşlukları sayım açısından sadece 21.30% olmasına rağmen, başarısızlık başına en pahalı kategoridir.

Yatırım:
- Örnek tabanlı insan incelemesi.
- Altın veri kümesi gerileme testleri.
- Önemli sonuçları kontrol eden ajanlar arası.

### Başarısızlık vs yavaş başarısızlık

Bazı başarısızlıklar hemen gerçekleşir; bazıları yavaş. Anında başarısızlıklar (zaman sonları, schema eşleşmezliği, yazar hatası) tespit edilmesi ucuz.

2026 mühendislik hareketi: cihaz yavaş başarısızlık proxyleri, görülebilir bir hata olmadan önce sürüklenmeyi yakalayabilmeniz için. Anlaşma hızı, tekrar deneme hızı, çıkış uzunluğu dağılımı ve ardıcıl ajan sürümleri arasındaki düzenleme mesafesi hepsi yararlı proxylerdir.

```figure
a5-retry-cascade
```

## Yapın

`code/main.py`Uygulamaları:

- `FailureTaxonomy` simülasyonlu olayları MAST + Groupthink kategorilerine sınıflandırır.
- `CircuitBreaker` klasik model; hata oranı eşiği aştığında açılır.
- `RetryStormSimulator` kaskadörün başarısızlığını gösterir; devreler kesiciyi açar / kapsar.
- `DetectionAgent` STRATUS tarzında bir senaryo belirti eşleşicisi.

Çık:

```
python3 code/main.py
npx tsx code/main.ts
```

Beklenen üretim:
- Bir devrim kesici olmadan fırtına tekrar denemek: envanter hataları patlar (simülasyon).
- Çekilme cihazı ile: Eğlence sınırında; bozulmuş modda yanıtlar servis edilmektedir.
- Deteksiyon ajanı, örneği işaretler ve MAST kategorisine isimler verir.

## Kullan

`outputs/skill-mast-auditor.md`MAST tarzı bir multi-agent sisteminde başarısızlık modunun denetimi yürütür.

## Gönder

Üretimdeki başarısızlık modunun disiplini:

- **MAST audit per quarter.**Sistemi büyütürken kategoriler değişir.
- **Circuit breakers everywhere.**Her çıkış çağrısı herhangi bir bağımlı hizmet. Öntanımlı açık eşiği %5-10 hata oranı.
- **Golden datasets.**Küçük, kaliteli, el denetimi yapılmış, haftada bir gerileme testi yapılıyor.
- **STRATUS trio.**Deteksiyon + Tanıdıma + Valideci ajanlar üretimi izler. Sadece deteksiyon ajanıyla başlayın; semptomlar gürültülü olduğunda teşhis ekleyin.
- **Failure budget.**Kategoriyalara göre başarısızlık oranı için açık bir SLO.Budjetin fazla olması, bir gemiyi durdurma konuşmasını tetikler.

## Egzersizler

1. Çık .`code/main.py`- Çekici fırtınayı tekrar kontrol eder.
2. A.**slow-failure proxy**: 3 paralel ajan arasında uyum oranı. Keskin düştüğünde uyarı tetikleyin.
3. Cemri et al. (arXiv:2503.13657). 7 MAS sistemlerinden birini seçin ve en büyük 3 başarısızlık kategorisini haritasın.
4. Groupthink kağıdı (arXiv:2508.05687) okuyun.
5. Bildiğiniz belirli bir çok ajanlı sistem için STRATUS tarzı bir tespit-tanıf-tvrayma üçlüğü tasarlayın. Hangi belirtiler tespit izliyor? Hangi hafiflemeleri teşhis önerir? Validasyon nasıl işe yarayacaklarını doğruluyor?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MAST | "The 2026 taxonomy" | Cemri 2025; 3 root categories + 14 sub-types of failures. |
| Specification Problem | "Role ambiguity" | Task or role under-defined; agents do not know what to do. |
| Coordination Failure | "State drift" | Communication or sync breakdown between agents. |
| Verification Gap | "No one checked" | Outputs accepted without independent validation. |
| Groupthink family | "Homogeneity failures" | Monoculture, conformity, deficient ToM, mixed-motive, cascading. |
| Monoculture collapse | "Same model, same hallucinations" | Correlated errors from shared base model or training data. |
| Retry storm | "Cascading error amplification" | One failure triggers retries which amplify load downstream. |
| Circuit breaker | "Fail fast on error rate" | Open when error rate exceeds threshold; short-circuit with default. |
| STRATUS | "Incident response trio" | Detection + diagnosis + validation agents. 1.5x mitigation success. |
| Memory poisoning | "Hallucinations propagate" | Shared-memory fact tainted; downstream agents reason on poison. |

## Daha Fazla Okumak

- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) MAST taksonomisi, NeurIPS 2025
- [Groupthink failures in multi-agent LLMs](https://arxiv.org/abs/2508.05687) Monoculture, conformity ve beş aile taksonomisi
- [STRATUS — specialized agents for MAS incident response](https://neurips.cc/) NeurIPS 2025 prosedürüne giriş ( tespit + teşhis + doğrulama)
- [Release It! — stability patterns (Nygard)](https://pragprog.com/titles/mnee2/release-it-second-edition/) Kanonik devreler kesici referansı
- [Anthropic — Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) üretim arızası notları
