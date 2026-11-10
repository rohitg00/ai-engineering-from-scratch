# Yetenekler Bulma ve Gelişen Açıklama

> Bir beceri, vücudunun yüklenmesinden önce yararlı hale gelir. Adı ve açıklaması katalogda yer alır; daha derin dosyaları görev onlara ulaştığında bağlam kazanır.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 22 (Agent Skills: Portable Contract and Runtime Boundary)
**Time:** ~105 minutes

## Öğrenme Hedefleri

- Kapsamı, doğrulama, çarpışma politikası ve katalog yayınını ayıran bir dosya sistemi keşif boru hattı oluşturun.
- Açıklama üç seviyesi açıklanmalı: katalog metadata, aktif talimatlar ve görev-özel kaynaklar.
- Tasarım referansları, böylece bir ajan tüm paketleri yüklemeden gerekli detaylara doğrudan ulaşabilir.
- Bütçe katalog alanı aktif beceri bağlamından bağımsız olarak.
- Bir yetenek kendi kaynaklarını okurken yol geçişini reddet ve simlink kaçış.

## Sorun

Ajanın 200 tane yeteneği var.`SKILL.md`Bu işlem, bir başlatma işleminde, bir referans dosyası, bir senaryo ve bir şablonun bulunduğu süreci kapatır.

Genel olarak yapılan anlaşma bir katalog: modelin her uygun beceri için kompakt bir kimlik ve yönlendirme tanımını gösterir, sonra da tüm vücut seçilince yüklenir. Bu iki yeni mühendislik sorunu yaratır.

İlk olarak, keşif sadece geri dönüşümlü dosya arama değildir. Bilgiler proje, kullanıcı, yöneticisi, eklenti veya yerleşik alanlarda olabilir. İki paket bir ismi paylaşabilir. Bir sim bağlantı güvenilir kökenin dışına işaret edebilir. Yanlış biçimlendirilmiş bir paket katalog alanını tüketebilir veya çağırabilir.

İkincisi, aşamalı açıklama aşamalı karışıklığa dönüşebilir.`SKILL.md`Bu nedenle, bu modelle ilgili bir dizi dosya ile ilgili bir bilgiyi göndermek için, bir dosya ile ilgili bir bilgiyi göndermek için, bir dosya ile ilgili bir bilgiyi göndermek için, bir dosya ile ilgili bir bilgiyi göndermek için, bir dosya ile ilgili bir bilgiyi göndermek için, bir dosya ile ilgili bir bilgiyi göndermek için, bir dosya ile ilgili bir bilgiyi göndermek için, bir dosya ile ilgili bir bilgiyi göndermek için, bir dosya ile ilgili bir bilgiyi göndermek için, bir dosya ile ilgili bir bilgiyi göndermek için, bir dosya ile ilgili bir bilgiyi göndermek için, bir dosya ile ilgili bir bilgiyi göndermek için, bir dosya ile ilgili bir bilgiyi göndermek için, bir dosya ile ilgili bir bilgiyi göndermek için, bir dosya ile ilgili bir bilgiyi göndermek için, bir dosya ile ilgili bir bağlantı ile bir bağlantı kurmak için, bir bağlantı kurulunun bir bağlantısı ile, bir bağlantı kurulunun bir bağlantısı ile, bir bağlantı kuruluş, bir bağlantı kuruluş, bir bağlantı kuruluş, bir bağlantı kuruluş, bir bağlantı kuruluş, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir bağlantı, bir, bir bağlantı, bir bağlantı, bir bağlantı, bir, bir, bir bağlantı, bir bağlantı, bir, bir, bir, bir, bir, bir bağlantı, bir, bir, bir, bir, bir, bir, bir, bir, bir,

İyi bir çalıştırma süresi keşifleri belirleyici ve açıklamaları kasıtlı hale getirir.

## Anlaşım

### Discovery bir kompayiller boru hattı .

Dosya sistemini kaynak giriş olarak değerlendirin.

```figure
skill-discovery-pipeline
```

Her aşamada yapılandırılmış veriler ve yapılandırılmış hatalar üretilmelidir.

- Hangi köklerin araştırıldığı?
- Hangi adaylar bulundu?
- Hangi adaylar reddedildi ve neden?
- Hangi paket çarpışmayı kazandı?
- Hangi kataloglar bütçe nedeniyle kısaltıldı veya atıldı?

Bu kanıt olmadan, "modelin benim yeteneğimi kullanmadığı" teşhis neredeyse imkansızdır.

### Uçuş politikası kapsamı

Uygulanabilir özellikler, bir evrensel kurulum yolu veya öncelik sırası değil, bir beceri paketi tanımlar.

Genel bir çalıştırma süresi bu alanları kullanabilir:

| Scope | Example root | Intended ownership |
|---|---|---|
| Workspace | `<repo>/.agents/skills/` | Project maintainers |
| User | `<user-data>/skills/` | One developer |
| Administrator | `<system>/skills/` | Machine or organization policy |
| Plugin | A signed plugin bundle | Plugin publisher and installer |
| Built-in | Runtime package | Runtime vendor |

Ağustos 2026 itibariyle, Codex, keşif projesini belgelerinden `$CWD/.agents/skills`Bu, birleştirilmek yerine ikili isimler ortaya çıkabilir. Bunlar Codex davranışları, `SKILL.md` [Codex skill documentation](https://learn.chatgpt.com/docs/build-skills)Adaptör yazırken.

Dizin isimlerinden öncelik asla uydurma. Onu politika olarak açıkla ve test et. Ders laboratuvarı her bir için açık bir tam sayı sıralaması kullanır.`Scope`Yani aynı aday kümesi her zaman aynı şekilde çözülür.

### Çatışmaların bir kimliğe ihtiyacı var .`name`

İki paket isimlendirilmiş .`release-readiness`Birisi çalışma alanının önbelleği olabilir ve diğerleri ise kullanıcı öntanımlı olabilir.

```json
{
  "name": "release-readiness",
  "description": "Inspect a release candidate for this repository.",
  "scope": "workspace",
  "source": "/repo/.agents/skills/release-readiness",
  "selected": true
}
```

Ortak çarpışma politikaları şunları içerir:

| Policy | Benefit | Risk |
|---|---|---|
| Keep every candidate | Nothing is hidden | The model sees ambiguous names |
| Highest-precedence scope wins | Simple invocation | A local package can shadow a trusted one |
| Reject duplicates | No silent shadowing | Legitimate overrides stop working |
| Qualify names by source | Explicit identity | User-facing names become longer |

Ev sahibi için bir politika seçin.Diagnostikte reddedilen veya gölgelik edilen adayları model katalogunda bulunmadıkları halde koruyun.

### Üç açıklama seviyesi

Ajan Yetenekleri özellikleri aşamalı yüklemeyi tanımlar.

```figure
skill-disclosure-levels
```

#### 1 seviye: Katalog metadataları

Model, komşulardan yeteneği ayırt etmek için yeterli bilgiye ihtiyaç duyar.

Kullanılabilir bir tanım iki madde içerir:

```yaml
description: Validate a release candidate and produce a readiness report. Use when the user asks whether a version, tag, or package is ready to publish.
```

İlk madde yetenekleri belirler. İkinci kısımda tetikleyici sınırları belirler. 25 ders bu sınırları pozitif ve hafif hataları ile değerlendirir.

#### Düzeyi 2: aktif talimatlar

Aktifleştirildikten sonra, vücut bir harita ve bir prosedür olarak çalışmalıdır.`SKILL.md`Bu bir tasarım sinyali, doldurulacak bir hedef değil.

Vücudun içi:

- Görev sınırları;
- Öntanımlı iş akışı;
- Şartlar;
- Daha derin dosyalara doğrudan atıfta bulunmak;
- araç ve senaryo sözleşmeleri;
- Başarısızlık ve durdurma davranışları;
- Beklenen çıkış ve doğrulama.

Merkez iş akışını giriş dosyasını kısa yapmak için bir referans olarak taşımayın. Aktifleştirme, modelin doğru bir şekilde başlaması için yeterli bağlam sağlamalıdır.

#### Dönüşme seviyesi 3: Destek kaynakları

Referanslar proza veya veri sağlar. Skriptler belirleyici hesaplama sağlar. Varlıklar talimat olarak değil, teslim edilebilir ürünlere kopyalandırılır, doldurulur veya dönüştürülür.

| Directory | Model reads it? | Model executes it? | Typical content |
|---|:---:|:---:|---|
| `references/` | Yes, when needed | No | schemas, policies, domain guides |
| `scripts/` | May inspect it | Through a permitted tool | validators, converters, collectors |
| `assets/` | Only if useful | No | templates, fixtures, images, starter files |

Bu isimler sihirli yetenekler değil, konvansiyonlar.

### Bölge-özel referanslar, konu atıklarından daha fazla

Giriş dosyasını bir karar haritası olarak yaz:

```markdown
## Choose the path

- For a Python package, read `references/python-release.md`.
- For a container image, read `references/container-release.md`.
- For a documentation-only release, read `references/docs-release.md`.
- If the release combines artifact types, read only the guides for those artifacts.
```

Bu, her referansın gözlemlenebilir bir yük koşulunu verir.`references/`"Bundan fazlası için" değil.

Referans grafikini yüzeysel tutun.`SKILL.md`Bir atlama ulaşılabilirliği test edilebilir hale getirir ve gerekli bir kısıtlamanın hiçbir zaman bağlamına girme olasılığını azaltır.

```figure
skill-reference-map
```

### Katalog bütçesi ve aktif bağlam farklı bütçelerdir

- Bırak .`c_i`Bu, seriye edilmiş kataloğun beceri maliyeti.`i`- Evet .`B_c`Katalog bütçesi, `b_j`aktif vücut maliyeti ve `r_k`Kaynaklar gerçekten yüklendi.

```text
catalog_cost = sum(c_i for every published skill)
active_cost = sum(b_j for every activated skill) + sum(r_k for every disclosed resource)
```

Bir bütçeyi azaltmak otomatik olarak diğerini azaltmaz. Kısa açıklamalar katalog alanını tasarruf edebilir, ancak aktif 900 satırlık bir vücut hala görevi boğar. Boruyu referanslara bölmek aktif maliyetleri ancak çalıştırma süresi ve talimatlar aslında alakasız dalların yüklenmesini önlerse azaltır.

Codex şu anda başlangıç yetenek listesini bağlamın yüzde 2'siyle bütçeliyor
8.000 karakter değerinin bir
Bu boyut bilinmeyen durumlarda geri dönüş; ikinci bir kaplama değil.
Kataloğun geçerli bütçeden fazlası olduğunda,
Bu rakamlar güncel olarak değerlendirilmelidir.
Kodeks politikası, ajan becerileri standartının bir özelliği değil.

### Kaynak yolları güven sınırlarıdır

Bir beceri sadece paket içindeki dosyaları okumalıdır.

```text
references/../../../../.ssh/config
references/external-link -> /private/company-secrets
```

Paket kökünü ve adayını dosya sistemi semantikası ile çözün, mutlak girişi reddedin ve çözülen adayın çözülen kök altında kaldığını doğrulayın. Bulmadan önce sim bağlantıların izin verildiğini belirleyin. İzin verirse, çözülen hedefi her zaman kontrol edin.

```figure
skill-resource-containment
```

Yolu tutma içeriğe güven oluşturmaz. Geçerli bir paket içi referans hala zararlı talimatlar içerebilir.

### Yükleme gözlemlenebilir olmalıdır.

Gizlilik kayıtları olmadan açıklama olaylarını kaydetmek:

```json
{
  "event": "skill.resource.loaded",
  "skill": "release-readiness",
  "resource": "references/python-release.md",
  "reason": "candidate contains pyproject.toml",
  "bytes": 2840
}
```

Bu nedenle, bağlam seçeneğini gözden geçirilebilir kanıtlara dönüştürür.

## Yapın

`code/main.py`Deterministik bir keşif ve açıklama motorunu inşa eder.

Bulma yüzeyi şunları içerir:

- `Scope`Kaynak ve öncelik metadataları için;
- `SkillCandidate`geçersiz dosya sistemi adayları için;
- `discover_scope(scope)`Hemen beceri dizinlerini listelemek;
- `resolve_collisions(candidates, precedence)`Bir açıklanan politika uygulamak;
- `CatalogEntry`ve `build_catalog(...)`sınırlı metadata yayınlamak;
- `CatalogBudget`Serileşmiş girişleri simgelemek için karakterler evrensel jetonlar.

Açıklama yüzeyi şunları içerir:

- `load_skill_body(entry, ...)`2. seviye aktivasyonu için;
- `validate_reference(skill_dir, reference)`Yol tutma için;
- `load_reference(...)`3 seviyesinin sınırlı okumaları için.

Laboratuvarı çalıştır:

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Bu blok yerel bir klon gerektirir ve deposu kökü herhangi bir
Klonun içinde çalışan bir dizin.

Demo, geçici proje ve kullanıcı alanları oluşturur, bir çarpışma ekler, kasıtlı olarak küçük bir bütçe altında bir katalog oluşturur, bir beceri etkinleştirir ve hem geçerli bir referans okuma hem de geçiş kaçışına çalışır.

### Neden keşif yüzeysel

`discover_scope`                      `SKILL.md`- Her yuvacıyı tekrar tekrar tedavi etmez .`SKILL.md`Bu, paket sınırını korur ve kurulmuş bir beceri içinde yanlışlıkla örnekler veya cihazlar yayınlanmasını önler.

### Neden laboratuvar keyfi YAML'i analiz etmez?

Laboratuvar, kataloguna ihtiyaç duyulan skalar ön maddesini destekler. Bir üretim çalıştırma zamanı açık bir şema, boyut sınırları ve devre özel nesne yapımı engellenmiş güvenli bir YAML analizcisi kullanmalıdır. "Stdlib-only" öğretim zorunluluğudur, kısmi bir YAML lehçesini sessizce icat etmeme izin verilmez.

## Kullan

Bu kontrol listesini herhangi bir keşif adaptörüne uygulayın:

1. Her yapılandırılmış kökü ve ona kim yazabileceğini listelen.
2. Simlink paketlerin izin verildiğini belirtin.
3. Paket adını, dizin adını, gerekli metadataları ve giriş bedeninin boyutunu onaylayın.
4. İç kimlik kaynağını ve kapsamını korumak.
5. İsimlerin çoğaltılmasını bildirin ve test edin.
6. Model'e gönderilen tam serili katalog ölçülür.
7. Bir cesedin veya kaynağın neden yüklendiğini kaydet.
8. Çözümlü paket kökünde kaynak okumalarını tutun.
9. Referans dosyası eksikken açıkça başarısız olun.
10. Kurulumlar veya politikalar değişirken katalogı yeniden oluşturun.

## Gönder

Bu ders , `skill-catalog-builder`paket. Açıkça sıralanmış kökleri tarar, simgelemiş giriş dosyalarını ve isim-katapör eşleşmezliklerini reddeder, çapraz çatışmaları çözür, eşit öncüliklü kopyaları reddeder ve seçilen metadataları açıklanan giriş, açıklama ve serileştirilmiş karakter bütçelerine ekler.

JSON raporu seçilmiş girişleri, gölge adayları, atılan girişleri, geçerlilik hataları, öncelik ve bütçe kullanımı içerir. Vücut ve referans yükleme ayrı çalıştırma süresi işlemleri olarak kalır, bu nedenle katalog oluşturan senaryoları yürütmez veya tüm paketi bağlamaya dahil etmez.

## Egzersizler

1. Bir eklenti kapsamını ekle ve kullanıcının ve yerleşik önceliğin arasında yerleştir. Çarpışma sonuçını bir testle kanıtla.
2. Çarpışma politikasını en yüksek önceliğe sahip isimlere değiştirin.
3.  için byte boyut sınırı ekle`load_reference`Dosyayı sınırı tam olarak test edin ve bir bayt yukarı.
4. Neredeyse aynı olan iki tanım oluşturun ve tetikleyici sınırlarının üst-üstün olmaması için yeniden yazın.
5. Her referans ve senaryo için hash içeren bir manifesto ekleyin.
6. Devamı, 1. seviye, 2. seviye ve 3. seviye bayt sayımlarını ayrı ayrı rapor etmek için kullan.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| Skill discovery | "Find every SKILL.md" | Search configured scopes, validate packages, attach provenance, and apply policy |
| Skill catalog | "The list of installed skills" | Compact model-visible routing metadata for eligible packages |
| Collision policy | "Which duplicate wins" | A declared rule for same-name candidates from different sources |
| Progressive disclosure | "Lazy loading" | Staged context admission from catalog to body to branch-specific resources |
| Reference graph | "Files linked by the skill" | The reachable resource structure and its load conditions |
| Path containment | "Stay in the folder" | Verify resolved resource targets remain inside the resolved package root |

## Daha Fazla Okumak

- [Agent Skills specification](https://agentskills.io/specification)paket şekli ve ilerleyici açıklama seviyeleri için.
- [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)Katalog yönlendirme metadataları için.
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)Doğrudan referanslar ve giriş dosyası boyutu için.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)Codex'un mevcut keşif alanları ve katalog sınırları için.
