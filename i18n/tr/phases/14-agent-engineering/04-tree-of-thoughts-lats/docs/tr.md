# Düşünceler ve Yöntemler Ağacı: Kasıtlı Arama

> Tek bir düşünce zinciri yörüngesinde geriye dönmek için yer yoktur. ToT (Yao et al., 2023) mantıklaşmayı her düğümde kendi kendini değerlendirme ile bir ağaca dönüştürür. LATS (Zhou et al., 2024) Monte Carlo Ağacı Araması altında ToT ile ReAct ve Reflexion'ı birleştirir. 24'in oyunu% 4'ten (CoT) % 74'e (ToT) gidiyor; LATS HumanEval'de% 92.7'e ulaşır.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 03 (Reflexion)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Arama gibi çerçeve mantığı: düğümler "fikirler", kenarlar "genişlemeler", değer "ne kadar umut verici".
- Kendini değerlendirmekle stdlib ToT tarzı BFS ağaç araması uygulayın.
- Seçim / genişletme / simülasyon / geri yayılma ile oyuncak LATS MCTS döngüsüne uzan.
- Arama ne zaman jeton katılayıcısına değer olduğunu (24'in oyunu, kod üretimi) ve tek bir yoldaki yeterli olduğunu (sadece S&A) karar verin.

## Sorun

Düşünce zinciri bir çizgici yürüyüştür. Eğer ilk adım yanlış ise, sonraki her adım kötü bir varsayım üzerinde çalışır. 24 Oyunda (+ − × ÷ ile dört rakam kullanın 24 yapmak için), GPT-4 CoT% 4 doğruluğa ulaşır.

Düşünceye ihtiyaç duyulan şey, birden fazla aday önerme, değerlendirme, umut verici olanları seçme ve kapalı uçlar ortaya çıktığında geri adım atma yeteneğidir.

## Anlaşım

### Düşünceler Ağacı (Yao et al., NeurIPS 2023)

Her düğüm, tutarlı bir orta adım ("bir düşünce") dir. Her düğüm K çocuk düşüncelerine genişleyebilir. LLM, her düğümü bir puanlama sorgulaması ile kendiliğinden değerlendirir. Arama ağacı  BFS, DFS veya ışın keşfeder.

```
                     (root: "find 24 from 4 6 4 1")
                    /               |            \
           ("6 - 4 = 2")    ("4 + 1 = 5")    ("4 * 6 = 24")  <- Score: HIGH
              /   \              |                  |
          ...    ...          ...                finish
```

Kendini değerlendirmek yük taşıyan bir parça.`sure / likely / impossible`sınıflandırma, `1..10`İddianlar arasında oylama ve sayısal puan.

### LATS (Zhou et al., ICML 2024)

LATS, MCTS'de ToT, ReAct ve Reflexion'ı birleştirir. LLM üç rol oynar:

- **Policy**: aday olarak bir sonraki eylemleri önerin (ReAct tarzı).
- **Value function**: kısmi bir yoldur (ToT tarzı kendi kendine değerlendirme).
- **Self-reflector**Bu nedenle, bu programın başarısız olması durumunda, doğal dilde bir yansıma (Yansıma tarzı) yazın ve onu gelecekteki yayımları yeniden düşünmek için kullanın.

Çevre geri bildirimleri ( gözlemler) değer fonksiyonuna karışır, böylece arama sadece model görüşleri değil, gerçek araç sonuçları ile bilgilendirilir. Kağıt zamanında sonuçlar: HumanEval pass@1 92.7% GPT-4 (SOTA), WebShop ortalaması 75.9 GPT-3.5 ile (gelişmiş gradient tabanlı ince ayarlama).

### MCTS, en az

Her iterasyon için dört aşama:

1. **Select** UCT (Ağaçlara bağlı üst güven) kullanarak kökten yapraklara yürüyün.
2. **Expand** politika yoluyla K çocukları doğurmak.
3. **Simulate** politikayı kullanan bir çocuğun dağıtımı, değer işlevi (veya çevre ödülü) ile sayfayı puanlayın.
4. **Backpropagate** ziyaret sayısını ve değer tahminlerini güncelleme yolu.

UCT formülü: `Q(s, a) + c * sqrt(ln N(s) / N(s, a))`Birinci terim sömürüdür, ikincisi keşif.`c`Görev başına.

### Maliyet gerçekliği

Arama jetonları patlatır. ToT on Game of 24 CoT jetonlarının 1001000x'ini kullanır. LATS benzer. Bu ücretsizdir; rezerve arama için:

- Tek bir yoldaki görevler kanıtlanmış olarak yetersiz (Game of 24, karmaşık kod).
- Duvar saati doğru olmaktan daha az önemli olan görevler.
- Ucuz ve güvenilir bir değer fonksiyonu olan görevler (kod için birim testleri, matematik için açık hedef).

Göreviniz tek doğru cevabı ve gürültülü bir değerlendirmeci varsa, arama genellikle işleri daha da kötüleştirir  "iyi puan" yanlış bir cevap bulur.

### 2026 konumlandırma

Çoğu üretim ajanı LATS çalıştırmaz. Araç tabanlı doğrulama ile ReAct çalıştırırlar (CRITIC, Ders 05). Arama uzmanlık nişlerinde görünür:

- Değer fonksiyonu olarak testleri yapan kodlama ajanları (HumanEval tarzı).
- Çoklu sorgu yollarını keşfeden derin araştırma ajanları.
- LangGraph altgrafları içinde planlama ağır iş akışları.

AlphaEvolve (Disim 11) 2025'in aşırılığıdır: kod üzerinde evrimsel arama, makine kontrol edilebilir fitness, sınır kazançları (56 yıl içinde ilk 4x4 matmul gelişim).

```figure
tree-of-thoughts
```

## Yapın

`code/main.py`Uygulamaları:

- "Seçim aritmetik operasyonları" görevinde küçük bir ToT BFS.
- UCT seçimi ile aynı görev üzerinde bir oyuncak LATS MCTS döngüsü (Seçim / Genişlet / Simülasyon / Geri Yayınlama).
- Simvolik puan artı kendi başına değer puanı oluşturan bir değer fonksiyonu.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

İzleme, ToT'nin BFS ile bir düğüm başına üç aday genişletilmesini, LATS'in MCTS üzerinden en iyi dağıtımda birleştiğini göstermektedir.

## Kullan

LangGraph, ToT tarzı keşifini altgraf kalıpları olarak gönderir; LangChain ekibinin LATS'deki blogu (Mayıs 2024) referans öğretmenidir. LlamaIndex bir `TreeOfThoughts`2026 üretim ajanlarının çoğu için bu model bir`if task_complexity > threshold: use_search()`gate  ders 05'teki değerlendirici-optimizeci örneğini gör.

## Gönder

`outputs/skill-search-policy.md`Görev biçimi, bütçe ve değerlendirici sadakati verildiği için lineer ReAct, ToT, LATS ve evrimsel arama arasında seçimler yapar.

## Egzersizler

1. Oyuncak LATS'i UCT c=0.1 vs c=2.0 ile çalıştır.
2. MCTS hala en iyi yaprakı bulur mu? en az sinyal-gürültü toleransı nedir?
3. Beam-search ToT uygulamak (her seviyede en üst düzeyde tutun) ve BFS ile karşılaştırın.
4. LATS Bölümü 5.1'i okuyun. HumanEval yörüngesi sayısını yeniden üretin: bildirilen geçit@1'e ulaşmak için kaç çıkış gerekiyor?
5. LATS makalesindeki "LATS daha az yardımcı olduğunda" konusundaki tartışmayı okuyun. Arama stratejisine göre bir paragraflı bir karar kuralını yazın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Tree of Thoughts | "Branching CoT" | Yao et al. — tree of thought nodes with self-evaluation |
| LATS | "MCTS for LLMs" | Zhou et al. — unifies ToT + ReAct + Reflexion under MCTS |
| UCT | "Upper confidence bound" | Select formula balancing exploitation (Q) and exploration (ln N / n) |
| Value function | "How good is this state" | Prompted LLM score or environment reward; feeds backprop |
| Policy | "Action proposer" | ReAct-style generator; emits candidate next thoughts/actions |
| Rollout | "Simulated trajectory" | Walk from a node to a leaf using policy, score with value |
| Backpropagate | "Update ancestors" | Push the leaf's reward up the path, updating visit counts and Q |
| Search cost | "Token explosion" | 100-1000x CoT on Game of 24; budget before you adopt |

## Daha Fazla Okumak

- [Yao et al., Tree of Thoughts (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) Kanonik kağıt
- [Zhou et al., LATS (arXiv:2310.04406)](https://arxiv.org/abs/2310.04406) MCTS'ler Refleksiyon geri bildirimleri ile
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) Arama için altgraf modelleri
- [AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) Programatik değerlendirmecilerle evrimsel araştırma
