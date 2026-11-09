# Capstone 10  Çoklu Ajan Yazılım Mühendisliği Ekibi

> 2026'da bir çok ajan mühendislik ekibinin şekli birleşti: bir mimar planlar, N kodlayıcılar paralel çalışma ağaçlarında çalışır, bir incelemeci kapıları, bir denetçi doğruluyor. SWE-AF'ın fabrika mimarisi, MetaGPT'nin rol tabanlı uyarısı, AutoGen 0.4'in tipize edilmiş oyuncu grafikleri, Kognition'in Devin ve Factory's Droids hepsi bağımsız olarak yere düştü. Paralel çalışma ağaçları duvar saatini üretim kapasitesine dönüştürür. Paylaşılan durum ve teslimat protokolleri başarısızlık yüzeyi haline gelir. Son nokta takım oluşturmak, SWE-benç Pro'da değerlendirmek ve hangi teslimatların kırıldığını ve ne kadar sıklıkla rapor etmek.

**Type:** Capstone
**Languages:** Python / TypeScript (agents, task board scaffold), Shell (worktree scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 17 (infrastructure)
**Phases exercised:**P11 · P13 · P14 · P15 · P16 · P17
**Time:** 40 hours

## Sorun

Tek ajan kodlama harmanları büyük görevlerde bir tavan vurdu. Herhangi bir bireysel ajan zayıf olduğu için değil, 200k jeton bağlamı bir mimari planı artı dört paralel kod tabanı parçaları artı incelemeci yorum artı test çıkışı tutamayacağı için. Çoklu ajan fabrikaları sorunu ikiye bölüyor: bir mimar planın sahibi, kodlayıcılar paralel çalışma ağaçlarında uygulamayı kendiliğinden, bir incelemeci kapıları, bir denetçi doğruluyor. SWE-AF'ın "fabrika" mimarisi, MetaGPT'nin rolleri, AutoGen'in tipize edilmiş oyuncu grafiği  üç çerçeve de aynı şekli tanımlar.

Başarısızlık yüzeyi, teslimat. Mimar kodlayıcıların uygulayamayacağı bir şeyi planlar. Kodlayıcılar çelişkili farklılıklar üretir. Eleştirmen bir halüsinasyonlı düzeltmeyi onaylar. Tester bir sabit yazma kodleyicisini yarışır. Bu ekiplerden birini inşa edersiniz, 50 SWE-bench Pro baskı üzerinde çalıştırırsınız, her teslimatı takip edersiniz ve post-mortem yayınlarsınız.

## Anlam

Roller tipte bir ajan.**Architect**(Claude Opus 4.7) sayıyı okuyor, bir plan yazıyor ve açık bir arayüzle alt görevlere ayırıyor. **Coders**(Claude Sonnet 4.7, N paralel örnekler, her biri bir `git worktree`+ Daytona sandbox) alt görevleri bağımsız olarak uygulayabilir. **Reviewer**(GPT-5.4) birleşmiş farkı okuyor ve ya onaylar ya da özel değişiklikler talep ediyor. **Tester**(Gemini 2.5 Pro) test süiti izole olarak çalışır ve eserlerle başarısızlık raporları verir.

İletişim ortak bir görev panosu (file-backed veya Redis) üzerinden gerçekleşir. Her rol, yerine getirmesine izin verilen görevleri tüketir. Elveriler A2A protokolü mesajları. Koordinasyon sorunları: birleşme çatışma çözümü (koordinatör rolü veya otomatik üç yönlü birleşme), ortak devlet senkronizasyonu (plani kodlayıcılar başladıktan sonra dondurulur; yeniden planlamalar ayrı olaylardır) ve incelemeci kapı tutması ( incelemeci kendi değişikliklerini veya önerdiği değişiklikleri onaylayamaz).

Token amplification gizli maliyettir. Her rol sınırı özet istekleri ve teslim bağlamı ekler. 40 dönüş tek ajan koşusu dört rol boyunca toplam 160 dönüş olur. Rubrik özellikle token verimliliğini tek ajan temel çizgisi karşı tartıyor çünkü soru "çok ajan iş yapar" değil "dolar başına kazanır mı"dır.

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

## Yüküm

- Orkestralama: LangGraph ortak devlet + ajan başına alt grafikler ile
- Mesajlaşma: A2A protokolü (Google 2025) tipileşmiş ajanlar arası mesajlar için
- Modeller: Opus 4.7 (memar) Sonet 4.7 (kodlayıcılar), GPT-5.4 (kazeticiler), Gemini 2.5 Pro (tester)
- İş ağacı izolasyonu: `git worktree add`Kodlayıcıya göre + Daytona kum kutusu
- Birleştirme koordinatörü: özel üç yönlü birleştirme + LLM aracılığıyla çatışma çözümü
- Eval: SWE-bench Pro (50 sayı), SWE-AF senaryoları, Unit testleri için HumanEval++
- Gözlemsellik: Rol etiketleri ile Langfuse, ajan başına token muhasebe
- Gösterim: Her bir rolü ayrı bir Gösterim olarak K8'ler + Aralıklı HPA

```figure
ce-team-handoff
```

## Yapın

1. **Task board.**Dosya desteklenen JSONL , yazılmış mesajlar ile: `plan_request`- Evet .`subtask`- Evet .`diff_ready`- Evet .`review_needed`- Evet .`test_needed`- Evet .`approved`- Evet .`rejected`- Evet .`replan_needed`Ajanlar etikete abone oluyor.

2. **Architect.**GitHub'un sorununu okuyor, açık alt görev arayüzlerini gerektiren bir plan şablonu ile Opus 4.7 çalıştırıyor (dokunmuş dosyalar, kamu fonksiyonları, test etkisi). Bir `plan_request`Bir gün alt görevler ile.

3. **Coders.**Paralel çalışanlar, her biri bir alt görev talep.`git worktree add`Bir Daytona kum kutusu ve alt görevleri uyguluyor.`diff_ready`Patch + test delta ile.

4. **Merge coordinator.**Tüm kodlayıcılar üzerinde, üç yönlü N dallarını bir aşama dalına birleştirir. LLM aracılığıyla çatışma çözümü sadece dosya düzeyinde birbiriyle örtüşme olduğunda.

5. **Reviewer.**GPT-5.4 birleşik farklılığı okuyor.`approved`(no-op) veya `review_feedback`Özel değişiklik istekleri ilgili kodlayıcıya yönlendirilmiş olarak.

6. **Tester.**Gemini 2.5 Pro test süiti temiz bir kum kutusunda çalışır.`test_passed`veya `test_failed`Başarısız testler başarısız alt görev sahibi kodlayıcısına döner.

7. **Handoff accounting.**Bir rol sınırı geçen her mesaj, Langfuse'de payload boyutuna ve modeline göre bir uzantı alır.

8. **Eval.**50 SWE-bench Pro sorununa çalıştırın. Bir tek ajanlı bir temel çizgiyle (tek bir iş ağacında bir Sonet 4.7) karşılaştırın.

9. **Post-mortem.**Her başarısız sayı için, kırılmış teslimatı belirleyin (çok belirsiz plan, birleşme çatışması, eleştirmenin yanlış onaylaması, testçi flake).

## Kullan

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

## Gönder

`outputs/skill-multi-agent-team.md`Sorun bir URL ve paralellik seviyesini göz önüne alarak, ekip rol başına token muhasebe ile birleşmeye hazır bir PR üretir.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | Matched 50-issue subset, pass@1 |
| 20 | Parallel speedup | Wall-clock vs single-agent baseline |
| 20 | Review quality | False-approval rate on injected-bug probe |
| 20 | Token efficiency | Total tokens per solved issue vs single-agent |
| 15 | Coordination engineering | Merge-conflict resolution, handoff-failure histogram |
| **100** | | |

## Egzersizler

1. Açık bir hata , ortalama bir defektörde enjekte edilmelidir (ekstra `return None`Dönüştürücü'nin yanlış onay oranını ölçün. Dönüştürücü'nin yanlış onayının % 5'ten az olduğu sürece uyarın.

2. İki kodlayıcıya (memur + iki kodlayıcı + gözden geçirmeci + tester) indirginleştirin, her kodlayıcı iki alt görevyi sıradan çalıştırır. Duvar saatini ve geçiş oranını karşılaştırın.

3. Birleştirme koordinatörünü tek yazıcı kısıtlamasıyla değiştirin (alt görevler ayrılmış dosya kümelerine dokunur).

4. GPT-5.4'ten Claude Opus 4.7'e kadar değişim değerlendirici.

5. Beşinci rol ekleyin: belgeci (Haiku 4.5). Tekrar incelemeden sonra, bir değişim loguna girme oluşturur. Belge kalitesi ek token harcamalarını haklı çıkarır mı ölçün.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Parallel worktree | "Isolated branch" | `git worktree add` producing a fresh working tree per coder |
| Task board | "Shared message bus" | File or Redis store of typed messages agents subscribe to |
| Handoff | "Role boundary" | Any message crossing from one role's context to another's |
| Token amplification | "Multi-agent overhead" | Total tokens across roles / single-agent tokens for the same task |
| A2A protocol | "Agent-to-agent" | Google's 2025 spec for typed inter-agent messages |
| Merge coordinator | "Integrator" | Component that runs three-way merge and mediates conflicts |
| False approval | "Reviewer hallucination" | Reviewer approves a diff with known bugs |

## Daha Fazla Okumak

- [SWE-AF factory architecture](https://github.com/Agent-Field/SWE-AF) 2026 referans çoklu ajan fabrikası
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT) Rol tabanlı çoklu ajan çerçevesini
- [AutoGen v0.4](https://github.com/microsoft/autogen) Microsoft'un tipi aktör çerçevesini
- [Cognition AI (Devin)](https://cognition.ai) Referans ürünü
- [Factory Droids](https://www.factory.ai) alternatif referans ürünü
- [Google A2A protocol](https://a2a-protocol.org/latest/) ajanlar arası mesajlaşma özellikleri
- [git worktree documentation](https://git-scm.com/docs/git-worktree) izolasyon altyapısı
- [SWE-bench Pro](https://www.swebench.com) değerlendirme hedefi
