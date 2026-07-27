# Düşünce Ağacı ve LATS: Kasıtlı Arama

> Tek bir düşünce zinciri yörüngesinin geriye doğru izlenecek yeri yoktur. ToT (Yao ve diğerleri, 2023), muhakemeyi her düğümde öz değerlendirmenin olduğu bir ağaca dönüştürür. LATS (Zhou ve diğerleri, 2024), Monte Carlo Ağaç Araması altında ToT'yi ReAct ve Reflexion ile birleştirir. 24'lü Oyun %4'ten (CoT) %74'e (ToT) çıkıyor; LATS, HumanEval'de %92,7 pass@1'e ulaştı.

**Tür:** Yapım
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 01 (Agent Loop), Aşama 14 · 03 (Yansıma)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Arama olarak çerçeve muhakemesi: düğümler "düşüncelerdir", kenarlar "genişlemelerdir", değer ise "ne kadar umut vericidir".
- Öz değerlendirme puanlamasıyla stdlib ToT tarzı BFS ağaç araması uygulayın.
- Seçme / genişletme / simüle etme / geri yayma ile oyuncak bir LATS MCTS döngüsünü genişletin.
- Aramanın ne zaman token çarpanına değeceğine (24'lü oyun, kod oluşturma) ve tek bir yörüngenin ne zaman yeterli olacağına (basit Soru-Cevap) karar verin.

## Sorun

Düşünce zinciri doğrusal bir yürüyüştür. İlk adım yanlışsa, sonraki her adım kötü bir temele dayalı olarak işler. 24'lü Oyunda (24 yapmak için + − × ÷ ile dört rakamı kullanın), GPT-4 CoT %4 doğruluğa ulaşır. Model yanlış alt ifadeyi erken seçer ve düzelemez.

Akıl yürütmenin ihtiyaç duyduğu şey, birden fazla aday önerme, bunları değerlendirme, ümit verici olanları seçme ve çıkmaz sokaklar ortaya çıktığında geriye doğru izleme becerisidir. Bu aramadır. Düşünce Ağacı ve LATS iki kanonik formülasyondur.

## Konsept

### Düşünce Ağacı (Yao ve diğerleri, NeurIPS 2023)

Her düğüm tutarlı bir ara adımdır ("bir düşünce"). Her düğüm K kadar çocuk düşüncesine genişleyebilir. LLM, her düğümü bir prompt puanlamasıyla kendi kendine değerlendirir. Arama, ağacı (BFS, DFS veya kiriş) araştırır.

```
                     (root: "find 24 from 4 6 4 1")
                    /               |            \
           ("6 - 4 = 2")    ("4 + 1 = 5")    ("4 * 6 = 24")  <- Score: HIGH
              /   \              |                  |
          ...    ...          ...                finish
```

Öz değerlendirme, yük taşıyan parçadır. Makalede üç değişken gösteriliyor: `sure / likely / impossible` sınıflandırması, `1..10` sayısal puanı ve adaylar arasındaki oylama. Üçü de CoT'yi Game of 24'te önemli ölçüde yendi (%4 -> %74, GPT-4 ile).

### LATS (Zhou ve diğerleri, ICML 2024)

LATS, ToT, ReAct ve Reflexion'u MCTS altında birleştirir. LLM üç rol oynar:

- **Politika**: adayın sonraki eylemlerini önerin (ReAct tarzı).
- **Değer fonksiyonu**: kısmi bir yörünge puanlayın (ToT tarzı öz değerlendirme).
- **Kendini yansıtan**: başarısızlık durumunda, doğal dilde bir yansıma (Yansıma stili) yazın ve bunu gelecekteki kullanıma sunma işlemlerini yeniden başlatmak için kullanın.

Ortam geri bildirimi (gözlemler) değer fonksiyonuna karışır, böylece arama yalnızca model görüşleriyle değil, gerçek araç sonuçlarıyla da bilgilendirilir. Kağıt zamanındaki sonuçlar: HumanEval pass@1 GPT-4 (SOTA) ile %92,7, WebShop ortalaması GPT-3,5 ile 75,9 (gradient tabanlı fine-tuning'ye yaklaşıyor).

### MCTS, minimum düzeyde

Yineleme başına dört aşama:

1. **Seç** — UCT (ağaçlar için üst güven sınırı) kullanarak kökten yaprağa doğru yürüyün.
2. **Genişlet** — politika aracılığıyla K alt öğe oluşturun.
3. **Simüle** — politikayı kullanan bir çocuktan uygulamaya alın, yaprağı değer fonksiyonuyla (veya çevre ödülüyle) puanlayın.
4. **Geriye yayma** — ziyaret sayılarını ve değer tahminlerini yol boyunca güncelleyin.

UCT formülü: `Q(s, a) + c * sqrt(ln N(s) / N(s, a))`. Birinci terim sömürüdür; ikincisi keşif. Görev başına `c`'yi ayarlayın.

### Maliyet gerçeği

Arama token'leri patlatır. Game of 24'teki ToT, CoT'nin token'lerinin 100-1000 katını kullanır. LATS benzerdir. Bu ücretsiz değil; rezerve araması:

- Tek bir yörüngenin açıkça yetersiz olduğu görevler (24'lü Oyun, karmaşık kod).
- Duvar saatinin doğruluğundan daha az önemli olduğu görevler.
- Ucuz, güvenilir değer fonksiyonuna sahip görevler (kod için birim testleri, matematik için açık hedef).

Görevinizin tek bir doğru cevabı ve gürültülü bir değerlendiricisi varsa, arama genellikle işleri daha da kötüleştirir; "iyi puan alan" bir yanlış cevap bulur.

### 2026 konumlandırma

Üretim agent'lerin çoğu LATS'yi çalıştırmaz. ReAct'i araca dayalı doğrulamayla çalıştırıyorlar (CRITIC, Ders 05). Arama özel nişlerde görünür:

- Değer işlevi olarak testleri çalıştıran agent'lerin kodlanması (HumanEval tarzı).
- Birden fazla sorgu yolunu keşfeden agent'leri derinlemesine araştırın.
- LangGraph alt grafiklerinde planlama ağırlıklı iş akışları.

AlphaEvolve (Ders 11) 2025'in en uç noktasıdır: kod üzerinde evrimsel arama, makine tarafından kontrol edilebilir uygunluk, sınır kazanımları (56 yılda ilk 4x4 matmul iyileştirmesi).

## İnşa Et

`code/main.py` şunu uygular:

- Stilize edilmiş bir "aritmetik işlem seçme" görevinde küçük bir ToT BFS.
- UCT seçimiyle aynı görevde (Seç / Genişlet / Simüle Et / Geri Yayılım) oyuncak bir LATS MCTS döngüsü.
- Sembolik bir puan artı bir öz değerlendirme puanı oluşturan bir değer fonksiyonu.

Çalıştır:

```
python3 code/main.py
```

İzleme, LATS'nin MCTS yoluyla en iyi kullanıma sunma konusunda yakınsamasına kıyasla ToT'nin BFS ile düğüm başına üç adayı genişlettiğini gösteriyor. Token her ikisi için de yazdırılan sayıları sayar.

## Kullan onu

LangGraph, ToT tarzı araştırmayı alt grafik desenleri olarak gönderir; LangChain ekibinin LATS'deki blogu (Mayıs 2024) referans eğitimdir. LlamaIndex bir `TreeOfThoughts` agent gönderir. Çoğu 2026 üretimi agent için bu model bir `if task_complexity > threshold: use_search()` kapısının arkasında yaşar - Ders 05'teki değerlendirici-optimizasyon modeline bakın.

## Gönderin

`outputs/skill-search-policy.md`, görev şekli, bütçe ve değerlendiricinin uygunluğuna göre doğrusal ReAct, ToT, LATS ve evrimsel arama arasında seçim yapar.

## Egzersizler

1. LATS oyuncağını UCT c=0,1 ve c=2,0 ile çalıştırın. İzde ne gibi değişiklikler olur?
2. Değer fonksiyonunu daha gürültülü bir golcüyle değiştirin (rastgele titreşim ekleyin). MCTS hâlâ en iyi yaprağı buluyor mu? Tolere ettiği minimum sinyal-gürültü nedir?
3. Işın arama ToT'yi uygulayın (her seviyede en üstteki k'yi koruyun) ve BFS ile karşılaştırın. Dar bir token bütçesinde hangisi daha iyi?
4. LATS Bölüm 5.1'i okuyun. HumanEval yörünge sayısını yeniden oluşturun: rapor edilen pass@1'e ulaşmak için kaç tane sunum gerekiyor?
5. LATS makalesinin "LATS daha az yardımcı olduğunda" hakkındaki tartışmasını okuyun. Görev şeklini arama stratejisine eşleyen tek paragraflı bir karar kuralı yazın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Düşünce Ağacı | "CoT'nin Dallara Ayrılması" | Yao ve ark. — öz değerlendirmeli düşünce düğümleri ağacı |
| LAT | "LLM'ler için MCTS" | Zhou ve diğerleri. — MCTS kapsamında ToT + ReAct + Reflexion'ı birleştiriyor |
| UCT | "Üst düzey güven sınırı" | Kullanımı (Q) ve keşfi (ln N / n) dengeleyen formülü seçin |
| Değer fonksiyonu | "Bu durum ne kadar iyi" | Prompted LLM puanı veya çevre ödülü; arka pervaneyi besliyor |
| Politika | "Eylem teklif eden" | ReAct tarzı jeneratör; adayın sonraki düşüncelerini/eylemlerini yayınlar |
| Kullanıma Sunma | "Simüle edilmiş yörünge" | İlkeyi kullanarak bir düğümden yaprağa yürüyün, değerle puanlayın |
| Geri yayılım | "Ataları güncelle" | Ziyaret sayılarını ve Q |
| Arama maliyeti | "Token patlaması" | 24'lü Oyunda 100-1000x CoT; benimsemeden önce bütçe |

## Daha Fazla Okuma

- [Yao ve diğerleri, Düşünce Ağacı (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) — kanonik makale
- [Zhou ve diğerleri, LATS (arXiv:2310.04406)](https://arxiv.org/abs/2310.04406) — Yansıma geri beslemeli MCTS
- [LangGraph'a genel bakış](https://docs.langchain.com/oss/python/langgraph/overview) — arama için alt grafik desenleri
- [AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) — programatik değerlendiricilerle evrimsel arama
