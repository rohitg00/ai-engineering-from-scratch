import type { Message, Role } from "./types.js";
import type { SharedWorkspace } from "./workspace.js";

export abstract class Agent {
  abstract readonly role: Role;
  protected sent = 0;
  protected received = 0;

  receive(_m: Message): void {
    this.received += 1;
  }

  protected emit(
    workspace: SharedWorkspace,
    to: Role | "broadcast",
    topic: string,
    body: string,
  ): Message {
    const message: Message = {
      from: this.role,
      to,
      topic,
      body,
      ts: Date.now(),
    };
    workspace.appendMessage(message);
    this.sent += 1;
    return message;
  }

  abstract step(workspace: SharedWorkspace, inbound: Message): Message | null;

  stats(): { role: Role; sent: number; received: number } {
    return { role: this.role, sent: this.sent, received: this.received };
  }
}

export class PlannerAgent extends Agent {
  readonly role = "planner" as const;
  private planned = false;

  step(workspace: SharedWorkspace, inbound: Message): Message | null {
    super.receive(inbound);
    if (inbound.topic === "issue.opened" && !this.planned) {
      const plan = [
        "1. parse failing test in test_payments.py",
        "2. patch refund rounding in refunds.py",
        "3. add regression test test_refund_rounding",
      ].join("\n");
      workspace.write("PLAN.md", plan, this.role);
      this.planned = true;
      return this.emit(workspace, "coder", "plan.ready", plan);
    }
    if (inbound.topic === "review.changes_requested") {
      return this.emit(
        workspace,
        "coder",
        "plan.amended",
        `re-plan based on reviewer note: ${inbound.body}`,
      );
    }
    return null;
  }
}

export class CoderAgent extends Agent {
  readonly role = "coder" as const;

  step(workspace: SharedWorkspace, inbound: Message): Message | null {
    super.receive(inbound);
    if (inbound.topic === "plan.ready" || inbound.topic === "plan.amended") {
      const file = workspace.read("refunds.py");
      const next =
        (file?.contents ?? "def refund(x):\n    return x\n") +
        "\n# rounding fix\n";
      workspace.write("refunds.py", next, this.role);
      workspace.write(
        "tests/test_refund_rounding.py",
        "def test_refund_rounding():\n    assert True\n",
        this.role,
      );
      return this.emit(
        workspace,
        "reviewer",
        "diff.ready",
        `fp=${workspace.fingerprint()}`,
      );
    }
    return null;
  }
}

export class ReviewerAgent extends Agent {
  readonly role = "reviewer" as const;
  private reviews = 0;

  step(workspace: SharedWorkspace, inbound: Message): Message | null {
    super.receive(inbound);
    if (inbound.topic === "diff.ready") {
      this.reviews += 1;
      const plan = workspace.read("PLAN.md");
      const refunds = workspace.read("refunds.py");
      if (!plan || !refunds) {
        return this.emit(
          workspace,
          "planner",
          "review.changes_requested",
          "missing plan or refunds.py",
        );
      }
      if (this.reviews === 1) {
        return this.emit(
          workspace,
          "planner",
          "review.changes_requested",
          "test asserts True with no failure case",
        );
      }
      return this.emit(workspace, "broadcast", "review.approved", "lgtm");
    }
    return null;
  }
}
