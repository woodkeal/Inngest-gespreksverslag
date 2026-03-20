import { inngest } from "../client.js";

export const handleTest = inngest.createFunction(
  {
    id: "handle-test",
    triggers: [{ event: "test/invoked" }], // required trigger; step.invoke bypasses this
    retries: 0,
  },
  async ({ event }: { event: { data: { input?: string } } }) => {
    const input = event.data.input ?? "(no input)";
    return { message: `Test function executed. Input was: "${input}"` };
  },
);
