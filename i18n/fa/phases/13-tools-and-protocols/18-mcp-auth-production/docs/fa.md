# MCP Auth in Production: ثبت نام و توکن های مرتبط با صادر کننده

> درس 16 ماشین حالت OAuth 2.1 را ساخت. این درس محدودیت های تولید خود را برای MCP 2026-07-28 سخت می کند: اسناد متاداتا شناسه مشتری اول، ثبت دینامیک صرفاً برای سازگاری، تأیید صادر کننده مجوز-پاسخ، اعتبارات مشتری کلید صادر کننده، جفکس تازه سازی و توکن های پینی بینندگان در هر درخواست بی وضعیت.
>
> **Spec note (2026-07-28):**ثبت نام پویا مشتری به نفع اسناد متاداتا شناسه مشتری منسوخ شده است. DCR یک مکانیسم سازگاری باقی می ماند. هنگامی که استفاده می شود، مشتری اعلام می کند که درست است `application_type`. یک مشتری یک RFC 9207 فعلی را تایید می کند`iss`ارزش گذاری و هرگز استفاده مجدد از اعتبارات در میان صادرکنندگان سرور مجوز.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 16 (OAuth 2.1 state machine), Phase 13 · 17 (gateways)
**Time:** ~90 minutes

## اهداف یادگیری

- یک سرور مجوز را از طریق متاداتا RFC 8414 کشف کنید و قرارداد را تأیید کنید.
- از طریق یک سند متاداتا شناسه مشتری ثبت کنید و DCR های منسوخ شده را به عنوان یک بازپسین جدا کنید.
- اعتبار RFC 9207 را تایید کنید `iss`، ثبت کلیدی توسط صادر کننده سرور مجوز و توکن های کلیدی محدود به منابع توسط صادر کننده به علاوه منابع.
- کلید های JWKS را در یک برنامه ذخیره و تازه کنید تا تأیید امضا از سرگردانی کلید زنده بماند.
- توکن ها را با استفاده از شاخص های منابع RFC 8707 به یک منبع MCP واحد متصل کنید و از استفاده مجدد از معاون های گیج شده رد کنید.
- تایید JWT یا بررسی درونگشایی توکن را انتخاب کنید، تازه بودن فسخ را تعریف کنید و وقتی وابستگی های هویت در دسترس نیستند، به طور ایمن شکست بخورید.
- سرور مجوز، سرور منابع و مشتری را جدا کنید تا هر کدام فقط چک های خود را اجرا کنند.
- یک سرور مجوز را با یک لیست چک نشریات بررسی کنید و ثبت نام یا استفاده مجدد توکن را که ایمن نیست رد کنید.

## مشکل

شبیه ساز درس 16 OAuth 2.1 را در حافظه اجرا می کند. تولید سه شکاف عملیاتی دارد که شبیه ساز فقط حافظه نمی بیند.

اولین شکاف ثبت نام و انزوا اعتبار است. یک سازمان واقعی ممکن است صدها سرور MCP و هزاران مشتری MCP را اجرا کند. تجدید نظر 2026-07-28 ترجیح می دهد یک **Client ID Metadata Document**: مشتری از یک URL HTTPS با یک مسیر که آن را به عنوان شناسه کنترل می کند استفاده می کند و سرور مجوز متاداتا را می کشد. ثبت دینامیک RFC 7591 تنها به عنوان یک مسیر مطابقت منسوخ باقی می ماند. هنگامی که DCR اجتناب ناپذیر است، درخواست اعلام می کند درست است `application_type`. مشتری ثبت نام ها را تحت مجوز سرور صادر کننده و توکن های دسترسی را تحت عنوان `(issuer, resource)`یک صادر کننده تغییر یافته به معنای ثبت نام جدید است و یک منبع مختلف به معنای یک توکن جداگانه مربوط به مخاطبان است.

فاصله دوم چرخش کلید است. اعتبار JWT به کلید های امضا سرور مجوز بستگی دارد که به عنوان یک مجموعه کلید وب JSON (JWKS) منتشر می شود. سرور مجوز این موارد را در یک برنامه (معمولا هر ساعت، گاهی اوقات سریع تر در پاسخ حادثه) چرخش می کند. یک سرور MCP که یک بار JWKS را در راه اندازی دریافت می کند تا پنجره چرخش  خوب تایید می شود سپس هر درخواست تا زمان بازخورد شکست می خورد. کابل های تولید JWKS را به عنوان یک مقدار ذخیره شده با یک کار تجدیدپذیر می کند که پیش از انقضاء کلید های قبلی، بیش از آن یک بازخورد عقب در مورد cache miss برای پرونده ای که یک توکن امضا شده توسط کلید جدید تر از cache وارد می شود.

در کلاس 16 شاخص های منابع RFC 8707 معرفی شد. در تولید، این شاخص تبدیل به یک بررسی سخت برای هر درخواست می شود. سرور MCP مقایسه می کند `token.aud`این تنها دفاعی در برابر یک سرور MCP بالا (یا یک مشتری مخرب که یک توکن را برای یک سرور نگه دارد) است که آن توکن را در برابر یک سرور دیگر در همان شبکه اعتماد بازی می کند.

این درس هر شکاف را روی یک قطعه بتونی از سطح نقشه می زند. سند متاداتا یک نقطه پایان HTTP است. تازه کردن کش JWKS یک کار برنامه ریزی شده و اضافه کردن یک کش کلید است. اعتبار JWT یک روتین است که سرور منابع قبل از ارسال هر ابزار اجرا می کند. سه نقش را جدا نگه دارید و هر یک فقط چک هایی را که در اختیار دارد اجرا می کند: سرور مجوز کلیدها را صادر می کند و چرخش می کند، سرور منابع ذخیره و تأیید می کند، مشتری کشف و ثبت نام می کند.

## دامنه: اجرای تولید پس از درس 16

[Lesson 16: MCP Security with OAuth 2.1](../../16-mcp-security-oauth-2-1/docs/en.md)در این درس یک جریان دوم OAuth تعریف نمی شود. این درس پس از وجود این قراردادها شروع می شود و می پرسد که چگونه یک سرور منابع در حال اجرا آنها را در طول چرخش کلید، اعتبارسنجی توکن های نامشفق، لغو، شکست وابستگی، انتشار و پاسخ حادثه است.

مرز تولید تنگ تر و عملیاتی تر است:

- یک مسیر JWT یک صادر کننده، الگوریتم، کلید امضا، مخاطبان، ادعاهای زمان و دامنه را در هر درخواست تأیید می کند در حالی که JWKS را به طور ایمن تازه می کند.
- یک مسیر رمز گذاری ناپراور به نقطه پایان خودبینی معتبر صادر کننده می گوید و وضعیت فعال، مخاطب یا منبع، انقضاء، موضوع و دامنه بازگردانده شده را تأیید می کند.
- سیاست لغو تعیین می کند که چه سرعت باید اعتبارنامه کار را متوقف کند و چه حافظه کش می تواند این واقعیت را به تاخیر بیندازد.
- سیاست شکست تصمیم می گیرد که چه اتفاقی می افتد وقتی زیرساخت کشف، JWKS، بررسی درون یا برگشت در دسترس نیست.
- اسناد اثبات شده که میتا داده های صادر کننده، مجموعه کلید یا پاسخ در نظر گرفتن، ادعاهای توکن، نسخه سیاست و دلیل انکار نتیجه را بدون ذخیره توکن هدایت کرده است.

این تفاوت درس ها را قابل ترکیب نگه می دارد. درس 16 جریان را ثابت می کند. درس 18 ثابت می کند که یک توکن بعد از رسیدن به مسیر درخواست MCP واقعی قابل اعتماد باقی می ماند یا رد می شود.

## مفهوم

### RFC 8414  OAuth Authorization Server متاداتا

یک سند در `/.well-known/oauth-authorization-server`تمام چيزي که يک مشتری نياز داره رو شرح ميده:

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
  "client_id_metadata_document_supported": true,
  "registration_endpoint": "https://auth.example.com/register",
  "authorization_response_iss_parameter_supported": true,
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["mcp:tools.read", "mcp:tools.invoke"],
  "token_endpoint_auth_methods_supported": ["none", "private_key_jwt"]
}
```

یک مشتری که به یک منبع MCP داده شده کشف زنجیره URL: `oauth-protected-resource`از RFC 9728 (دokument سرور منابع) نام صادر کننده را می دهد، سپس `oauth-authorization-server`(این RFC) نام هر نقطه ی آخر را می دهد. مشتری هیچ وقت یک URL مجوز را سخت نمی کند.

برای یک شناسه منابع با یک مسیر، بخش شناخته شده را قبل از آن مسیر وارد کنید. به عنوان مثال، `https://mcp.example.com/team/server`میتا داده های منبع محرومی را در `https://mcp.example.com/.well-known/oauth-protected-resource/team/server`. اضافه کردن`/.well-known/...`بعد از اینکه مسیر منابع اشتباه باشد.

قراردادي که قبل از اعتماد به يک IDP براي MCP مي شناسيد:

- `code_challenge_methods_supported`شامل می شود`S256`(PKCE در RFC 7636) مشخصات واضح است: اگر این میدان **absent**، سرور مجوز PKCE و مشتری را پشتیبانی نمی کند **MUST**از ادامه دادن انکار کرد
- `grant_types_supported`شامل می شود`authorization_code`و ردش مي کنه`password`و`implicit`. .
- حداقل یک مسیر ثبت نام در دسترس است: `client_id_metadata_document_supported: true`(CIMD، ترجیحا) ، یک مشتری پیش از ثبت نام، یا`registration_endpoint`(موافقیت RFC 7591 کاهش یافته)
- اگه`authorization_response_iss_parameter_supported`درست است، مشتری نیاز به بازگشت RFC 9207 دارد`iss`و آن را دقیقا با صادر کننده ثبت شده قبل از تغییر مسیر مقایسه می کند.
- `response_types_supported`دقیقاً`["code"]`برای OAuth 2.1.

اگه`S256`اگر در حال غیبت است، سرور MCP از نشر در برابر این IdP  وجود ندارد حالت کاهش یافته برای PKCE. اگر * هیچ یک از * مسیر ثبت نام تبلیغ شده است و شما هیچ پیش از ثبت نام نیست `client_id`، شما هم نمی توانید ثبت نام کنید؛ دفترچه نشریات اشتباه است، نه کد.

### RFC 9728 (تجزیه)  متاداتا منابع محافظت شده

درسی 16 شامل RFC 9728 بود. دلتا در تولید: این سند تنها جایی است که یک مشتری به دنبال یافتن سرورهای مجوز است که توسط *این * سرور MCP مورد اعتماد قرار می گیرد. یک سرور MCP واحد ممکن است توکن های چندین IdP را (یک برای کارکنان، یکی برای شرکا) بپذیرد. RFC 9728 اعلام می کند که مجموعه؛ RFC 8414 اسناد هر IdP پشتیبانی می کند.

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com", "https://partners.example.com"],
  "scopes_supported": ["mcp:tools.invoke"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://notes.example.com/docs"
}
```

### اسناد متادای شناسه مشتری (موصف پیش فرض)

CIMD ثبت نام را از *پوش* به *پول* تبدیل می کند. به جای اینکه از سرور مجوز بخواهید تا یک `client_id`، مشتری از URL HTTPS استفاده می کند که کنترل می کند **as**.`client_id`. URL به یک سند متاداتا JSON حل می شود؛ سرور مجوز آن را در هنگام جریان OAuth به درخواست می گیرد. اعتماد در DNS ریشه دارد: اگر اپراتور سرور اعتماد کند `app.example.com`، به مشتری که خدمت کرده بود اعتماد داره`https://app.example.com/client.json`. بدون ثبت نام سفر برگشت و برگشت ، نه`client_id`نام فضا به تخلیه، هیچ حالت هر سرور برای حفظ همگامگی.

متاداتا سند که مشتری میزبانی می کند:

```json
{
  "client_id": "https://app.example.com/oauth/client.json",
  "client_name": "Example MCP Client",
  "client_uri": "https://app.example.com",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:7333/callback", "http://localhost:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

.`client_id`ارزش در سند **MUST**برابر URL که از آن خدمت می شود (سرور مجوز این را تأیید می کند؛ عدم مطابقت رد می شود). سرور مجوز پشتیبانی را با `client_id_metadata_document_supported: true`در متادای RFC 8414 آن.

برای قرارداد فعلی CIMD،`client_id`،`client_name`، و یک خالی`redirect_uris`آدیفکیشن مشتری یک URL HTTPS مطلق با یک مسیر است. `application_type`ممکن است شامل شود، اما این یک زمینه CIMD اجباری نیست.`application_type`به مسیر CIMD مورد علاقه

دو تا از حقايق امنيتي که مشخصات رو به طور واضح بيان ميکنه:

- **SSRF.**سرور مجوز یک URL ارائه شده توسط مهاجم را می گیرد. باید از جعل درخواست های طرف سرور دفاع کند (هیچ دسترسی به نقاط انتهای داخلی / مدیر).
- **localhost impersonation.**CIMD به تنهایی نمی تواند مانع حمله کننده محلی از ادعا کردن URL متادتا یک مشتری مشروع و پیوند دادن هر `localhost`.ملاحظه مجدد .سرور مجوز**MUST**نام میزبان URI را در زمان رضایت به وضوح نمایش دهید و **SHOULD**هشدار بده`localhost`-فقط يه بار ديگه رو ميگردونه

از آنجا که CIMD به حالت طرف سرور نیاز ندارد، هیچ ثبت کننده ای برای ایستادن به همان شیوه ای که DCR نیاز دارد وجود ندارد. طرف مشتری فقط برای خواندن است: سند متادتا خود را از یک نقطه پایانی HTTPS ثابت ارائه دهید و اجازه دهید سرور مجوز آن را بکشید.

اگر اپراتور سرور مجوز قبلاً یک شناسه مشتری را فراهم کرده است، قبل از امتحان ثبت نام خودکار از ثبت نام صادر کننده استفاده کنید. در غیر این صورت CIMD را ترجیح دهید. فقط زمانی که صادر کننده نمی تواند از پیش ثبت نام یا CIMD استفاده کند، DCR قدیمی را استفاده کنید.

### RFC 7591: ثبت نام مطابقت منسوخ

DCR در نسخه 2026-07-28 منسوخ شده است. آن را فقط برای سرورهای مجوز که نمی توانند CIMD را مصرف کنند و در آن صورت که پیش از ثبت نام غیر عملی باشد، نگه دارید. یک مشتری سازگاری پست می کند:

```json
POST /register
Content-Type: application/json

{
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "mcp:tools.invoke",
  "client_name": "Cursor",
  "software_id": "com.cursor.cursor",
  "software_version": "0.42.0"
}
```

سرور جواب ميده با `client_id`و یک`registration_access_token`برای بروزرسانی های بعدی:

```json
{
  "client_id": "c_3e7f1a",
  "client_id_issued_at": 1769472000,
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "registration_access_token": "regt_b2...",
  "registration_client_uri": "https://auth.example.com/register/c_3e7f1a"
}
```

`application_type`نه دکوراتيوي. يک كليک ديسک تاپ لوپ بیک اعلام مي كند`native`; یک مشتری میزبان سرور اعلام می کند `web`و از HTTPS URI های هدایت مجدد استفاده می کند. `token_endpoint_auth_method: none`این گزینه برای یک مشتری بومی عمومی مناسب است.`client_id`فقط با ارائه PKCE اثبات مالکیت.

سه خطره تولید:

- نقطه ی آخر ثبت باید حد بندی شده توسط IP منبع باشد. بدون این، یک بازیگر دشمن میلیون ها ثبت نام جعلی را نوشته و تمام اطلاعات را از دست می دهد.`client_id`قبل از اينکه دفتر ثبت نام درخواست رو انجام بده يه چک محدوديت نرخ رو اجرا کن
- `software_statement`(یک گواهی JWT امضا شده برای مشتری) توسط برخی از IDPs شرکت مورد نیاز است. مدل درس آن را رد می کند؛ کابل های تولید یک مرحله تأیید را رد می کند که ثبت نام های امضا نشده را از هر چیزی جز URL های هدایت محلی میزبان رد می کند.
- .`registration_access_token`دزدي از اين رمز يعني مهاجم ميتونه يه بار ديگه URIs رو از سمت اول بازنويسي کند

### RFC 8707 (تجزیه)  شاخص های منابع

درس 16 شکل را مشخص کرد. قانون تولید: هر درخواست رمزنگاری شامل`resource=<canonical-mcp-url>`، و سرور MCP تایید می کنه`token.aud`URL منابع خود را در هر تماس مطابقت می دهد. URI کانونیک * مشخص ترین * شناسه برای سرور است: از طرح کوچک و میزبان استفاده می کند، هیچ قطعه ای و به طور متعارف هیچ شلیک عقب است.**not**از قانون حذف شده  مشخصات آن را در زمانی که برای شناسایی یک سرور MCP فردی ضروری است نگه می دارد. `https://mcp.example.com`،`https://mcp.example.com/mcp`،`https://mcp.example.com:8443`و`https://mcp.example.com/server/mcp`همه ی URI های قانونی معتبر هستند. یکی را از هر سرور و پین انتخاب کنید`aud`(این تمسخر درس از مخاطبان میزبان برهنه استفاده می کند مانند`https://notes.example.com`برای خلاصه بودن: یک پیاده سازی که چندین سرور MCP را تحت یک اصل مشترک میزبانی می کند، آنها را به لحاظ مسیر تشخیص می دهد.)

### RFC 7636 (تجزیه)  PKCE

PKCE در OAuth 2.1 واجب است. جریان کد مجوز درس همیشه حمل می کند `code_challenge`و`code_verifier`سرور هر درخواست توکن را بدون یک تأیید کننده یا با یک تأیید کننده که به چالش ذخیره شده هاش نمی کند رد می کند.

### مشخصات مجوز MCP 2026-07-28

در حال حاضر MCP تجدید نظر حفظ OAuth منابع و سرور مرز در حالی که MCP حمل و نقل بدون حالت وجود دارد. هیچ جلسه پروتکل برای ذخیره سازی یک تصمیم هویت وجود دارد. بنابراین لایه مجوز هر درخواست به طور مستقل معتبر می کند:

- RFC 9728 متاداتا منابع محافظت شده را اجرا کنید و محل آن را از طریق `WWW-Authenticate: Bearer resource_metadata="..."`سرش روی 401**or**URI معروف`/.well-known/oauth-protected-resource`(SEP-985 باعث شد که سرنخ با یک عقب نشینی شناخته شده اختیاری باشد).`authorization_servers`زمینه**MUST**حداقل یک سرور را نام بده.
- فقط از طریق  توکن ها را قبول کنید`Authorization: Bearer ...`در**every**درخواست  هرگز در یک رشته سوال، هرگز فقط در آغاز جلسه تایید نشده است.
- اعتبارش را تایید کن`aud`،`iss`،`exp`، و دامنه های مورد نیاز در هر درخواست.**MUST**تایید کند که توکن به طور خاص برای آن صادر شده است (مشاهد) ؛ یک گمشده یا نامتناسب `aud`رد شده، هرگز به عنوان کارت وحشی مورد نظر قرار نمی گیرد.
- در 401/403، برگرد`WWW-Authenticate: Bearer`حمل`error=...`،`resource_metadata="<PRM-URL>"`پارامتر (URL سند متاداتا، *نه* منبع خالی) و `scope="..."`در`insufficient_scope`(403) توجه: پارامتر این است`resource_metadata`، يه اشاره اي براي کشف وجود نداره`resource`پارامتر در چالش
- اجازه سرور کشف قبول می کنه**either**RFC 8414 OAuth متاداتا **or**OpenID Connect Discovery 1.0؛ مشتریان باید هر دو ضمیمه شناخته شده را در ترتیب اولویت امتحان کنند.
- مشتری (نه سرور) در برابر**mix-up attacks**: انتظارات رو ثبت مي کنه`issuer`قبل از اینکه مسیر را تغییر دهد و تایید کند`iss`ارزش برگشت در پاسخ مجاز واقعی (RFC 9207) قبل از بازخورد کد. PKCE به تنهایی مخلوط کردن را متوقف نمی کند، زیرا مشتری به `code_verifier`به هر نقطه ای که هدایت شده بود.
- یک اعتبار مشتری متعلق به یک صادر کننده سرور مجوز است. اگر کشف به یک صادر کننده دیگر حل شود، مشتری به جای ارائه قدیمی دوباره ثبت نام می کند `client_id`، توکن ثبت نام، یا توکن دسترسی
- CIMD مکانیسم ثبت نام ترجیح داده شده است. DCR به کار رفته است؛ یک درخواست DCR مطابقت هنوز هم درست را اعلام می کند `application_type`. .

طرح OAuth 2.1 زیربنایی است؛ RFC 8414/7591/8707/9728/9207 + RFC 7636 + CIMD سطح است؛ مشخصات MCP پروفایل است.

### فهرست چک قابلیت های تعین

جدول های ویژگی های فروشنده به سرعت قدیمی می شوند. متاداتا را که توسط سرور مجوز به شما بازگردانده شده است بررسی کنید. دروازه مکانیکی است:

| Check | Required decision |
|---|---|
| Discovered issuer | Exact HTTPS issuer expected by policy |
| PKCE | `S256` advertised; otherwise stop |
| Enrollment | CIMD preferred, pre-registration accepted, DCR only as deprecated compatibility |
| Authorization response | Validate RFC 9207 `iss` when present or advertised |
| Resource binding | Token request carries `resource`; resource server requires the matching `aud` |
| Credential storage | Key client IDs and registration credentials by issuer; key access tokens by issuer plus resource |
| DCR compatibility | Declare `native` or `web`; reject redirect URIs that do not fit the declared application type |

از یک نام محصول یا سطح قیمت گذاری پشتیبانی نکشید. سند کشف شده را در شواهد انتشار ضبط کنید و در صورت عدم وجود یک زمینه اجباری بسته نشود.

### الگوی تازه سازی JWKS (در AS چرخش، در سرور منابع تازه سازی)

دو فعل را جدا نگه دارید، چون ترکیب آنها یک خطا تولید واقعی است:

- **Rotate**این کاری است که * سرور مجوز* انجام می دهد: یک کلید امضا جدید را چاپ کنید، آن را در JWKS منتشر کنید، قدیمی را بعدا بازنشسته کنید. سرور منابع هیچ مشارکت در این کار ندارد و نمی تواند انجام دهد  کلید های خصوصی IdP را در خود ندارد.
- **Refresh**این کاری است که *سرور منابع* انجام می دهد:`GET`اين تنها عمل JWKSي است که يک سرور منابع انجام ميده

حالت شکست تولید یک کش قدیمی است. آن را با یک کار تجدید برنامه ریزی شده و یک حافظه حافظه کلید-قیمت حل کنید. سرور منابع یک کار (cron، تایمر، هر آنچه زمان اجرا شما ارائه می دهد) را اجرا می کند که در یک فاصله ثابت، می آورد `<issuer>/.well-known/jwks.json`و اضافه کردن`cache[issuer] = {keys, fetched_at}`. اعتبارگر از اون حافظه ي مخزن ميخواد . يه رمزي که`kid`از محرکات حافظه پنهان گم شده**one**این کار دو مورد را به طور همزمان اداره می کند: تازه کاری برنامه ریزی شده و پنجره های تکیه کلید که یک توکن امضا شده توسط یک کلید جدید قبل از تازه کاری برنامه ریزی شده بعدی می آید.

پس از سقوط**must be a re-fetch, never a rotate**اگر مسیر گمشده حافظه را به یک چرخ و چسب بزنید، دو چیز شکسته می شود: (1) چسبیدن یک کلید تازه باعث می شود`kid`که * هنوز* با توکن مطابقت ندارد، بنابراین جستجو به هر حال شکست می خورد؛ و (2) یک مهاجم که توکن ها را با تصادفی پر می کند `kid`ارزش ها مجموعه ای از خلاقیت های کلیدی را مجبور می کند  یک DoS خود ایجاد شده است. یک بازیافت بی قدرت است، بنابراین یک جعلی `kid`به حداکثر يک بار تلف شده

شکل حافظه:

```json
{
  "https://auth.example.com": {
    "keys": [
      {"kid": "k_2026_03", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"},
      {"kid": "k_2026_04", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"}
    ],
    "fetched_at": 1772668800
  }
}
```

دو کلید در یک زمان حالت ثابت است. سرورهای مجوز با وارد کردن کلید بعدی (`k_2026_04`) قبل از بازنشسته شدن (`k_2026_03`), بنابراین توکن های صادر شده تحت کلید قدیمی تا زمانی که به پایان می رسند معتبر باقی می مانند.`kid`. .

### روال اعتبارسنجی

سرور MCP قبل از ارسال هر ابزار تایید را اجرا می کند.`code/main.py`استفاده:

```python
result = server.validate(bearer_token, required_scope="mcp:tools.invoke")
if not result["valid"]:
    return {"status": result["status"], "WWW-Authenticate": result["www_authenticate"]}
```

`validate`رمزگذاری JWT، حل کلید امضا از حافظه پیش فرض JWKS (فروش یک بار در یک اشتباه) ، تایید امضا، سپس چک `iss`در مقابل لیست اجازه داده شده`aud`در مقابل منابع کاینونیک این سرور،`exp`, و دامنه مورد نیاز  بازگشت یک `WWW-Authenticate`چالش در اولین شکست. نگه داشتن آن یک روتین واحد در سرور منابع به این معنی است که هر نقطه ورود (هر تماس ابزار، هر حمل و نقل) از طریق چک های مشابه عبور می کند؛ هیچ مسیری وجود ندارد که بدون تأیید اول به یک ابزار برسد.

### توکن های غیر شفاف از خودآگاهی استفاده می کنند نه حدس زدن

هر توکن دسترسی یک JWT نیست. اگر صادر کننده یک توکن غیر شفاف را مستند کند، سرور منابع نمی تواند آن را به ادعاهای قابل اعتماد رمزگذاری کند. این توکن را به نقطه انتخابی بازرسی RFC 7662 صادر کننده از طریق یک backchannel معتبر ارسال می کند و نیاز به`active: true`، زمینه صادر کننده انتظار می رود، مخاطبان یا منابع دقیق MCP، ادعاهای زمان غیرفعال و دامنه های مورد نیاز ابزار مشخص.

خودآگاهی از طریق صادر کننده، یک هضم یک طرفه توکن و منابع MCP. هرگز از رمز شفاف به عنوان یک برچسب ثبت یا حافظه کش استفاده نکنید. یک ورودی مثبت از زیرنویس با اولین انقضاء توکن، راهنمایی های زیرنویس صادر کننده و هدف تجدید تجدید نظر انتشار محدود شود. حافظه منفی را به اندازه کافی کوتاه نگه دارید تا یک توکن تازه صادر شده به طور جعلی غیرفعال باقی نماند. یک نتیجه برای یک منبع نمی تواند منبع دیگری را مجاز کند حتی اگر رشته رمزنگاری نامشفق یکسان باشد.

در حالت تأیید از محتوای توکن کنترل شده توسط مهاجم انتخاب نکنید. رفتار JWT در مقابل رفتار درونگشایی به متاداتا صادر کننده و پیکربندی انتشار تایید شده. در مسیر JWT، الگوریتم های پذیرفته شده و قابل اعتماد را پین کنید.`jwks_uri`; هرگز از یک URL کلیدی یا الگوریتم که فقط توسط عنوان توکن انتخاب شده است پیروی نکنید.

### فسخ کردن قرارداد تازه ایه

RFC 7009 اجازه می دهد تا یک مشتری از یک سرور مجوز بخواهد تا یک توکن را لغو کند. این درخواست کپی هایی را که قبلا توسط هر سرور منابع ذخیره شده است حذف نمی کند. حداکثر تاخیر قابل قبول لغو را تعریف کنید و هر کاش را به آن احترام بگذارید.

انتشار توکن های غیر شفاف می تواند با بررسی در هر تماس با ریسک بالا یا استفاده از یک کش مثبت کوتاه، از سرپوشانی دقیق تر دست یابد. پیاده سازی های مستقل JWT معمولاً عمر کوتاه توکن دسترسی را با لغو توکن تجدید، بازنشستگی کلید برای حوادث در سراسر صادر کننده و یک موضوع، جلسه یا فهرست دلیلی توکن برای رد محلی اضطراری ترکیب می کنند. یک JWT امضا شده تا زمان انقضا از نظر رمزنگاری معتبر باقی می ماند مگر اینکه سرور منابع دارای شواهد خارجی فعلی از لغو باشد.

ورود، غیرفعال کردن حساب، برداشت رضایت و پاسخ حادثه عوامل مختلفی هستند اما باید بر روی یک بیانیه قابل اندازه گیری همگام شوند: پس از حداکثر پنجره فسخ اعلام شده، هر نسخه اعتبار را رد می کند. این بیانیه را از طریق ترازنده بار، نه تنها در برابر یک فرآیند گرم آزمایش کنید.

### شکست وابستگی نیاز به تصمیم اعلام شده دارد

هرگز سیاست دسترسی را در داخل یک دستیار استثنا به طور خودکار اجرا نکنید.

| Failure | Safe production behavior |
|---|---|
| Scheduled JWKS refresh fails, known `kid` remains in a still-valid bounded cache | Continue only within the declared stale-on-error window and emit degraded health evidence |
| Token has an unknown `kid` and the one allowed refresh fails | Reject; never accept an unverifiable signature |
| Introspection is unavailable | Fail closed for protected calls; do not convert network failure into `active: true` |
| Protected-resource or issuer metadata changes unexpectedly | Stop new enrollment and token acquisition; keep only explicitly pinned, unexpired configuration under a bounded incident policy |
| Revocation endpoint is unavailable | Report logout or revocation as incomplete, retain the credential locally as unusable when possible, and do not claim global revocation succeeded |
| Clock source or claim type is invalid | Reject rather than widening skew until the token passes |

شکست ها را از اعتبارات غیرفعال جدا طبقه بندی کنید. قطع اعتماد یک خطای عملیاتی با سیاست سلامت و بازجربه است. امضا بد، صادر کننده، مخاطب، انقضاء یا دامنه یک انکار مجوز است. هیچ یک از این موارد به دستیار ابزار نمی رسد و هیچ یک نباید محتوای توکن را به شواهد حسابرسی برساند.

### پخش مجدد مخاطبان (محدودیت امتیازات توکن دسترسی)

سرور A (`notes.example.com`) و سرور B (`tasks.example.com`) هر دو در برابر سرور مجوز یکسان ثبت می شوند. سرور A به خطر می افتد. مهاجم توکن یادداشت های کاربر را می گیرد و آن را در برابر سرور B باز می کند.

اعتبار دهنده سرور B:

1. JWT رو رمزگشایی کن، JWKS رو از طریق تو بگير`kid`، امضا رو تایید کن
2. چک کن`iss`در مقابل متادای منابع محافظت شده اش`authorization_servers`. (مطابق مشابه IDP)
3. چک کن`aud == "https://tasks.example.com"`. (شکست دادن توکن)`aud`.`https://notes.example.com`.)
4. 401 رو با `WWW-Authenticate: Bearer error="invalid_token", error_description="audience mismatch", resource_metadata="https://tasks.example.com/.well-known/oauth-protected-resource"`. .

ادعای مخاطبان تنها دفاعی در برابر این حمله در لایه پروتکل است. تخفیف آن برای عملکرد رایج ترین اشتباه تولید است؛ اعتبار دهنده باید در هر درخواست اجرا شود، نه فقط در آغاز جلسه. مشخصات این را می نامند**access-token privilege restriction**: یک سرور MCP `MUST`هر نشانه ای را که در بین مخاطبان نامش را نپذیرفت رد کنید.

> **Naming note.**مشخصات اصطلاح "مربوطی اشتباه" را برای یک مشکل مرتبط اما مشخص حفظ می کند: یک سرور MCP که به عنوان یک OAuth عمل می کند**proxy**به یک API شخص ثالث، با استفاده از یک ID مشتری ثابت، که یک توکن را بدون دریافت رضایت کاربر در هر مشتری ارسال می کند. ارتباط بینندگان بازی مجدد را در بالا تنظیم می کند؛ حل حل حل معاون اشتباه رضایت در هر مشتری است **plus**هیچ وقت توکن ورودی را به API های بالا (سرور MCP) منتقل نمی کند`MUST`تا توکن خود را به سمت بالا ببرد).

### حملات مخلوط (دفاع طرف مشتری که سرور نمی تواند ارائه دهد)

یک مشتری با بسیاری از سرورهای مجوز در طول زندگی خود صحبت می کند. یک AS مخرب می تواند سعی کند تا مشتری کد مجوز AS صادقانه را در نقطه پایان توکن مهاجم بازخورد. پیوند مخاطبان در اینجا کمک نمی کند.

1. قبل از تغییر مسیر، مشتری انتظاراتش را ثبت می کند`issuer`از متادای AS معتبر
2. در پاسخ مجوز، مشتری پاسخ های بازگردانده را مقایسه می کند `iss`پارامتر در مقابل صادر کننده ثبت شده (مقارنۀ ساده رشته، بدون نرمال سازی) قبل از ارسال کد به هر جایی.
3. عدم مطابقت (یا `iss`وقتی که AS اعلام کرد از بین رفته بود`authorization_response_iss_parameter_supported`) → رد و حتی نشان دادن `error`. میدان ها

PKCE به تنهایی اشتباهات را متوقف نمی کند، چون مشتری به او می دهد `code_verifier`به هر نقطه نهایی رمزنگاری شده است که به آن هدایت شده است. به همین دلیل است که مشخصات صادر کننده را در هر درخواست همراه با تأیید کننده PKCE ثبت می کند و`state`. .

### حالت شکست

- **Stale JWKS.**اعتبارسازیگر بعد از اینکه AS کلید را چرخش کند، توکن های معتبر را رد می کند. اصلاح این است که الگوی cron-refresh + cache-miss-refetch در بالا است. هرگز JWKS را بدون یک کار تازه ذخیره نکنید.
- **Rotate-as-fall-back.**سیم کشی مسیر گمشده به یک چرخش و مرطوب به جای یک بازیافت یک خطای واقعی است: هرگز تولید نمی کند گمشده `kid`و اون به کنترل مهاجم تبديل ميشه`kid`ارزش ها را به یک کلید ایجاد DoS. سقوط عقب باید قادر به ایجاد باشد`refresh-jwks`. .
- **Missing `aud` claim.**بعضی از IDPs به طور پیش فرض حذف می کنند `aud`مگر اینکه`resource`در درخواست توکن موجود است. اعتبارگر باید توکن های گمشده را رد کند`aud`، نه اینکه از غیاب به عنوان کارت وحشی رفتار کنیم
- **Mix-up via missing `iss` check.**یک مشتری که RFC 9207 را تایید نمی کند`iss`پارامتر اجازه-جواب در برابر صادر کننده که قبل از تغییر مسیر ثبت شده است می تواند به بازخورد کد AS صادقانه در نقطه پایان توکن یک مهاجم هدایت شود. این یک شکست از طرف مشتری است؛ سرور منابع نمی تواند آن را تعویض کند.
- **Scope upgrade race.**دو جریان همزمان برای یک کاربر می تواند به موفقیت برسد و دو توکن دسترسی با دامنه های مختلف تولید کند. اعتبارگر باید از توکن ارائه شده در درخواست استفاده کند، نه به دنبال " دامنه فعلی کاربر"  که پنجره TOCTOU را ایجاد می کند.
- **Registration token theft.**یه دزدی`registration_access_token`اجازه می دهد تا مهاجم به بازنویسی URI ها بپردازد. این ها را در حالت استراحت ها هاش کنید؛ از مشتری بخواهید که در هر بروزرسانی متن پاک را ارائه دهد؛ به دلیل شک به آن ها برگردانید.
- **`iss` not pinned.**يه اعتبارگر که هر چيزي رو قبول کنه`iss`اجازه می دهد تا یک مهاجم سرور مجوز خود را ایجاد کند، یک مشتری را برای مخاطبان هدف ثبت کند و توکن ها را صادر کند.`authorization_servers`لیست اجازه دادن است؛ اجراش کن.
- **Credential or token cache collision.**یک مشتری که فقط با استفاده از منابع ثبت نام را کلید می دهد می تواند هویت یک سرور مجوز را به دیگری ارائه دهد. یک مشتری که فقط با استفاده از طرد دسترسی به توکن ها را کلید می دهد می تواند یک توکن را در مخاطبان اشتباه پخش کند. ثبت کلیدی توسط صادر کننده معتبر، توکن های دسترسی کلیدی توسط `(issuer, resource)`، و هر وقت که صادر کننده عوض بشه دوباره ثبتش کنه

```figure
t3-jwks-rotate
```

## ازش استفاده کن

`code/main.py`تمام جریان تولید را با stdlib پایتون و سه نقش انجام می دهد: `AuthorizationServer`،`ResourceServer`و`Client`. جریان:

از ریشه مخزن، اجرا کنید:

```bash
cd phases/13-tools-and-protocols/18-mcp-auth-production
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

اولین دستور ثبت نام و اعتبارسنجی توکن های مرتبط با صادر کننده را چاپ می کند
نسخه دوم گزارش 18 چک عبور. هیچ کدام از فرمان ها یک
شنونده شبکه یا نویسندگان اعتبار.

1. سرور مجوز متاداتا RFC 8414 را در `/.well-known/oauth-authorization-server`. .
2. مشتری MCP به نقطه پایان متادتا زنگ می زند و گزینه های ثبت نام خود را بررسی می کند (`client_id_metadata_document_supported`برای CIMD`registration_endpoint`برای DCR) و `S256`پشتیبانی از PKCE
3. مشتری برای ثبت پیش از انتشار مجوز صادر کننده بررسی می کند، در غیر این صورت با سند متاداتا HTTPS مشتری خود ثبت نام می کند. DCR ضعیف همچنان یک روش سازگار بودن قابل آزمایش جداگانه است.
4. مشتری صادر کننده معتبر را ثبت می کند، یک چالش S256 ایجاد می کند، یک کد مجوز یک بار و اضافه می کند `iss`, اعتبار دهنده ی بازگردانده شده را تأیید می کند و کد را با تایید کننده اصلی و RFC 8707 بازمی گرداند `resource`شاخص
5. کلائنت MCP به یک ابزار در سرور MCP با `Authorization: Bearer ...`. .
6. سرور MCP اجرا می شود`validate`، حل کردن کلید امضا از کش JWKS
7. IDP کلید را می چرخد؛ تازه سازی برنامه ریزی شده JWKS را به سمت حافظه پیش فرض می کشد.
8. تماس بعدی بدون باز کردن کلید های تازه شده را تأیید می کند و توکن قبلی همچنان در پنجره تعویض معتبر است.
9. يه تلاش بازيگر از مخاطبان در برابر يه منبع مختلف از MCP به 401 مي رسه`audience mismatch`و یک`resource_metadata`. اشاره

JWT در اینجا از HS256 با یک راز مشترک استفاده می کند (به این ترتیب درس فقط در stdlib اجرا می شود). تولید از RS256 یا EdDSA با الگوی JWKS بالا استفاده می کند؛ منطق اعتبارگذاری به طور دیگر یکسان است. از آنجا که IdP و سرور منابع در یک فرآیند زندگی می کنند ،`refresh_jwks`به طور مستقیم لیست کلید سرور مجوز را می خواند؛ از طریق سیم یک HTTP است `GET`به`jwks_uri`. .

## -باده

این درس به ما کمک می کند`outputs/skill-mcp-auth.md`. با توجه به یک پیکربندی سرور MCP و مجموعه قابلیت IdP، مهارت سطح auth را برای ایستادن  متاداتا منابع محافظت شده، مسیر ثبت نام برای استفاده (CIMD، پیش ثبت نام یا DCR fallback) ، برنامه تجدید JWKS، نقشه برداری دامنه و قوانین عدم استفاده را برای اعمال زمانی که IdP از مشخصات RFC کامل پشتیبانی نمی کند، منتشر می کند.

## تمرینات

1. فرار کن`code/main.py`. جریان را ردیابی کنید. توجه کنید که چگونه IdP یک کلید را در مرحله 6 از نسخه خروجی ( مرحله 7 از جریان بالا) ، برنامه ریزی شده به طور مرتب به طور خودکار به حرکت می رساند.`refresh_jwks`مجموعه منتشر شده را دوباره بکشید و هر دو توکن قدیمی (چندوی تعویض) و توکن تازه بدون باز کردن مجدد معتبر می شوند.

2. یک IDP جدید را به متادای منابع محافظت شده اضافه کنید `authorization_servers`لیست. یک توکن را صادر کنید که توسط IdP جدید امضا شده و تایید کننده آن را قبول می کند. یک توکن را صادر کنید که توسط IdP غیرمسلح امضا شده و تایید کننده رد می کند.`WWW-Authenticate: Bearer error="invalid_token", error_description="iss not allowed"`. .

3. اضافه کردن چک محدودیت نرخ به `register_client`استفاده از یک تکه-باکت در هر IP منبع در یک dict کوچک با کلید IP نگه داشته شده است.

4. RFC 7591 را بخوانید و دو زمینه را که در درس است شناسایی کنید `/register`کنترل کننده اعتبار نمی دهد. اعتبار را اضافه کنید.`software_statement`و`redirect_uris`طرح URI.)

5. یک سرور مجوز دوم اضافه کنید. تایید کنید که مشتری یک ثبت نام کلیدی صادر کننده را جداگانه ذخیره می کند و از استفاده مجدد از توکن اولین صادر کننده یا `client_id`. .

6. ثابت کن که DoS درست شده، به اعتبار دهنده یه توکن با یک تصادفی بفرست`kid`و تاییدش کنم`refresh_jwks`در نهایت یک بار اجرا می شود و تعداد کلید سرور مجوز رشد نمی کند. سپس به طور عمدی به عقب برگردان را به یک چرخش و چنگال و تماشا کنید که تعداد کلید به هر توکن جعلی افزایش می یابد

7. تمرین DCR با هر دو`native`و`web`یک مشتری وب با یک URL URL HTTP تغییر مسیر و یک مشتری بومی بدون تغییر مسیر دقیق برگشت برگشت رد می شود.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ASM | "OAuth metadata document" | RFC 8414 `/.well-known/oauth-authorization-server` JSON |
| CIMD | "Client metadata URL" | Client ID Metadata Document: an HTTPS URL used as the `client_id`; the AS pulls the JSON. Preferred enrollment in MCP 2026-07-28 |
| DCR | "Self-service client registration" | RFC 7591 `POST /register`; deprecated for current MCP and retained only for compatibility |
| JWKS | "Public keys for JWT validation" | JSON Web Key Set, fetched from `jwks_uri`, indexed by `kid` |
| Rotate vs refresh | "Updating the keys" | *Rotate* = AS mints/retires signing keys; *refresh* = resource server re-fetches the published set. Resource servers only ever refresh |
| Resource indicator | "Audience parameter" | RFC 8707 `resource` parameter pinning the token to one server |
| `aud` claim | "Audience" | JWT claim the validator compares against the canonical resource URL |
| Audience replay | "Token replay" | Token issued for Server A presented to Server B; defended by audience validation (spec: access-token privilege restriction) |
| Confused deputy | "Proxy token misuse" | An MCP proxy with a static client ID forwarding a token without per-client consent; distinct from audience replay |
| Mix-up attack | "Wrong token endpoint" | Client steered to redeem an honest AS's code at an attacker's endpoint; defended client-side via RFC 9207 `iss` |
| `iss` allow-list | "Trusted authorization servers" | The set named in protected-resource metadata's `authorization_servers` |
| `resource_metadata` | "Where to find the PRM doc" | `WWW-Authenticate` parameter naming the RFC 9728 metadata URL on a 401/403 |
| Public client | "Native or browser client" | OAuth client with no `client_secret`; PKCE compensates |
| `WWW-Authenticate` | "401/403 response header" | Carries `Bearer error=...` directives that drive client recovery |

## خواندن بیشتر

- [MCP authorization specification (2026-07-28)](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)- پروفایل مجوز MCP فعلی
- [MCP 2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)- CIMD، اعتبار صادر کننده، تخفیف DCR و تغییرات اعتبارات کلیدی صادر کننده
- [OAuth Client ID Metadata Document (draft-ietf-oauth-client-id-metadata-document-00)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00) CIMD
- [RFC 8414 — OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414) قرارداد کشف
- [RFC 7591 — OAuth 2.0 Dynamic Client Registration Protocol](https://datatracker.ietf.org/doc/html/rfc7591) DCR (راه برگشت)
- [RFC 7636 — Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636) اثبات مالکیت توسط مشتری عمومی
- [RFC 8707 — Resource Indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707) تماشای مخاطبان
- [RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728) کشف سرور منابع
- [RFC 9207 — OAuth 2.0 Authorization Server Issuer Identification](https://datatracker.ietf.org/doc/html/rfc9207)`iss`پارامتر که در برابر حملات مخلوط دفاع می کند
- [RFC 7662: OAuth 2.0 Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662)
- [RFC 7009: OAuth 2.0 Token Revocation](https://datatracker.ietf.org/doc/html/rfc7009)
