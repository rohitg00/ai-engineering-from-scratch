# بازداشت های بازنشسته  نمودار، نقش و آرکیستر بازیگران

> هر چارچوبی همان نمایش را می فروشد (اعمال تحقیق گزارش را ایجاد می کنند) و همان خطای را پنهان می کند (شیما وضعیت با لایه آرکیسترشن مبارزه می کند). چارچوبی را انتخاب کنید که انتزاع آن با شکل مشکل شما مطابقت دارد؛ همه چیز دیگر چسب است که شما دو بار می نویسید.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 16 (LangGraph)
**Time:** ~45 minutes

## مشکل

شما یک کار دارید که نیاز به بیش از یک تماس LLM دارد. شاید یک جریان کار تحقیقاتی باشد (خطط، جستجو، خلاصه، نقل قول). شاید یک خط لوله بررسی کد (بررسی تفاوت، انتقاد، اصلاح، اعتبار). شاید یک دستیار چند نوبت باشد که پروازهای خود را ثبت می کند، ایمیل ها را می نویسد و گزارش های هزینه را فایل می کند. شما یک چارچوب را انتخاب می کنید.

سه روز بعد، شما متوجه تخلیه تجریدی های چارچوب می شوید. کروآئی نقش شما را می دهد اما با شما مبارزه می کند وقتی که "مطالبان" نیاز به تحویل یک برنامه ساختاری به "نوشته" دارند. آتوژن به شما چت بین عوامل می دهد اما وضعیت درجه اول ندارد بنابراین نقطه بازرسی شما یک انگور از یک دفترچه مکالمه است. لنگ گراف شما را به یک نمودار دولت اما شما را مجبور به نام هر انتقال قبل از شما می دانید که چه عامل خواهد کرد. آگنو يه تجريده ي يک عامل رو به شما ميده که وقتي ميخواي به سه کارگر هم زماني پخش کني فرياد ميکنه

راه حل این نیست که "بهترین چارچوب را انتخاب کنید". این برای مطابقت با جزییات اصلی چارچوب با شکل مشکل شما است. این درس نقشه را می کشد.

## مفهوم

![Agent framework matrix: core abstraction vs problem shape](../assets/framework-matrix.svg)

چهار چارچوب بر منظره 2026 حاکم است. انتزاع های اصلی آنها یکسان نیستند.

| Framework | Core abstraction | Best fit | Worst fit |
|-----------|------------------|----------|-----------|
| **LangGraph** | `StateGraph` — typed state, nodes, conditional edges, checkpointer. | Workflows with explicit state and human-in-the-loop interrupts; production agents needing time-travel debugging. | Loose, role-driven brainstorming where the topology is unknown. |
| **CrewAI** | `Crew` — roles (goal, backstory), tasks, process (sequential or hierarchical). | Role-playing or persona-driven workflows with a short linear/hierarchical plan. | Anything stateful beyond the crew's turn history; complex branching. |
| **AutoGen** | `ConversableAgent` pair — two or more agents that speak in turns until an exit condition. | Multi-agent *dialogue* (teacher-student, proposer-critic, actor-reviewer) where the thinking emerges from the chat. | Deterministic workflows with a known DAG; anything needing durable state across restarts. |
| **Agno** | `Agent` — a single LLM + tools + memory, composable into teams. | Fast-to-build single agents and lightweight teams; strong multi-modality and built-in storage drivers. | Deep, explicitly-branched graphs with custom reducers. |

### "استراکت" واقعاً چه معنایی دارد؟

انتزاع اصلی یک چارچوب چیزی است که شما در صفحه سفید هنگام ارائه معماری آن را نقاشی می کنید.

- **LangGraph**در هر نقطه ای که شما یک نمودار را می کشید، نودها مراحل هستند، حاشیه ها انتقال هستند و شی حالت در هر نقطه تایپ می شود. مدل ذهنی یک ماشین حالت است.
- **CrewAI**→ شما یک نمودار سازمان را می رسمید. هر نقش دارای یک توصیف شغل است و یک مدیر وظایف را مسیر می دهد. مدل ذهنی یک تیم کوچک از متخصصان است.
- **AutoGen**دو عامل به یکدیگر پیام می دهند؛ یک سوم اگر به یک مدیر نیاز دارید، به شما می پیوندد. مدل ذهنی این است که چت کنید.
- **Agno**شما یک جعبه ی تک با ابزارها که روی آن دارند را می کشید. جعبه ها را کنار هم قرار دهید برای یک تیم. مدل ذهنی "آژان با باتری ها شامل شده است".

### سوال دولت

دولت جایی است که اکثر انتخاب های چارچوب در تولید خراب می شوند.

- **LangGraph.**حالت تایپ شده (`TypedDict`یا مدل Pydantic) ، کاهش دهنده های هر زمینه، چک پوائنتر درجه اول (SQLite/Postgres/Redis). ادامه کار، قطع و سفر در زمان رایگان است. *(ببینید مرحله 11 · 16.) *
- **CrewAI.**جریان های دولتی به عنوان رشته های بین وظایف از طریق `context`میدان، یا ساختار از طریق `output_pydantic`. هيچ فروشگاهي با دوام براي هر خدمه از جعبه خارج نمي شه . اگه خدمه بايد از بازپديد زنده بمونه
- **AutoGen.**حالت تاریخچه چت و هر نوع تعریف شده توسط کاربر است `context`. نقل متن مکالمه باقی می ماند؛ حالت جریان کار تعسفی نمی تواند باشد مگر اینکه شما آداپتورهای را بنویسید.
- **Agno.**درایورهای ذخیره سازی داخلی (SQLite، Postgres، Mongo، Redis، DynamoDB) متصل به یک `Agent`از طریق`storage=` جلسات مکالمه و خاطرات کاربر به طور خودکار باقی می مانند. یک چک پوائنتر گرافیک کامل نیست؛ یک فروشگاه جلسه.

### سوال شاخه بندی

هر مامور غير مهمي که به عنوان شاخه اي قرار ميده

- **LangGraph** شما از طریق حواشی مشروط تصمیم می گیرید. روتینگ یک تابع پایتون با شاخه های نامگذاری شده است. شاخه ها در نمودار مرتب درجه اول هستند؛ چک پوائنتر ثبت می کند که کدام شاخه گرفته شده است.
- **CrewAI** مدیر در حالت سلسله مراتبی تصمیم می گیرد؛ در حالت دنباله دار شما در زمان ساخت تصمیم می گیرید. روتینگ در لیست وظایف ضمنی است؛ هیچ "اگر" کلاس اول خارج از دستور کار مدیر وجود ندارد.
- **AutoGen** ماموران از طریق چت تصمیم می گیرند. شاخه شدن از طرف بعدی صحبت می کند. `GroupChatManager`مکالمات بعدی را انتخاب می کند. شما می توانید یک `speaker_selection_method`اما پیش فرض به عنوان LLM هدایت شده است.
- **Agno** نماینده تصمیم می گیرد که با کدام ابزار بعدی تماس بگیرد. تیم ها دارای یک حالت هماهنگ کننده/رؤتر/کارکن هستند؛ شاخه های فراتر از این مسئولیت توسعه دهنده است.

### سوال مشاهده ای

- **LangGraph** OpenTelemetry از طریق LangSmith یا هر صادر کننده OTel. هر انتقال گره یک مدت ردیابی است؛ نقاط بازرسی به عنوان ردیابی قابل بازیابی دو برابر می شوند. LangSmith گزینه اول طرف است؛ Langfuse / Phoenix همچنین آداپتورها را دارد.
- **CrewAI** اولین کلاس OpenTelemetry از اواخر سال 2025؛ ادغام با Langfuse، Phoenix، Opik، AgentOps.
- **AutoGen** یکپارچه سازی OpenTelemetry از طریق `autogen-core`؛آژانت اوپس و اوپک رابط دارن.تراسي گروناليتي هر پيام عامل است نه هر گره
- **Agno** ساخته شده `monitoring=True`پرچم و صادرکنندگان OpenTelemetry؛ یکپارچه سازی نزدیک با Langfuse برای ردیابی جلسات.

### هزینه و تاخیر

هر چهار چارچوب اضافه کردن هر تماس هزینه های اضافی (منطقه چارچوب، اعتبار، سریال سازی). ترتیب خشن افزایش هزینه های اضافی: Agno ≈ LangGraph < CrewAI ≈ AutoGen. تفاوت توسط چه مقدار اضافی LLM روت کردن چارچوب است. مدیر سلسله مراتبی CrewAI هزینه توکن تصمیم گیری چه کسی بعدی می شود؛ AutoGen `GroupChatManager`مثل اينه که LangGraph فقط توکهايي که تو مي نويسي خرج ميکنه`llm.invoke`راه واحد کارگر آگنو کم است

وقتی هزینه هر اجرا مهم است، روتینگ صریح را ترجیح دهید (LangGraph edges، AutoGen `speaker_selection_method`) در مورد مسیر انتخاب شده LLM.

### قابلیت همکاری

- **LangGraph** **LangChain**ابزارها، بازیافت کنندگان، LLMs. آداپتور MCP درجه اول (اسازهایی که به عنوان سرور MCP وارد می شوند).
- **CrewAI** ابزارها از دست`BaseTool`; ابزار LangChain، ابزار LlamaIndex و ابزار MCP همه سازگار هستند.`allow_delegation=True`. .
- **AutoGen**→ `FunctionTool`هر نوع فونت های پیتون را بسته می کند، آداپتور MCP موجود است، برای الگوهای عامل به عامل به اکوسیستم AG2 متصل می شود.
- **Agno**→ `@tool`تزئین کننده یا زیرکلاس BaseTool؛ آداپتور MCP؛ ابزارها می توانند در میان عوامل و تیم ها به اشتراک گذاشته شوند.

## مهارت

> شما می توانید در یک جمله توضیح دهید که چرا یک چارچوب خاص برای یک مشکل عامل خاص مناسب است.

فهرست چک قبل از ساخت:

1. **Draw the shape.**آیا این یک نمودار است (حالات تایپ شده، انتقال های نامگذاری شده) ؟ یک بازی نقش (مختصین کار را ترک می کنند) ؟ یک چت (عملاء صحبت می کنند تا تمام شود) ؟ یک عامل واحد با ابزار؟
2. **Decide who branches.**شاخه سازی تصمیم گرفته توسط توسعه دهنده → LangGraph. مدیر تصمیم گرفته شده توسط عامل → CrewAI سلسله مراتب. چت ظهور → AutoGen. ابزار تصمیم گرفته شده توسط تماس → Agno.
3. **Check the state budget.**آیا شما نیاز به ادامه کار از نقطه چک دارید؟ سفر در زمان؟ انسان در وسط اجرا قطع می کند؟ اگر بله، LangGraph پیش فرض است؛ جلسات Agno شامل وضعیت گفتگو است.
4. **Check the cost budget.**راهبردهاي انتخاب شده توسط LLM به صورت توليد توليدات اضافه ايستاده اند. اگر وكيل هزاران بار در روز راهبردهاي رواني را انتخاب مي كند، راهبردهاي صريح را ترجيح مي دهد.
5. **Budget the framework overhead.**هر چارچوب وابستگی دیگری است. اگر وظیفه دو تماس LLM و یک ابزار باشد، ۳۰ خط از پایتون ساده بنویسید؛ هیچ چارچوبی ارزان تر از هیچ چارچوبی نیست.

قبل از اینکه بتوانید نمودار، نمودار سازمان، چت یا جعبه ای را رسم کنید، از یک چارچوب دست بردارید. از انتخاب یک چارچوب که شما را مجبور به مبارزه با مدل دولت برای چیزی که واقعاً به آن نیاز دارید، نکشید.

## ماتریس تصمیم گیری

| Problem shape | Preferred framework | Why |
|---------------|---------------------|-----|
| Workflow DAG with typed state, human approvals, long-running | LangGraph | First-class state, checkpointer, interrupts, time-travel. |
| Research / writing pipeline with distinct roles | CrewAI (sequential) or LangGraph subgraphs | Role-per-task is cheap to express in CrewAI; scale up with LangGraph when branching gets complex. |
| Proposer-critic or teacher-student dialogue | AutoGen | Two-agent chat is its native shape. |
| Single agent with tools, sessions, memory | Agno | Thinnest setup, built-in storage and memory. |
| Thousands of parallel fanouts with reducers | LangGraph + `Send` | The only one with a first-class parallel-dispatch API. |
| Quick prototype, no framework commitment | Plain Python + provider SDK | No framework is the fastest framework. |

```figure
l5-framework-fit
```

## تمرینات

1. **Easy.**همان کار را انجام دهید  "رئیسگاه Anthropic را تحقیق کنید، خلاصه ای از 200 کلمه بنویسید، منابع را نقل قول کنید"  و آن را در LangGraph (چهار گره: برنامه ریزی، جستجو، نوشتن، نقل قول) و در CrewAI (سه نقش: محقق، نویسنده، ویرایشگر) پیاده سازی کنید. هزینه توکن را در هر اجرا و خطوط کد گزارش کنید.
2. **Medium.**ساخت همان کار در AutoGen (تجربه کننده  نویسنده چت، ویرایشگر از طریق `GroupChat`) و آگنو (یک نماینده با `search_tools`و`write_tools`چهار پیاده سازی را بر اساس (ا) هزینه هر اجرا، (ب) توانایی برای ادامه پس از تصادف، (ج) توانایی تزریق تأیید انسانی قبل از مرحله نوشتن رتبه بندی کنید.
3. **Hard.**یک اسکریپت درخت تصمیم بسازید `pick_framework.py`که یک توضیحات کوتاه مشکل را می گیرد (JSON: `{has_typed_state, has_roles, has_dialogue, has_parallel_fanout, needs_resume}`) و یک توصیه با یک جمله توجیه می دهد. آن را در شش مورد که خودتان طراحی می کنید بررسی کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Orchestration | "How the agents coordinate" | The layer that decides which node/role/agent runs next. |
| Durable state | "Resume after a restart" | State that survives process death, attached to a checkpoint or session store. |
| LLM-selected routing | "Let the model decide" | A planner LLM picks the next step each turn; flexible but pays tokens on every decision. |
| Explicit routing | "Developer decides" | A Python function or static edge picks the next step; cheap and auditable. |
| Crew | "A CrewAI team" | Roles + tasks + process (sequential or hierarchical) bound into a single runnable. |
| GroupChat | "AutoGen's multi-agent chat" | A managed conversation between N agents with a speaker selector. |
| Team (Agno) | "Multi-agent Agno" | Route / coordinate / collaborate mode over a set of agents. |
| StateGraph | "LangGraph's graph" | Typed-state, node, conditional-edge, checkpointer abstraction. |

## خواندن بیشتر

- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) StateGraph، چک پوائنترها، قطعات، سفر زمان
- [CrewAI documentation](https://docs.crewai.com/) خدمه ها، جریان ها، ماموران، وظایف، فرآیندهای
- [AutoGen documentation](https://microsoft.github.io/autogen/) ConversableAgent، GroupChat، تیم ها، ابزارها
- [Agno documentation](https://docs.agno.com/) مامور، تیم، جریان کار، ذخیره سازی، حافظه
- [Anthropic — Building effective agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) کتابخانه الگوی (سلسل سریع، مسیر، موازی سازی، کارگران آرکیستراتور، ارزیابی کننده- بهینه ساز) چارچوب-آگنوستیک.
- [Yao et al., "ReAct: Synergizing Reasoning and Acting" (ICLR 2023)](https://arxiv.org/abs/2210.03629) هر چارچوبي که در حال اجراست
- [Wu et al., "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation" (2023)](https://arxiv.org/abs/2308.08155) کاغذ طراحی آتوژن
- [Park et al., "Generative Agents: Interactive Simulacra of Human Behavior" (UIST 2023)](https://arxiv.org/abs/2304.03442) پایه بازی نقش هایی که مجموعه های شخصیت به سبک CrewAI بر روی آن ساخته می شوند.
- مرحله 11 · 16 (LangGraph)  چارچوبی که این درس با آن مقایسه می کند.
- مرحله 11 · 19 (عكس)  یک الگویی که به طور تمیز به LangGraph نقشه می زند اما به طور نامناسب به CrewAI.
- مرحله 11 · 22 (ببیننده بودن تولید)  چگونه ابزار را انتخاب کنید هر چارچوبی را که انتخاب کنید.
