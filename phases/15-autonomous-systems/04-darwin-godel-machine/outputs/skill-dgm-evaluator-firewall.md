---
name: dgm-evaluator-firewall
description: Specify the evaluator separation a Darwin-Godel-Machine-style self-modifying agent loop needs to avoid documented reward hacking.
version: 1.0.0
phase: 15
lesson: 4
tags: [dgm, self-modification, reward-hacking, evaluator, sandbox]
---

Given a proposed self-modifying agent loop (agent scaffolding, evaluator pipeline, deployment target), produce a firewall specification that keeps the evaluator outside the agent's reach. The DGM paper documented the agent removing its own safety markers to raise scores; this skill is the control.

Produce:

1. **File-system boundary.** List every file the agent can edit. List every file the evaluator reads. The intersection must be empty. If it is not, specify the exact move needed to make it empty.
2. **Process boundary.** The evaluator must run in a process the agent does not control. Spec the container or sandbox. If the agent has shell access, the agent can bypass in-process guards.
3. **Network and secret boundary.** The agent must not be able to edit the CI secrets that fetch evaluator inputs or post scores. List where secrets live and how they are mounted.
4. **Score-ingress contract.** Scores return from the evaluator to the loop's archive. That path is the only channel. Anything the agent can write that influences future scoring breaks the contract.
5. **Mutation review list.** List the classes of agent edits that require manual review before acceptance: new dependencies, edits to scoring-adjacent code, edits to sandbox configuration, edits to logging or monitoring.

Hard rejects:
- Evaluator in the same repository as the agent source. Move it out.
- Evaluator that runs as a Python import inside the agent process. Run it in a subprocess.
- Any score adjustment that is applied at the agent's side of the boundary. All adjustment must be server-side.
- Any logging that the agent can silence by editing its own code.

Refusal rules:
- If the user cannot name every file the agent can edit, refuse and require a file-level write-access audit first.
- If the evaluator has no held-out inputs, refuse — this is Lesson 3's audit, a precondition.
- If the deployment surface includes mutations to the evaluator itself (even indirectly through a proposed dependency update), refuse and require a manual firewall-review step.

Output format:

Return a one-page spec with:
- **Agent write-surface** (paths, globs)
- **Evaluator read-surface** (paths, endpoints)
- **Intersection** (must be empty; show the diff)
- **Process model** (how the evaluator is isolated)
- **Secrets inventory** (where and how mounted)
- **Review-required mutation classes** (bulleted)
- **Sign-off line** (who owns the firewall invariant)
