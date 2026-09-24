# The MCPA Blueprint Is a Study Budget, Not a Checklist

> A syllabus lists what might appear on an exam. A blueprint states how often each part actually does. Read the MCPA blueprint as a budget for your study hours, not a table of contents to skim once and forget.

**Type:** Orientation
**Languages:** Python
**Prerequisites:** None
**Time:** ~45 minutes

## Learning Objectives

- Name the five MCPA domains and their exact published weights, and confirm they total 100 percent
- Convert a domain's blueprint weight into a proportional share of a fixed study-hours budget
- State the MCPA exam's format, fee, validity period, and retake policy, and reconcile the certification page's 90 minute duration against the launch press release's conflicting 120 minute figure
- Explain why the exam's item count and passing score are not published, and what that means for how a candidate calibrates readiness
- Read an exam question for a legacy-era distractor, such as an `initialize` handshake, a session, or `-32601` for an unknown tool, and reason to the 2026-07-28 replacement
- Trace the 34-lesson route from this orientation lesson through the capstone, and say which domain, or domains, each lesson belongs to

## The Problem

The Model Context Protocol touches a lot of surface area: roles and messages, schemas, transports, tool and resource lifecycles, sampling, error handling, OAuth, consent, auditability, and the ecosystem that has grown up around all of it. A candidate who opens the MCPA guide and starts reading top to bottom, spending roughly equal time on every topic, is making a study-plan decision without realizing it: that every part of the syllabus matters equally. It does not. The certification page that defines this exam also publishes a blueprint, a breakdown of five domains with a percentage weight attached to each one. That number is not decoration. It is the closest thing to an answer key the provider gives you before exam day, because it states how the exam's content is distributed across domains, on average.

Ignoring the blueprint is a planning bug, the same kind of bug as building a cache that never gets invalidated: it looks fine until the mismatch between assumption and reality costs you. Spend your hours evenly across five domains and you will, by construction, under-study the domain worth 26 percent of the exam and over-study the one worth 14 percent. The gap compounds because two domains, Interactions and Execution and Security and Governance, together account for half the blueprint. A study plan that does not know this treats a domain that is nearly twice as heavy as another as though they were interchangeable.

There is a third problem, and it costs points rather than hours. Every MCPA question is written against the 2026-07-28 release, but a candidate's intuition about MCP is often shaped by older tutorials, blog posts, and even earlier drafts of this curriculum, all describing a protocol that opened every connection with an `initialize` handshake and kept state in a session. An option that describes that older protocol reads as familiar, even authoritative, and familiarity is exactly what makes it a convincing wrong answer. A candidate who cannot tell a legacy-era belief from a 2026-07-28 fact on sight will lose points to options that sound right for the wrong reason. Finally, a 34-lesson curriculum is easy to read start to finish without ever noticing which of the five domains a given lesson is training. This lesson exists to fix all four problems before you read another lesson in this track: turn the published weights into an explicit hours budget, build a readiness signal that is honest about what the guide does and does not tell you, train the reflex that catches a legacy-era distractor, and hand you the route that maps all 34 lessons onto the five domains they build toward.

## The Concept

Start with the numbers themselves, because they are the whole foundation of the plan. The MCPA blueprint publishes five domains: MCP Fundamentals at 16 percent, Architecture and Components at 14 percent, Interactions and Execution at 26 percent, Security and Governance at 24 percent, and Use Cases and Ecosystem at 20 percent. Add them and you get exactly 100, which is worth checking yourself rather than trusting a summary, because a blueprint that does not sum to 100 is a sign something was transcribed wrong. Each domain also publishes named sub-competencies. MCP Fundamentals covers purpose and scope, core concepts, and interoperability and value. Architecture and Components covers schemas and structured data, the host, client, and server roles, and the model interaction flow. Interactions and Execution, the heaviest domain, covers interaction patterns and response handling, error handling, the tool invocation lifecycle, and protocol primitives. Security and Governance covers trust boundaries, permissions and consent, risk and safety controls, and auditability and observability. Use Cases and Ecosystem covers roles and adoption, operational use cases, and ecosystem portability. Every fact in this paragraph, along with its source and retrieval date, is recorded in `certifications/mcpa/research/source-verification-ledger.md` in this repository, so you can verify it yourself rather than take a lesson's word for it.

Next, the mechanics around the blueprint. The exam is delivered online, proctored, and multiple choice, and its content is aligned to the Model Context Protocol specification dated 2026-07-28, the same version this entire curriculum targets. The fee is 250 US dollars for the exam alone, separate from any bundled subscription. The credential is valid for two years, and a candidate who does not pass on the first attempt gets one included retake. Even the duration is not one clean number: the certification page itself states a 90 minute duration, while the Linux Foundation's own launch press release states 120 minutes. This curriculum follows the certification page, the exam-specific source, and records the press release's figure as an unresolved discrepancy rather than quietly picking whichever number looked more convenient; `certifications/mcpa/research/source-verification-ledger.md` carries both numbers with both sources so you can reverify before relying on either one. Two numbers are conspicuously absent from both sources: the exact number of items on the exam, and the passing score. Treat that absence as a fact in its own right, not a gap to paper over with a guess. It means your calibration target cannot be "answer at least N of 60 questions correctly." It has to be "reach solid, evenly distributed competence across all five domains," because that is the only target the published information actually supports.

Now connect the numbers to a plan. If a blueprint weight is a percentage of exam content, then the same percentage applied to a study-hours budget gives you a defensible per-domain target: hours for a domain equal your total budget multiplied by that domain's weight, divided by 100. This is ordinary proportional allocation, the same arithmetic behind sizing a budget line item or a portfolio position, and it is deterministic: the same budget and the same blueprint always produce the same split. The second half of the plan is measuring where you stand. A readiness estimate that simply averages your practice accuracy across five domains treats a domain worth 14 percent the same as one worth 26 percent, which quietly lets strength in a light domain cover for weakness in a heavy one. A weighted readiness estimate multiplies each domain's practice accuracy by that domain's blueprint weight before summing, so the number you look at tracks the exam's own emphasis instead of a naive five-way split. Both computations, the budget allocation and the weighted readiness estimate, are implemented as small, deterministic functions in `code/main.py`, and the figure below turns the five weights into a picture you can compare against your own allocation.

### Reading a question: catching a legacy-era distractor

A well-written distractor is not random noise. The MCPA exam is aligned to 2026-07-28, but MCP has gone through five revisions, and the belief system of the first, 2024-11-05, release is still everywhere: in old blog posts, in cached documentation, in an earlier draft of this very curriculum before it was corrected. That older belief system reads as fluent and confident, which is what makes it dangerous as a wrong answer. Train a specific reflex instead of a vague sense of caution. First, notice any option that describes a setup step, a handshake, or a negotiation before the first real request; 2026-07-28 has none, every request carries its own protocol version and capabilities in `_meta`, so an `initialize` call, or a claim that the connection negotiates a version up front, is a legacy-era tell. Second, notice any option that leans on a session or a sticky connection to explain how a server remembers something across calls; 2026-07-28 is stateless, and cross-request state travels as an explicit, server-minted handle passed back as an ordinary argument, never as an implicit session. Third, check any error code against what it actually means: an unknown tool is `-32602`, not the tempting `-32601`, which is reserved for an unknown method, and an argument that fails a tool's schema is not a protocol error at all, it is a normal result with `isError: true` that the model can read and correct. `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 16, keeps a running table of these traps, each wrong belief paired with the 2026-07-28 fact that replaced it; read it once before your first practice set and again the night before the exam.

### The route: 34 lessons across five domains

This track has 34 lessons, numbered 00 through 33, and every one of them is tagged to at least one of the five blueprint domains. Most lessons belong to exactly one domain: the tools primitive belongs to Interactions and Execution, OAuth belongs to Security and Governance, and so on down the route. A few lessons sit at a genuine intersection and are tagged with two domains at once. JSON-RPC and Meta is tagged Fundamentals and Architecture because the message envelope it teaches is both a core concept and a piece of the architecture the exam separately asks about; Transports and HTTP Headers is tagged Interactions and Architecture for the same reason, one mechanism, two angles the exam can question it from. The capstone lesson at the end of the route, lesson 33, is tagged with all five domains on purpose, because it is the one exchange that has to exercise every domain's ideas in a single transcript. `code/main.py` in this lesson encodes that entire route as data, not prose, so a script, or you, can ask "which lessons train Security and Governance" and get an exact, checkable answer instead of a guess from memory.

```figure
mcpa-00-blueprint-weights
```

## Interactive Lab

Run the script below. It validates the domain weights and the 34-lesson route, then prints the exam facts exactly as the two official sources state them, including the 90 versus 120 minute duration conflict and the two fields that are deliberately `null` because neither source publishes them. It allocates a 40-hour example budget across the five domains and prints the result next to a sample readiness computation built from example practice scores, alongside a naive unweighted average of the same scores so you can see the two numbers diverge. Finally it prints the full route length and the lesson slugs `route_for_domain` returns for two sample domains, the same question the route section above answers in prose.

```bash
python3 code/main.py
```

Hold the printed allocation table next to the figure above. The tallest bars, Interactions and Execution and Security and Governance, should also be the largest numbers in your printed allocation, because both come from the same five weights. If you change the `total_hours` value passed to `allocate_study_hours` in `demo()` and rerun the script, every number in the table moves in place while the proportions between domains stay fixed, because the split is relative to the blueprint, not to any specific budget size. Try calling `main.route_for_domain("not-a-real-domain")` from a Python shell in the lesson directory and watch it refuse the request instead of silently returning an empty route.

## Practice Lab

Before you open the next lesson in this track, do three things with your own numbers instead of the example ones baked into the demo. First, decide how many hours you actually have between now and your exam date, then call `allocate_study_hours` with that number and write down the five domain targets somewhere you will see them again, such as the shipped cheat sheet below. Second, as you work through practice questions or the diagnostic assessment in this track, keep a running `(correct, total)` tally for each domain, and periodically call `estimate_readiness` with that tally. Watch what happens to the number as you fill in a domain you had previously left at zero attempts: it should move, because an unpracticed domain scores as zero in the estimate rather than being quietly excluded. Third, call `route_for_domain` for whichever domain your readiness estimate says is weakest, and read that exact list of lessons next, in order, instead of continuing straight down the numbered list out of habit. Repeat all three checks weekly. A plan you built once and never revisited is not a plan, it is a snapshot.

## Shipped Artifact

`outputs/mcpa-blueprint-cheatsheet.md` is the one-page reference this lesson produces: all five domains with their weights and published sub-competencies, the fixed exam facts including the page-versus-press duration conflict and the two facts that are explicitly unpublished, a short legacy-era distractor checklist, and the full 34-lesson route table with each lesson's domain. Print it, pin it, or keep it open in a second window for the rest of this track.

## Verify It

Run the tests with `python3 -m unittest discover code/tests`. They check that the five domain weights sum to exactly 100 and that the validation guard rejects a weight set that does not, that a study-hours budget is split in exact proportion to those weights and that the split sums back to the original budget, that a weighted readiness estimate rewards mastery of the heaviest domain more than mastery of a lighter one rather than treating every domain the same, that a zero-hour budget allocates zero to every domain without special-casing, that a domain with no attempted practice questions contributes zero to readiness instead of raising a division error, that an unrecognized domain name is rejected by both the readiness estimate and the route lookup instead of failing silently, and that the route covers all 34 lessons numbered 00 through 33 with the capstone alone spanning every domain. If any of these fail, the code and this lesson have drifted apart, and the code is the source of truth for the arithmetic.

This lesson never exchanges a message with an MCP server, so its wire transcript is deliberately empty; the repository's wire checker confirms that the module explains why instead of silently shipping nothing:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/00-mcp-exam-strategy
```

## Capstone Connection

The `estimate_readiness` function you just ran is not a throwaway demo. It is the same weighted scoring model lesson 33, the capstone readiness review, expects you to run again, this time against your real diagnostic or mock-exam domain breakdown, to decide whether you are actually ready to schedule the exam or whether a specific domain still needs another pass. Keep the cheat sheet, the two study functions, and the route table in this lesson close. Every one of the 34 lessons that follows slots into at least one of the five weighted domains named here, and the capstone is where you prove, with your own numbers run back through this same math, that your coverage matches the blueprint rather than your reading order.

## Key Terms

| Term | Meaning |
|------|---------|
| Blueprint | The published table of the five MCPA domains and their percentage weights |
| Domain weight | The percentage of exam content a single domain represents, on average |
| Study-hours budget | The fixed number of hours available before exam day, split across domains by weight |
| Readiness estimate | A weighted average of practice accuracy across domains, using blueprint weights instead of a plain average |
| Unpublished fact | An exam detail, such as item count or passing score, that neither official source states |
| Legacy-era distractor | A wrong answer option that describes MCP as it worked before 2026-07-28, such as an `initialize` handshake or a session |
| Route | The mapping from each of the 34 lessons to the domain, or domains, it trains |

## Further Reading

- Model Context Protocol specification, version 2026-07-28, at https://modelcontextprotocol.io/specification/2026-07-28, the release this entire blueprint and curriculum are aligned to.
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 16, for the full table of legacy-era traps this lesson's reading strategy is built from.
- `phases/13-tools-and-protocols/06-mcp-fundamentals` in this repository, for the deep-dive lesson on the core concepts every domain in the blueprint builds on.
- MCPA certification page, https://training.linuxfoundation.org/certification/model-context-protocol-associate-mcpa/, the official guide this lesson's exam facts are drawn from.
- `certifications/mcpa/research/source-verification-ledger.md` in this repository, for every fact above, including the duration discrepancy, with its source and retrieval date.
