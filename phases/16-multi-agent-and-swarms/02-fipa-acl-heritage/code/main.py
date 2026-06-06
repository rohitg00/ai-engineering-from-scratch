"""FIPA-ACL translator and mini contract-net demo, stdlib only.

Shows that every 2026 agent-protocol message (MCP tools/call, MCP
resources/read, A2A task creation) reduces to a FIPA-ACL envelope with a
different syntax. Then runs a 3-bidder contract-net negotiation using the
canonical cfp / propose / accept-proposal / reject-proposal performatives.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


PERFORMATIVES = {
    "inform", "request", "query-if", "query-ref", "propose",
    "accept-proposal", "reject-proposal", "agree", "refuse",
    "confirm", "disconfirm", "not-understood", "cfp",
    "subscribe", "cancel", "failure",
}


@dataclass
class ACLMessage:
    performative: str
    sender: str
    receiver: str
    content: Any
    language: str = "SL0"
    ontology: str = "default"
    protocol: Optional[str] = None
    conversation_id: Optional[str] = None
    reply_with: Optional[str] = None

    def __post_init__(self) -> None:
        if self.performative not in PERFORMATIVES:
            raise ValueError(f"unknown performative: {self.performative}")

    def render(self) -> str:
        fields = [
            f":sender       {self.sender}",
            f":receiver     {self.receiver}",
            f":content      {self.content!r}",
            f":language     {self.language}",
            f":ontology     {self.ontology}",
        ]
        if self.protocol:
            fields.append(f":protocol     {self.protocol}")
        if self.conversation_id:
            fields.append(f":conversation-id {self.conversation_id}")
        if self.reply_with:
            fields.append(f":reply-with   {self.reply_with}")
        inner = "\n  ".join(fields)
        return f"({self.performative}\n  {inner}\n)"


def mcp_tools_call_to_acl(req: dict) -> ACLMessage:
    """MCP tools/call JSON-RPC message -> FIPA-ACL request."""
    return ACLMessage(
        performative="request",
        sender="host",
        receiver=req["params"]["name"],
        content=req["params"].get("arguments", {}),
        language="JSON",
        ontology=req["params"]["name"],
        protocol="fipa-request",
        conversation_id=f"jsonrpc-{req['id']}",
        reply_with=f"msg-{req['id']}",
    )


def mcp_resources_read_to_acl(req: dict) -> ACLMessage:
    """MCP resources/read JSON-RPC message -> FIPA-ACL query-ref."""
    return ACLMessage(
        performative="query-ref",
        sender="host",
        receiver="resource-server",
        content=req["params"]["uri"],
        language="URI",
        ontology="mcp-resource",
        protocol="fipa-query",
        conversation_id=f"jsonrpc-{req['id']}",
        reply_with=f"msg-{req['id']}",
    )


def a2a_task_create_to_acl(task: dict) -> ACLMessage:
    """A2A POST /tasks body -> FIPA-ACL request inside a contract-net-like flow."""
    return ACLMessage(
        performative="request",
        sender=task.get("client", "client"),
        receiver=task.get("agent", "agent"),
        content=task["input"],
        language="JSON",
        ontology=task.get("skill", "default"),
        protocol="a2a-task",
        conversation_id=task.get("task_id", "t-0"),
        reply_with=task.get("task_id", "t-0"),
    )


def a2a_subscribe_to_acl(task_id: str, client: str, agent: str) -> ACLMessage:
    """A2A SSE subscription -> FIPA-ACL subscribe."""
    return ACLMessage(
        performative="subscribe",
        sender=client,
        receiver=agent,
        content={"task_id": task_id, "event_types": ["state", "artifact"]},
        language="JSON",
        ontology="a2a-events",
        protocol="fipa-subscribe",
        conversation_id=task_id,
    )


@dataclass
class Bid:
    bidder: str
    price: int
    eta_minutes: int


@dataclass
class ContractNet:
    manager: str
    bidders: list[str]
    log: list[ACLMessage] = field(default_factory=list)

    def cfp(self, task: str, conv: str) -> None:
        for b in self.bidders:
            self.log.append(ACLMessage(
                performative="cfp",
                sender=self.manager,
                receiver=b,
                content=task,
                ontology="contract-net",
                protocol="fipa-contract-net",
                conversation_id=conv,
                reply_with=f"cfp-{b}",
            ))

    def propose(self, bidder: str, bid: Bid, conv: str) -> None:
        self.log.append(ACLMessage(
            performative="propose",
            sender=bidder,
            receiver=self.manager,
            content={"price": bid.price, "eta_minutes": bid.eta_minutes},
            ontology="contract-net",
            protocol="fipa-contract-net",
            conversation_id=conv,
            reply_with=f"propose-{bidder}",
        ))

    def award(self, winner: str, losers: list[str], conv: str) -> None:
        self.log.append(ACLMessage(
            performative="accept-proposal",
            sender=self.manager,
            receiver=winner,
            content="awarded",
            ontology="contract-net",
            protocol="fipa-contract-net",
            conversation_id=conv,
        ))
        for L in losers:
            self.log.append(ACLMessage(
                performative="reject-proposal",
                sender=self.manager,
                receiver=L,
                content="not awarded",
                ontology="contract-net",
                protocol="fipa-contract-net",
                conversation_id=conv,
            ))


def demo_round_trip() -> None:
    print("=" * 72)
    print("Round-trip: 2026 JSON-RPC / REST <-> FIPA-ACL envelope")
    print("=" * 72)

    mcp_call = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {"name": "lookup_stock", "arguments": {"symbol": "IBM"}},
        "id": 42,
    }
    print("\n-- MCP tools/call --")
    print(mcp_call)
    print("as ACL:")
    print(mcp_tools_call_to_acl(mcp_call).render())

    mcp_read = {
        "jsonrpc": "2.0",
        "method": "resources/read",
        "params": {"uri": "file:///etc/hosts"},
        "id": 43,
    }
    print("\n-- MCP resources/read --")
    print(mcp_read)
    print("as ACL:")
    print(mcp_resources_read_to_acl(mcp_read).render())

    a2a_task = {
        "client": "research-host",
        "agent": "code-review-agent",
        "skill": "review-python",
        "input": "def f(x): return x",
        "task_id": "t-12",
    }
    print("\n-- A2A POST /tasks --")
    print(a2a_task)
    print("as ACL:")
    print(a2a_task_create_to_acl(a2a_task).render())

    print("\n-- A2A SSE subscribe --")
    print(a2a_subscribe_to_acl("t-12", "research-host", "code-review-agent").render())


def demo_contract_net() -> None:
    print("\n" + "=" * 72)
    print("Contract Net Protocol — manager broadcasts cfp, bidders propose")
    print("=" * 72)

    cn = ContractNet(manager="scheduler", bidders=["worker-a", "worker-b", "worker-c"])
    conv = "cn-1"

    cn.cfp(task="compress 10GB log bundle", conv=conv)
    cn.propose("worker-a", Bid("worker-a", price=3, eta_minutes=18), conv)
    cn.propose("worker-b", Bid("worker-b", price=2, eta_minutes=25), conv)
    cn.propose("worker-c", Bid("worker-c", price=4, eta_minutes=10), conv)

    proposes = [m for m in cn.log if m.performative == "propose"]
    winner = min(proposes, key=lambda m: m.content["price"] + m.content["eta_minutes"] / 10)
    losers = [m.sender for m in proposes if m.sender != winner.sender]
    cn.award(winner.sender, losers, conv)

    for msg in cn.log:
        print()
        print(msg.render())

    print(f"\nWinner: {winner.sender} (price {winner.content['price']}, eta {winner.content['eta_minutes']}m)")


def main() -> None:
    demo_round_trip()
    demo_contract_net()
    print("\nTakeaway: MCP/A2A messages are FIPA-ACL envelopes with JSON syntax.")
    print("The structural primitives survive; the ontology and formal semantics do not.")


if __name__ == "__main__":
    main()
