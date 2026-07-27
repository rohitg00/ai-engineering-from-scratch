# Oylama, Öz Tutarlılık ve Tartışma Topolojisi

> En ucuz toplama: örnek N bağımsız agents, çoğunluk oyu. Wang ve diğerleri. 2022'nin kendi içinde tutarlılığı bunu N kez örneklenen bir modelle gerçekleştirdi. Çoklu-agent, monokültürden kaçmak için onu **heterojen** agent'larle genişletir — farklı modeller, farklı prompt'lar, farklı sıcaklıklar, farklı bağlamlar. Çoğunluk oylamasının ötesinde, topolojiyi tartışmak önemlidir: ÇokluAgentBench (arXiv:2503.01935, ACL 2025) yıldız / zincir / ağaç / grafik koordinasyonunu değerlendirdi ve ~4 agent saniyeden uzun bir "koordinasyon vergisi" ile **araştırma için en iyi grafiği** buldu. AgentAyet (ICLR 2024), ortaya çıkan iki modeli - gönüllü davranışlar ve uygunluk davranışları - belgelemektedir ve uygunluk hem bir özelliktir (fikir birliği bulma) hem de bir risktir (grup düşüncesi, Ders 24). Bu ders topoloji uzayını haritalar, her bir değişkeni oluşturur ve koordinasyon vergisini ölçer.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 16 · 07 (Zihin ve Tartışma Topluluğu), Aşama 16 · 14 (Uzlaşı ve BFT)
**Süre:** ~75 dakika

## Sorun

Tartışma doğruluğu artırabilir (Du ve diğerleri, arXiv:2305.14325). Aynı zamanda onu bozabilir. Tartışmanın işe yarayıp yaramayacağı dört yapısal seçeneğe bağlıdır:

1. Kim kiminle konuşuyor (topoloji).
2. Kaç tur (Du 2023: hem turlar hem de agent'lar bağımsız olarak önemlidir).
3. agent'ların heterojen olup olmadığı (farklı temel modeller monokültürü bozar).
4. Düşmanca bir sesin mevcut olup olmadığı (çelik yönetimine karşı saman yönetimi).

Bir göreve "5 agent koşup oy veren" takımlar, tek bir agent yerine genellikle geriler. Başarısızlıklar rastgele değildir. Topolojiyi ve heterojenliği izlerler. Bu ders topoloji haritasıdır.

## Konsept

### Kendi kendine tutarlılık, tek modelin temeli

Wang ve diğerleri. 2022 ("Kendi Tutarlılığı, Düşünce Akıl Yürütme Zincirini İyileştirir") aynı modeli sıcaklık > 0'da N kez örnekledi ve akıl yürütme yolu yanıtlarına çoğunluk oyu verdi. GSM8K'deki sonuç: Tek bir açgözlü kod çözme işleminde N=40 örnekle önemli kazanımlar. Kendi kendine tutarlılık, çoklu-agent oylamanın tek-agent öncüsüdür.

Sınır: Kendi kendine tutarlılık tek bir temel model kullanır. Hatalar yapıyla ilişkilidir. Modelin sistematik bir önyargısı varsa, tüm N numuneler bunu paylaşır.

### Çoklu-agent oy, heterojen uzantı

N numuneyi N *farklı* agent'larla değiştirin. Farklı temel modeller (Claude, GPT, Llama), farklı prompt'lar, farklı araç erişimi. Faydası: ilişkisiz hatalar. Maliyet: farklı agent'ların maliyeti farklı tutarlardır; bunları koordine etmek ek yükü artırır.

Heterojen tartışmanın 2026'daki kanonik adı **A-HMAD** — Çekişmeli Heterojen Çoklu-Agent Tartışmadır. Evrensel olarak benimsenmedi, ancak makaleler bu terimi "monokültürün çöküşünden kaynaklanan ilişkili hataları azaltan farklı modeller tartışması" için kullanıyor.

### Dört topoloji

```
star                chain               tree                graph

    ┌─A─┐           A─B─C─D         ┌──A──┐              A───B
    │   │                           │     │              │ × │
    B   C                           B     C              D───C
    │   │                          / \   / \
    D   E                         D   E F   G           (fully connected)
```

Yıldız: bir merkez, diğerleri yalnızca merkezle konuşur. Arka kanalı olmayan yönetici-işçiye eşdeğerdir.
Zincir: doğrusal, her agent bir öncekinin çıktısını görür. Boru hattına benzer.
Ağaç: hiyerarşik, hiyerarşik agent sistemler tarafından kullanılır (Ders 06).
Grafik: herhangi birinden herhangi birine. Tamamen bağlı klik ve isteğe bağlı DAG'leri içerir.

### Koordinasyon vergisi (ÇokluAgentBench)

Araştırma, kodlama ve planlamayı içeren bir görev paketinde ÇokluAgentBench (MARBLE, ACL 2025, arXiv:2503.01935) benchmarked yıldız, zincir, ağaç, grafik. Ölçülen önemli sonuçlar:

- **Grafik** topolojisi araştırma görevlerinde kazanır. Bilgi herhangi birinden diğerine akar; agent'lar birbirlerini eleştirebilirler.
- **Yıldız** hızlı cevap verilen gerçek görevlerde kazanır. Hub filtreler ve birleştirir.
- **Zincir** adım adım ardışık düzenlerde kazanır (aşamalı iyileştirme).
- **Koordinasyon vergisi** grafik topolojisinde ~4 agent saniyeden sonra görünür. Duvar saati ve token maliyeti kaliteden daha hızlı artar.

4-agent tavanı temel değil ampiriktir. Bu, 2026 Yüksek Lisans bağlam kapasitesini yansıtır: her agent'ın bağlamı eşlerin çıktılarıyla dolar ve herkes herkesi görebildiğinde agent N+1 eklemenin marjinal değeri düşer.

### Çoklu-Agent Tartışma Stratejileri ("Delirmeli miyiz?")

arXiv:2311.17371, MAD stratejilerine ilişkin 2023 anketidir. Başkaları tarafından tekrarlanan temel bulgu: Kendi kendine tutarlılığa (bağımsız örnekleme + toplama) *yapısal olarak benzer* olan MAD varyantları, aynı bütçeyi kullanırken genellikle kendi kendine tutarlılığın altında performans gösterir. MAD en çok agent'ların gerçekten heterojen olduğu ve tartışmanın çekişmeli bir yapıya sahip olduğu durumlarda yardımcı olur (bir agent karşı çıkıyor).

### AgentAyet ortaya çıkan kalıplar

AgentAyet (ICLR 2024, https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) , açık bir tasarım olmasa bile çokluagent tartışmalarından ortaya çıkan iki davranışı belgelemektedir:

- **Gönüllü.** Bir agent, promptedilmeden yardım teklif eder ("Sonraki adımı atabilirim"). Yararlı: işi bir alt görev için en yetenekli agent'a tahsis eder.
- **Uygunluk.** Bir agent, eleştirmen hatalı olsa bile duruşunu eleştirmene uyacak şekilde ayarlar. Bu, dalkavukluğun tartışmadaki eşdeğeridir (Ders 14).

Uyum, anlaşmaya kadar tartışmanın zorbaları ödüllendirmesinin nedenidir. Ayrı bir hakemle sınırlı turlar hafifletilir.

### Heterojenlik: doğruluğu hareket ettiren gerçek düğme

Pratik literatürdeki 2024-2026 modeli: N agent'larınızdan birini farklı bir temel modelle değiştirmek, N'yi 1 birim artırmaktan daha büyük bir doğruluk artışı sağlar. Sezgi monokültürdür; her yeni bağımsız hata kaynağı, ek bir ilişkili örnekten daha değerlidir.

Sınırda heterojenlik çokluğu yener. Üç farklı model, net temel gerçeğe sahip çoğu görevde bir modelin beş kopyasını yener.

### Jüri yöntemleri

Sibyl framework (Minsky-LLM literatüründe alıntılanmıştır) bir "jüri" oluşturur; her aşamada oylama yoluyla yanıtları hassaslaştıran küçük bir uzman agent grubudur. Basit çoğunluk oyunlarından farklı olarak jürinin rolleri vardır: biri agent çapraz sorgu yapar, biri bağlamı sağlar, biri inandırıcılığı puanlar. Jüri yöntemleri, basit oylama (ucuz, monokültüre eğilimli) ile tam MAD (pahalı, uygunluğa eğilimli) arasında bir orta noktadır.

### Tartışmalı oylama hakim olduğunda

- Sorunun temel gerçeği var (gerçek, matematik, kod davranışı). Oy yakınlaşması anlamlıdır.
- Agent'lar farklı kaynaklara veya araçlara erişebilir (heterojenlik mevcuttur).
- Turlar sınırlıdır (tipik olarak 2-3) ve ayrı bir hakem veya doğrulayıcı vardır.
- Bütçe 3-5 agents'ye izin verir. Grafik topolojisinde 5-7'nin ötesinde koordinasyon vergisi hakimdir.

### Tartışmalı oylama acı verdiğinde

- Soru görüş şeklindedir. Agent'ler, en doğru değil, en güvenilir görünen yanıta yakınlaşır.
- Tüm agent'lar bir temel modeli paylaşıyor. Monokültür, fikir birliğini anlamsız hale getiriyor.
- Turlar sınırsızdır. Uyumluluk her zaman kazanır.
- Görev basit. N=5'te kendi kendine tutarlılığa sahip tek bir agent daha ucuz ve aynı derecede doğrudur.

## Build It — Kendin Geliştir

`code/main.py` şunu uygular:

- `run_star(agents, hub, question)` — merkez her çalışanı anketler ve toplar.
- `run_chain(agents, question)` — sıralı iyileştirme.
- `run_tree(root, children, question)` — derinlik-2 toplamayla hiyerarşik.
- `run_graph(agents, question, rounds)` — genel tartışma, sınırlı turlar.
- Yazılı bir heterojenlik kadranı: her agent, sistematik yanlışlığını gösteren bir `error_bias` 'ye sahiptir.
- Her topolojiyi N=3, 5, 7'de çalıştıran ve raporlar (doğruluk, toplam_tokens, wallclock_simulated) sağlayan bir ölçüm donanımı.

Koşmak:

```
python3 code/main.py
```

Beklenen çıktı: bir topoloji tablosu × N → (doğruluk, tokens, gecikme). Grafik, araştırma tarzı görevlerde N=3-5'te kazanır; hızlı gerçeklere dayalı görevlerde yıldız kazanır; N=7'deki grafik koordinasyon vergisini gösterir (gecikme, doğruluktan daha hızlı artar).

## Use It — Hazır Araçla Uygula

`outputs/skill-topology-picker.md` , bir görev tanımını okuyan ve bir topoloji (yıldız / zincir / ağaç / grafik), bir N (agent sayısı), bir heterojenlik profili (kullanılacak temel modeller) ve bir yuvarlak sınır öneren bir beceridir.

## Ship It — Kullanıma Sun

Herhangi bir topluluk için:

- Tek bir güçlü temel model kullanarak **N=5** düzeyinde kendi kendine tutarlılık ile başlayın. Bu ucuz temeldir.
- Doğruluk önemliyse **N=3'te heterojen oylamaya** geçin. Deltayı ölçün.
- Yalnızca görevin yapısı varsa (araştırma, çok adımlı) ve sınırlı turlar mümkünse **tartışma topolojisine** yükseltin.
- Her zaman azınlık kümesini günlüğe kaydedin. Bir azınlık ısrarla haklı olduğunda çeşitlilik sinyali alırsınız.
- Benchmark duvar saati ve tokens yanında doğruluk. "10 kat maliyetle daha iyi doğruluk" bir iş kararıdır.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Grafik topolojisi için koordinasyon vergisi eğrisini çizin: doğruluk vs N, tokens vs N. Eğri hangi N'de bükülür?
2. A-HMAD'yi uygulayın: kasıtlı olarak farklı önyargılara sahip üç agent. Tamamen aynı önyargılı temel, Ders 14'teki monokültür saldırısına ilişkin A-HMAD ile nasıl karşılaştırılır?
3. Grafik topolojisine oy vermeyen, yalnızca nihai fikir birliğini puanlayan bir "yargıç" rolü ekleyin. Bu, ortaya çıkan uyum davranışını değiştirir mi?
4. AgentAyet belgesini (ICLR 2024) okuyun. Uygulamanızın en güçlü şekilde hangi davranışı sergilediğini belirleyin. prompt değişikliğiyle zıt davranışı ortaya çıkarabilir misiniz?
5. ÇokluAgentBench (arXiv:2503.01935) Bölüm 4'ü (topoloji deneyleri) okuyun. Koşum takımınızı kullanarak kağıttaki tek bir görevde "grafik kazanır-araştırma" sonucunu yeniden üretin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Kendi kendine tutarlılık | "N kez örnek alın, oy verin" | Wang 2022. Tek model, N sıcaklık>0 örnek, muhakeme yollarında çoğunluk oyu. |
| Heterojenlik | "Farklı modeller" | Farklı temel modellerden veya prompt ailelerden oluşan topluluk. Monokültürü bozar. |
| Çılgın | "Çoklu-agent tartışma" | agent'ların turlar boyunca eleştiri alışverişinde bulunmaları için kullanılan genel terim. Bkz. Du 2023. |
| A-HMAD | "Düşmanca Heterojen MAD" | Farklı modelleri + rakip yapıyı vurgulayan MAD çeşidi. |
| Topoloji | "Kim kiminle konuşuyor" | Yıldız, zincir, ağaç, grafik. Bilgi akışını belirler. |
| Koordinasyon vergisi | "Geri dönüşlerin azalması" | Grafikte ~4 agents'nin üzerinde maliyet, kaliteden daha hızlı artar. |
| Gönüllü davranışı | "Yardımpromptedildi" | AgentAyet ortaya çıkan kalıp: bir agent bir adım atmayı teklif ediyor. |
| Uygunluk davranışı | "Anlaşma baskı altında" | AgentAyet ortaya çıkan kalıp: agent bir eleştirmenle aynı hizadadır. |
| Jüri | "Küçük özel panel" | Rolleri (araştırmacı, bağlam, puanlayıcı) olan Sibyl tarzı topluluk. |

## Daha Fazla Okuma

- [Wang ve ark. — Tutarlılık, Düşünce Zinciri Akıl Yürütmesini Geliştirir](https://arxiv.org/abs/2203.11171) — tek model temel çizgisi
- [Du ve ark. — Çokluagent Tartışma](https://arxiv.org/abs/2305.14325) Yoluyla Gerçekliği ve Akıl Yürütmeyi Geliştirmek — hem agent'lar hem de turlar bağımsız olarak önemlidir
- [ÇokluAgentTezgah / MERMER](https://arxiv.org/abs/2503.01935) — araştırma için en iyi grafiği, boru hatları için zinciri gösteren topoloji benchmark
- [Delirmeli miyiz?](https://arxiv.org/abs/2311.17371) — MAD-strateji anketi; MAD'in sıklıkla eşit bütçede kendi tutarlılığını kaybettiğini düşünüyor
- [AgentVerse (ICLR 2024)](https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) — gönüllülük ve uyumla ilgili ortaya çıkan kalıplar
- [MARBLE repo](https://github.com/ulab-uiuc/MARBLE) — benchmark uygulamasına referans
