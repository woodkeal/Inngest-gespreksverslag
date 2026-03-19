import { createAgent, createTool, anthropic } from "@inngest/agent-kit";
import { z } from "zod";
import type { ConversationStateData } from "../types/state.js";

const MAX_RETRIES = 2;

const handleErrorTool = createTool({
  name: "handle_error",
  description: "Leg de beslissing vast: opnieuw proberen of stoppen, en stel een gebruikersbericht op",
  parameters: z.object({
    shouldRetry: z.boolean().describe("True als de fout retriable is en we nog niet het maximum hebben bereikt"),
    userMessage: z.string().describe("Nederlandstalig bericht om naar de gebruiker te sturen"),
  }),
  handler: async (input, { network }) => {
    const state = network.state.data as ConversationStateData;
    const step = state.failedStep!;
    const currentRetries = state.retryCount[step] ?? 0;
    const reason = (state.failureReason ?? "").toLowerCase();

    // Deterministisch: bekende niet-retriable fouten nooit opnieuw proberen
    const isKnownNonRetriable =
      reason.includes("forbidden") ||
      reason.includes("unauthorized") ||
      reason.includes("401") ||
      reason.includes("403") ||
      reason.includes("invalid api key") ||
      reason.includes("api key");

    // Override retry decision if max retries exceeded or error is non-retriable
    const shouldRetry = !isKnownNonRetriable && input.shouldRetry && currentRetries < MAX_RETRIES;

    state.shouldRetry = shouldRetry;
    state.errorUserMessage = input.userMessage;
    state.errorHandled = true;

    if (shouldRetry) {
      state.retryCount = { ...state.retryCount, [step]: currentRetries + 1 };
    }

    return shouldRetry ? `Retry besloten (poging ${currentRetries + 2})` : "Stop besloten, gebruiker geïnformeerd";
  },
});

export const errorHandlerAgent = createAgent<ConversationStateData>({
  name: "error-handler",
  description: "Verwerkt mislukte stappen, beslist of opnieuw proberen of stoppen, en stelt een gebruikersbericht op",
  model: anthropic({
    model: "claude-haiku-4-5-20251001",
    defaultParameters: { max_tokens: 512, tool_choice: { type: "tool", name: "handle_error" } },
  }),
  system: ({ network }) => {
    const state = network?.state.data as ConversationStateData | undefined;
    const failedStep = state?.failedStep ?? "onbekend";
    const failureReason = state?.failureReason ?? "onbekende fout";
    const currentRetries = state?.retryCount[failedStep] ?? 0;

    return `Je bent een foutafhandelaar voor een geautomatiseerd gespreksverslag systeem.

Een stap is mislukt:
- Stap: ${failedStep}
- Fout: ${failureReason}
- Geprobeerd: ${currentRetries} keer
- Maximum: ${MAX_RETRIES} keer

Beslis of we opnieuw moeten proberen en stel een vriendelijk Nederlandstalig bericht op voor de gebruiker.

Retriable fouten (shouldRetry: true):
- Netwerk- of verbindingsfouten (fetch failed, ECONNREFUSED, ETIMEDOUT)
- Tijdelijke serverfouten (429 rate limit, 502, 503, 504)
- Timeout fouten

Niet-retriable fouten (shouldRetry: false):
- Authenticatiefouten (401, 403, ongeldige API sleutel)
- Ongeldig of corrupt bestandsformaat
- Ontbrekende verplichte informatie
- Configuratiefouten

Als je besluit opnieuw te proberen: schrijf een kort, geruststellend bericht (bijv. "We proberen het opnieuw, een moment geduld...").
Als je besluit te stoppen: leg vriendelijk uit wat er misging en wat de gebruiker kan doen.

Gebruik altijd de handle_error tool.`;
  },
  tools: [handleErrorTool],
});
