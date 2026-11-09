# CAIS, CAISI ve Toplum Ölçüsünde Risk

> San Francisco'daki AI Güvenliği Merkezi (CAIS, Hendrycks ve Zhang tarafından 2022 yılında kurulan) dört risk çerçevesini yayınlıyor  kötü amaçlı kullanım, AI yarışları, kurumsal riskler, kötü amaçlı AI  ve yüzlerce profesör ve şirket liderinin imzaladığı yok olma riskine ilişkin Mayıs 2023 açıklaması. CAIS'ten 2026'da yayınlanan yayınlar: Sınır model değerlendirmesi için AI Dashboard, Uzak İş İndeksi (Scale AI ile), Süper İstihbarat Stratejisi Kağıdı, AI Sınırları haber bülten. Ayrı bir kurum: NIST AI Standartları ve Yenilikleri Merkezi (CAISI)  ABD hükümetine yönelik gönüllü anlaşmalar ve siber, biyolojik ve kimyasal silah risklerine odaklanan sınıflandırılmamış kapasite değerlendirmeleri. CAIS, kurumsal riskleri dört üst düzey riskten biri olarak belirtiyor: Güvenlik kültürü, katı denetimler, çok katlı savunmalar ve bilgi güvenliği temel ama düzenli olarak dağıtım hızı karşılığında satılır. Eğer imzalanırsa, Kaliforniya SB-53, ABD'de ilk devlet düzeyinde felaket riski düzenlemesi olacaktır.

**Type:** Learn
**Languages:** Python (stdlib, four-risk inventory and mitigation matcher), TypeScript
**Prerequisites:** Phase 15 · 19 (RSP), Phase 15 · 20 (PF + FSF)
**Time:** ~45 minutes

## Sorun

Dersler 19 ve 20 laboratuvar içi ölçeklendirme politikalarını kapsamaktadır. Ders 21 bağımsız kapasite değerlendirmesini kapsamaktadır. Bu ders üçüncü bakış açısını kapsar: sivil toplum ve kamuoyu düzenlemelerini ve AI riskini felaketle karşılayan düzenleyici temelini şekillendiren hükümet örgütlerini.

CAIS, AI riskleri hakkında düşünme çerçeveleri yayınlayan ve kamu açıklamalarını koordine eden bir kar amacı gütmeyen araştırma örgütüdür. CAISI, NIST'in içinde gönüllü anlaşmalar yapan ve sınıflandırılmamış kapasite değerlendirmeleri yapan bir ABD hükümet merkezi.

Pratik içeriği: CAIS'in dört risk çerçevesinin literatürde en çok alıntılanan toplumsal ölçek risk taksonomisi. Güvenlik kültürü ve örgütsel risk bu dörtten biridir ve bu bir uygulayıcının kontrolü altındaki en doğrudan bir şeydir. SB-53 (Kaliforniya) imza yapılırsa ABD eyalet düzeyinde ilk felaket riski düzenlemesi olacaktır; tasarının çerçevesinde önemli olan, çünkü eyalet düzeyinde düzenleme tarihsel olarak ABD teknolojik politikasında federal eylemlere yol açmıştır.

## Anlaşım

### CAIS  AI Güvenliği Merkezi

- 2022 yılında San Francisco'da Dan Hendrycks ve Oliver Zhang tarafından kurulmuştur. Hendrycks, Yönetim ve Araştırma Direktörüdür; Zhang Yönetim Direktörüdür.
- Durum: 501 ((c) ((3) kâr amacı gütmeyen kuruluş.
- Görkemli 2023 sonucu: yüzlerce araştırmacı ve CEO'nun ortak imzaladığı yok olma riskiyle ilgili açıklama. "İS'ten yok olma riskini azaltmak, salgın hastalıklar ve nükleer savaş gibi diğer toplumsal risklerle birlikte küresel bir öncelik olmalıdır" dedi.
- 2026 çıkışları: Sınır model değerlendirmesi için AI Tablosu, Uzaktan İş İndeksi (Scale AI ile birlikte), Süper zeka Stratejisi Kağıdı, AI Sınırları haber bültenleri.

### Dört risk çerçevesini

CAIS çerçevesinde, felaketli AI riskini dört üst düzey kategoride gruplandırıyor:

1. **Malicious use**: kötü bir oyuncu, AI'yi zarar vermek için kullanır (biyo silah sentezi, yanlış bilgi, siber saldırılar).
2. **AI races**Laboratuvarlar, şirketler veya ülkeler arasındaki rekabet basıncı, dağıtımın güvenli olduğu noktan öteye doğru ilerlemesini sağlar.
3. **Organizational risks**: iç laboratuvar dinamikleri (güven kültüründe başarısızlıklar, yetersiz denetim, yetersiz kaynaklı güvenlik) kötü bir uygulama üretir.
4. **Rogue AIs**: Yeterince yetenekli bir Yapay zeka, insan refahıyla çelişen hedefleri takip eder.

Bu tek taksonom değil; en çok alıntılanan. Kategoriler birbirini hariç tutmuyor  bir yarışta hız denetimi yapan bir organizasyon tarafından üretilen bir çirkin AI dörttür.

### Organizasyonel riskin yaşadığı yer

Dört kategoriden, örgütsel risk uygulanabilir bir laboratuvarın güvenlik kültürü, denetim sıkıntısı, savunma katmanlama ve bilgi güvenliği, ders 1018 kontrolleri ile model gemilerinin gerçekten yer aldığını veya bu kontrollerin kimsenin doğrulanmadığı kontrol listesi öğeleri olup olmadığını belirler.

Konkret organizasyonel risk levhaları:

- **Safety culture**CAIS anketleri bu durumun diğer derecelerin güçlü bir tahmincisi olduğunu buldu.
- **Rigorous audits**Sadece iç denetimler iyimser raporlar üretir.
- **Multi-layered defenses**: tek bir katman yeterli değildir (Faz 15'in devam konusu).
- **Information security**Modelle ağırlık sızdırılması, değerlendirme verileri sızdırılması, izleyici-önleme teknikleri sızdırılması.

### CAISI  AI Standartları ve Yenilikler Merkezi

- NIST'de çalışır.
- Sınır laboratuvarlarıyla gönüllü anlaşmalar yürütüyor.
- Siber, biyolojik ve kimyasal silah risklerine odaklanan sınıflandırılmamış kapasite değerlendirmeleri yayınlar.
- CAIS'ten farklı; kısaltmalar çarpışır; hangi birini okuduğunuzu doğrultmak için URL'yi (nist.gov) kontrol edin.

CAISI'nin rolü, METR'nin özel laboratuvar çalışmalarına (Desin 21) kamu ve hükümet karşıtıdır. CAISI raporları sınıflandırılmamıştır; METR raporları genellikle NDA kapalıdır.

### Kaliforniya SB-53

Kaliforniya Senatosu tasarısı (2025 2026 seansı) sınır modellerinden gelen felaket riskini ele alıyor.

- Devlet düzeyinde yükümlülükleri tetikleyen özel kapasite eşiği.
- AI laboratuvarı çalışanları için haberci koruma.
- Katastrofik başarısızlıklar için olay raporlama gereksinimleri.

Eğer imzalanırsa, ABD eyalet düzeyinde ilk felaket riski düzenlemesi olacaktır. İmza durumuna bakılmaksızın, yasa tasarısının çerçevesinde diğer eyalet mevzuatçılarının soruna nasıl yaklaştığı şekillendirilir. Kaliforniya'daki uygulayıcılar yasa tasarısının durumunu takip etmelidir; diğer yerlerde uygulayıcılar ABD eyalet düzeyinde düzenlemenin nasıl görüneceğini anlamak için okumalıdır.

### Toplumsal risk tek katmanlı bir sorun değildir.

15'inci aşamada devam eden teması  derin savunma  toplumsal katmanlarda da geçerlidir. Tek bir organizasyon, düzenleme veya çerçeve felaket riski kapatmaz.

- Laboratuvarlar'ın ölçeklendirme politikaları (Deneyimler 19, 20).
- Dış değerlendiciler ölçümler yapar (Denevi 21).
- Sivil toplum izleme ve kamuoyuna yayımlama (CAIS).
- Hükümet gönüllü programlar ve temel düzenleme (CAISI, SB-53) yürütüyor.
- Pratikçiler çok katlı kontroller inşa (Düşünmeler 1018).

Bu, aşama için son sentez: her önceki ders, tamamlılığı herhangi bir tabaka gücünden daha önemli olan bir yığındaki bir katmandır.

```figure
a5-four-risks
```

## Kullan

`code/main.py`Bu, bir risk envanteri aracı uygulamaktadır. Bir önerilen dağıtımla, dağıtımın dört risk kategorisine karşı etiketlenmesini ve azaltma kontrol listesini gönderir.

## Gönder

`outputs/skill-societal-risk-review.md`Toplum ölçeğinde risk pozisyonu için bir uygulama değerlendiriyor: dört kategoriden hangisine değiniyor, hangi hafiflemeler uygulanıyor, kurumsal risk maruz kalması nedir.

## Egzersizler

1. Çık .`code/main.py`. Farklı ölçeklerde üç sentetik dağıtım ekleyin. Dört risk etiketlerinin beklediğinizle uyumlu olduğunu doğrulayın; araçın düşük veya aşırı etiketlendiği bir durum belirleyin.

2. CAIS dört risk kağıdı'nı tamamıyla okuyun. Bir risk kategorisini seçin ve 2026'da bu kategoride en önemli gelişme olduğuna inandığınız şey hakkında iki paragraf yazın.

3. California SB-53'in hazırkı taslağını okuyun.

4. Bildiğiniz bir üretim AI dağıtımını seçin (seninki veya yayınlanmış bir tane). Kurumsal risk alt dereceleri ile karşılaştırın: güvenlik kültürü, denetim sıkılığı, çok katlı savunmalar, bilgi güvenliği. En zayıf olan hangisi?

5. Dört risk çerçevesinin 2028 versiyonunu çizin ki bu bir yılın ek kapasite ve bir yılın ek dağıtım deneyimi yansıtır. Neyi ekleyeceksiniz, çıkarırsınız veya yeniden gruplandırırsınız?

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| CAIS | "Center for AI Safety" | Non-profit; four-risk framework; 2023 extinction statement |
| CAISI | "US government AI safety" | NIST Center; voluntary agreements; unclassified evals |
| Four-risk framework | "CAIS's taxonomy" | malicious use, AI races, organizational risks, rogue AIs |
| Malicious use | "Bad actor uses AI" | Bioweapons, disinformation, cyberattacks |
| AI races | "Competitive pressure" | Labs/companies/nations push deployment past safety |
| Organizational risk | "Lab internal failure" | Safety culture, audit, defenses, infosec |
| Rogue AI | "Misaligned agent" | Capable AI pursuing goals conflicting with human welfare |
| California SB-53 | "State-level regulation" | 2025–2026 bill; first US state catastrophic-risk regulation if signed |

## Daha Fazla Okumak

- [Center for AI Safety](https://safe.ai/) Dört risk çerçevesinin kurumsal evleri.
- [CAIS — AI Risks that Could Lead to Catastrophe](https://safe.ai/ai-risk) dört riskli kağıt.
- [CAIS — May 2023 statement on extinction risk](https://safe.ai/statement-on-ai-risk) Kısa ortak açıklama.
- [NIST CAISI](https://www.nist.gov/caisi) Hükümet karşısında AI standartları ve yenilik merkezi.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) laboratuvar düzeyinde yapılan yükümlülükleri toplumsal ölçekte bir çerçeveye bağlar.
