import { Agent, CoderAgent, PlannerAgent, ReviewerAgent } from "./agent.js";
import type { Message, Role, RunResult, WorkspaceFile } from "./types.js";
import { SharedWorkspace } from "./workspace.js";

export class Coordinator {
  private readonly agents: Agent[];
  private readonly workspace = new SharedWorkspace();
  private rotationIndex = 0;

  constructor(agents?: Agent[]) {
    const resolved = agents ?? [
      new PlannerAgent(),
      new CoderAgent(),
      new ReviewerAgent(),
    ];
    if (resolved.length === 0) {
      throw new Error("Coordinator: agents must not be empty");
    }
    this.agents = resolved;
  }

  private routeTo(agent: Agent, msg: Message): boolean {
    return msg.to === "broadcast" || msg.to === agent.role;
  }

  rotation(): Role[] {
    const start = this.rotationIndex % this.agents.length;
    return this.agents
      .map((a, i) => this.agents[(start + i) % this.agents.length]!.role);
  }

  run(initialMessage: Message, maxTurns = 12): RunResult {
    let pending: Message | null = initialMessage;
    this.workspace.appendMessage(initialMessage);
    let turn = 0;
    while (pending && turn < maxTurns) {
      let next: Message | null = null;
      for (let offset = 0; offset < this.agents.length; offset++) {
        const idx = (this.rotationIndex + offset) % this.agents.length;
        const agent = this.agents[idx]!;
        if (!pending) break;
        if (!this.routeTo(agent, pending)) continue;
        next = agent.step(this.workspace, pending);
        if (next) break;
      }
      this.rotationIndex = (this.rotationIndex + 1) % this.agents.length;
      pending = next;
      turn += 1;
      if (pending && pending.topic === "review.approved") {
        return { approved: true, turns: turn };
      }
    }
    return { approved: false, turns: turn };
  }

  workspaceFiles(): WorkspaceFile[] {
    return this.workspace.list();
  }

  messageLog(): readonly Message[] {
    return this.workspace.messages();
  }

  stats(): { role: Role; sent: number; received: number }[] {
    return this.agents.map((a) => a.stats());
  }
}
