# Phase 00 — Setup & Tooling

## What is this phase about?

Before you can learn AI, you need a workshop. This phase builds it. You'll install the languages and tools, learn to control your computer through the terminal, get access to a GPU, and make your first AI API call. None of this is "AI" yet — it's the plumbing every later lesson depends on. Do it once, properly, and you'll barely think about your tools again.

## Why is this phase important?

Every AI team hits the same first problem: "it works on my machine but not yours." This phase teaches the habits that make that problem vanish. AI Engineers use these tools **every single day** — far more than any fancy math.

## What will I be able to build after this phase?

A clean, reproducible coding environment; a GPU-powered setup (local or free cloud); your first working AI API call; a Docker container that runs your code anywhere; a git-tracked project so you never lose work.

## How important is this phase?

⭐⭐⭐⭐⭐ Essential.

## Difficulty

Easy — setup work, not hard concepts. The only challenge is patience.

## Estimated Study Time

**5–7 hours** across 12 lessons. A weekend gets you set for the whole course.

---

# Dev Environment

## Simple Definition
The full set of tools your code needs to run — languages, package managers, and AI libraries — installed in the right order, bottom-up. An environment has *layers*, and each sits on the one below. Get the bottom right and everything above just works.

## Imagine This...
Like setting up a kitchen before cooking: stove and plumbing first, then the pantry, then tonight's ingredients.

## Why Do We Need This?
- Broken tooling turns every lesson into a debugging fight.
- AI needs many languages and libraries installed and cooperating.
- Set it up once, and you almost never think about it again.

## Where Is It Used?
Every AI team on earth — same idea at OpenAI, Google, or a two-person startup.

## Do I Need to Master This?
🟡 Be comfortable installing things and fixing setup issues without panic.

## In One Sentence
Builds the layered toolkit — languages, package managers, AI libraries — that every later lesson runs on.

## What Should I Remember?
- Install bottom-up: system → package managers → languages → AI libraries.
- `uv` is the fast, modern way to handle Python.
- Always verify — "it installed" isn't "it works."

## Common Beginner Confusion
One big install doesn't fix everything forever. Environments are layered and version-sensitive; a small mismatch in one layer breaks the one above.

## What Comes Next?
Your tools now exist — next, Git makes sure you never lose the work you create with them.

---

# Git & Collaboration

## Simple Definition
Git takes snapshots of your code over time (called *commits*) so you can undo anything, see what changed, and try risky ideas on separate *branches* without fear. You likely know it already; here it's framed for AI, where you also track experiments and keep huge model files *out* of the repo.

## Imagine This...
Like save points in a video game — die in a boss fight, reload the last save instead of restarting the whole game.

## Why Do We Need This?
- Without it, you'll eventually lose work.
- Branches let you experiment without breaking what works.
- Collaboration is impossible without shared history.

## Where Is It Used?
Every software and AI team. GitHub, GitLab, and all of open-source AI run on git.

## Do I Need to Master This?
🟡 The daily loop (add, commit, push, branch) should be automatic. Advanced git can wait.

## In One Sentence
Git saves versioned snapshots so you can experiment fearlessly and never lose progress.

## What Should I Remember?
- The daily loop is `add → commit → push`.
- Branch for experiments; merge when they work.
- Never commit huge model files — use `.gitignore`.

## Common Beginner Confusion
Git (the tool) isn't GitHub (a website that hosts git). Git works fully on your own computer.

## What Comes Next?
Your code is safe — now learn where it runs *fast*, on a GPU.

---

# GPU Setup & Cloud

## Simple Definition
A GPU is a chip built for video games that turns out to be perfect for AI, because both do the same simple math on huge amounts of data at once. You'll check for a usable GPU, use a free one in the cloud (Colab), and see the speed difference. Hours on a CPU become minutes on a GPU.

## Imagine This...
A CPU is a few brilliant chefs; a GPU is a thousand line cooks. For chopping ten thousand onions (AI math), the line cooks win easily.

## Why Do We Need This?
- Training real models on a CPU is painfully slow.
- GPUs do AI's repetitive math thousands of times in parallel.
- Free cloud GPUs let you learn without buying hardware.

## Where Is It Used?
Every model you've heard of — ChatGPT, Midjourney, Tesla's vision. NVIDIA got huge because of this.

## Do I Need to Master This?
🟢 Know how to check for a GPU and use Colab. Deep optimization comes in Phase 17.

## In One Sentence
A GPU does AI's repetitive math thousands of times in parallel, turning hours into minutes.

## What Should I Remember?
- GPUs shine at the parallel math AI needs.
- No GPU? Google Colab gives one for free.
- Model memory ≈ number of parameters × bytes per number.

## Common Beginner Confusion
You don't need an expensive GPU to learn AI — most of this course runs on CPU or free cloud.

## What Comes Next?
You can run code fast — next, call AI *services* you don't host yourself, via an API.

---

# APIs & Keys

## Simple Definition
An API lets your code ask another company's service to do something ("summarize this") and get an answer back. An API *key* is your secret password that identifies you and tracks billing. Every AI API follows one pattern: send a request, get a response. You'll make your first model call and store your key safely.

## Imagine This...
Like ordering at a restaurant: you don't cook — you give the waiter your order (request) and the kitchen sends back the meal (response). The key is your membership card.

## Why Do We Need This?
- Most AI apps *call* powerful models instead of hosting them.
- Keys must be stored safely or you risk huge surprise bills.
- Agents (later phases) are basically API calls in a loop.

## Where Is It Used?
Almost every AI product — chat assistants, writing tools, coding copilots — calls APIs from Anthropic, OpenAI, or Google.

## Do I Need to Master This?
🔴 From Phase 11 on, API calls are the core of everything you build.

## In One Sentence
An API lets your code rent a powerful model with a simple "send a request, get a response."

## What Should I Remember?
- The pattern never changes: request in, response out.
- Keep keys in `.env` / environment variables, never in code.
- An API key is money — leaking it costs real dollars.

## Common Beginner Confusion
Hardcoding a key and pushing it to GitHub: bots find it in minutes and run up bills. Keep keys out of code and git.

## What Comes Next?
You can call models — next, the interactive notebook where you'll prototype with them.

---

# Jupyter Notebooks

## Simple Definition
A notebook lets you write code in small chunks, run each on its own, and see results (charts, tables) right underneath. It mixes runnable code, notes, and visuals in one place — perfect for exploring and experimenting without re-running everything.

## Imagine This...
Like a science lab notebook: you scribble an experiment, run it, and tape the result right next to your notes.

## Why Do We Need This?
- Test one idea at a time without re-running everything.
- Results and notes live next to the code that made them.
- Nearly every AI tutorial, paper, and course uses them.

## Where Is It Used?
Researchers, data scientists, engineers everywhere — Kaggle, Colab, and most published AI experiments.

## Do I Need to Master This?
🟡 You'll live in notebooks while learning — but they're for *exploring*, not shipping.

## In One Sentence
Notebooks run code in small pieces with instant results — the lab bench of AI work.

## What Should I Remember?
- Explore in notebooks; ship finished code in scripts.
- Cells run in whatever order *you* click — the #1 source of bugs.
- "Restart and Run All" is the honesty check.

## Common Beginner Confusion
A notebook can *look* correct thanks to leftover variables from deleted cells. If it fails after "Restart and Run All," it doesn't actually work.

## What Comes Next?
Notebooks are where you experiment — next, virtual environments keep each project's libraries from breaking them.

---

# Python Environments

## Simple Definition
A virtual environment is a private box of libraries for one project. Without it, every project shares one global pile, so upgrading for Project A silently breaks Project B. Each environment keeps its own libraries at its own versions, so they never collide — and a lockfile records exact versions so anyone can reproduce it.

## Imagine This...
Like giving each project its own toolbox, instead of one shared drawer where swapping a wrench for one project ruins another.

## Why Do We Need This?
- Different projects need different, conflicting versions.
- Isolation means one project never breaks another.
- Lockfiles make setups reproducible for everyone.

## Where Is It Used?
Every serious Python project. Reproducible environments are a basic professional expectation.

## Do I Need to Master This?
🟡 Creating and activating environments should be automatic. Deeper packaging can wait.

## In One Sentence
Virtual environments give each project its own libraries so they never break each other.

## What Should I Remember?
- One isolated environment per project — always.
- A lockfile pins exact versions for reproducibility.
- Don't carelessly mix pip and conda.

## Common Beginner Confusion
Installing everything globally and wondering why projects break over time. The fix isn't more installing — it's *isolation*.

## What Comes Next?
Environments isolate libraries; next, Docker goes further and packages the *whole* system.

---

# Docker for AI

## Simple Definition
Docker packs your code *and* everything it needs — OS bits, libraries, exact versions — into a sealed box called a *container* that runs identically on any machine. A virtual environment isolates Python libraries; Docker isolates basically everything.

## Imagine This...
Like shipping a sealed lunchbox instead of a recipe. A recipe turns out differently in each kitchen; the lunchbox arrives identical everywhere.

## Why Do We Need This?
- It kills "works on my machine" by shipping the whole environment.
- AI setups (CUDA, drivers) are fragile; Docker freezes them.
- It's how AI gets deployed to production.

## Where Is It Used?
Nearly all modern deployment — AI services usually ship as containers on Kubernetes, AWS, Google Cloud.

## Do I Need to Master This?
🟢 Know what a container is and how to run one. Go deeper at deployment (Phase 17).

## In One Sentence
Docker seals your code and its entire environment into a portable box that runs identically anywhere.

## What Should I Remember?
- A container packages the *whole* environment, not just libraries.
- The cure for "works on my machine."
- Use volumes so data and models survive restarts.

## Common Beginner Confusion
An *image* is the frozen blueprint; a *container* is a running copy of it. One image can spawn many containers.

## What Comes Next?
Your code runs anywhere — next, tune the editor where you actually write it.

---

# Editor Setup

## Simple Definition
Your editor is where you write code, and a good one quietly autocompletes, flags errors before you run, formats automatically, and lets you edit code on a remote GPU machine as if it were local. This lesson sets up VS Code well and weighs alternatives like Cursor.

## Imagine This...
Like a great rally co-driver: you watch the road (your logic) while they call the turns and warn of hazards before you crash.

## Why Do We Need This?
- You'll spend thousands of hours in your editor — friction adds up.
- Autocomplete and inline errors catch mistakes before you run.
- Remote SSH lets you work on GPU boxes as if local.

## Where Is It Used?
Every developer. VS Code is the world's most popular editor; AI-native ones like Cursor are common on AI teams.

## Do I Need to Master This?
🟢 Set it up well once, learn a few shortcuts, move on. Don't over-customize.

## In One Sentence
A well-configured editor catches mistakes early and stays out of your way.

## What Should I Remember?
- Configure once, properly; then stop fiddling.
- Format-on-save and inline errors are non-negotiable time-savers.
- Remote SSH = edit on a GPU box like it's local.

## Common Beginner Confusion
A fancier editor doesn't make you a better engineer. The skill is in your head, not the tool.

## What Comes Next?
Your editor handles code — next, handle the *data* that feeds every model.

---

# Data Management

## Simple Definition
AI runs on data, and managing it well is a real skill: downloading and loading datasets, converting between file formats, splitting data correctly into train/validation/test sets, and versioning large files without bloating your repo. Get these unglamorous steps wrong and even a great model gives misleading results.

## Imagine This...
Like a chef's *mise en place* — washing and chopping before cooking, so you never grab the wrong thing mid-dish.

## Why Do We Need This?
- Every AI project begins and lives with data.
- Correct train/validation/test splits keep results honest.
- The right format (e.g. Parquet) saves time and space.

## Where Is It Used?
Every data and ML team. Hugging Face is the hub for AI datasets.

## Do I Need to Master This?
🟡 Clean data habits prevent a whole category of silent, painful bugs.

## In One Sentence
Loading, converting, splitting, and versioning data is the prep work that keeps every experiment honest.

## What Should I Remember?
- Split into train/validation/test; never let test data leak in.
- Fixed random seeds make splits reproducible.
- Keep huge files out of git (use LFS or DVC).

## Common Beginner Confusion
*Data leakage* — letting test data influence training — gives amazing scores that collapse in the real world. The test set is your untouched final exam.

## What Comes Next?
You can manage data locally — next, get comfortable in the terminal, where remote AI work lives.

---

# Terminal & Shell

## Simple Definition
The terminal controls your computer by typing commands instead of clicking. For AI engineers it's home base: launching training runs, watching GPU usage, tailing logs, connecting to remote machines. You'll learn the genuinely useful moves — pipes, `grep`, `tmux`, monitoring, and file transfer.

## Imagine This...
Like knowing keyboard shortcuts instead of the mouse — the power user is done before the menu finishes opening. On remote machines, there often *is* no menu.

## Why Do We Need This?
- Remote GPU machines often have no graphical interface.
- `tmux` keeps long jobs alive even if your connection drops.
- Pipes and `grep` find one line in a million-line log.

## Where Is It Used?
Every server, cloud machine, and training job.

## Do I Need to Master This?
🟡 Basic fluency (navigation, pipes, grep, tmux) pays off constantly.

## In One Sentence
The terminal controls machines — especially remote GPU boxes — quickly through typed commands.

## What Should I Remember?
- Pipes (`|`) feed one command's output into another.
- `grep` finds the needle in a giant log haystack.
- `tmux` keeps training alive after you disconnect.

## Common Beginner Confusion
The terminal feels dangerous, but everyday commands are safe to explore. The real risk is *avoiding* it — remote AI work assumes you can use it.

## What Comes Next?
The terminal is your interface; on remote machines it sits on Linux — next, just enough Linux to be comfortable there.

---

# Linux for AI

## Simple Definition
Most AI runs on Linux, even though you develop on Mac or Windows. Rent a cloud GPU and you land in a terminal-only Linux machine. You'll learn the survival kit: navigating the file system, fixing "Permission denied," installing packages with `apt`, and the small ways Linux differs from your home computer.

## Imagine This...
Like learning enough of a country's language to travel — order food, read signs, ask directions — not to write poetry.

## Why Do We Need This?
- Cloud GPU machines are almost always Linux with no GUI.
- "Permission denied" errors are constant until you understand them.
- Idle rented GPU time costs money while you're stuck.

## Where Is It Used?
Servers, the cloud, supercomputers — most AI training and serving runs on Linux.

## Do I Need to Master This?
🟢 Learn the survival commands and permissions. Administration is a separate specialty.

## In One Sentence
A little Linux fluency keeps you productive on the cloud GPU machines where real AI runs.

## What Should I Remember?
- Cloud GPUs mean Linux, terminal-only, by default.
- `chmod`/`chown` fix most "Permission denied" headaches.
- You need survival-level Linux, not mastery.

## Common Beginner Confusion
Your Mac terminal and a Linux server are close cousins but differ in small ways that cause surprising errors until you know they exist.

## What Comes Next?
You can survive on any machine — the last lesson tackles AI's sneakiest bugs: the silent ones.

---

# Debugging and Profiling

## Simple Definition
AI code fails sneakily: it often *doesn't crash*. A broken training run can chug for hours, cost money, and quietly produce a useless model with no error at all. You'll learn to catch these silent failures — inspecting data mid-run, finding slow code (*profiling*), spotting classic bugs, and using TensorBoard to *see* whether training works.

## Imagine This...
Like being a doctor for a patient who never says they're sick — the model smiles and hands you a beautiful loss curve while having learned nothing.

## Why Do We Need This?
- AI bugs often produce no error, just bad results.
- A silent bug can waste hours of compute and real money.
- TensorBoard lets you *see* whether learning is happening.

## Where Is It Used?
Every team that trains models — TensorBoard and Python profilers are standard kit.

## Do I Need to Master This?
🟡 Once you train your own models (Phase 3+), these skills save enormous time and money.

## In One Sentence
Debugging AI means catching the silent failures that never throw an error but quietly ruin results.

## What Should I Remember?
- AI's worst bugs don't crash; they produce garbage quietly.
- Check tensor shapes, dtypes, and `NaN`s — most bugs hide there.
- A beautiful loss curve isn't proof the model learned anything.

## Common Beginner Confusion
"No error message" does not mean "it worked." You must actively verify that learning happened — silence is not success.

## What Comes Next?
The workshop is built. Phase 01 starts the real journey with the math that makes AI tick — explained gently.

---

## Phase Summary

**What I learned.** You built your AI workshop end to end: installed the languages and tools (Dev Environment, Python Environments, Editor Setup), made work safe and reproducible (Git, Docker), got fast hardware and AI services (GPU & Cloud, APIs & Keys), set up your experimentation space (Jupyter, Data Management), got comfortable controlling machines (Terminal, Linux), and learned to catch AI's silent bugs (Debugging & Profiling).

**What I should remember.** Isolation and reproducibility are the whole point — environments, Docker, lockfiles, and git all exist so your work runs the same way twice. The terminal and Linux are home base. API keys are money and secrets — keep them out of code. And AI bugs are silent: "no error" ≠ "it worked."

**Most important lessons.** If you deeply learn four: **APIs & Keys** (🔴 used constantly), **Git**, **Python Environments**, and **Jupyter** — the daily tools of the entire course.

**Revisit later.** **Docker** and **Debugging & Profiling** deserve a deeper return at training (Phase 3) and deployment (Phase 17). **GPU & Cloud** and **Linux** can stay survival-level for now.

**Real-world applications.** This phase mirrors a real engineer's day one: set up an environment, clone a repo, configure the editor, get keys, spin up a GPU, confirm it all runs.

**Interview relevance.** Shows up in practical and system-design talk: "How do you make an ML project reproducible?", "How would you deploy a model to run the same everywhere?", "How do you debug a training run that isn't learning?" Good answers signal you've actually built things.
