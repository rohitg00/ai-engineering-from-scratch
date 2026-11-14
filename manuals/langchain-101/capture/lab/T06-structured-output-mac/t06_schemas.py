from enum import Enum
from typing import Optional, Union

from pydantic import BaseModel, Field


class Contact(BaseModel):
    """Contact details extracted from the text."""
    name: str = Field(description="Full name of the person")
    email: str = Field(description="Email address")
    age: int = Field(description="Age in years")


class Customer(BaseModel):
    name: str
    email: str


class LineItem(BaseModel):
    sku: str = Field(description="Product code, for example SKU-123")
    quantity: int
    unit_price: float


class Order(BaseModel):
    """An order extracted from the text."""
    order_id: str
    customer: Customer
    items: list[LineItem]
    notes: Optional[str] = None


class Refund(BaseModel):
    """The customer wants money back."""
    order_id: str
    amount: float


class Exchange(BaseModel):
    """The customer wants a different product instead."""
    order_id: str
    new_sku: str


RequestUnion = Union[Refund, Exchange]


class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class Category(str, Enum):
    billing = "billing"
    technical = "technical"
    account = "account"


class Ticket(BaseModel):
    """A support ticket triage."""
    priority: Priority
    category: Category
    summary: str


FIRST = ["Ana Silva", "Ben Okafor", "Chen Wei", "Dara Novak", "Eli Haddad", "Fatima Zahra", "Gus Lindqvist",
         "Hana Sato", "Ivan Petrov", "Jade Moreau", "Kofi Mensah", "Lena Fischer", "Marco Rossi", "Nina Kowalski",
         "Omar Farouk", "Priya Nair", "Quinn Byrne", "Rosa Diaz", "Sam Tanaka", "Tara Walsh"]


def flat_inputs():
    out = []
    for i, name in enumerate(FIRST):
        age = 21 + i * 2
        email = name.lower().replace(" ", ".") + "@example.org"
        style = i % 4
        if style == 0:
            text = f"Hi, I'm {name}, {age} years old. Reach me at {email}."
        elif style == 1:
            text = f"New signup: {name} (age {age}), contact {email}, wants the newsletter."
        elif style == 2:
            text = f"Email from {email}: 'This is {name}. I turned {age} last month and need help.'"
        else:
            text = f"Record -> person: {name}; years: {age}; mail: {email}; status: active"
        out.append({"text": text, "expect": {"name": name, "email": email, "age": age}})
    return out


def nested_inputs():
    out = []
    for i, name in enumerate(FIRST):
        email = name.lower().replace(" ", ".") + "@shop.test"
        n = 1 + i % 3
        items = [{"sku": f"SKU-{100 + i * 7 + k}", "quantity": 1 + (i + k) % 4, "unit_price": round(4.5 + i + k * 2.25, 2)} for k in range(n)]
        parts = ", ".join(f"{it['quantity']} x {it['sku']} at ${it['unit_price']}" for it in items)
        note = " Please gift wrap." if i % 2 == 0 else ""
        text = f"Order ORD-{5000 + i} placed by {name} <{email}>: {parts}.{note}"
        out.append({"text": text, "expect": {"order_id": f"ORD-{5000 + i}", "n_items": n}})
    return out


def union_inputs():
    out = []
    for i in range(20):
        oid = f"ORD-{7000 + i}"
        if i % 2 == 0:
            amt = round(10 + i * 3.5, 2)
            text = f"Order {oid} arrived broken. I want my ${amt} back, please refund it."
            kind = "Refund"
        else:
            sku = f"SKU-{900 + i}"
            text = f"For order {oid}, the size is wrong. Please swap it for {sku} instead of refunding."
            kind = "Exchange"
        out.append({"text": text, "expect": {"kind": kind, "order_id": oid}})
    return out


def enum_inputs():
    rows = [
        ("I was charged twice this month and need one charge reversed today.", "high", "billing"),
        ("The app crashes every time I open settings. Production is down for our whole team!", "urgent", "technical"),
        ("How do I change the email on my account? No rush.", "low", "account"),
        ("Invoice PDF shows the wrong VAT number, please fix before quarter end.", "medium", "billing"),
        ("Login fails with error 500 since this morning, nobody can sign in.", "urgent", "technical"),
        ("Please delete my old account when you get a chance.", "low", "account"),
        ("Card declined on renewal, service will stop tomorrow.", "high", "billing"),
        ("Export to CSV is slow but works eventually.", "low", "technical"),
        ("I can't reset my password, the link expired twice.", "medium", "account"),
        ("Refund for the cancelled plan has not arrived after 30 days.", "high", "billing"),
        ("API returns 429 for all requests, our checkout is broken right now.", "urgent", "technical"),
        ("Can I add a second admin to the account?", "low", "account"),
        ("The receipt email has a typo in my company name.", "low", "billing"),
        ("Dark mode toggle does nothing on Firefox.", "medium", "technical"),
        ("Someone else logged into my account, I see unknown sessions!", "urgent", "account"),
        ("We were billed for 50 seats but only use 20.", "medium", "billing"),
        ("Webhook deliveries stopped an hour ago, orders are not syncing.", "high", "technical"),
        ("Please merge my two accounts into one.", "medium", "account"),
        ("Tax exemption certificate needs to be applied to future invoices.", "medium", "billing"),
        ("Mobile app font is a bit small.", "low", "technical"),
    ]
    return [{"text": t, "expect": {"priority": p, "category": c}} for t, p, c in rows]


SCHEMAS = {
    "flat": (Contact, flat_inputs),
    "nested": (Order, nested_inputs),
    "union": (RequestUnion, union_inputs),
    "enum": (Ticket, enum_inputs),
}
