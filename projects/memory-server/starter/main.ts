export type Memory = {
  id: string;
  namespace: string;
  text: string;
  source: string;
  revision: number;
};

import { pathToFileURL } from "node:url";
import path from "node:path";

export function validateMemory(raw: unknown): any {
  throw new Error("Not implemented: validateMemory");
}
export function embed(text: string, dimensions = 32): number[] {
  throw new Error("Not implemented: embed");
}
export function cosineScores(query: number[], vectors: number[][]): number[] {
  throw new Error("Not implemented: cosineScores");
}
export class MemoryStore {
  file: string;
  constructor(file: string) {
    this.file = file;
  }
  async load(): Promise<void> {
    throw new Error("Not implemented: load");
  }
  async put(raw: unknown, expectedRevision = 0): Promise<any> {
    throw new Error("Not implemented: put");
  }
  async list(namespace: string): Promise<any[]> {
    throw new Error("Not implemented: list");
  }
  async search(namespace: string, query: string, limit = 5): Promise<any[]> {
    throw new Error("Not implemented: search");
  }
}
export function createMemoryServer(store: MemoryStore, token: string): any {
  throw new Error("Not implemented: createMemoryServer");
}
