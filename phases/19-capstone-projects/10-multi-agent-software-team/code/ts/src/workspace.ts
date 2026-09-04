import { createHash } from "node:crypto";
import type { Message, Role, WorkspaceFile } from "./types.js";

export class SharedWorkspace {
  private readonly files = new Map<string, WorkspaceFile>();
  private readonly log: Message[] = [];

  write(path: string, contents: string, writer: Role): WorkspaceFile {
    const prev = this.files.get(path);
    const file: WorkspaceFile = {
      path,
      contents,
      lastWriter: writer,
      revisions: (prev?.revisions ?? 0) + 1,
    };
    this.files.set(path, file);
    return file;
  }

  read(path: string): WorkspaceFile | undefined {
    return this.files.get(path);
  }

  list(): WorkspaceFile[] {
    return [...this.files.values()];
  }

  fingerprint(): string {
    const hasher = createHash("sha256");
    for (const f of [...this.files.values()].sort((a, b) =>
      a.path.localeCompare(b.path),
    )) {
      hasher.update(`${f.path}:${f.contents}\n`);
    }
    return hasher.digest("hex").slice(0, 12);
  }

  appendMessage(m: Message): void {
    this.log.push(m);
  }

  messages(): readonly Message[] {
    return this.log;
  }
}
