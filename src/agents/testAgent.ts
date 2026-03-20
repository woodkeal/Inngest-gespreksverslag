import { createAgent, anthropic } from "@inngest/agent-kit";
import { invokeTest } from "../tools/invokeTest.js";
import type { ConversationStateData } from "../types/state.js";

export const testAgent = createAgent<ConversationStateData>({
  name: "test",
  description: "Demonstreert step.invoke door een aparte Inngest functie aan te roepen",
  model: anthropic({
    model: "claude-haiku-4-5-20251001",
    defaultParameters: { max_tokens: 256 },
  }),
  system: "Call invoke_test with the user's message as input.",
  tools: [invokeTest],
  tool_choice: "invoke_test",
});
