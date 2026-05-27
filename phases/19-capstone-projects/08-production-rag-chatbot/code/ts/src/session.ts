import type { Session, Turn } from "./types.js";

export class SessionStore {
  private readonly sessions = new Map<string, Session>();

  getOrCreate(id: string, role: string, jurisdiction: string): Session {
    const existing = this.sessions.get(id);
    if (existing) return existing;
    const session: Session = {
      id,
      role,
      jurisdiction,
      turns: [],
      createdAt: Date.now(),
    };
    this.sessions.set(id, session);
    return session;
  }

  appendTurn(id: string, turn: Turn): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.turns.push(turn);
  }

  list(): Session[] {
    return Array.from(this.sessions.values());
  }

  size(): number {
    return this.sessions.size;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }
}
