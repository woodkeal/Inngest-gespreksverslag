import { createAgent, anthropic, createTool } from "@inngest/agent-kit";
import { z } from "zod";
import type { ConversationStateData, ReportStructure } from "../types/state.js";

const saveReport = createTool({
  name: "save_report",
  description: "Sla het gegenereerde rapport op in de state",
  parameters: z.object({
    samenvatting: z.string().describe("2-5 zin samenvatting van het gesprek"),
    actiepunten: z.array(
      z.object({
        beschrijving: z.string(),
        eigenaar: z.string().nullable(),
        deadline: z.string().nullable(),
      })
    ).describe("Lijst van actiepunten met eigenaar en deadline"),
    besluiten: z.array(z.string()).describe("Expliciete besluiten genomen in het gesprek"),
    sprekers: z.array(
      z.object({
        label: z.string().describe("Spreker 1, Jan, etc."),
        statements: z.array(z.string()).describe("Key uitspraken van deze spreker"),
      })
    ).describe("Sprekers en hun key uitspraken"),
    duur: z.string().nullable().describe("Geschatte gespreksduur"),
    taal: z.string().describe("Gedetecteerde taal: nl, en, of mixed"),
  }),
  handler: async (input, { network }) => {
    const state = network.state.data as ConversationStateData;

    const report: ReportStructure = {
      samenvatting: input.samenvatting,
      actiepunten: input.actiepunten,
      besluiten: input.besluiten,
      sprekers: input.sprekers,
      metadata: {
        duur: input.duur,
        taal: input.taal,
        generatedAt: new Date().toISOString(),
      },
    };

    state.report = report;
    return "Rapport opgeslagen";
  },
});

export const reportAgent = createAgent<ConversationStateData>({
  name: "report",
  description: "Genereert een gestructureerd gespreksverslag uit een transcriptie",
  model: anthropic({
    model: "claude-sonnet-4-6",
    defaultParameters: { max_tokens: 4096 },
  }),
  system: ({ network }) => {
    const state = network?.state.data as ConversationStateData | undefined;
    const transcript = state?.transcript ?? "(geen transcriptie beschikbaar)";

    return `Je bent een professionele notulist die gespreksverslagen maakt in het Nederlands.

Analyseer de volgende transcriptie en maak een volledig rapport met:

1. **Samenvatting**: 2-5 zinnen die de kern van het gesprek samenvatten
2. **Actiepunten**: Concrete taken die uit het gesprek voortvloeien, met eigenaar en deadline indien vermeld
3. **Besluiten**: Expliciete beslissingen die zijn genomen
4. **Sprekers**: Identificeer de sprekers (Spreker 1, Spreker 2, of namen indien herkenbaar) en noteer hun key uitspraken

Wees bondig maar volledig. Als iets niet van toepassing is, gebruik dan een lege lijst.

TRANSCRIPTIE:
${transcript}

Roep de tool save_report aan met het ingevulde rapport.`;
  },
  tools: [saveReport],
  tool_choice: "save_report",
});
