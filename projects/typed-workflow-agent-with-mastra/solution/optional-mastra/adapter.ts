import { createStep, createWorkflow } from "@mastra/core/workflows";
import { Mastra } from "@mastra/core/mastra";
import { InMemoryStore, type MastraCompositeStore } from "@mastra/core/storage";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  classify,
  makePlan,
  executePlan,
  validatePlan,
  type Tool,
  type Plan,
} from "../main.ts";
const ticketSchema = z.object({
  id: z.string().min(1),
  message: z.string().min(1).max(10000),
});
const classificationSchema = z.object({
  ticket: ticketSchema,
  intent: z.enum(["read", "write"]),
  topic: z.string(),
});
const planSchema = z.object({
  ticket: ticketSchema,
  actions: z
    .array(
      z.object({
        tool: z.enum(["lookup", "update"]),
        query: z.string().min(1),
      }),
    )
    .min(1)
    .max(10),
  requiresApproval: z.boolean(),
});
const resultSchema = z.object({
  ticketId: z.string(),
  answer: z.string(),
  calls: z.number(),
});
export function planHash(plan: Plan): string {
  return createHash("sha256")
    .update(JSON.stringify(validatePlan(plan)))
    .digest("hex");
}

export function createTicketWorkflow(
  tool: Tool,
  approved = false,
  storage: MastraCompositeStore = new InMemoryStore(),
) {
  const classifyStep = createStep({
    id: "classify",
    inputSchema: ticketSchema,
    outputSchema: classificationSchema,
    execute: async ({ inputData }) => classify(inputData),
  });
  const planStep = createStep({
    id: "plan",
    inputSchema: classificationSchema,
    outputSchema: planSchema,
    execute: async ({ inputData }) => makePlan(inputData),
  });
  const executeStep = createStep({
    id: "execute",
    inputSchema: planSchema,
    outputSchema: resultSchema,
    suspendSchema: z.object({
      ticketId: z.string(),
      planHash: z.string(),
      plan: planSchema,
      reason: z.string(),
    }),
    resumeSchema: z.object({
      approved: z.boolean(),
      ticketId: z.string(),
      planHash: z.string(),
    }),
    execute: async ({ inputData, resumeData, suspendData, suspend }) => {
      const plan = validatePlan(inputData),
        digest = planHash(plan);
      if (plan.requiresApproval && !approved) {
        if (
          suspendData &&
          (suspendData.planHash !== digest ||
            suspendData.ticketId !== plan.ticket.id)
        )
          throw new Error("Stored approval context changed");
        if (!resumeData?.approved)
          return suspend({
            ticketId: plan.ticket.id,
            planHash: digest,
            plan: structuredClone(plan),
            reason: "Explicit approval required before update",
          });
        if (
          resumeData.ticketId !== plan.ticket.id ||
          resumeData.planHash !== digest
        )
          throw new Error("Approval does not match the suspended plan");
      }
      const result = await executePlan(plan, tool, {
        approved: approved || resumeData?.approved === true,
        maxCalls: 3,
        maxAttempts: 2,
      });
      if (result.status !== "complete")
        throw new Error(
          result.status === "failed"
            ? result.reason
            : "Unexpected scratch suspension",
        );
      return result.result;
    },
  });
  const workflow = createWorkflow({
    id: "ticket-triage",
    inputSchema: ticketSchema,
    outputSchema: resultSchema,
  })
    .then(classifyStep)
    .then(planStep)
    .then(executeStep)
    .commit();
  const mastra = new Mastra({
    workflows: { "ticket-triage": workflow },
    storage,
    logger: false,
  });
  return mastra.getWorkflow("ticket-triage");
}

export async function persistentWorkflow(tool: Tool, url: string) {
  if (!url.startsWith("file:"))
    throw new Error("Use an explicit local file: database URL");
  const { LibSQLStore } = await import("@mastra/libsql");
  const storage = new LibSQLStore({ id: "ticket-approval-store", url });
  return { workflow: createTicketWorkflow(tool, false, storage), storage };
}
