# مطابقت  SOC 2، HIPAA، GDPR، PCI-DSS، قانون AI اتحادیه اروپا، ISO 42001

> پوشش چند چارچوبی، شرط میز برای معاملات تجاری 2026 است. **EU AI Act**: در اثر 1 اوت 2024 . بیشتر الزامات ریسک بالا 2 اوت 2026 اجرا می شود. جرمانه تا 15 میلیون یورو یا 3 درصد از گردش سالانه جهانی برای تعهدات سیستم ریسک بالا (مادة 99(4) ؛ تا 35 میلیون یورو یا 7 درصد برای شیوه های ممنوعه هوش مصنوعی (مادة 99(3) .**Colorado AI Act**: موثر در 30 ژوئن 2026 (از فوریه 2026 توسط SB25B-004)  ارزیابی تاثیر برای سیستم های با ریسک بالا، حق تجدید نظر در تصمیمات هوش مصنوعی. ویرجینیا مشابه برای اعتبار / اشتغال / مسکن / آموزش. **SOC 2 Type II**: نیاز به هوش مصنوعی B2B (نوع II، نه نوع I، برای فن تکنالوژی)**GDPR**: بزرگترین جریمه مشخصی مستند شده برای هوش مصنوعی 30.5 میلیون یورو علیه Clearview AI (DPA هلند، سپتامبر 2024) است؛ Garante ایتالیا 15 میلیون یورو علیه OpenAI در دسامبر 2024 صادر کرد (بعد در تجدید نظر در مارس 2026 رد شد). حذف PII در زمان واقعی در نتیجه استاندارد قابل دفاع است؛ پاکسازی پس از پردازش کافی نیست. **HIPAA**: خدمات بهداشتی محدود شده  نمی تواند PHI را بدون BAA به خدمات AI خارجی ارسال کند. **PCI-DSS**: پوشش لایه های تعامل هوش مصنوعی نیاز به تنظیم + توافقنامه های قراردادی دارد، نه خودکار. **ISO 42001**: استاندارد حاکمیت AI در حال ظهور، نیاز به خرید در کنار ISO 27001. پروفایل مرجع: OpenAI SOC 2 نوع 2 ، ISO / IEC 27001:2022 ، ISO / IEC 27701:2019 ، GDPR / CCPA / HIPAA (BAA) / FERPA ، PCI-DSS برای قطعات پرداخت ChatGPT را حفظ می کند. نقشه سازی چارچوب های مختلف خستگی حسابرسی را کاهش می دهد: کنترل دسترسی به نقشه در سراسر ISO 27001 A.5.15-5.18, GDPR Art. 32, HIPAA §164.312 ((a).

**Type:** Learn
**Languages:** (Python, TypeScript optional: compliance is policy + process, not code)
**Prerequisites:** Phase 17 · 25 (Security), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## اهداف یادگیری

- هفت چارچوب سال 2026 مربوط به محصولات LLM را ذکر کنید و هر کدام را با بخش مشتری مطابقت دهید.
- جدول زمانی اجرای قانون هوش مصنوعی اتحادیه اروپا (در ماه اوت ۲۰۲۴؛ اجرای ریسک بالا در ماه اوت ۲۰۲۶) و سقف دو سطحی (۱۵ میلیون یورو / ۳ درصد برای تعهدات با ریسک بالا، ۳۵ میلیون یورو / ۷ درصد برای اقدامات ممنوع) را ذکر کنید.
- توضیح دهید که چرا پاکسازی پس از پردازش PII برای GDPR کافی نیست و ویرایش لایه نتیجه گیری در زمان واقعی را به عنوان استاندارد قابل دفاع نام دهید.
- نقشه برداری کنترل های بین چارچوبی را توصیف کنید (به عنوان مثال، نقشه های کنترل دسترسی به ISO 27001 A.5.15-5.18 + GDPR ماده 32 + HIPAA §164.312 ((a)).

## مشکل

در خرید مشتری شرکت از SOC 2 نوع II، GDPR، HIPAA BAA، ISO 27001 و " بیانیه موافقت با قانون AI اتحادیه اروپا" درخواست می شود. تیم شما SOC 2 نوع I را دارد. شما شش ماه از نوع II هستید و هنوز ثبتات ماده 30 GDPR را آغاز نکرده اید.

پوشش چند فریم ورک یک مشکل LLM نیست  این یک مشکل سازمانی-SaaS است، با پوشش های خاص LLM. تیم های خرید در سال 2026 می خواهند یک ماتریس با یک ردیف در هر فریم ورک و یک ستون در هر کنترل، نه یک PDF.

## مفهوم

### هفت چارچوب

| Framework | Scope | LLM-specific requirement |
|-----------|-------|--------------------------|
| SOC 2 Type II | B2B SaaS baseline | Process controls audited over 6-12 months |
| HIPAA | US healthcare | BAA required; PHI cannot leave infrastructure without signed agreement |
| GDPR | EU users | Real-time PII redaction; data subject rights; Article 30 records |
| PCI-DSS | Payment data | Configuration + contracts for AI touching payment |
| EU AI Act | Serving EU users | Risk tier classification; high-risk systems: conformity assessment, documentation, logging |
| Colorado AI Act | Serving CO residents | Impact assessments; right to appeal |
| ISO 42001 | AI governance | Emerging; pairs with ISO 27001 |

### جدول زمانی قانون هوش مصنوعی اتحادیه اروپا

- ۱ آگوست ۲۰۲۴: در حال اجرا
- ۲ فوریه ۲۰۲۵: اعمال ممنوعه هوش مصنوعی اجرا شد.
- ۲ اوت ۲۰۲۶: سیستم های با ریسک بالا اجرا می شوند (تقييم سازگاری، اسناد، ثبت چوب).
- اوت 2027: سیستم های ریسک بالا در محصولات تحت قانون سازمانی هماهنگ

سطوح ریسک: غیرقابل قبول (منظور شده) ، ریسک بالا (تبایقی + ثبت نام) ، ریسک محدود (شفافیت) ، خطر حداقل (هیچ محدودیت) بیشتر B2B LLM SaaS دارای ریسک محدود است؛ ریسک بالا برای اشتغال، اعتبار، آموزش، اجرای قانون، مهاجرت، خدمات ضروری است.

جریمه (ماده ۹۹): تا ۱۵ میلیون یورو یا ۳ درصد درآمد سالانه جهانی برای نقض تعهدات سیستم با ریسک بالا (ماده ۹۹ ((۴) ؛ تا ۳۵ میلیون یورو یا ۷ درصد برای شیوه های ممنوعه هوش مصنوعی (ماده ۹۹ ((۳)) ؛ هر چه بالاتر باشد.

### GDPR  ویرایش در زمان واقعی استانداردی

پاکسازی پس از پردازش (از PII پس از اینکه LLM آن را ببیند، بازنویسی کنید) موضعی قابل دفاع نیست. مدل قبلاً داده ها را دیده است. ویرایش لایه نتیجه گیری در زمان واقعی استاندارد 2026 است:

- شناسایی شرکت قبل از درخواست LLM
- توکن سازی مداوم (رفتار میش) معنوی را حفظ می کند.
- فقط پیام های اصلاح شده + رضایت از انتخاب خام را ذخیره کنید.

اجرای اخیر: 30.5 میلیون یورو علیه Clearview AI (DPA هلندی، سپتامبر 2024) بزرگترین جریمه GDPR خاص AI به دست آمده تا کنون است؛ 15 میلیون یورو علیه OpenAI (گارانت ایتالیا، دسامبر 2024) بزرگترین جریمه خاص LLM است، اگرچه در تجدید نظر در مارس 2026 رد شد و حکم همچنان تحت بررسی بیشتر است. ادعاهای پس از پردازش در حسابرسی شکست خورده است.

### HIPAA  BAA اختیاری نیست

شما نمی توانید PHI را به خدمات AI خارجی بدون توافقنامه همکاری تجاری امضا کنید. هر سه پلت فرم LLM های هیپر اسکالری (Bedrock، Azure OpenAI، Vertex) BAA را ارائه می دهند. OpenAI مستقیم API BAA را ارائه می دهد. Anthropic مستقیم API BAA را ارائه می دهد. قبل از ارسال PHI تایید کنید.

### SOC 2 نوع II

نوع I: کنترل های طراحی شده و مستند شده.
نوع دوم: کنترل ها در طول 6 تا 12 ماه به طور موثر کار می کنند.

خرید B2B در سال 2026 به نوع II مربوط نمی شود. نوع I یک راه اندازی است؛ نوع II دروازه است.

عوامل مشترک حسابرسی: دفترچه های دسترسی (چه کسی چه چیزی را دید) ، مدیریت تغییر (چگونه به کار گرفته شد) ، ارزیابی ریسک (هر سه ماهه) ، پاسخ به حوادث (تست شده) ؟ دفترچه حسابرسی از مرحله 17 · 25 مستقیماً قابل استفاده مجدد است.

### نقشه برداری میان چارچوب ها

یک سیاست کنترل دسترسی کنترل های چارچوبی را برآورده می کند:

| Control | Frameworks |
|---------|-----------|
| Access logging | ISO 27001 A.5.15-5.18, GDPR Art. 32, HIPAA §164.312(a) |
| Change management | ISO 27001 A.8.32, PCI DSS Req. 6, HIPAA breach-notification scope |
| Encryption in transit | ISO 27001 A.8.24, GDPR Art. 32, HIPAA §164.312(e) |
| Secrets management | ISO 27001 A.8.19, PCI DSS Req. 8, SOC 2 CC6.1 |

ابزار های تطبیق (Drata، Vanta، Secureframe) این نقشه برداری را خودکار می کنند. ارزش هزینه در مقیاس است.

### ISO 42001  ظهور

در اواخر سال 2023 منتشر شد. تقاضا برای خرید در کنار ISO 27001 افزایش می یابد. چارچوب برای مدیریت هوش مصنوعی از جمله مدیریت ریسک، کیفیت داده ها، شفافیت، نظارت انسانی.

### پروفایل مرجع OpenAI

OpenAI SOC 2 نوع 2 ، ISO / IEC 27001:2022 ، ISO / IEC 27701:2019 ، GDPR / CCPA / HIPAA (BAA) / FERPA ، PCI-DSS را برای قطعات پرداخت ChatGPT حفظ می کند. این تقریباً میز شرکت در سال 2026 است.

### شماره هایی که باید به یاد داشته باشی

- جرمانه های قانون هوش مصنوعی اتحادیه اروپا: تا 15 میلیون یورو / 3٪ (اجازه های با ریسک بالا، ماده 99 ((4)) ؛ تا 35 میلیون یورو / 7٪ (تدریس ممنوع، ماده 99 ((3)).
- اجرای قانون هوش مصنوعی اتحادیه اروپا با ریسک بالا: 2 اوت 2026
- بزرگترین جریمه ثبت شده GDPR خاص AI: € 30.5M، Clearview AI (DPA هلندی، سپتامبر 2024).
- بزرگترین جریمه GDPR خاص LLM: 15 میلیون یورو، OpenAI (گارانت ایتالیا، دسامبر 2024؛ در تجدید نظر مارس 2026 رد شد).
- پنجره SOC 2 نوع II: 6 تا 12 ماه کنترل های عملیاتی.
- تاریخ اجرا قانون هوش مصنوعی کلرادو: 30 ژوئن 2026 (از فوریه 2026 توسط SB25B-004) تأخیر شد.

```figure
i4-control-matrix
```

## ازش استفاده کن

`code/main.py`یک جداول برقی نقشه برداری مطابق با دستور العمل در پایتون است  با توجه به کنترل، چارچوب هایی را که برآورده می کند، لیست می کند.

## -باده

این درس به ما کمک می کند`outputs/skill-compliance-matrix.md`. به توجه به بخش مشتری و جغرافیای آن، چارچوب و کنترل های مورد نیاز را مشخص می کند.

## تمرینات

1. اولین مشتری تجاری شما نیاز به SOC 2 نوع II، HIPAA BAA، بیانیه قانون AI اتحادیه اروپا دارد. حداقل وضعیت قابل اجرا برای کسب معامله چیست؟
2. سه محصول فرضیه ی LLM را تحت سطوح خطر قانون هوش مصنوعی اتحادیه اروپا طبقه بندی کنید.
3. تو تصادفاً PHI رو به يه ارائه دهنده بدون BAA فرستاده بودي
4. استدلال کنید که آیا ISO 42001 برای یک فروشنده هوش مصنوعی در بازار متوسط "در سال 2026 ضروری است".
5. زمینه های دفترچه حسابرسی LLM خود را (فاز 17 · 25) به حداقل سه کنترل چارچوبی نقشه برداری کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SOC 2 Type II | "audited controls" | Controls operating over 6-12 months, independently attested |
| HIPAA BAA | "healthcare contract" | Business Associate Agreement; required for PHI |
| GDPR | "EU privacy" | Real-time PII redaction is the defensible 2026 standard |
| EU AI Act | "EU AI rules" | High-risk enforcement August 2026; €15M / 3% (high-risk obligations) — €35M / 7% (prohibited practices) |
| Colorado AI Act | "US AI state law" | June 30, 2026 effective (delayed by SB25B-004); impact assessments |
| ISO 42001 | "AI governance" | Emerging framework for AI risk + transparency |
| ISO 27001 | "security ISMS" | Information Security Management System baseline |
| Conformity assessment | "EU AI doc package" | High-risk requirement: docs, testing, logging |
| Cross-framework mapping | "one control, many frames" | Single policy satisfies multiple framework controls |

## خواندن بیشتر

- [OpenAI Security and Privacy](https://openai.com/security-and-privacy/) پروفایل مطابقت مرجع
- [GuardionAI — LLM Compliance 2026: ISO 42001, EU AI Act, SOC 2, GDPR](https://guardion.ai/blog/llm-compliance-guide-iso-42001-eu-ai-act-soc2-gdpr-2026)
- [Dsalta — SOC 2 Type 2 Audit Guide 2026: 10 AI Controls](https://www.dsalta.com/resources/ai-compliance/soc-2-type-2-audit-guide-2026-10-ai-powered-controls-every-saas-team-needs)
- [EU AI Act official text](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) منبع اصلی
- [Colorado AI Act](https://leg.colorado.gov/bills/sb24-205) منبع اصلی
- [ISO/IEC 42001:2023](https://www.iso.org/standard/81230.html) استاندارد سیستم مدیریت هوش مصنوعی
