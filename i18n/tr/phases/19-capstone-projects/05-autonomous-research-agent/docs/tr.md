# Capstone 05  Özerk Araştırma Ajanı (AI-Bilimci Sınıfı)

> Sakana'nın AI-Scientist-v2'si tam makaleler yayınladı. Ajan Laboratuvar deneyleri yaptı. Allen AI izleri paylaştı. 2026 şekli plan-ürüten-gelen-tutar ağacı araştırması deneyler, bütçeli maliyet, kum kutu kod yürütme, bir görüntü geri bildirim LaTeX yazarı ve otomatik NeurIPS tarzı incelemeci ansambludur. Son taş, bir tane inşa etmek, her kağıda 30 dolarlık bir değer içinde çalıştırmak ve Sakana'nın belgelendiği kum kutudan kaçan kırmızı takımdan kurtulmaktır.

**Type:** Capstone
**Languages:** Python (agent + sandbox), TypeScript, LaTeX (output)
**Prerequisites:** Phase 2 (ML), Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 18 (safety)
**Phases exercised:**P0 · P2 · P3 · P7 · P10 · P14 · P15 · P16 · P18
**Time:** 40 hours

## Sorun

Özerk araştırma ajanları 2026'da bir eşiği geçti. Sakana AI'nin AI-Bilimci-v2'si, atölye eşcinsel incelemesini onaylayan oluşturulan makalelerle Nature'de yayınlandı. ShinkaEvolve (ICLR 2026) çizgisini gelişen hipotezlere uzattı. AMD'nin ajan laboratuvarı yeniden üretilebilir izler gönderdi. Ajanlar sihirli değiller. Onlar bir plan-üretme-güvenleme döngüsüdür. Başvuru deneylerinin ağacının üzerinde çalışmaktadır. Masraf limitleri, tohum bağlanmış kum kutuları ve otomatik inceleme ile. Geminin durumu, bütçesi ve güvenlik hikâyesi.

Sık bir alanda bir tohum fikri karşı bir uygulamakla döngüyü öğreniyorsunuz (örneğin, 100M-parametr transformatöründe dikkat-sparsity ablations). Değer ilk kez yeni bir şey keşfetmek değil. Değer altyapıda: ağaç araması, deney kum kutusu, yazar-tâvsiyeci döngüsü, kırmızı ekip raporunda. Sakana ekibi kum kutu kaçış başarısızlıklarını belgeledi. Ajan aynı kırmızı takımı geçmeli.

## Anlam

Ajan ağaç araması için ilk önce en iyi yöntemdir. Kısımlar deney özellikleri: (hipotez, yapılandırma, kod, beklenen sonuç). Genişleme adımları küçük düzenlemelerle (swap optimizer, şifte parti boyutu, bir bileşenyi ablate) çocuklara önerir. Her çocuk sert bir kaynak kapısı ile taze bir kum kutusu içinde koşar. Sonuçlar, düğümleri (yenilik × kalite × kalan bütçe) ile sıralayan bir puanlama fonksiyonuna geri döner. Bütçe bitene kadar ağaç büyür, sonra en iyi dal yazılır.

Yazar çok modaldir. LaTeX taslakını oluşturur, birleştirir, rakamları gösterir ve gösterilen PDF'yi Claude Opus 4.7'in görme moduna geri gönderir. Beş LLM yargıçından oluşan bir inceleme grubu NeurIPS tarzı puanlar (yenilik, titizlik, netlik, yeniden üretilebilirlik, etki) verir; ortalama eşiğin altında düşerse makale eleştirilerle yazarın yanına döner.

Güvenlik yük taşıyan bir şey. Her deney, ağ çıkışı, sınırlı duvar saati ve sabit kaynak sınırları olmayan bir E2B veya Daytona kum kutusu içinde çalışır. Ajanın kod üretimi adımları kum kutusuyla kaçan sistem çağrılarını engelleyen bir politika katmanından geçer. Kırmızı takım raporu Sakana belgelenmiş saldırı yüzeyini (kırmızı bombalar, dosya sistemi kaçışları, LLM yazılı ağ çağrıları) yeniden üretir.

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

## Yüküm

- Orkestralama: Kontrol noktaları ve insan onay kapıları olan LangGraph
- Ağaç araması: özel en iyi ilk deney düğümleri (AB-MCTS tarzı Sakana v2)
- Kum Kutusu: E2B her deney, Docker-in-Docker geri dönüş; kaynak sınırlamaları cgrouplar üzerinden
- Edebiyat: Semantic Scholar Graph API + OpenAlex + yerel FAISS soyutları önbelleği
- Yazar: LaTeX şablonu + Claude Opus 4.7 (görüş modu) resimler eleştirisi ve düzen için
- Eleştirmen: 5 yargıçtan oluşan grup (Opus 4.7, GPT-5.4, Gemini 3 Pro, DeepSeek R1, Qwen3-Max) ağırlıklı bir toplama ile
- Deneyim çerçevesini: Fiziksel deneyler için PyTorch 2.5, ağaç kesimi için W&B
- Gözlem: Ajan izleri için Langfuse, her kağıda 30 dolarlık zor bütçe

```figure
ce-experiment-tree
```

## Yapın

1. **Seed and domain scoping.**Bir tohum fikri alın (örneğin, "sub-1B transformörlerinin dikkat haritalarında sıvışıklık kalıplarını araştırın"). Arama alanını tanımlayın: modeller, veri kümeleri, hesaplama bütçesi.

2. **Literature pass.**En çok alıntılanan 50 ilgili makale için Semantic Scholar + OpenAlex sorusu; yerel olarak önbelleğe alıntılar; 1 sayfalık bir alan dijesini oluşturun.

3. **Tree scaffolding.**Kökü tohum hipotezi ile başlatın.`expand(node) -> children`Küçük düzenleme önerileri ile (her çocuk için bir yapılandırma değişikliği).`score(node)`ağırlıklı yenilik × kalite × bütçe dönemidir.

4. **Sandbox wrapping.**Her deney geçer .`docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only`Tohumlar kum kutusuna yazılır; çıkışlar sadece okunur geriye monte edilir.

5. **Plan-execute-verify loop.** `plan`Çocuklar önerir.`execute`Kum kutusunu çalıştırır, kayıtları ve ölçümleri yakalar. `verify`Metrikler üzerinde birim kontrolleri yapar (kayıp azalmış mı? ablasyon etkeni izolasyon etmiş miydi?). Başarısız düğümler ağaçta kaydedilen bir başarısızlık nedeni elde eder.

6. **Writer.**Bütçeden sonra en iyi dalı seçin. Matplotlib ile rakamları göster. Claude Opus 4.7 üzerinden bir LaTeX taslakı oluşturun. Bağlantı izini bağlamda oluşturun. Yapıştırın. Yapıştırılan PDF'yi eleştirek için Opus 4.7 vizyonuna geri gönderin. İterasyon.

7. **Reviewer ensemble.**Beş hakim, taslakın (yenilik, titizlik, netlik, yeniden üretilebilirlik, etki) ile NeurIPS tarzı rubrikalar ile puanını verir.

8. **Red team.**Kum kutusunu hedef alan bir dizi düşmanca görev oluşturmak veya entegre etmek: çatal bombaları, ağın dışına çıkma girişimleri, dosya sisteminden kaçışlar, LLM yazılı kabuğunun meta karakteri. Hepsinin engellendiğini onaylayın. Bulgular yazın.

9. **Reproducibility.**Her kağıt ağaç araması ile birlikte JSON izini, tohumları, W & B çalıştırma bağlantıları, kum kutuları yapılandırmaları ve onu sonuna kadar yeniden üreten README ile gemiye gönderilir.

## Kullan

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

## Gönder

`outputs/skill-ai-scientist.md`Bir tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane tane

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Paper quality | Blind rubric review against published workshop papers |
| 20 | Experimental rigor | Baselines, seeds, ablations; every claim backed by a cell in the results table |
| 20 | Cost and compute discipline | $30/paper ceiling enforced, Langfuse-traced |
| 20 | Safety | Sandbox red team passes; network policy and kill-switch verified |
| 15 | Reproducibility | One-command rerun with identical seeds reproduces the paper |
| **100** | | |

## Egzersizler

1. Aynı alanın üç farklı tohum fikri ile karşılaştırın. Ağaç araması kapsamındaki bölümlerin ne olduğunu karşılaştırın.

2. 5 dolardan fazla değerli düğümler için deney yürütülmeden önce insan içi bir kapı ekleyin.

3. Tek bir yargıç için eleştirmen grupunu değiştirin ve yanlış kabul oranını bilinen kötü makaleler üzerinde ölçün.

4. Ağın kırmızı takımı testini yapın: ajan, kod yazmaya çalışır.`curl`Dış adres.`--network=none`Politika onu engelliyor.

5. Ağaç aramanızı düz bir rastgele temel çizgiyle karşılaştırın (eşit bütçe, genişleme stratejisi yok).

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Tree search | "AB-MCTS-style expansion" | Best-first exploration over experiment nodes with a novelty×quality×budget score |
| Sandbox | "Experiment isolation" | Container with no network, bounded CPU/memory, pinned seeds, read-only inputs |
| Vision critique | "Render-then-read" | Compile the paper to PDF, feed the PDF back to a VLM for layout and claim-evidence critique |
| Reviewer ensemble | "Automated peer review" | Multiple LLM judges scoring the paper with a NeurIPS rubric; weighted aggregate gates the pipeline |
| Novelty score | "Is this new?" | Heuristic that penalizes proximity to the 50-paper literature cache |
| Cost ceiling | "$ budget" | Hard cap on total spend per paper; Langfuse counters + pre-run estimates |
| Red team | "Sandbox-escape audit" | Adversarial tasks that would escape the sandbox if the policy is wrong |

## Daha Fazla Okumak

- [Sakana AI-Scientist-v2 repository](https://github.com/SakanaAI/AI-Scientist-v2) Referans üretim araştırma ajanı
- [Sakana AI-Scientist-v1 paper (arXiv:2408.06292)](https://arxiv.org/abs/2408.06292) orijinal yöntem
- [ShinkaEvolve (Sakana ICLR 2026)](https://sakana.ai) Devrimsel genişleme
- [Agent Laboratory (AMD)](https://github.com/SamuelSchmidgall/AgentLaboratory) Çoklu rollü araştırma laboratuvarı çerçevesini
- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) Referans orkestrasyon katmanı
- [Semantic Scholar Graph API](https://api.semanticscholar.org/) Edebiyat aramaları
- [E2B sandboxes](https://e2b.dev) Referans deney izolesi
- [NeurIPS reviewer guidelines](https://neurips.cc/Conferences/2026/ReviewerGuidelines) eleştirmen grubunun kodladığı rubrik
