# Bitirme Taşı 10 — Multi-Agent Yazılım Mühendisliği Ekibi

> Çokluagent mühendislik ekibinin 2026 şekli birleşti: bir mimar plan yapıyor, N kodlayıcılar paralel çalışma ağaçlarında çalışıyor, bir inceleme kapısı, bir test uzmanı doğruluyor. SWE-AF'nin fabrika mimarisi, MetaGPT'nin rol tabanlı prompting'i, AutoGen 0.4'ün yazılı aktör grafiği, Cognition'ın Devin'i ve Factory'nin Droid'lerinin hepsi bağımsız olarak bu platforma yerleştirildi. Paralel çalışma ağaçları duvar saatini üretime dönüştürür. Paylaşılan durum ve aktarım protokolleri başarısızlık yüzeyi haline gelir. İşin özü, ekibi oluşturmak, SWE-bench Pro'yu değerlendirmek ve hangi aktarımların ne sıklıkta kesintiye uğradığını rapor etmektir.

**Tür:** Kapak taşı
**Diller:** Python / TypeScript (agents), Shell (çalışma ağacı komut dosyaları)
**Önkoşullar:** Aşama 11 (LLM mühendisliği), Aşama 13 (araçlar), Aşama 14 (agents), Aşama 15 (otonom), Aşama 16 (çoklu-agent), Aşama 17 (altyapı)
**Uygulanan aşamalar:** P11 · P13 · P14 · P15 · P16 · P17
**Süre:** 40 saat

## Sorun

Tek-agent kodlama donanımları büyük görevlerde tavan yaptı. Herhangi bir agent zayıf olduğundan değil, 200k-token bağlamının bir mimari plan artı dört paralel kod tabanı dilimi artı gözden geçiren yorumu artı test çıktısını tutamaması nedeniyle. Çoklu-agent fabrikalar sorunu böler: planın sahibi bir mimardır, paralel çalışma ağaçlarında kodlayıcılar kendi uygulamasını yapar, gözden geçiren kapılar, test eden kişi doğrular. SWE-AF'nin "fabrika" mimarisi, MetaGPT'nin rolleri, AutoGen'in yazılı aktör grafiği; üç çerçevenin tümü aynı şekli tanımlar.

Başarısızlık yüzeyi aktarımdır. Mimar, kodlayıcıların uygulayamayacağı bir şey planlar. Kodlayıcılar çelişkili farklar üretir. İncelemeyi yapan kişi halüsinasyonlu bir düzeltmeyi onaylıyor. Testçi, hala yazan bir kodlayıcıyla yarışıyor. Bu ekiplerden birini oluşturacak, onu 50 SWE-bench Pro sayısı üzerinde çalıştıracak, her aktarımı takip edecek ve otopsiyi yayınlayacaksınız.

## Konsept

Roller agents olarak yazılır. **Mimar** (Claude Opus 4.7) konuyu okur, bir plan yazar ve onu açık arayüzlerle alt görevlere ayırır. **Kodlayıcılar** (Claude Sonnet 4.7, N paralel örnek, her biri `git worktree` + Daytona sanal alanında) alt görevleri bağımsız olarak uygular. **İnceleyen** (GPT-5.4) birleştirilmiş farkı okur ve belirli değişiklikleri onaylar veya talep eder. **Test Cihazı** (Gemini 2.5 Pro), test paketini ayrı olarak çalıştırır ve başarılı/başarısız olduğunu artifact'larla raporlar.

İletişim, paylaşılan bir görev panosu (dosya destekli veya Redis) aracılığıyla gerçekleştirilir. Her rol, gerçekleştirmesine izin verilen görevleri tüketir. Aktarımlar A2A protokolüyle yazılan mesajlardır. Koordinasyon kaygıları: birleştirme çatışması çözümü (koordinatör rolü veya otomatik üç yönlü birleştirme), paylaşılan durum senkronizasyonu (kodlayıcılar başladığında plan dondurulur; yeniden planlar ayrı olaylardır) ve gözden geçirenin eşik tutması (gözden geçiren kişi kendi değişikliklerini veya önerdiği değişiklikleri onaylayamaz).

Token amplifikasyonu gizli maliyettir. Her rol sınırı özet prompt'lari ve aktarım bağlamını ekler. 40 turluk tek-agent koşu, dört rolde toplam 160 tur olur. Değerlendirme listesi özellikle token verimliliğini tek-agent temel çizgisine göre tartıyor çünkü soru "çoklu-agent işe yarıyor mu" değil, "dolar başına kazanıyor mu?"

## Mimarlık

```
GitHub issue URL
      |
      v
Architect (Opus 4.7)
   reads issue, produces plan with subtasks + interfaces
      |
      v
Task board (file / Redis)
      |
   +-- subtask 1 ---+-- subtask 2 ---+-- subtask 3 ---+-- subtask 4 ---+
   v                v                v                v                v
Coder A          Coder B          Coder C          Coder D          (4 parallel)
 (Sonnet)         (Sonnet)         (Sonnet)         (Sonnet)
 worktree A       worktree B       worktree C       worktree D
 Daytona          Daytona          Daytona          Daytona
      |                |                |                |
      +--------+-------+-------+--------+
               v
           merge coordinator  (three-way merge + conflict resolution)
               |
               v
           Reviewer (GPT-5.4)
               |
               v
           Tester  (Gemini 2.5 Pro)  -> passes? -> open PR
                                     -> fails?  -> route back to coder
```

## Yığın

- Düzenleme: Paylaşılan durum + başına-agent alt grafiğiyle LangGraph
- Mesajlaşma: Yazılan inter-agent mesajları için A2A protokolü (Google 2025)
- Modeller: Opus 4.7 (mimar), Sonnet 4.7 (kodlayıcılar), GPT-5.4 (inceleyici), Gemini 2.5 Pro (testçi)
- Çalışma ağacı izolasyonu: Kodlayıcı başına `git worktree add` + Daytona sanal alanı
- Birleştirme koordinatörü: özel üç yönlü birleştirme + Yüksek Lisans aracılı çatışma çözümü
- Eval: SWE-bench Pro (50 sayı), SWE-AF senaryoları, birim testleri için HumanEval++
- Observability: Rol etiketli aralıklara sahip Langfuse, her-agent token muhasebesi
- Deployment: Her rolün ayrı bir Deployment + biriktirme listesinde HPA olduğu K8'ler

## Build It — Kendin Geliştir

1. **Görev panosu.** Yazılan mesajları içeren dosya destekli JSONL: `plan_request`, `subtask`, `diff_ready`, `review_needed`, `test_needed`, `approved`, `rejected`, `replan_needed`. AgentEtiketlere abone olun.

2. **Mimar.** GitHub sayısını okur, Opus 4.7'yi açık alt görev arayüzleri (dokunulan dosyalar, genel işlevler, test etkisi) gerektiren bir plan şablonuyla çalıştırır. Bir DAG alt göreviyle birlikte bir `plan_request` yayar.

3. **Kodlayıcılar.** N sayıda paralel çalışan, her biri yönetim kurulundan bir alt görev talep ediyor. Her biri yeni bir `git worktree add` dalı artı bir Daytona sanal alanı oluşturur. Alt görevi uygular. Yama + test deltalarıyla birlikte `diff_ready` yayınlar.

4. **Birleştirme koordinatörü.** Tüm kodlayıcılar tamamlandığında, üç yollu, N dallarını bir hazırlama dalına birleştirir. LLM aracılı çakışma çözümü yalnızca dosya düzeyinde çakışma mevcut olduğunda.

5. **İnceleyen.** GPT-5.4 birleştirilmiş farkı okur. Yazdığı farklar onaylanamıyor. İlgili kodlayıcıya geri yönlendirilen belirli değişiklik istekleriyle birlikte `approved` (işlemsiz) veya `review_feedback` yayar.

6. **Test Cihazı.** Gemini 2.5 Pro, test paketini temiz bir sanal alanda çalıştırır. artifact'ları yakalar. Yığın izlemelerle birlikte `test_passed` veya `test_failed` yayar. Başarısız testler, başarısız olan alt göreve sahip olan kodlayıcıya geri döner.

7. **Dağıtım muhasebesi.** Bir rol sınırını aşan her mesaj, Langfuse'da yük boyutu ve kullanılan modelle birlikte bir yayılma alanına sahip olur. Alt görev başına token amplifikasyonu hesaplayın (coder_tokens + reviewer_tokens + tester_tokens + Architect_share / coder_tokens).

8. **Eval.** 50 SWE-bench Pro sayısı üzerinde çalıştırın. pass@1 ve $-per-solved-issue'yu tek bir agent taban çizgisiyle (tek bir çalışma ağacında bir Sonnet 4.7) karşılaştırın.

9. **Opsi sonrası.** Başarısız olan her sorun için, bozulan geçişi tanımlayın (plan çok belirsiz, birleştirme çatışması, gözden geçirenin yanlış onaylaması, test edenin pulu). Bir aktarım hatası histogramı oluşturun.

## Use It — Hazır Araçla Uygula

```
$ team run --issue https://github.com/acme/widget/issues/842
[architect] plan: 4 subtasks (parser, cache, api, migration)
[board]     dispatched to 4 coders in parallel worktrees
[coder-A]   subtask parser  -> 42 lines, tests pass locally
[coder-B]   subtask cache   -> 88 lines, tests pass locally
[coder-C]   subtask api     -> 31 lines, tests pass locally
[coder-D]   subtask migration -> 19 lines, tests pass locally
[merge]     3-way merge: 0 conflicts
[reviewer]  comments on cache (thread pool sizing); routed to coder-B
[coder-B]   revision: 92 lines; submits
[reviewer]  approved
[tester]    all 412 tests pass
[pr]        opened #3382   4 coders, 1 revision, $4.90, 18m
```

## Ship It — Kullanıma Sun

`outputs/skill-multi-agent-team.md` teslim edilebilirdir. Bir sorun URL'si ve paralellik düzeyi verildiğinde ekip, rol başına token muhasebesi ile birleştirmeye hazır bir PR üretir.

| Ağırlık | Kriter | Nasıl ölçülür |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | Eşleşen 50 sayı alt kümesi, pass@1 |
| 20 | Paralel hızlandırma | Duvar saati ve tek-agent taban çizgisi |
| 20 | Kaliteyi inceleyin | Enjekte edilen hata araştırmasında yanlış onay oranı |
| 20 | Token verimlilik | Çözülmüş sorun başına toplam tokens vs tek-agent |
| 15 | Koordinasyon mühendisliği | Birleştirme çakışması çözümü, aktarım hatası histogramı |
| **100** | | |

## Egzersizler

1. Çalışmanın ortasında bir farka bariz bir hata enjekte edin (ana gövdeden önce fazladan `return None` ). Gözden geçirenin yanlış onaylama oranını ölçün. Yanlış onay %5'in altına düşene kadar incelemeciyi prompt ayarlayın.

2. İki kodlayıcıya azaltın (mimar + kodlayıcı + gözden geçiren + testçi, kodlayıcı iki alt görevi sırayla çalıştırır). Duvar saati ile geçiş oranını karşılaştırın.

3. Birleştirme koordinatörünü tek yazarlı bir kısıtlamayla değiştirin (alt görevler ayrık dosya kümelerine dokunur). Mimarın üzerindeki planlama yükünü ölçün.

4. İnceleyiciyi GPT-5.4'ten Claude Opus 4.7'ye değiştirin. Yanlış onay oranını ve token maliyet deltasını ölçün.

5. Beşinci bir rol ekleyin: belgeleyici (Haiku 4.5). İncelemeden sonra bir değişiklik günlüğü girişi oluşturur. Dokümantasyon kalitesinin ekstra token harcamayı haklı gösterip göstermediğini ölçün.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Paralel çalışma ağacı | "İzole şube" | `git worktree add` kodlayıcı başına yeni çalışan bir ağaç üretiyor |
| Görev panosu | "Paylaşılan mesaj veriyolu" | agent'larin abone olduğu yazılan mesajların dosya veya Redis deposu |
| Aktarma | "Rol sınırı" | Bir rolün bağlamından diğerinin bağlamına geçen herhangi bir mesaj |
| Token amplifikasyonu | "Çoklu-agent ek yük" | Aynı görev için roller genelinde toplam token'lar / tek-agent token'lar |
| A2A protokolü | "Agent-to-agent" | Google'ın yazılan inter-agent mesajları için 2025 spesifikasyonu |
| Birleştirme koordinatörü | "Entegratör" | Üç yönlü birleştirmeyi çalıştıran ve çakışmalara aracılık eden bileşen |
| Yanlış onay | "Yorumcu halüsinasyonu" | İnceleyen, bilinen hatalara sahip bir farkı onayladı |

## Daha Fazla Okuma

- [SWE-AF fabrika mimarisi](https://github.com/Agent-Field/SWE-AF) — referans 2026 çoklu-agent fabrikası
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT) — rol tabanlı çoklu-agent framework
- [AutoGen v0.4](https://github.com/microsoft/autogen) — Microsoft'un yazdığı aktör framework
- [Cognition AI (Devin)](https://cognition.ai) — referans ürün
- [Fabrika Droidleri](https://www.factory.ai) — alternatif referans ürünü
- [Google A2A protokolü](https://a2a-protocol.org/latest/) — inter-agent mesajlaşma spesifikasyonu
- [git çalışma ağacı belgeleri](https://git-scm.com/docs/git-worktree) — izolasyon alt katmanı
- [SWE-bench Pro](https://www.swebench.com) — değerlendirme hedefi
