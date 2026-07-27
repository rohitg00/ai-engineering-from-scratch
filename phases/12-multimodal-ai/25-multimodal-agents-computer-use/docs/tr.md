# Multimodal Agent'ler ve Bilgisayar Kullanımı (Capstone)

> 2026 sınır ürünü, ekran görüntülerini okuyan, düğmelere tıklayan, web kullanıcı arayüzlerinde gezinen, formları dolduran ve iş akışlarını uçtan uca tamamlayan çok modlu bir agent'dir. SeeClick ve CogAgent (2024), GUI temelli ilkelliği kanıtladı. Ferret-UI mobil eklendi. ChartAgent, grafikler için görsel araç kullanımını tanıttı. VisualWebArena ve AgentVista (2026), öncülerin peşinde koşan benchmark'lerdir; hatta Gemini 3 Pro ve Claude Opus 4.7, AgentVista'nın zorlu görevlerinde ~%30 puan alır. Bu kapak taşı, Aşama 12'nin tüm konularını bir araya getirir: algı (yüksek çözünürlüklü VLM), muhakeme (araç kullanımıyla yüksek lisans), topraklama (koordinat çıktısı), uzun ufuk hafızası ve değerlendirme.

**Tür:** Kapak taşı
**Diller:** Python (stdlib, eylem şeması + agent loop iskeleti)
**Önkoşullar:** Aşama 12 · 05 (LLaVA), Aşama 12 · 09 (Qwen-VL JSON), Aşama 14 (Agent Mühendislik)
**Süre:** ~240 dakika

## Öğrenme Hedefleri

- Çok modlu bir agent loop tasarlayın: algılama → akıl yürütme → eyleme geçme → gözlemleme → tekrarlama.
- VLM'nin JSON olarak yayabileceği bir GUI topraklama çıkış şeması oluşturun (koordinatlara tıklayın, metin yazın, kaydırın, sürükleyin).
- Yalnızca ekran görüntüsü olan agent'leri erişilebilirlik ağacı agent'lerle hibrit agent'lerle karşılaştırın.
- Küçük bir VisualWebArena diliminde çok modlu bir agent benchmark değerlendirmesi ayarlayın.

## Sorun

Bir rezervasyon sitesi iş akışı: "Bana 15 Nisan için Tokyo'ya bir uçuş bulun, koridor koltuğu 800 doların altında, rezervasyon yaptırın."

Çok modlu bir agent'nin şunları yapması gerekir:

1. Tarayıcının ekran görüntüsünü alın.
2. Ekran görüntüsünü + URL + hedefi bir plan halinde ayrıştırın.
3. Yapılandırılmış bir eylem yayınlayın: (x,y'de) tıklayın, "Tokyo" yazın (E öğesinde), aşağı kaydırın, seçin (radyo düğmesi).
4. Eylemi tarayıcıya uygulayın.
5. Yeni durumu gözlemleyin (sonraki ekran görüntüsü).
6. Görev tamamlanana kadar tekrarlayın.

Her adım çok modlu bir VLM çağrısıdır. VLM çıkışı ayrıştırılabilir JSON olmalıdır. Hatalar adımlar arasında birleşir, dolayısıyla kurtarma önemlidir.

## Konsept

### GUI temeli — ilkel

GUI temeli şu şekildedir: bir ekran görüntüsü ve doğal dil talimatı verildiğinde, tıklama (veya başka bir eylem) için (x, y) koordinatının çıktısı alınır.

SeeClick (arXiv:2401.10935) ölçekteki ilk açık sonuçtu: sentetik + gerçek GUI verileri üzerinde bir VLM'ye ince ayar yapın, koordinatları düz metin token olarak çıkarın. Çalışıyor.

CogAgent (arXiv:2312.08914), yoğun kullanıcı arayüzleri için 1120x1120 yüksek çözünürlüklü kodlama ekledi. Puan: Web'de gezinmede ~%84.

Ferret-UI (arXiv:2404.05719) mobil kullanıcı arayüzlerine odaklanır ve iOS erişilebilirlik verileriyle bütünleşir.

Çıktı formatı genellikle JSON'dur:

```json
{"action": "click", "x": 384, "y": 220, "element_desc": "Search button"}
```

`element_desc` kurtarmaya yardımcı olur: Koordinatlar ekran görüntüleri arasında kayarsa anlamsal ipucu sistemin yeniden topraklanmasını sağlar.

### Eylem şemaları

Tipik bir eylem şemasında 6-10 eylem türü bulunur:

- `click`: (x, y)
- `type`: (metin, x?, y?)
- `scroll`: (yön, miktar)
- `drag`: (x0, y0, x1, y1)
- `select`: (option_index)
- `hover`: (x, y)
- `navigate`: (url)
- `wait`: (ms)
- `done`: (başarı, açıklama)

agent adım başına bir eylem gerçekleştirir. Tarayıcı sarmalayıcısı yürütür ve yeni durumu döndürür.

### Yalnızca ekran görüntüsü ve erişilebilirlik ağacı karşılaştırması

İki giriş modu:

- Yalnızca ekran görüntüsü: tam görüntü, yapısal bilgi yok. En geneli; herhangi bir uygulamada çalışır.
- Erişilebilirlik ağacı: yapılandırılmış DOM / iOS erişilebilirlik bilgileri. Topraklama için çok daha güvenilir; Ağacın mevcut olduğu yerde çalışır.
- Hibrit: her ikisi de, atomik eylemler için güvenilir bir temel oluşturan ağaç ve anlamsal bağlam için ekran görüntüsü ile.

Üretim agent'ler mümkün olduğunda hibrit kullanır. Tarayıcı otomasyonu (Selenyum + erişilebilirlik) her zaman bir ağaca sahiptir; masaüstü uygulamaları bazen bunu yapar.

### Uzun ufuk hafızası

20 adımlı bir iş akışı 20 ekran görüntüsü oluşturur. VLM'nin içeriği hızla doluyor. Üç sıkıştırma stratejisi:

- Özet zinciri: Her 5 adımdan sonra olanları özetleyin, eski ekran görüntülerini bırakın.
- Kare atlama: ilk, son ve her 3. ekran görüntüsünü saklayın.
- Araçla kaydedilen günlük: eylemleri yürütün, yapılanların metin günlüğünü tutun; eski ekran görüntülerine tekrar bakmayın.

Claude'un bilgisayar kullanım API'si günlük modelini kullanır. Daha basit, daha güvenilir.

### Görsel araç kullanımı

ChartAgent (arXiv:2510.04514), grafiği anlamak için görsel araç kullanımını sunar: kırpma, yakınlaştırma, OCR, çağrı harici algılama. agent, bir araç çağrısı olarak "bölgeye (100, 200, 300, 400) kırpın ve ardından OCR'yi çağırın" çıktısını alabilir. Araç metni döndürür; VLM muhakeme yürütmeye devam ediyor.

Bu model genelleştirir: işaret seti prompting, bölge açıklaması ve harici algılama araçlarının tümü aynı "bir araç çağrısı çıkışı, yapılandırılmış bir yanıt alma" şemasına uyar.

### 2026 benchmark'ler

- ScreenSpot-Pro. ~1k web ekran görüntüsüne dayalı GUI. SOTA Qwen2.5-VL-72B ~%85'i açın. Sınır ~%90.
-VisualWebArena. Uçtan uca web görevleri (mağaza, forum, ilanlar). SOTA'yı ~%20 açın. Gemini 3 Pro ~%27.
- AgentVista (arXiv:2602.23166). En zor 2026 benchmark. 12 alanda gerçekçi iş akışları. Sınır modelleri %27-40 puan alır; açık modeller %10-20.
- WebArena / Web Mağazası. Daha eski benchmark'ler; sınır tarafından doymuş.

### Neden hala zor

Agent performans darboğazları:

1. İnce ölçekte görsel topraklama. "Küçük X'e tıklayın" seçeneği mobil çözünürlükte sıklıkla başarısız olur.
2. Uzun vadeli planlama. 10 eylemden sonra agent kaleden uzaklaşıyor.
3. Hata kurtarma. Bir tıklama başarısız olduğunda (yanlış düğme), algılama + kurtarma nadiren eğitilmiş verilerdir.
4. Sayfalar arası bağlam. Sekmeler veya uzun formlar arasında geçiş yapmak durumu kaybeder.

Araştırma yönleri: bellek mimarileri, açık yeniden planlama, çok modlu doğrulama (eylem başarısı için ekran görüntüsü eşleşmesi).

### Temel yapı taşı

Bitirme görevi: Bilgisayarda kullanılabilen bir agent oluşturmak:

1. Rezervasyon sitesi örnek sayfasının HTML + ekran görüntüsünü okur.
2. Çok adımlı bir sıra planlar: ara → seç → formu doldur → gönder.
3. Eylem şemasıyla eşleşen JSON eylemlerini yayınlar.
4. Sabit 10 görev diliminde değerlendirme yapar.

Ders, gerçek bir tarayıcıya genişletilmesi kolay olan iskele kodunu sağlar.

## Kullan onu

`code/main.py` kapak taşı iskelesidir:

- Eylem şeması JSON tanımı (10 eylem).
- Tarayıcı durumunu dict olarak taklit edin.
- Agent loop iskeleti: durumu alma, eylemi yayma, uygulama, döngü.
- Uçtan uca başarı oranını ölçmek için 10 görevli mini-benchmark (sentetik sayfalar).
- Bir eylem başarısız olduğunda hata kurtarma kancası.

## Gönderin

Bu ders `outputs/skill-multimodal-agent-designer.md`'yi üretir. Bilgisayarda kullanılan bir ürün (etki alanı, eylem seti, değerlendirme hedefi) verildiğinde, agent loop'nin tamamını, bellek stratejisini, temel modunu ve beklenen benchmark puanını tasarlar.

## Egzersizler

1. Eylem şemasını bir `screenshot_region` aracıyla (kırpma + yakınlaştırma) genişletin. Hangi görevler faydalıdır?

2. AgentVista'yı (arXiv:2602.23166) okuyun. En zor görev kategorisini ve sınır modellerinin neden hala başarısız olduğunu açıklayın.

3. Uzun ufuklu bellek sıkıştırması: Canlı tutulan ve herhangi bir sayının günlüğe kaydedildiği ≤4 ekran görüntüsünden oluşan bir özet zinciri tasarlayın.

4. Bir hata kurtarma kancası oluşturun: eylem hatası durumunda (düğme bulunamadı), agent bundan sonra ne yapar?

5. 10 web görevinde yalnızca ekran görüntüsü olan Claude 4.7'yi karma ekran görüntüsü + erişilebilirlik ağacı Qwen2.5-VL ile karşılaştırın. Hangi görevlerde hangisi kazanır?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| GUI topraklaması | "Koordinatlara tıklayın" | Ekran görüntüsündeki talimatın hedefi için model çıktıları (x,y) |
| Eylem şeması | "Araç tanımları" | Geçerli eylemlerin JSON açıklaması (tıklama, yazma, kaydırma, sürükleme) |
| Erişilebilirlik ağacı | "Yapılandırılmış DOM" | Tarayıcı/iOS API'lerinden makine tarafından okunabilen kullanıcı arayüzü hiyerarşisi |
| Hibrit agent | "Ekran görüntüsü + ağaç" | Hem görüntüyü hem de yapılandırılmış bilgiyi kullanır; her ikisinden de daha güvenilir |
| Görsel araç kullanımı | "Yakınlaştır/kırp/algıla" | Agent, orta planda harici görüş araçlarını (OCR, algılama) çağırıyor |
| Özet zinciri | "Bellek sıkıştırma" | Periyodik metin özetleri, uzun ekran görüntüsü geçmişinin yerini alır |
| VisualWebArena | "E2E web tezgahı" | Uçtan uca web görevleri için 2024 benchmark |
| AgentVista | "2026 sert tezgah" | 12 alanlı gerçekçi iş akışları; Gemini 3 Pro'nun puanları bile ~%30 |

## Daha Fazla Okuma

- [Cheng ve ark. — SeeClick (arXiv:2401.10935)](https://arxiv.org/abs/2401.10935)
- [Hong ve ark. — CogAgent (arXiv:2312.08914)](https://arxiv.org/abs/2312.08914)
- [Sen ve ark. — Ferret-UI (arXiv:2404.05719)](https://arxiv.org/abs/2404.05719)
- [ChartAgent (arXiv:2510.04514)](https://arxiv.org/abs/2510.04514)
- [Koh ve ark. — VisualWebArena (arXiv:2401.13649)](https://arxiv.org/abs/2401.13649)
- [AgentVista (arXiv:2602.23166)](https://arxiv.org/abs/2602.23166)
