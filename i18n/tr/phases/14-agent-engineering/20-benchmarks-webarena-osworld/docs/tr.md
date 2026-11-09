# Benchmarks: WebArena ve OSWorld

> WebArena, dört kendi kendine barındırılan uygulama üzerinden web-ajent yeteneğini test eder. OSWorld, Ubuntu, Windows, macOS üzerinden masaüstü-ajent yeteneğini test eder. Serbest sınıf ajanları ve insanlar arasında büyük bir boşluk gösterdi.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 19 (SWE-bench, GAIA)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- WebArena'nın dört kendi kendine barındırılan uygulamasını ve neden yürütme tabanlı değerlendirme önemli olduğunu açıklayın.
- OSWorld'in erişilebilirlik API'lerinin yerine neden gerçek OS ekran görüntüleri kullandığını açıklayın.
- OSWorld'in iki temel başarısızlık modunu isimlendirin: GUI yerleştirme ve operasyonel bilgi.
- OSWorld-G ve OSWorld-Human'ın temel referans değerinin üstüne ne eklediğini özetleyin.

## Sorun

Genelist ajanlar araçları çağırabilir. Bir alışveriş kontrolünü tamamlamak için bir tarayıcını 20 tıkla kullanabilir mi? Sadece klavyayı ve fareyi kullanarak Linux kutuunu yapılandırabilir mi? Bunlar WebArena ve OSWorld'in cevapladığı sorulardır.

## Anlaşım

### WebArena (Zhou et al., ICLR 2024)

- 4 kendi kendine barındırılan web uygulamasındaki 812 uzun uzayda görev: bir alışveriş sitesi, bir forum, GitLab gibi bir geliştirme aracı, bir iş CMS.
- Karte, hesap makinesi, çizme levhası.
- Değerlendirme, spor salonunun API'leri üzerinden yürütülmeye dayalıdır  sipariş verildi mi, sorun kapatıldı mı, CMS sayfası güncellenmedi mi?
- Serbest GPT-4 ajanı, insan oranı %78.24'e karşı %14.41'e ulaştı.

Kendini barındırmış çerçeveleme önemli  referans, hedef uygulamaların sabitlenmiş ve yeniden üretilebilir olduğu için gevşek değildir.

### Gelişmeler

- **VisualWebArena** Başarı görüntülerin yorumlanmasından (birinci sınıf gözlemler olarak ekran görüntüleri) bağlı görsel temelli görevler.
- **TheAgentCompany**(Aralık 2024)  terminal + kodlama ekler; daha çok gerçek bir uzaktan çalışma ortamına benziyor.

### OSWorld (Xie et al., NeurIPS 2024)

- Ubuntu, Windows, macOS'da 369 gerçek bilgisayar görevi.
- Gerçek uygulamaların serbest biçimli klavyası ve fare kontrolü.
- 1920×1080 ekran görüntüleri gözlem olarak.
- Serbest model 12.24% vs. insan 72.36%

### Başlangıç hata modları

1. **GUI grounding.**Pixel → element haritası. Modeller 1920×1080'de kullanıcı arayüzü öğelerini güvenilir bir şekilde yerleştirmek için mücadele ediyor.
2. **Operational knowledge.**Hangi menü ayarları, hangi klavye kısayolu, hangi tercih penceresi, insanların yıllarca oluşturduğu bilgi kuyrukları var.

### Takipler

- **OSWorld-G**564 numune yerleştirme süiti + Jedi eğitim seti.
- **OSWorld-Human** elle kurate edilen altın eylem rotaları.

### Bu neden önemli?

Claude bilgisayar kullanımı, OpenAI CUA, Gemini 2.5 Bilgisayar Kullanımı (Desin 21) hepsi WebArena ve OSWorld tarafından şekillendirilmiş iş yükleri üzerinde eğitim alıyor.

### Benchmarking'in yanlış gittiği yer

- **Screenshot-only evals.**OSWorld ekran görüntüsü ile yönlendirilir; OSWorld'de DOM veya erişilebilirlik API'lerini kullanan bir ajanı değerlendirmek, yerleşim zorunluluğunu kaçırır.
- **Ignoring trajectory length.**Sadece başarı oranını elde etmek, OSWorld-Human yüzeylerinin 1.4-2.7x adım verimsizliğini kaçırır.
- **Stale self-hosted apps.**WebArena'nın uygulamaları belirli sürümlere pin; yeniden kurasyon yapmadan güncelleme karşılaştırılabilirliği bozar.

```figure
ae-agent-human-gap
```

## Yapın

`code/main.py`Oyuncak web-ağent harnessini uyguluyor:

- Minimum bir " alışveriş uygulaması " durum makinesi: list_items, add_to_cart, checkout.
- 3 görev için altın yollar.
- Her görevi deneden bir senaryolu ajan.
- İcracılık tabanlı değerlendirme (devlet kontrolü) ve yörüngel etkinlik ölçüsü (adımlar altın karşılığı).

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

Üretim: Görev başına başarı oranı ve yörüngenin verimliliği, OSWorld-Human'ın metodologiyasını yansıtan.

## Kullan

- **WebArena Verified**Sürekli değerlendirme için iç bir küme üzerinde kendi kendine konutlanmıştır.
- **OSWorld**Masaüstü ajanlar için bir VM filosu.
- **Computer-use agents**(Daahi 21) Claude, OpenAI CUA, Gemini hepsi bu tür iş yükleri üzerinde eğitilmiştir.
- **Your own product flows** en önemli 20 görevinin altın yörüngelerini yakalayın; haftada bir ajanla karşılaşma yapın.

## Gönder

`outputs/skill-web-desktop-harness.md`İslâm tabanlı eval ve yörüngenin verimlilik ölçüsünü kullanarak web/desktop ajan harnessini oluşturur.

## Egzersizler

1. Oyuncak harnesini ikinci bir uygulama (forum) ile uzatın. 3 görev ve altın yollar yazın.
2. Oyuncaklarınızda ajanın altınla karşılığı 1x, 2x, 3x mi?
3. Altın yoldaki bir "açıklayıcı" aracı uygulayın.
4. OSWorld-G'yi okuyun. Kendi değerlendirmelerinizde yerleştirme başarısızlıklarını planlama başarısızlıklarından nasıl ayırırdınız?
5. WebArena'nın uygulamalarını oku.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| WebArena | "Web agent benchmark" | 812 tasks across 4 self-hosted apps; gym-style evaluation |
| VisualWebArena | "Visual WebArena" | Visually grounded WebArena; screenshots are observations |
| OSWorld | "Desktop agent benchmark" | 369 tasks on real Ubuntu/Windows/macOS |
| GUI grounding | "Pixel-to-element mapping" | Model localizing UI elements in 1920x1080 |
| Operational knowledge | "OS know-how" | Which menu, which shortcut, which preference pane |
| OSWorld-G | "Grounding suite" | 564 grounding-only samples + training set |
| OSWorld-Human | "Gold trajectories" | Manual expert action sequences to measure efficiency |
| Trajectory efficiency | "Steps over gold" | Agent step count divided by human minimum |

## Daha Fazla Okumak

- [Zhou et al., WebArena (arXiv:2307.13854)](https://arxiv.org/abs/2307.13854) 4 uygulama web referansı
- [Xie et al., OSWorld (arXiv:2404.07972)](https://arxiv.org/abs/2404.07972) Cross-OS masaüstü referans
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) Claude'un referans değerine benzer yetenekleri
- [OpenAI, Computer-Using Agent](https://openai.com/index/computer-using-agent/) OSWorld ve WebArena numaraları
