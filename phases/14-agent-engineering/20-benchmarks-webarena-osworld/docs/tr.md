# Benchmarks: WebArena ve OSWorld

> WebArena, web-agent özelliğini kendi kendine barındırılan dört uygulamada test eder. OSWorld, Ubuntu, Windows ve macOS'ta masaüstü-agent özelliğini test eder. Piyasaya sürüldüğünde (2023–2024) her ikisi de sınıfının en iyisi agent'ler ile insanlar arasında büyük bir uçurum olduğunu gösterdi. Boşluk daralıyor; arıza modları değişmedi.

**Tür:** Öğren
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 19 (SWE-bank, GAIA)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- WebArena'nın kendi kendine barındırılan dört uygulamasını ve yürütmeye dayalı değerlendirmenin neden önemli olduğunu açıklayın.
- OSWorld'ün neden erişilebilirlik API'leri yerine gerçek işletim sistemi ekran görüntülerini kullandığını açıklayın.
- İki temel OSWorld arıza modunu adlandırın: GUI temeli ve operasyonel bilgi.
- OSWorld-G ve OSWorld-Human'ın benchmark tabanına ne eklediğini özetleyin.

## Sorun

Genelci agent'ler araçları çağırabilir. Bir alışveriş ödemesini tamamlamak için bir tarayıcıyı 20 tıklamayla yönlendirebilirler mi? Bir Linux kutusunu yalnızca klavye ve fareyi kullanarak yapılandırabilirler mi? Bunlar WebArena ve OSWorld'ün cevapladığı sorular.

## Konsept

### WebArena (Zhou ve diğerleri, ICLR 2024)

- Kendi kendine barındırılan dört web uygulamasında 812 uzun ufuklu görev: bir alışveriş sitesi, bir forum, GitLab benzeri bir geliştirme aracı, bir iş CMS'si.
- Artı yardımcı programlar: harita, hesap makinesi, karalama defteri.
- Değerlendirme, spor salonu API'leri aracılığıyla uygulamaya dayalıdır - sipariş verildi mi, sorun kapatıldı mı, CMS sayfası güncellendi mi?
- Yayınlandığında: en iyi GPT-4 agent %14,41 başarıya ulaşırken insan %78,24 başarıya ulaştı.

Kendi kendine barındırılan çerçeveleme önemlidir - hedef uygulamalar sabitlendiğinden ve tekrar üretilebildiğinden benchmark düzensiz değildir.

### Uzantılar

- **VisualWebArena** — başarının görüntülerin yorumlanmasına bağlı olduğu görsel temelli görevler (birinci sınıf gözlemler olarak ekran görüntüleri).
- **AgentŞirket** (Aralık 2024) — terminal + kodlamayı ekler; daha çok gerçek bir uzaktan çalışma ortamına benziyor.

### OSWorld (Xie ve diğerleri, NeurIPS 2024)

- Ubuntu, Windows ve macOS'ta 369 gerçek bilgisayar görevi.
- Gerçek uygulamaların serbest biçimli klavye ve fare kontrolü.
- Gözlem olarak 1920×1080 ekran görüntüleri.
- Piyasaya sürüldüğünde: en iyi model %12,24 ve insan %72,36.

### Birincil arıza modları

1. **GUI topraklaması.** Piksel → öğe eşleme. Modeller, kullanıcı arayüzü öğelerini 1920×1080 çözünürlüğünde güvenilir bir şekilde yerelleştirmekte zorlanıyor.
2. **İşlemsel bilgi.** Hangi menüde ayar, hangi klavye kısayolu, hangi tercih bölmesi bulunur. İnsanların yıllar içinde oluşturduğu bilgi kuyruğu.

### Takipler

- **OSWorld-G** — 564 örnek topraklama paketi + Jedi eğitim seti. Topraklamayı planlamadan ayrıştırır, böylece bunları ayrı ayrı ölçebilirsiniz.
- **OSWorld-Human** — manuel olarak seçilmiş altın aksiyon yörüngeleri. En iyi agent'lerin gerekenden 1,4-2,7 kat daha fazla adım kullandığını gösterir (yörünge-verimlilik açığı).

### Bu neden önemli?

Claude bilgisayar kullanımı, OpenAI CUA, Gemini 2.5 Bilgisayar Kullanımı (Ders 21) hepsi WebArena ve OSWorld tarafından şekillendirilen iş yükleri konusunda eğitim vermektedir. benchmark'lar hedeftir; üretim modelleri gönderilen yanıttır.

### benchmarkişlerin ters gittiği yer

- **Yalnızca ekran görüntüsü değerlendirmeleri.** OSWorld ekran görüntüsüne dayalıdır; OSWorld'de DOM veya erişilebilirlik API'lerini kullanan bir agent'yi değerlendirmek temel zorluğu kaçırır.
- **Yörünge uzunluğu göz ardı ediliyor.** Yalnızca başarı oranının puanlanması, 1,4-2,7x adım verimsizliği OSWorld-Human yüzeylerini kaçırıyor.
- **Kendi kendine barındırılan eski uygulamalar.** WebArena'nın uygulamaları belirli sürümleri sabitler; Yeniden iyileştirme olmadan güncelleme karşılaştırılabilirliği bozar.

## İnşa Et

`code/main.py` bir oyuncak ağ-agent koşum takımı uygular:

- Minimal bir "alışveriş uygulaması" durum makinesi: list_items, add_to_cart, checkout.
- 3 görev için altın yörüngeler.
- Her görevi deneyen komut dosyasıyla yazılmış bir agent.
- Uygulamaya dayalı değerlendirici (durum kontrolü) ve yörünge verimliliği ölçümü (adımlara karşı altın).

Çalıştır:

```
python3 code/main.py
```

Çıktı: OSWorld-Human'ın metodolojisini yansıtan, görev başına başarı oranı ve yörünge verimliliği.

## Kullan onu

- **WebArena Onaylı** sürekli değerlendirme için dahili bir kümede kendi kendine barındırılır.
- **OSWorld** masaüstü agent'ler için bir VM filosunda.
- **Bilgisayar kullanan agentlar** (Ders 21) — Claude, OpenAI CUA, Gemini — hepsi buna benzer iş yükleri konusunda eğitimlidir.
- **Kendi ürün akışlarınız** — ilk 20 göreviniz için altın gidişatlarını yakalayın; onlara karşı haftalık olarak agents yürüt.

## Gönderin

`outputs/skill-web-desktop-harness.md`, yürütmeye dayalı değerlendirme ve yörünge verimliliği metriği ile bir web/masaüstü agent koşum takımı oluşturur.

## Egzersizler

1. Oyuncak kemerini ikinci bir uygulamayla (forum) uzatın. 3 görev artı altın yörüngeleri yazın.
2. Görev başına yörünge verimliliği raporlaması ekleyin. Oyuncağınızdaki agent altının üzerinde 1x, 2x veya 3x mi?
3. Altın yörüngesinin asla kullanmadığı bir "dikkat dağıtıcı" aracı uygulayın. Komut dosyasıyla yazılan agent cazip geliyor mu?
4. OSWorld-G'yi okuyun. Kendi değerlendirmelerinizde temellendirme hatalarını planlama hatalarından nasıl ayırırsınız?
5. WebArena'nın uygulamalarını okuyun README. Sabitlenmiş uygulama sürümlerinden birini yükselttiğinizde ne bozulur?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| WebArena | "Web agent benchmark" | Kendi kendine barındırılan 4 uygulamada 812 görev; spor salonu tarzı değerlendirme |
| VisualWebArena | "Görsel WebArena" | Görsel olarak temellendirilmiş WebArena; ekran görüntüleri gözlemlerdir |
| İşletim Sistemi Dünyası | "Masaüstü agent benchmark" | Gerçek Ubuntu/Windows/macOS'ta 369 görev |
| GUI topraklaması | "Pikselden öğeye eşleme" | UI öğelerini 1920x1080'de yerelleştirme modeli |
| Operasyonel bilgi | "İşletim Sistemi teknik bilgisi" | Hangi menü, hangi kısayol, hangi tercih bölmesi |
| OSWorld-G | "Topraklama paketi" | 564 yalnızca topraklama örneği + eğitim seti |
| OSWorld-İnsan | "Altının yörüngeleri" | Verimliliği ölçmek için manuel uzman eylem dizileri |
| Yörünge verimliliği | "Altının ötesine geçen adımlar" | Agent adım sayısının insan minimumuna bölümü |

## Daha Fazla Okuma

- [Zhou ve diğerleri, WebArena (arXiv:2307.13854)](https://arxiv.org/abs/2307.13854) — dört uygulamalı web benchmark
- [Xie ve diğerleri, OSWorld (arXiv:2404.07972)](https://arxiv.org/abs/2404.07972) — işletim sistemleri arası masaüstü benchmark
- [Antropik, Bilgisayar kullanımına giriş](https://www.anthropic.com/news/3-5-models-and-computer-use) — Claude'un benchmark şeklindeki yeteneği
- [OpenAI, Bilgisayar Kullanımı Agent](https://openai.com/index/computer-using-agent/) — OSWorld ve WebArena numaraları
