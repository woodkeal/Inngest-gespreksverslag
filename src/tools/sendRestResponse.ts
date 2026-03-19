import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import type { ConversationStateData } from "../types/state.js";

export const sendRestResponse = createTool({
  name: "send_rest_response",
  description: "Stuur een antwoord terug naar de REST API caller via een callback URL",
  parameters: z.object({
    replyCallbackUrl: z.string().describe("De callback URL om het antwoord naar te sturen, of 'skip' als er geen callback is"),
    body: z.string().describe("De tekst van het antwoord"),
  }),
  handler: async (input, { network, step }) => {
    const state = network.state.data as ConversationStateData;

    if (input.replyCallbackUrl !== "skip") {
      const doCallback = async () => {
        const response = await fetch(input.replyCallbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: input.body }),
        });
        if (!response.ok) {
          throw new Error(`Callback mislukt: ${response.status} ${response.statusText}`);
        }
      };
      await (step?.run("send-rest-response", doCallback) ?? doCallback());
    }

    state.messageSent = true;
    return `Antwoord verzonden naar ${input.replyCallbackUrl}`;
  },
});
