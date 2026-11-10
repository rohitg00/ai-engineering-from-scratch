# Yetenek İhtiyaçları ve Yollama

> İpucu, yetkili bir kararın ardından bir ilgililik kararıdır. İyi bir açıklama modelin seçmesine yardımcı olur; iyi bir politika bu seçimin izin verildiğini belirler.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 24 (Skill Discovery and Progressive Disclosure)
**Time:** ~105 minutes

## Öğrenme Hedefleri

- Açık kullanıcı çağrısı, içten model çağrısı, uygulama çağrısı ve beceri-becerik çağrısı arasında ayrım yapın.
- İnsan görünürlüğünü ve uygunluğunu bağımsız politika boyutları olarak örnekleyin.
- Pozitif tetikleyici ve neredeyse eksik sınırları olan yönlendirme tanımlarını yazın.
- Ayrı uygunluk, seçim, etkinleştirme, argüman bağlama ve iz ve testlerde yürütme.
- Uygulama zamanı spesifik çağrı alanlarını taşınabilir ön madde olarak sunmadan uyarlayın.

## Sorun

Bir `database-migration`Bu özellikler, bir kullanıcı tarafından kullanılabilir. kullanıcı, bu bilgiyi isimle çalıştırır, ancak model ayrıca tanımını görür ve birisi genel bir veritabanı sorusu sorduğunda seçer.

Ekle .`user-invocable: false`Bu alanın kullanımı, insanların manuel olarak çalışmasını engellemeyi beklerken, başka bir çalıştırma zamanında bu alanın göz ardı edilmesini sağlar.`disable-model-invocation: true`Bu yetenek tamamen ortadan kalkacak.

Alan isimleri ile ilgili yanlış bir şey yok. Model yanlış. "Kullanıcı görebilir," "Model onu seçebilir," "Uygulamada önceden yüklenebilir" ve "Açıntıları içinde çalıştırılabilir" ayrı gerçeklerdir.`invocable`Onları ifade edemiyorum.

Routing ikinci bir başarısızlık moduna sahiptir. Eğer açıklamalar belirsizse, birkaç beceri makul hale gelir. Eğer açıklamalar anahtar kelimelerle doludursa, ilgili olmayan görevler onları tetikler. Katalogi bir olasılık arayüzüdür: uyum için yeterince kompakt, yönlendirmek için yeterince spesifik.

## Anlaşım

### Beş kanal yaşam döngüsünü başlatabilir

| Actor | Invocation shape | Typical use | Main risk |
|---|---|---|---|
| Human user | Names a skill in the UI or prompt | Deliberate workflow selection | User expects availability or authority the host does not grant |
| Model or autonomous agent | Selects a catalog entry from task context | Automatic expert procedure | False-positive routing |
| Application | Activates or preloads a skill through runtime code | Fixed product workflow | Hidden coupling to one host |
| Another skill or subagent | Requests an exact skill as a workflow dependency | Composition | Cycles, missing dependency, or context bleed |
| Evaluation harness | Activates an exact skill under a fixed scenario | Repeatable measurement | Tests the skill while accidentally bypassing the production policy under study |

Uygulanabilir Agent becerileri özellikleri paketi tanımlar. Bir evrensel slash komut UI, içerikli yönlendirme bayrağı, uygulama API veya subagent yaşam döngüsünü standartlaştırmaz.

### Beş çağrı aşaması

```figure
skill-invocation-stages
```

Bu kelimeleri doğru kullan:

- **Eligible**politika bu aktörün yeteneği talep etmesine izin veriyor.
- **Selected**kullanıcının adı verildiği veya yönlendirici tarafından uygun olarak değerlendirilmiş anlamına gelir.
- **Activated**İş bağlamına girilen talimatları ifade eder.
- **Executing**Bu talimatlar altında temsilci model veya araç çalışmalarına başladı.
- **Completed**çıkış bağımsız bir başarısızlık kontrolüne ulaştığı anlamına gelir.

Sadece kaydedilen bir iz .`skill_used=true`Başarısızlık olan yeri gizler.

### İnsan ve model çağrılar 2x2 matris oluşturur

| Human can invoke | Model can invoke | Mode | Suitable examples |
|:---:|:---:|---|---|
| Yes | Yes | Shared | Code explanation, test planning, documentation review |
| Yes | No | Human-only | Publish preparation, billing export, destructive cleanup plan |
| No | Yes | Model-only | Internal style guide, domain reference, automatic support procedure |
| No | No | Disabled or application-only | Staged rollout, deprecated package, programmatic preload |

Matrix standart YAML değil, bir politika modeli.

Bir sunucu kullanıyor `disable-model-invocation: true`Sadece insan için sırada ve `user-invocable: false`Sadece model satırı için. Öntanımlı olarak her ikisi de.`agents/openai.yaml`- Evet .`allow_implicit_invocation: false`Bu tür programlar, açık çağrıları etkinleştirirken açık çağrıları korumak için kullanılır.

Kafanın karışıklığı önemli .`user-invocable: false`"Model bunu kullanamaz". anlamına gelmez. Bu, onu tanımlayan host'ta doğrudan kullanıcı çağrısını kaldırır. `disable-model-invocation: true`"İlmi devre dışı bırakıldı" anlamına gelmez. Açık kullanıcı erişimini korurken model başlatılan seçimi kaldırır.

### Açıkça çağırma önce kimliktir .

Açıkça yapılan bir çağrı doğrudan kimliği sağlar:

```text
/release-readiness v2.4.0
```

veya:

```text
release-readiness check v2.4.0 without publishing
```

Geçerli Kodeks arayüzleri belgesi `/skills`Açıkça çağrı taleplerinde seçme ve sıradan beceri isimleri için.`/skill-name`Tam sözcük, menü görünürlüğü, alıntı kuralları ve değişken genişlemeyi host'a ait.

Açık bir istek hala politika geçer. Bir beceriyi isimlendirme eksik izinleri, çalışma alanı kısıtlamalarını, onay kapılarını veya çalıştırma zamanı izolasyonunu atlamamalıdır.

### İrtisası çağrı ilk olarak tanımlama

İrtis yolulama için, model başlangıçta tüm vücut yerine katalog metadatalarını görür.

Zayıf:

```yaml
description: Helps with releases.
```

Çok geniş:

```yaml
description: Use for release, version, package, build, deploy, publish, tag, changelog, GitHub, CI, or software tasks.
```

Sınırlı:

```yaml
description: Inspect an already prepared release candidate and produce a readiness report. Use when the user asks whether a version, tag, package, or image is ready to publish; do not use for ordinary build failures or feature development.
```

Sınırlı versiyon aşağıdakileri içerir:

1. **Capability:**Hazırlanan bir adayı incelemek.
2. **Output:**Hazırlık raporu.
3. **Positive boundary:**Bir serbest bırakma eseri hazır mı diye sorar.
4. **Negative boundary:**Normal inşaat ve geliştirme alanı dışındadır.

Negatif sınırlar, iki yakın yetenek sözlük birikimi paylaşırken yararlıdır.

### Routing, bir kaçınma seçeneği ile sınıflandırma

Bir beceri için .`s`ve talep`x`, bir yönlendirme puanını hayal edin:

```text
score(s, x) = capability_match + trigger_match + context_match - exclusion_match - ambiguity_penalty
```

Bu nedenle, teknik prensip hala geçerlidir: seçim bir eşiği ve rekabetçi bir beceriyi aşmalıdır.

```figure
skill-routing-abstention
```

Yüksek etki becerileri için, içten yönlendirme sert bir açıklama bile uygun olmayabilir. Yanlış pozitif maliyetinin otomatik seçimin rahatlığını aşması durumunda sadece insan politikalarını kullanın.

### Eğitimi sıralamadan önce olmalıdır.

Bulduğunuz her beceriyi notlamayın, en güçlü maçı seçin ve sonra bu beceri politikasını kontrol edin.

Bu sırayı kullanmak için:

1. Filter, talep eden aktör ve aktif ev sahibi adaptör tarafından becerileri keşfetti.
2. Sadece uygun adayları not edin.
3. En güçlü uygun maç, eşiği ve belirsizlik kurallarını temizlerse seçilir.
4. Hiçbir aday uygun olmadığında veya yeterli derecede güçlü olmayan bir puan alınmazsa, çekilme.

Diyelim ki`incident-triage`puanlar `0.80`Ama host uzantısı model çağrısını devre dışı bırakır. `incident-review`puanlar `0.55`Router değerlendirmek zorunda.`incident-review`En iyi aday olarak seçilmeli.`incident-triage`İnkar et ve dur.

Bu düzenleme aynı zamanda politika değişikliklerinin bir bağlam puanının anlamını değiştirmesini önler.Eğitimi seçim kümesini tanımlar.Ağlam bu kümenin sıralarını belirler.

### Yollama değerlendirmelerinin neredeyse eksikliği gerekir

Pozitif vakalar hatırlatmayı kanıtlıyor:

```json
{"prompt":"Is version 2.4.0 ready to publish?","expected":"release-readiness"}
```

Açık negatifler temel doğruluğu kanıtlıyor:

```json
{"prompt":"Explain rotary position embeddings.","expected":null}
```

Yakınlıktan çıkmışlar sınır kalitesini ortaya çıkarıyor:

```json
{"prompt":"Why did today's package build fail?","expected":"build-diagnostics"}
```

Yaklaşık bir kadının payı .`package`ve `build`Sadece açık olumlu ve ilgili olmayan olumsuzlardan oluşan bir yönlendirme kümesi kaliteyi aşırı derecede değerlendirecektir.

### Dönemler üç farklı yönteme sahiptir.

Bir çağrı argümanı birkaç sınır aşıyor:

```figure
skill-argument-boundaries
```

Her sınırda, metni kod olarak görmeden niyetinizi koruyun.

- Host analizörü komut sentaksını ve alıntılarını belirler.
- Yetenek, konuk kurallarına göre bağlanmış metin veya değişkenler alır.
- Bu talimatlar gerekli değerleri ve varsayılanları onaylar.
- Bir araç çağrısı değerleri bir yazılmış şemaya dönüştürür ve onları geçerliliği yeniden doğruluyor.

Çizilmez argümanları shell komutlarına bölmeyin. Bir argüman vektörü veya bir MCP aracı ile çağrılan bir senaryoyu tercih edin.

### Başvuru çağrısı açık bir orkestrasyon.

Bir ürün bir beceriyi etkinleştirebilir çünkü iş akışı zaten görev türünü bilir. Örneğin, bir çekme-talep inceleme hizmeti önceden yüklenebilir `pull-request-risk-review`Kullanıcı Review'ı basınca.

Bu, yönlendirme belirsizliğini ortadan kaldırır, ancak çalıştırma zaman API'ye bağımlılık yaratır.

```figure
skill-host-adapter
```

Bu yetenek, farklı bir uyumlu müşteri tarafından açıldığında anlaşılır kalmalıdır.

### Yeteneklere çağrı bir araç gibi bir avantaj

Diyelim ki`release-readiness`- Sorar .`security-change-review`bağımlılık dosyaları değiştiğinde.

Arayan kişi şunları belirtmelidir:

- hedef yetenek kimliği;
- sınırlı bir görev ve eser yolları;
- Beklenen cevap sözleşmesi;
- İtirazın nedeni;
- Eğer bu seçenek mevcut değilse geri dönüş;
- En fazla derinlik veya döngü kuralları.

```json
{
  "target_skill": "security-change-review",
  "task": "Review dependency changes in the candidate diff",
  "inputs": ["artifacts/release.diff"],
  "expected": "risk-report.json",
  "max_depth": 2
}
```

İkinci beceri körü körü körü körü körüne ilkine yapıştırılmıyor. Ev sahibi onu nasıl etkinleştirmeyeceğini ve bağlamı paylaşmaya, bir çatal içinde çalışmaya veya bir araç sonucu üzerinden geri dönmeye karar verir.

### Kontext yaşam döngüsü, konuksever özel

Eğitimden sonra, beceri vücudu konuşmada kalabilir, sıkıştırma sırasında özetlenebilir veya bir vekil bağlamında çalıştırılabilir. Araç izinleri bir dönüş sürebilir, talimatlar daha uzun sürebilir. Bir alt görevli, ebeveynin tüm geçmişi olmadan beceri alabilir.

Görünmez bir yaşam süresi varsayımına bağlı olan bir beceri yazmayın. Dosyalara dayanıklı çıkışlar koyun veya yazılmış durumlara, tekrar giriş güvenli hale getirin ve kesilmeden sonra ne yüklenmesi gerektiğini belirtin.

```markdown
On resume, read `artifacts/release-readiness.json` if it exists.
Revalidate the candidate commit before continuing.
Do not repeat an external write whose idempotency key is already recorded.
```

## Yapın

`code/main.py`politika ve yönlendirmeyi ayrı adaptör olarak uyguluyor.

Modelle şunlar yer alır:

- `Actor`İnsan, model, özerk ajan, uygulama, beceri ve harman çağıranlar için;
- `SkillMetadata`yönlendirme kimliği için;
- `InvocationPolicy`İnsan/model matrisi için;
- `InvocationRequest`ve `InvocationDecision`izlenebilir giriş ve sonuçlar için;
- `CorePolicyAdapter`host uzantıları olmayan taşınabilir davranışlar için;
- `ExtensionPolicyAdapter`Tanınan çalıştırma zaman alanları için;
- `build_invocation_matrix(policy)`2x2 görünüm için;
- `route_request(skills, request, adapter)`Uygunluk sıralaması, seçimi ve reddedilmeden önce uygunluk filtresi için.

Çek şunu:

```bash
cd phases/13-tools-and-protocols/25-skill-invocation-and-routing
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Demo açık insan, içerikli model, özerk ajan, uygulama, beceri-kompozisyon ve harness kanalları için bir matris ve kararlar basar. Genişleme-adapter sonuçları, uygun bir alternatif sıralamadan önce engellenmiş bir üst leksikal eşleşmenin kaldırıldığını göstermektedir. Ayrıca tam isim listeleri de içerir. Model API gerekmez. Deterministik yönlendirme, politika sınırlarını kontrol edilebilir hale getirmek için var, leksikal eşleşmenin üretim model yönlendirmeyi yeniden ürettiğini iddia etmek için değil.

### Neden çekirdek ve uzantı adaptörleri ayrı

Bir analizci gözlemlenen her ön madde alanına anlam atarsa, sessizce çalıştırma zamanı sözleşmelerini sahte bir standart haline getirir. Ayrı adaptörler arayanı hangi host semantiklerinin aktif olduğunu belirlemeye zorlar.

- Evet .`CorePolicyAdapter`Sadece başvuruda verilen politika kullanır.`ExtensionPolicyAdapter`Kararı değiştiren ev sahibi alanların ve kayıtların açık bir setini tanımlar.

## Kullan

Bir beceri yayınlamadan önce bir çağrı sözleşmesi yazın:

```yaml
actors:
  human: allow
  model: deny
  application: allow
  skill: deny
explicit_name: release-readiness
arguments:
  candidate: required
  publish: fixed_false
ambiguity: ask_user
missing_dependency: stop
context:
  durable_state: artifacts/release-readiness.json
  max_composition_depth: 2
```

Bu sözleşme adaptörler ve testler için tasarım belgesidir.`SKILL.md`Bir standart açıkça kabul etmediği sürece ön madde.

## Gönder

Bu ders , `skill-invocation-router`paket. Bir çağrı modeli referansı, örneğin bir host politikası ve bir insan, model, özerk ajan, uygulama, beceri-kompozisyon veya kullanma talebini değerlendiren ve kanal, adaptör, skor ve nedenle bir JSON kararını iade eden bir yürütmeyen CLI içerir.

Tek istekli CLI, tam bir tetikleme değerlendirmesi değil, bir politika araştırmasıdır. Kafas karışıklığı sayıları, hassasiyet, geri çağırma ve tekrarlanan çalışmalar istikrarını hesaplamak için Ders 27'de etiketlenmiş olumlu ve neredeyse hata tasarımını kullanın.

## Egzersizler

1. İnsan/model matrisinin dört satırını oluşturun ve her biri için bir meşru kullanım durumunu yazın.
2. Sadece uygulama etkinleştirmesini ekle `CorePolicyAdapter`İnsan ve model aramacıların reddedildiğini kanıtlayın.
3. Bir uygulama becerisi için on yakın eksik yazın. Her bir istek farklı bir iş akışına aitken, kelime birikimi becerisiyle paylaşacaktır.
4. En üst iki yönlendirme puanı arasında belirsizlik farkı ekleyin.`ask`Marj çok küçük olduğunda.
5. Yetenek-yetenek taleplerine en fazla bir kompozisyon derinliği ekleyin ve iki yetenek döngüsünü tespit edin.
6. Aynı etiketlenen seti çekirdek ve uzantı adaptörleri üzerinden çalıştırın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| Explicit invocation | "Slash command" | An actor supplies skill identity directly, subject to policy |
| Implicit invocation | "The model chooses" | A router selects from eligible catalog metadata based on task context |
| User-invocable | "Humans can use it" | A host-specific menu or direct-invocation property, not a core field |
| Model-invocable | "The agent can use it" | Eligibility for implicit model selection under host policy |
| Invocation adapter | "Frontmatter parser" | Code that maps a host's fields and APIs into a declared policy model |
| Near miss | "Hard negative" | A non-triggering request that resembles a skill's intended inputs |
| Abstention | "No skill selected" | A deliberate routing result when evidence is absent or ambiguous |

## Daha Fazla Okumak

- [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)Pozitif tetikleyici, spesifiklik ve değerlendirme için.
- [Evaluating skills](https://agentskills.io/skill-creation/evaluating-skills)Başlatıcı ve çıkış değerlendirme tasarımı için.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)mevcut Codex açık ve içerikli çağrı kontrolleri için.
- [Claude Code skills](https://code.claude.com/docs/en/skills)Bir ev sahibi için.`user-invocable`- Evet .`disable-model-invocation`, argümanlar ve delegasyon bağlamı.
