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
        "1. test_payments.py の failing test を parse する",
        "2. refunds.py の refund rounding を patch する",
        "3. regression test test_refund_rounding を追加する",
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
        `reviewer note に基づいて re-plan: ${inbound.body}`,
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
        "\n# 丸め修正\n";
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
          "plan または refunds.py がありません",
        );
      }
      if (this.reviews === 1) {
        return this.emit(
          workspace,
          "planner",
          "review.changes_requested",
          "test が failure case なしで True を assert しています",
        );
      }
      return this.emit(workspace, "broadcast", "review.approved", "承認");
    }
    return null;
  }
}
