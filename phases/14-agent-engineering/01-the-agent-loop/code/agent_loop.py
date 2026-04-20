import os
import subprocess


TOOLS = {
    "read_file": {
        "description": "Read the contents of a file",
        "parameters": {
            "path": {"type": "string", "description": "File path to read"}
        },
        "execute": lambda path: open(path).read() if os.path.exists(path) else f"File not found: {path}"
    },
    "write_file": {
        "description": "Write content to a file",
        "parameters": {
            "path": {"type": "string", "description": "File path to write"},
            "content": {"type": "string", "description": "Content to write"}
        },
        "execute": lambda path, content: (
            open(path, 'w').write(content),
            f"Wrote {len(content)} chars to {path}"
        )[1]
    },
    "run_command": {
        "description": "Run a shell command and return output",
        "parameters": {
            "command": {"type": "string", "description": "Shell command to run"}
        },
        "execute": lambda command: subprocess.run(
            command.split(), capture_output=True, text=True, timeout=30
        ).stdout or "No output"
    },
    "list_files": {
        "description": "List files in a directory",
        "parameters": {
            "path": {"type": "string", "description": "Directory path"}
        },
        "execute": lambda path: "\n".join(os.listdir(path)) if os.path.isdir(path) else f"Not a directory: {path}"
    }
}


class SimpleAgent:
    def __init__(self, tools, max_turns=10):
        self.tools = tools
        self.max_turns = max_turns
        self.messages = []

    def run(self, user_message):
        self.messages.append({"role": "user", "content": user_message})

        for turn in range(self.max_turns):
            print(f"\n--- Turn {turn + 1}/{self.max_turns} ---")

            response = self._call_llm()

            tool_calls = self._extract_tool_calls(response)

            if not tool_calls:
                print(f"Agent: {response}")
                return response

            self.messages.append({"role": "assistant", "content": response})

            for call in tool_calls:
                name = call["name"]
                args = call["arguments"]
                print(f"  Tool: {name}({args})")

                if name in self.tools:
                    result = self.tools[name]["execute"](**args)
                else:
                    result = f"Unknown tool: {name}"

                print(f"  Result: {str(result)[:200]}")
                self.messages.append({
                    "role": "tool",
                    "content": f"Tool '{name}' returned: {result}"
                })

        return "Max turns reached"

    def _call_llm(self):
        print("  [LLM would be called here with messages + tool definitions]")
        print(f"  [Messages so far: {len(self.messages)}]")
        return "I'll list the files in the current directory."

    def _extract_tool_calls(self, response):
        return []


if __name__ == "__main__":
    print("=== The Agent Loop ===\n")
    print("This is the core pattern behind every AI agent:\n")
    print("  1. User sends a message")
    print("  2. LLM thinks and decides to use a tool (or respond)")
    print("  3. Tool executes and returns a result")
    print("  4. Result feeds back to the LLM")
    print("  5. Repeat until the LLM decides it's done\n")

    print("Available tools:")
    for name, tool in TOOLS.items():
        print(f"  - {name}: {tool['description']}")

    print("\n--- Demo: Tool execution ---")
    print(f"\nlist_files('.'): \n{TOOLS['list_files']['execute']('.')}")

    print("\n--- Demo: Agent loop (without LLM) ---")
    agent = SimpleAgent(TOOLS)
    result = agent.run("List the files in the current directory")
    print(f"\nResult: {result}")

    print("\nTo run with a real LLM, set ANTHROPIC_API_KEY and use agent_loop_real.py")
