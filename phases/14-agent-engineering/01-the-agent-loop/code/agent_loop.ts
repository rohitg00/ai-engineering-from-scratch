import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "fs";
import { execSync } from "child_process";

type ToolDef = {
  description: string;
  parameters: Record<string, { type: string; description: string }>;
  execute: (args: Record<string, string>) => string;
};

const tools: Record<string, ToolDef> = {
  read_file: {
    description: "Read the contents of a file",
    parameters: {
      path: { type: "string", description: "File path to read" },
    },
    execute: ({ path }) => {
      if (!existsSync(path)) return `File not found: ${path}`;
      return readFileSync(path, "utf-8");
    },
  },

  write_file: {
    description: "Write content to a file",
    parameters: {
      path: { type: "string", description: "File path to write" },
      content: { type: "string", description: "Content to write" },
    },
    execute: ({ path, content }) => {
      writeFileSync(path, content, "utf-8");
      return `Wrote ${content.length} chars to ${path}`;
    },
  },

  run_command: {
    description: "Run a shell command and return output",
    parameters: {
      command: { type: "string", description: "Shell command to run" },
    },
    execute: ({ command }) => {
      try {
        return execSync(command, { timeout: 30000, encoding: "utf-8" });
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    },
  },

  list_files: {
    description: "List files in a directory",
    parameters: {
      path: { type: "string", description: "Directory path" },
    },
    execute: ({ path }) => {
      if (!existsSync(path) || !statSync(path).isDirectory()) {
        return `Not a directory: ${path}`;
      }
      return readdirSync(path).join("\n");
    },
  },
};

type Message = {
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: { id: string; name: string; arguments: Record<string, string> }[];
  toolUseId?: string;
};

async function agentLoop(
  userMessage: string,
  maxTurns = 10
): Promise<string> {
  const messages: Message[] = [{ role: "user", content: userMessage }];

  for (let turn = 0; turn < maxTurns; turn++) {
    console.log(`\n--- Turn ${turn + 1}/${maxTurns} ---`);

    const response = await callLLM(messages);

    if (!response.toolCalls?.length) {
      console.log(`Agent: ${response.content}`);
      return response.content;
    }

    messages.push(response);

    for (const call of response.toolCalls) {
      console.log(`  Tool: ${call.name}(${JSON.stringify(call.arguments)})`);

      const tool = tools[call.name];
      const result = tool
        ? tool.execute(call.arguments)
        : `Unknown tool: ${call.name}`;

      console.log(`  Result: ${result.slice(0, 200)}`);

      messages.push({
        role: "tool",
        toolUseId: call.id,
        content: result,
      });
    }
  }

  return "Max turns reached";
}

async function callLLM(_messages: Message[]): Promise<Message> {
  console.log("  [LLM would be called here]");
  return {
    role: "assistant",
    content: "I'll list the files in the current directory.",
  };
}

console.log("=== The Agent Loop (TypeScript) ===\n");
console.log("Available tools:");
for (const [name, tool] of Object.entries(tools)) {
  console.log(`  - ${name}: ${tool.description}`);
}

console.log("\n--- Demo: Tool execution ---");
console.log(`list_files('.'): \n${tools.list_files.execute({ path: "." })}`);

agentLoop("List the files in the current directory").then((result) => {
  console.log(`\nResult: ${result}`);
});
