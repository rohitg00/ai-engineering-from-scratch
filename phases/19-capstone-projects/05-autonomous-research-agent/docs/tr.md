# Bitirme Taşı 05 — Otonom Araştırma Agent (Yapay Zeka Bilim Adamı Sınıfı)

> Sakana'nın AI-Scientist-v2 tam makalelerini yayınladı. Agent Laboratuvarı deneyleri yürüttü. Allen AI izleri paylaştı. 2026 şekli, deneyler üzerinde planla-yürüt-doğrula ağaç araması, bütçelenmiş maliyet, korumalı alanda kod yürütme, vizyon geri bildirimi LaTeX yazıcısı ve otomatik NeurIPS tarzı inceleme topluluğudur. Önemli olan bir tane inşa etmek, onu kağıt başına 30 dolar maliyetle uçtan uca çalıştırmak ve Sakana'nın belgelediği kum havuzundan kaçış kırmızı ekibinden sağ çıkmak.

**Tür:** Kapak taşı
**Diller:** Python (agent + korumalı alan), LaTeX (çıkış)
**Önkoşullar:** Aşama 2 (ML), Aşama 3 (deep learning), Aşama 7 (transformers), Aşama 10 (sıfırdan LLM'ler), Aşama 14 (agents), Aşama 15 (otonom), Aşama 16 (çoklu-agent), Aşama 18 (güvenlik)
**Uygulanan aşamalar:** P0 · P2 · P3 · P7 · P10 · P14 · P15 · P16 · P18
**Süre:** 40 saat

## Sorun

Otonom araştırma agent'lar 2026'da bir eşiği aştı. Sakana AI'nın AI-Scientist-v2'si, atölye akran değerlendirmesini geçen, oluşturulan makalelerle birlikte Nature'da yayınlandı. ShinkaEvolve (ICLR 2026) çizgiyi gelişen hipotezlere kadar genişletti. AMD'nin Agent Laboratuvarı tekrarlanabilir izler gönderdi. agent'lar sihir değil; bunlar, aday deneylerden oluşan bir ağaç üzerinde çalışan, maliyet üst sınırları, tohuma bağlı sanal alanlar ve otomatik inceleme ile bir planla-yürüt-doğrula döngüsüdür. Zanaat döngünün içinde, bütçede ve güvenlik hikayesinde.

Döngüyü, dar bir alanda bir tohum fikrine karşı bir fikir uygulayarak öğrenirsiniz (örneğin, 100M parametreli bir transformer üzerinde dikkat seyrekliği ablasyonları). Önemli olan ilk denemede yeni bir şey keşfetmek değil. Değer altyapıdadır: ağaç arama, deney sanal alanı, yazar-inceleyici döngüsü, kırmızı takım raporu. Sakana ekibi sanal alandan kaçış başarısızlıklarını belgeledi; agent'ınız aynı kırmızı takımı geçmelidir.

## Konsept

agent en iyi ilk ağaç aramasıdır. Düğümler deney spesifikasyonlarıdır: (hipotez, yapılandırma, kod, beklenen sonuç). Genişletme adımı, çocuklara küçük düzenlemeler (iyileştiriciyi değiştirme, parti boyutunu değiştirme, bir bileşeni çıkarma) önerir. Her çocuk, sabit kaynak sınırına sahip yeni bir sanal alanda çalışır. Sonuçlar, düğümleri (yenilik × kalite × kalan bütçe) göre sıralayan bir puanlama işlevine geri bildirim sağlar. Ağaç bütçe bitene kadar büyür, sonra en iyi dal yazılır.

Yazar çok modludur. Bir LaTeX taslağı oluşturur, onu derler, şekiller oluşturur ve oluşturulan PDF'yi düzen, şekil okunabilirliği ve iddia-kanıt hizalaması konularında eleştiri için Claude Opus 4.7'nin görüş moduna geri gönderir. Beş LLM jürisinden oluşan bir inceleme topluluğu, NeurIPS tarzı puanlar (yenilik, titizlik, netlik, tekrarlanabilirlik, etki) yayar; ortalama eşiğin altına düşerse makale eleştiriyle birlikte yazara geri döner.

Güvenlik yük taşır. Her deney, ağ çıkışı olmayan, sınırlı duvar saati ve sabitlenmiş kaynak sınırları olmayan bir E2B veya Daytona sanal alanında çalışır. agent'ın kod oluşturma adımı, korumalı alandan kaçan sistem çağrılarını engelleyen bir politika katmanından geçer. Kırmızı takım raporu, Sakana tarafından belgelenen saldırı yüzeyini yeniden üretiyor (çatal bombaları, dosya sistemi kaçışları, LLM tarafından yazılan ağ çağrıları).

## Mimarlık

```
seed idea + domain
      |
      v
  literature search (Semantic Scholar + OpenAlex + FAISS cache)
      |
      v
  LangGraph plan-execute-verify tree
      |
      v
  +--- expand node ----+      per-node sandbox
  |                    |      (E2B / Daytona)
  v                    v      resource caps
  child_1           child_k   no network egress
  |                    |      deterministic seeds
  v                    v
  run experiment       run experiment
  |                    |
  v                    v
  score nodes by (novelty, quality, budget)
      |
      v
  best branch -> LaTeX writer
      |
      v
  compile + vision critique (Opus 4.7 vision)
      |
      v
  reviewer ensemble (5 LLM judges, NeurIPS rubric)
      |
      v
  paper.pdf + review.md + trace.json
```

## Yığın

- Düzenleme: Kontrol noktası belirleme ve insan onayı kapılarına sahip LangGraph
- Ağaç arama: deney düğümleri üzerinde özel en iyi ilk (Sakana v2'den AB-MCTS stili)
- Sandbox: Deney başına E2B, Docker-in-Docker geri dönüşü; Gruplar aracılığıyla kaynak sınırları
- Literatür: Semantic Scholar Graph API + OpenAlex + özetlerin yerel FAISS önbelleği
- Yazar: Şekil eleştirisi ve düzen için LaTeX şablonu + Claude Opus 4.7 (görüş modu)
- İncelemeci: ağırlıklı toplamalı 5 jüri üyesinden oluşan topluluk (Opus 4.7, GPT-5.4, Gemini 3 Pro, DeepSeek R1, Qwen3-Max)
- Deney framework: Fiziksel deneyler için PyTorch 2.5, kayıt için W&B
- Observability: agent iz için Langfuse, kağıt başına 30 ABD doları tutarında kesin bütçe

## Build It — Kendin Geliştir

1. **Çekirdek ve etki alanı kapsamı.** Bir tohum fikri alın (e.g., "1B alt transformer'ların dikkat haritalarındaki seyreklik modellerini araştırın"). Arama alanını tanımlayın: modeller, dataset'ler, hesaplama bütçesi.

2. **Literatür geçişi.** En çok alıntı yapılan 50 ilgili makale için Semantic Scholar + OpenAlex'i sorgulayın; özetleri yerel olarak önbelleğe alın; 1 sayfalık bir etki alanı özeti oluşturun.

3. **Ağaç iskelesi.** Kökü tohum hipoteziyle başlatın. `expand(node) -> children` 'yi küçük düzenleme önerileriyle uygulayın (alt öğe başına bir yapılandırma değişikliği). `score(node)` 'i ağırlıklı yenilik × kalite × bütçe dönemi olarak uygulayın.

4. **Korumalı alan sarma.** Her deney `docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only` (veya eşdeğer E2B politikası) çalıştırır. Tohumlar kum havuzuna yazılır; çıkışlar salt okunur olarak arka tarafa monte edilir.

5. **Planla-yürüt-doğrula döngüsü.** `plan` çocukları önerir. `execute` korumalı alanı çalıştırır, günlükleri ve ölçümleri yakalar. `verify` , metrikler üzerinde birim kontrolleri gerçekleştirir (kayıp azaldı mı? Ablasyon etkiyi izole etti mi?). Başarısız düğümler ağaçta saklanan bir hata nedeni alır.

6. **Yazar.** Bütçeden sonra en iyi branşı seçin. Şekilleri matplotlib ile işleyin. Claude Opus 4.7 aracılığıyla dal izlemeyi bağlam içinde içeren bir LaTeX taslağı oluşturun. Derleyin. Derlenmiş PDF'yi eleştiri için Opus 4.7 vizyonuna geri gönderin. Yineleyin.

7. **İnceleme ekibi.** Beş jüri üyesi taslağı NeurIPS tarzı değerlendirme listeleriyle (yenilik, titizlik, netlik, tekrarlanabilirlik, etki) puanlıyor. Ortalama < 4.0/5 ise, eleştiriyle yazara geri dönün. 3 yeniden yazmadan sonra sert durma.

8. **Kırmızı takım.** Korumalı alanı hedef alan bir dizi düşmanca görev oluşturun veya entegre edin: çatal bombaları, ağdan sızma girişimleri, dosya sistemi kaçışları, LLM ile yazılmış kabuk meta karakterleri. Tümünün engellendiğini onaylayın. Bulguları yazın.

9. **Tekrarlanabilirlik.** Her makale, ağaç arama izi JSON'u, tohumları, W&B çalıştırma bağlantıları, korumalı alan yapılandırmaları ve onu uçtan uca yeniden üreten bir README ile birlikte gönderilir.

## Use It — Hazır Araçla Uygula

```
$ ai-scientist run --seed "attention sparsity in sub-1B transformers" --budget 30
[lit]    50 papers, digest in 12s
[tree]   expanded 8 nodes, budget 12/30
[exec]   node #3 sparsity=top-8, loss=2.83 (best so far)
[exec]   node #6 sparsity=top-4, loss=3.12 (worse)
[exec]   ...
[tree]   chose branch rooted at node #3 (novelty 0.62, quality 0.81)
[write]  LaTeX draft v1 complete
[vision] critique: figure 2 legend too small, claim-evidence ok
[write]  draft v2 after 3 edits
[review] mean 4.2/5 (novelty 3.9, rigor 4.3, clarity 4.1, repro 4.5, impact 4.2)
[done]   paper.pdf + review.md + trace.json     $28.40 spent
```

## Ship It — Kullanıma Sun

`outputs/skill-ai-scientist.md` teslim edilebilirdir. Bir başlangıç ​​fikri + bir alan adı + 30 ABD Doları tutarında bir bütçe verildiğinde, tüm süreci yürütür ve gözden geçirilebilir bir makalenin yanı sıra bir tekrarlanabilirlik paketi yayınlar.

| Ağırlık | Kriter | Nasıl ölçülür |
|:-:|---|---|
| 25 | Kağıt kalitesi | Yayınlanan çalıştay makalelerine karşı kör değerlendirme değerlendirmesi |
| 20 | Deneysel titizlik | Taban çizgileri, tohumlar, ablasyonlar; sonuç tablosundaki bir hücre tarafından desteklenen her iddia |
| 20 | Maliyet ve bilgi işlem disiplini | 30$/kağıt tavan uygulanıyor, Langfuse takibi |
| 20 | Güvenlik | Sandbox kırmızı takımı pas verir; ağ politikası ve kill-switch doğrulandı |
| 15 | Tekrarlanabilirlik | Aynı tohumlarla tek komutla yeniden çalıştırma, kağıdı yeniden üretir |
| **100** | | |

## Egzersizler

1. İşlem hattını aynı alandaki üç farklı tohum fikrine göre çalıştırın. Ağaç aramanın hangi bölümlerinin örtüştüğünü karşılaştırın. Yinelenen boşa harcanan işlemleri tanımlayın.

2. Tahmini 5 doların üzerinde olan düğümler için denemenin yürütülmesinden önce döngüdeki insan geçidini ekleyin. Toplam maliyetin ne kadar düştüğünü ölçün.

3. İnceleme ekibini tek bir hakemle değiştirin. Kötü olduğu bilinen kağıtlardan oluşan bir dizi üzerinde yanlış kabul oranını ölçün.

4. Ağdan sızma kırmızı takım testi uygulayın: agent, harici bir adrese `curl` ulaşmaya çalışan bir kod yazar. `--network=none` politikasının onu engellediğini onaylayın. Denemeyi günlüğe kaydedin.

5. Ağaç aramanızı düz rastgele bir temel ile karşılaştırın (aynı bütçe, genişleme stratejisi yok). Yenilik × kalite kazanımını bildirin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Ağaç arama | "AB-MCTS tarzı genişletme" | Yenilik×kalite×bütçe puanıyla deneme düğümleri üzerinde en iyi ilk keşif |
| Korumalı alan | "İzolasyonu deneyin" | Ağsız, sınırlı CPU/bellekli, sabitlenmiş tohumlu, salt okunur girişli kapsayıcı |
| Vizyon eleştirisi | "Oluştur ve sonra oku" | Makaleyi PDF olarak derleyin, düzen ve iddia kanıtı eleştirisi için PDF'yi bir VLM'ye geri gönderin |
| Eleştirmen topluluğu | "Otomatik hakem değerlendirmesi" | Çok sayıda Yüksek Lisans jürisi makaleyi NeurIPS değerlendirme tablosuyla puanlıyor; ağırlıklı agrega boru hattının kapaklarını |
| Yenilik puanı | "Bu yeni mi?" | 50 kağıtlık literatür önbelleğine yakınlığı cezalandıran buluşsal yöntem |
| Maliyet tavanı | "$ bütçe" | Kağıt başına toplam harcamaya ilişkin sert tavan; Langfuse sayaçları + çalışma öncesi tahminler |
| Kırmızı takım | "Korumalı alandan kaçış denetimi" | Politikanın yanlış olması durumunda sanal alandan kaçabilecek çekişmeli görevler |

## Daha Fazla Okuma

- [Sakana AI-Scientist-v2 deposu](https://github.com/SakanaAI/AI-Scientist-v2) — referans üretim araştırması agent
- [Sakana AI-Scientist-v1 makalesi (arXiv:2408.06292)](https://arxiv.org/abs/2408.06292) — orijinal metodoloji
- [ShinkaEvolve (Sakana ICLR 2026)](https://sakana.ai) — evrimsel uzantı
- [Agent Laboratuvar (AMD)](https://github.com/SamuelSchmidgall/AgentLaboratory) — çok rollü araştırma laboratuvarı framework
- [LangGraph dokümantasyonu](https://langchain-ai.github.io/langgraph/) — düzenleme katmanına referans
- [Semantic Scholar Graph API](https://api.semanticscholar.org/) — literatür araması
- [E2B sanal alanları](https://e2b.dev) — deneme izolasyonuna referans
- [NeurIPS inceleme kuralları](https://neurips.cc/Conferences/2026/Reviewer-Guidelines) — inceleme ekibinin kodladığı değerlendirme listesi
