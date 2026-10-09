# Career Practice: One Project, Four Domains

Use one project to demonstrate technical depth, agent-assisted delivery, product decisions, and ownership after release. Choose one career direction and carry the same user problem through its specialist lessons and the four core domains.

This is an independent practice guide. A working portfolio records what you can demonstrate; completing it does not establish professional experience or guarantee a job.

## Check Your Starting Point

If you are a beginner, start with [Software Engineering Fundamentals](https://aiengineeringfromscratch.com/learning-paths.html#software-fundamentals) and complete the prerequisites named by each lesson. The career routes are specialist overlays, not replacements for the underlying curriculum.

If you have equivalent knowledge, demonstrate it on a small repository before skipping foundation lessons:

- Set up a clean environment, make a versioned change, and reproduce a failure with a test.
- Explain the request, data, and error boundaries of a small application.
- Keep credentials outside source, bound permissions, and recover from a failed request.
- Run a model-facing feature and explain its evaluation, fallback, latency, and cost.

Revisit the corresponding foundation when you cannot explain or reproduce the result. Then check the baseline in your chosen career guide, such as statistics for evaluation work or data pipelines for AI data systems.

## Follow a Sequence, Keep One Project

1. Establish [software foundations](https://aiengineeringfromscratch.com/learning-paths.html#software-fundamentals). Keep a reproducible repository with one tested end-to-end behavior.
2. Start [Product Judgment and Delivery](shaping-the-build.json) before building the feature. Observe a workflow, name the user outcome, record assumptions, and choose the smallest useful experiment.
3. Apply [AI application foundations](building-and-deploying-ai-applications.json) to that experiment. Build the interface, grounding, evaluation, failure handling, and operational boundary the slice actually needs.
4. Use [Agent-Assisted Engineering](using-coding-agents.json) during implementation. Frame bounded tasks, supply context, control tools, review the changes, and verify the running artifact independently.
5. Follow your [specialist route](https://aiengineeringfromscratch.com/learning-paths.html#career-chooser) to deepen the same system. Add complexity only when the role's evidence requires it.
6. Close the product loop: gather feedback, brief a stakeholder, make one owned improvement, and rerun the relevant evaluation and cost comparison.

Follow each route's listed lesson order and prerequisites. Shared lessons need one artifact applied well to this project, not duplicate completion records. Guided lesson minutes exclude your independent project and review time.

The workbench path expects [The Agent Loop](../phases/14-agent-engineering/01-the-agent-loop/docs/en.md) and [Agentic Failure Modes](../phases/14-agent-engineering/26-failure-modes-agentic/docs/en.md). Its [durable feedback lesson](../phases/14-agent-engineering/46-turn-feedback-into-system/docs/en.md) also supplies a prerequisite for the product path's final feedback-ownership lesson.

## Choose One Career Project

These are project options, not six assignments. Narrow the scope until you can run the complete workflow and explain each boundary.

| Career direction | One coherent project | Evidence the project must expose |
|---|---|---|
| Customer AI Deployment | A support-intake assistant that proposes a category and hands uncertain cases to a person. | Observed intake workflow, manual baseline, approval boundary, pilot decision, and a changed handoff after feedback. |
| Developer Experience and Education | A runnable integration kit for a grounded-answer API, with a quickstart and failure examples. | Clean-machine setup, another developer's walkthrough, reproduced friction, and measured improvement in task completion. |
| AI Data Systems | A versioned policy-document ingestion and retrieval pipeline. | Lineage, freshness and deletion checks, retrieval evaluation, a failed ingestion drill, and a corrected data-quality control. |
| Agent Systems Engineering | A repository-maintenance agent that proposes a bounded change in a disposable workspace. | Tool permissions, context and state traces, rejected out-of-scope actions, termination, recovery, and independent patch review. |
| LLM Product Engineering | A support-answer feature with citations, structured output, review, and fallback. | Grounding failures, user acceptance, latency, cost per successful task, and a justified release or stop decision. |
| AI Evaluation and Reliability | A release gate and failure drill for a grounded-answer service. | Versioned cases, grader checks against known failures, traces, rollback evidence, and an incident-driven regression case. |

For every option, use a coding agent to perform a bounded repository task and record how you directed and verified it. Building an agent product alone does not demonstrate that practice.

## Keep an Evidence Bundle

Keep these artifacts in your own project repository. Reference the commit, environment, inputs, and command behind every measured result so a reviewer can reproduce it.

| Artifact | Ready for review when | Redo when |
|---|---|---|
| Workflow and decision brief | It names the user, current workflow, desired outcome, baseline, constraints, riskiest assumption, and chosen slice. | The goal is only a feature list, or a cheaper manual or deterministic option was never considered. |
| Agent task and controls | Scope, acceptance, context sources, allowed tools, approval points, time or cost budget, stop rules, and handoff are explicit. | Authority is implied, context is stale, or the agent can modify unrelated resources. |
| Independent verification record | You inspect the diff and run the built artifact against positive, failure, and boundary cases. | The only evidence is the agent's report, generated screenshots, or tests that never exercise the actual behavior. |
| Check-effectiveness record | One deliberate behavior defect makes its check fail, and the repaired version passes. | The check stays green with the defect, or asserts only that a file or field exists. |
| Outcome and cost report | Baseline and candidate use the same cases, acceptance criteria, and accounting window; failures and retries stay in the totals. | A faster demo is presented as user value, or human review and failed attempts are excluded. |
| Stakeholder decision note | It states the evidence, tradeoff, recommendation, unresolved risk, and decision needed in plain language. | It reports activity without saying what should happen next. |
| Feedback and incident record | One signal has an owner, fix, rerun evidence, and a review or retirement condition. | The fix is untested, the original failure still recurs, or nobody owns the next action. |

Use the [agent workbench capstone](../phases/14-agent-engineering/42-agent-workbench-capstone/docs/en.md) to package reusable instructions, setup, state, verification, and handoff. Tailor it to your project's permissions and failure modes.

Review security, dependencies, data handling, and maintainability as part of the diff review. You remain accountable for accepting generated code; another model's approval is supplementary evidence.

For the deliberate defect, work in a disposable branch or fixture. For example, bypass a citation check and confirm that an unsupported answer fails acceptance. Restore the behavior and rerun before recording success.

## Measure Cost per Successful Outcome

Define success before the run. A completed API request is not necessarily a completed user task.

```text
cost per successful outcome =
  (model + infrastructure + tool charges + human review cost)
  / independently accepted outcomes

human review cost = review hours × declared hourly rate
```

Illustrative practice run: 100 attempted tasks produce 80 accepted outcomes. Model and infrastructure cost $12; two hours of review at an assumed $20 per hour cost $40. Total cost is $52, so cost per successful outcome is $0.65 and the success rate is 80%.

Include the cost of all 100 attempts, their retries, and their review. Label the hourly rate as an assumption. Record actual review time separately from any estimated labor cost, and include tool charges if you incur them.

Compare the baseline using the same task set and success definition. Report success rate, latency, review effort, and cost together; a lower cost can hide more failures. With zero accepted outcomes, report that the ratio is undefined and investigate the failures.

For a deeper treatment, use the optional [FinOps for LLMs](../phases/17-infrastructure-and-production/27-finops-llms/docs/en.md) lesson. Its time is outside the core product path estimate.

## Give a Two-Minute Stakeholder Briefing

Use a recording or a live review. Ask a peer to explain the decision back to you without reading your implementation.

| Time | Say and show |
|---|---|
| 0:00 to 0:25 | Who has the problem, what the current workflow costs, and the outcome you tested. |
| 0:25 to 0:55 | The smallest change and one representative result, including a failure. |
| 0:55 to 1:25 | Baseline versus candidate quality, latency, review effort, cost, and the main tradeoff. |
| 1:25 to 2:00 | Your recommendation, unresolved risk, next owner, and decision needed to continue, change, or stop. |

Keep technical details available for questions. Record one objection or disagreement and explain whether it changed the plan and why.

## Run a Second Iteration

Ask a target user to attempt the task with minimal coaching. Record where they hesitate, correct the result, abandon the workflow, or need a handoff. For developer-facing projects, use a clean environment and a developer unfamiliar with your setup.

Choose one feedback signal and one safe failure drill. The drill can be a stale document, unavailable dependency, rejected permission, or malformed output. Record detection, containment, recovery, and what remains unresolved.

Use [feedback ownership](../phases/14-agent-engineering/54-build-the-feedback-ratchet/docs/en.md) to assign the smallest effective fix to context, evaluation, policy, runtime, or backlog. In a solo project, you can be the owner; name the next action and review date explicitly.

Add the failure to the relevant check, rerun the original cases plus the new case, and compare outcomes and costs. Keep regressions visible. A reasonable conclusion can be to simplify or stop the feature.

## Present Evidence Honestly

Label each result as a real user observation, peer walkthrough, synthetic case, or simulated incident. If you have no target-user access, document the assumption and use a peer simulation to test the mechanics; do not describe that as validated demand.

Separate local tests, hosted trials, and production evidence. Record sample size, data limitations, environment, and any estimated costs. Do not claim live traffic, customer adoption, team leadership, or operational experience from a solo simulation.

Your final walkthrough should reproduce one successful task, one rejected or failed task, the improvement between iterations, and the reasoning behind the next decision.
