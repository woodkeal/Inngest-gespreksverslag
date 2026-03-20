import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import type { ConversationStateData } from "../types/state.js";
import { handleTest } from "../functions/handleTest.js";

export const invokeTest = createTool({
  name: "invoke_test",
  description: "Invoke the handleTest function via step.invoke and store the result",
  parameters: z.object({
    input: z.string().describe("The input to pass to the test function"),
  }),
  handler: async (params, { network, step }) => {
    const state = network.state.data as ConversationStateData;
    const result = await step?.invoke("invoke-test-fn", {
      function: handleTest,
      data: { input: params.input },
    });
    state.testResult = (result as { message: string } | undefined)?.message ?? "no result";
    return state.testResult;
  },
});
