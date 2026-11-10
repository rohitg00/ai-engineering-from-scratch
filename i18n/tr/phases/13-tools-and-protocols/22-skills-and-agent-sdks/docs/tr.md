# Ajan yetenekleri: Portable sözleşme ve çalışma süresi sınırları

> Bir beceri daha iyi bir dosya adı ile uzun bir istek değil. Bir ajanın bağlamına bir çalıştırma süreci sözleşmesi aracılığıyla giren bir talimat, kaynak ve yürütülebilir yardımcılar paketi.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 01 (The Tool Interface), Phase 13 · 05 (Tool Schema Design)
**Time:** ~90 minutes

## Öğrenme Hedefleri

- Bir ajan becerisini bir prompt, depot talimatları, bir araç, bir kanca, bir subagent veya bir eklenti ile karıştırmadan tanımlayın.
- Mobil cihazı oku .`SKILL.md`Sözleşme ve çalıştırma süresi özel uzatmalardan ayırmak.
- Bulma, seçim, etkinleştirme, kaynak yükleme, araç kullanımı ve doğrulama, yaşam döngüsü farklı aşamaları olarak açıklayın.
- Bir yetenek paketi, bir iş zamanının bir ajanın kataloguna yerleştirilmeden önce doğrulanmalıdır.
- Bir iş için bir beceri, MCP aracı, kanca, alt kod veya sıradan kod arasında seçim yapın.

## On Dakikalık Başarılılık

Uzun açıklama yapmadan önce bunu yapın.
Tam bir incelemeci paketini gerçek bir ajan ev sahibi haline getirir, onu çağrıştırır,
Bu, yaşam döngüsünü gözlemlenebilir bir sonuçla kanıtlar.

### Gerçek ev sahibi laboratuvarına uçuş öncesi.

Gerçek ev sahibi kontrol noktası Node.js'i gerektirir.`npx`Python 3, seçilmiş bir tane .
yetenekli bir host ve seçtiğiniz projeye veya kullanıcı alanına erişim yazın
Önce yerel komutları kontrol et:

```bash
node --version
npx --version
python3 --version
```

Kurulumdan önce hangi host ve kapsamı kullanacağınızı belirleyin.
Bu dersleri web sitesinde okuyun veya devam edin
Bu geri dönüş sözleşmeyi öğretir, ama
host keşifini, çağrıyı, paketli metin uygulanmasını kanıtlamıyor veya
Bu gözlemleri bekleyen olarak işaretle.

### 1. Boş bir çalışma dizininden başlayın

Çalışmayı öğrenmeye devam ettiğiniz herhangi bir ana dizininden bu komutları çalıştırın:

```bash
mkdir -p agent-skills-first-run
cd agent-skills-first-run
TARGET_ROOT="$(pwd -P)"
printf 'TARGET_ROOT=%s\n' "$TARGET_ROOT"
ls -A
```

Son komut hiçbir şey yazdırmamalı.
Bu yüzden incelemenin açık bir sınırı var.

İlk yeteneğin için bir dizin oluştur:

```bash
mkdir -p my-first-skill
```

Yaratmak`my-first-skill/SKILL.md`Bu içeriği ile:

```markdown
---
name: my-first-skill
description: Turn rough meeting notes into a compact decision record when the user asks to capture a technical decision.
---

# Decision record

Extract the decision, context, alternatives, owner, and next review date.
If the notes do not contain a decision, ask one clarifying question instead
of inventing one.
```

Dosyayı amaçlı dizide oluşturduğunuzdan emin olun:

```bash
test -f my-first-skill/SKILL.md
```

Çıkış kodı 0 yok, dosya var demektir.

### 2. Tam incelemeci paketini yükle

İçeride kalın .`agent-skills-first-run`ve koş:

```bash
npx skills add rohitg00/ai-engineering-from-scratch --skill skill-contract-reviewer --full-depth
```

Kullanmakta olduğunuz ajan host ve kapsamını seçin.
`skill-contract-reviewer`Ve yazdığı yer.`--full-depth`-
Bu ders yeteneği referanslarla bir yuva bir paket,
Senaryo ve bir sermaye.

Yapıştır `SKILL_ROOT`Kurulucu tarafından bildirilen mutlak dizinine.
Kurulmuş olan dizin olması `SKILL.md`, ders kaynağı değil
Dizin ve mevcut çalışma alanı değil:

```bash
# Replace the placeholder with the destination printed by the installer.
SKILL_ROOT="$(cd "/absolute/path/to/skill-contract-reviewer" && pwd -P)"
test -f "$SKILL_ROOT/SKILL.md"
printf 'SKILL_ROOT=%s\n' "$SKILL_ROOT"
```

Eğer ajan seansı zaten açılmışsa, yeni bir seans başlatın veya o ev sahibi'nin
Her ev sahibi katalogunu sıfır yeniden yükler diye düşünmeyin.

### 3. Açıkça çağırın.

Kurulmuş ajanın içinde, `agent-skills-first-run`işçi olarak
Dizin, host tarafından desteklenen sentaks kullanın:

| Host | Explicit invocation |
|---|---|
| Codex | `skill-contract-reviewer`, or choose it from `/skills`, then provide the review request |
| Claude Code | `/skill-contract-reviewer` followed by the review request |
| Portable fallback | `Use skill-contract-reviewer to review the target package.` |

 için yazdırılan mutlak değerleri kullanın`SKILL_ROOT`ve `TARGET_ROOT`- ...
Uygulama işleminden önce ev sahibi tarafından genişletilmesini ve tam olarak
çözülmüş komut, işlem çalışma dizine bağlı olmayan bir komut değil:

```text
Use skill-contract-reviewer to review <TARGET_ROOT>/my-first-skill. The installed bundle root is <SKILL_ROOT>. Run python3 <SKILL_ROOT>/scripts/check_skill.py <TARGET_ROOT>/my-first-skill. Before running it, show the fully resolved argv. Return the validation report, selected primitives, and one sentence for each selection. Include the resolved script path, resolved target path, cwd, argv, and exit code as execution evidence.
```

Çözümlü komut, yer tutmayan şekilinde olmalıdır:

```bash
python3 "/absolute/install/path/skill-contract-reviewer/scripts/check_skill.py" \
  "/absolute/workspace/path/agent-skills-first-run/my-first-skill"
```

Başarılı bir sonuç üç özellikten de oluşur:

1. Ev sahibi buldu .`skill-contract-reviewer`Adıyla.
2. Değerlendirici paket sözleşmesini okuyor ve paket onaylayıcıyı çalıştırıyor.
3. Cevap, yapısal hata olmadan onay raporu içerir.
   Örnek, ek olarak haklı bir ilkel seçim.

Yaptıkları kanıtlarda senaryo yolu, hedef yolu, cwd, tam adı da bulunmalıdır.
Bu alanlar olmadan akıcı bir rapor
Kurulan eş metni çalıştırdığını kanıtlayın.

Ev sahibi yeteneğin bulunmadığını bildirirse, kurulumunu doğrulayın
hedef, bir kez yeniden tarayın veya yeniden başlatın ve açıkça yapılan talebi tekrar deneyin.
Kurulum başarısızlığını gizlemek için beceri tanımını yeniden yazmak.

### 4. Sönem içeren seçim

Yeni bir ajan dönüşü başlatın ve yeteneği isimlendirmeden aynı görevi girin:

```text
Review <TARGET_ROOT>/my-first-skill as a reusable agent package and tell me whether its package contract is valid.
```

Ev sahibi seçilen becerileri ortaya çıkarırsa, seçtiğini kaydet
`skill-contract-reviewer`Ev sahibi yönlendirmeyi açığa çıkarmazsa,
Açıkça çağrıda taşınabilir geri dönüş bulunmaktadır.

### 5. Temizle.

Sadece yüklenen incelemeci paketini kaldır:

```bash
npx skills remove skill-contract-reviewer
```

Kurulum sırasında kullanılan aynı host ve kapsamı seçin.
Sessiyon, açık bir şekilde istek`skill-contract-reviewer`rapor etmelidir.
- Bu kullanılamıyor.`my-first-skill`Sonraki dersler için veya
Yolu bitirdikten sonra laboratuvar dizinine.

## Sorun

Ekibinizin güvenilir bir yayın iş akışı olduğunu varsayalım. Birleştirilmiş değişiklikleri bulur, göç notlarını kontrol eder, değişim kaydı güncelleyir, bir paket komutu çalışır ve bir inceleme kontrol listesini oluşturur.

Bu iş akışını bir istekle koymanın yapıştırması kolay ve çalıştırılması zor hale getirir. istekle sabit bir kimliğe, keşif kuralına, kaynak sınırına, test edilebilir paket şekline ve temel soruların cevabına sahip değildir: Kim çağırabilir? Modelin ne zaman seçmesi gerekir? Hangi senaryoları çalıştırabilir? Hangi dosyalara güvenilir?

Bu nedenle, her tekrar kullanılabilir talimatı bir beceri olarak değerlendirmek yanlış bir şeydir. deposu konvansiyonları, belirleyici otomasyon, dış araçlar, olay hakları ve delegasyonlu ajanlar farklı sorunları çözüyor.`SKILL.md`bir ev sahibi'nin belgelenmemiş davranışına bağlı olarak taşınabilir görünen bir dizin oluşturur.

İlk mühendislik görevi sınıflandırma. Nasıl paketleneceğine karar vermeden önce eserin ne olduğunu belirleyin.

## Anlaşım

### Yetenekler prosedürel bilgiyi kodlamaktadır

Bir ajan yeteneği , giriş noktası olan bir dizindir .`SKILL.md`. Giriş dosyası, YAML ön maddesini ve ardından Markdown talimatlarını içerir. Dizin ayrıca referanslar, senaryolar ve varlıkları da içerebilir.

```figure
skill-package-anatomy
```

Markdown dosyası değil, dizin, dağıtılabilir birimdir.`SKILL.md`Kayıp referansları olan bir paket, ön malzemesi analiz edilse bile kırılmış.

### Komşu soyutlamalar

| Artifact | Primary job | Loaded or run when | What it should not impersonate |
|---|---|---|---|
| Prompt | Shape one model interaction | Included by an application or user | A versioned package with resources |
| Repository instructions | Explain one codebase's standing rules | A coding runtime enters that scope | A reusable task workflow |
| Agent skill | Supply reusable procedural knowledge | Explicit or implicit activation | A hard authorization boundary |
| MCP tool | Expose a typed remote capability | The model or application calls it | A detailed operating procedure |
| Hook | Run deterministic logic on an event | The declared event occurs | Probabilistic model routing |
| Subagent | Delegate work with separate context and state | An orchestrator creates or calls it | A static instruction bundle |
| Plugin | Distribute a larger runtime extension | The host installs or enables it | The portable skill contract itself |
| Learned skill library | Store behavior discovered through experience | A policy retrieves a prior program or trajectory | A standards-based `SKILL.md` package |

Bir serbest bırakma becerisi, ajanın bir serbest bırakmayı nasıl inceleyeceğini söyleyebilir. Bir MCP sunucusu serbest bırakma kayıtlarını ortaya koyabilir. Bir kanca doğrudan itmeyi yasaklayabilir. Bir alt görevli adayı bağımsız olarak denetebilir. Bu parçalar farklı sorumlulukları taşıdığı için oluşturulur.

### "İltibat" kelimesi iki farklı fikre atfeder.

Araştırma sistemleri bazen öğrenilmiş bir programa, başarılı bir yoldaki veya çevreye özgü bir politika fragmanı bir beceri olarak adlandırır. Bir ajan, keşif sırasında bu eserleri oluşturabilir, görev benzerliğiyle geri alabilir, uygulayabilir ve kitaptaki geri bildirimleri gözden geçirebilir.

Bu mini-track'deki Agent Yetenek farklıdır. Bu, açıklanan dosya sistem sözleşmesi, katalog metadata, ilerici açıklama, çalıştırma zaman aracılığıyla çağrı ve host kontrolü araçları ile birlikte yazılmış bir paketdir.

| Dimension | Agent Skill package | Learned skill library |
|---|---|---|
| Primary unit | `SKILL.md` directory | Program, policy, trajectory, or memory record |
| Creation | Authored, generated, or curated | Usually discovered from environment experience |
| Selection | Catalog description plus runtime policy | Retrieval or policy over task state |
| Execution | Model follows instructions and calls host tools | Environment runs a stored behavior or code artifact |
| Portability | Package contract can cross compatible hosts | Often tied to one environment and action space |
| Evaluation | Routing, artifact, safety, and host compatibility | Reward, success rate, transfer, and library growth |

Her iki fikir de tekrar kullanılabilir yetkinlik paketini içerir.

### Uygulanabilir çekirdek

Agent becerileri özellikleri iki ön madde alanı gerektirir:

```yaml
---
name: release-readiness
description: Inspect a release candidate when the user asks whether a version is ready to publish.
---
```

`name`Bu özelliklerin isimlendirme kurallarına uymalı ve ana dizinle eşleşmelidir. `description`Bu bilgi, yeteneklerin ne yaptığını ve ne zaman uygulanacağını belirtmelidir.

Aktarılabilir seçeneği alanlar:

| Field | Purpose | Portability note |
|---|---|---|
| `license` | State the terms for the package | Core specification |
| `compatibility` | State environmental requirements | Core specification |
| `metadata` | Carry string-valued extension data | Core specification |
| `allowed-tools` | Suggest pre-approved tools | Experimental; host support varies |

Markdown organı, iş akışı, karar noktaları, başarısızlık davranışları ve destek kaynaklarına doğrudan yolları tanımlamalıdır.

```markdown
# Release readiness

Use this workflow for a release candidate, not for ordinary development builds.

1. Read `references/release-policy.md`.
2. Run `python3 scripts/inspect_release.py --format json`.
3. Stop if the report contains a blocking failure.
4. Produce the checklist from `assets/release-checklist.md`.
5. Ask for approval before any publish or tag action.
```

### Çalışma süresi uzantıları ikinci katman

Bazı ev sahipleri ek ön madde veya eş yapılandırmayı kabul eder. Bu alanlar yararlı olabilir, ancak otomatik olarak taşınabilir değildir.

| Behavior | Example host extension | Portable core? |
|---|---|:---:|
| Hide a skill from model routing while keeping direct user invocation | `disable-model-invocation` | No |
| Hide a skill from the user's command menu while allowing model routing | `user-invocable` | No |
| Show argument help in a command menu | `argument-hint` | No |
| Run the skill in delegated context | `context`, `agent` | No |
| Pin model or reasoning settings | `model`, `effort` | No |
| Register lifecycle automation | `hooks` | No |
| Disable implicit invocation in Codex | `agents/openai.yaml` policy | No |

Her uzantıyı bir adaptör olarak değerlendirin. Temel iş akışını geçerli tutun, düşüşü belgeleyin ve onu tüketen barındırmayı test edin. Bir çalıştırma zamanı bilinmeyen bir alanı görmezden gelebilir, reddedebilir veya davranışları uygulamadan koruyabilir.

### Ön madde , çalıştırılabilir metadata

Metadata, beceri kurumu okumanın öncesinde sistem davranışını değiştirir.

- Bir bozukluk .`name`keşif başarısız olabilir.
- - Kısıtlı .`description`yanlış istekleri yönlendirebilir.
- Sadece insan bayrağı, modelin kataloğundan yeteneği çıkarır.
- Bir araç tahsisinin sahibi izin istemesini değiştirebilir.
- Bir bağlam ayarı, yürütmeyi ayrı bir ajan oturumuna taşıyabilir.

Konfigurasyon kodu gibi ön maddeyi gözden geçirin. Onu doğrulayın, versiyon verin ve davranışlarını değerlendirmelere dahil edin.

### Yetenek yaşam döngüsü

```figure
skill-runtime-lifecycle
```

Her ok kendi başarısızlık modlarına sahip bir sınırdır.

1. **Discovery**yapılandırılmış yerlerde olası paketler bulur.
2. **Validation**Katalog yayınlanmadan önce yanlış biçimlendirilmiş veya güvenli olmayan paketleri reddeder.
3. **Cataloging**- ... bir kompaktı ortaya çıkarır .`name`ve `description`- Tam paket değil.
4. **Selection**yetkinliğin uygun olup olmadığını belirler.
5. **Activation**Vücudun model görebilir bir bağlamına yüklenmesi.
6. **Disclosure**referansları veya varlıkları yalnızca bir şubenin ihtiyaç duyduğu zaman okuyor.
7. **Execution**host araçlarını host'ın izin ve izole kuralları altında kullanır.
8. **Verification**üretilen eser, modelin iddialarından bağımsız olarak kontrol edilir.

Bu aşamaların çökmesi kötü zihinsel modellere neden olur. Bulunan bir beceri aktif değildir.

### Bilgiler ve araçlar ortogonal

MCP, "Bu uygulama hangi yetenekleri arayabilir ve onların şemaları nelerdir?" diye cevap verir.

```figure
skill-tool-orthogonality
```

Bu özellik bir aracı adlayabilir, ancak ev sahibi gerçek yetenek kayıtlarına sahip. Eğer araç yoksa, yetenek bir düşüş veya başarısızlık belirtmelidir. Bu asla bir yeteneğin adının oluşturulduğunu ima etmelidir.

### Bilgiler ve deposu talimatları farklı alanlardır

Depo talimatları zaten bulunduğunuz ortamı tanımlar: komutlar, konvansiyonlar, oluşturulan dosyalar ve sınırlar. Bir beceri birçok depose içinde oluşabilecek bir görev için tekrar kullanılabilir bir prosedür sağlar.

Her ikisi de geçerli olduğunda, aktif kullanıcı talebi ve deposu kuralları beceriyi kısıtlar.

### Yetenekler birbirini içeri almaz

Bir beceri ajanı diğerini çağrıştırmaya yönlendirebilir, ancak bu dil düzeyinde bir ithalat değildir. İkinci beceri hala çalıştırma süresi keşfi, uygunluk, etkinleştirme, izinler ve bağlam yönetimi yoluyla geçer.

Gözetilebilir iş akışı kenarları olarak beceri arası bağımlılıkları yazın:

```markdown
After producing the candidate changelog, invoke the `release-risk-review` skill.
Pass the candidate path and require a blocking or non-blocking verdict.
If that skill is unavailable, stop and report the missing dependency.
```

Bu bağımlılığı test edilebilir hale getirir ve ev sahibi politikaları uygulamaya geçirme şansı verir.

## Yapın

`code/main.py`Bu sistem, standartlara yönelik küçük bir onaylayıcı ve bir eser seçicisi uyguluyor.

Validasyoncu aşağıdakileri ortaya çıkarır:

- `parse_frontmatter(text)`Metadataları vücuttan ayırmak için.
- `validate_skill_text(text, directory_name, allowed_runtime_extensions=())`Gerekli alanları, isimlendirme, bilinmeyen uzantıları, vücut varlığı ve taşınabilir sınırları kontrol etmek için.
- `ValidationIssue`ve `SkillReport`Bir çürük boolean yerine yapılandırılmış kanıtları geri göndermek.
- `FrontmatterSyntaxError`Güvenli bir şekilde yorumlanamayacak bir giriş için.

Seçiciler açığa çıkarır `TaskShape`ve `select_primitives(task)`Bir görevin ihtiyaçlarını sıradan kod, depot talimatları, bir beceri, bir kanca, bir alt-gen veya bir MCP aracı ile haritasıyor.

Laboratuvarı çalıştır:

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/22-skills-and-agent-sdks
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Bu komut blokuna yerel bir klon gerek ve içeriden herhangi bir yerden başlamalı .
Bu klon öyle.`git rev-parse --show-toplevel`deposu kökü çözmek için.

Demo, bir geçerli taşınabilir beceri, bir host genişletilen beceri, bir geçersiz paket ve birkaç görev biçimi kararı için JSON yazdırırır. Sorun kodlarını inceleyin.

### Valide etmem için gerekli olan emirler

Daha derin içeriği kurallarından önce ucuz yapısal gerçekleri doğrulayın:

```figure
skill-validation-order
```

Bu sıralama ikinci hataların ilk kırık değişkenini gizlemesini engeller.

## Kullan

Bir beceri yazmadan önce, bu karar kartını doldurun:

| Question | If yes | Likely primitive |
|---|---|---|
| Does this need reusable model judgment across several steps? | The procedure is stable but decisions vary | Skill |
| Must this happen every time an event fires? | Missing one execution is unacceptable | Hook or application code |
| Does the model need an external capability with typed inputs? | The operation lives outside model context | Tool or MCP server |
| Does the work need isolated context, state, or ownership? | A separate worker returns a bounded result | Subagent |
| Is this guidance specific to one repository? | It describes local commands and constraints | Repository instructions |
| Is one interaction enough? | No package lifecycle is needed | Prompt |

Birçok üretim iş akışı birden fazla satır kullanır. Kart bir eser her mülkiyet sağlıyor gibi davranmasını engeller.

## Gönder

Bu ders , `skill-contract-reviewer`Altında bir paket`outputs/`İçeriğinde:

- bir taşınabilir`SKILL.md`önerilen beceri paketini gözden geçirir;
- taşınabilir sözleşme ve ilkel seçim için referans kontrol listeleri;
- Determinizm doğrulama metni;
- Görev şekli, istekleri, becerileri, araçları, hakları, sıradan kodları ve alt kısımları kapsayan cihazlar.

Sadece giriş dosyası değil, tüm paketleri yükle:

```bash
cd "$(git rev-parse --show-toplevel)"
python3 scripts/install_skills.py /tmp/aiefs-skills --phase 13 --type skill
```

Kurs yükleyici, her kopyalanan 13. aşama yeteneğini rapor eder ve yazar:
`/tmp/aiefs-skills/manifest.json`Bu temiz yer paket şeklini kontrol eder .
Yukarıdaki ilk başarı döngüsü gerçek bir ev sahibi içinde keşif ve çağrı kontrol eder.

Aşağıdaki dersler yaşam döngüsünün her aşamasını derinleştirir. 24 ders keşif ve ilerleyici açıklama oluşturur. 25 ders çağıran politika ve yönlendirme oluşturur. 26 ders, izinleri kum kutularından ayırır. 27 ders tüm paketi değerlendirilmiş bir serbest bırakma eseri haline getirir.

## Egzersizler

1. Kendi ekibinizden beş iş akışını sınıflandırın .`TaskShape`Birden fazla ilkel seçtiğin her davası savunabilirsin.
2. 500 karakterli bir testin olduğunu kanıtlayan sınırlar testlerini ekleyin`compatibility`değer geçer ve 501 karakterlik bir değer bir özellik hatası olarak başarısız olur.
3. İzin listesine bir çalıştırma süresi uzantısı ekleyin. Aynı dosyanın sadece taşınabilir bir beceriyle hala ayırt edilebilir olduğunu kanıtlayan bir test yazın.
4. 400 satırlı bir istekle bölün .`SKILL.md`Bir referans, bir senaryo sözleşmesi ve bir çıkış şablonu.
5. Bir MCP aracı bulunmayan bir beceri için bir başarısızlık tepkisi tasarlayın.
6. Var olan bir beceriyi gözden geçirin ve her cümleyi yönlendirme, prosedür, politika, referans işaretçisi veya çıkış sözleşmesi olarak etiketleyin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| Agent skill | "A saved prompt" | A discoverable directory of procedural instructions and optional resources |
| Portable core | "Fields every runtime shares" | The contract defined by the Agent Skills specification |
| Runtime extension | "Extra frontmatter" | Host-specific configuration whose behavior requires a compatible adapter |
| Activation | "The skill ran" | The skill body entered model-visible context; execution may come later |
| Skill dependency | "Import another skill" | A runtime-mediated invocation edge with availability and policy checks |
| Tool contract | "A function schema" | Inputs, outputs, permissions, side effects, errors, and evidence for a capability |

## Daha Fazla Okumak

- [Agent Skills specification](https://agentskills.io/specification)taşınabilir dizin ve ön ürün sözleşmesi için.
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)kapsam, talimatlar ve kaynak örgütlemesi için.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)Codex'un mevcut keşif ve çağrı davranışları için.
- [Claude Code skills](https://code.claude.com/docs/en/skills)Bir çalıştırma süresi için çağrı, argüman, araç ve delegasyonlu bağlam uzantıları.
