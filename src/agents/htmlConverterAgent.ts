import { createAgent, anthropic, createTool } from "@inngest/agent-kit";
import { z } from "zod";
import type { ConversationStateData } from "../types/state.js";

const saveHtml = createTool({
  name: "save_html",
  description: "Sla de gegenereerde HTML op in de state",
  parameters: z.object({
    html: z.string().describe("De volledige HTML output van het rapport"),
  }),
  handler: async (input, { network }) => {
    const state = network.state.data as ConversationStateData;
    state.htmlOutput = input.html;
    return "HTML opgeslagen";
  },
});

export const htmlConverterAgent = createAgent<ConversationStateData>({
  name: "html_converter",
  description: "Converteert een rapport JSON naar semantische HTML",
  model: anthropic({
    model: "claude-haiku-4-5-20251001",
    defaultParameters: { max_tokens: 4096 },
  }),
  system: ({ network }) => {
    const state = network?.state.data as ConversationStateData | undefined;
    const report = state?.report;
    const reportJson = report ? JSON.stringify(report, null, 2) : "(geen rapport beschikbaar)";

    return `Je bent een HTML-generator. Converteer het volgende rapport JSON naar een professionele, semantische HTML-pagina.

Vereisten:
- Gebruik semantische HTML5 elementen (article, section, h1-h3, ul, li, p)
- Voeg inline CSS toe voor een nette opmaak (geen externe stylesheets nodig)
- Nederlandse kopjes: "Samenvatting", "Actiepunten", "Besluiten", "Sprekers"
- Actiepunten tabel met kolommen: Beschrijving | Eigenaar | Deadline
- Professioneel, zakelijk design met witte achtergrond
- Voeg metadata toe in de footer (taal, duur, gegenereerd op)

RAPPORT JSON:
${reportJson}

Roep save_html aan met de complete HTML (inclusief <!DOCTYPE html> en <html> tags).`;
  },
  tools: [saveHtml],
  tool_choice: "save_html",
});
