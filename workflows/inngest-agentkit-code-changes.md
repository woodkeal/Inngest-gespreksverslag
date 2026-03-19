# Workflow: Inngest & Agent-Kit Code Changes

## Doel
Zorg dat elke wijziging aan Inngest-functies of agent-kit code gebaseerd is op de officiële voorbeelden en documentatie, niet op aannames. Fouten in dit soort code zijn moeilijk te debuggen door Inngest's step-memoization model.

## Wanneer gebruiken
Gebruik deze workflow **voordat** je code schrijft of aanpast voor:
- `step.run`, `step.waitForEvent`, `step.sleep`, `step.sendEvent`
- `createAgent`, `createNetwork`, `createTool`, `createRoutingAgent`
- Routing logica en state management
- HITL (Human-in-the-Loop) patronen
- Flow control (concurrency, throttle, debounce)
- Middleware

## Stap 1: Zoek een officieel voorbeeld

Doorzoek in deze volgorde:

### 1a. Agent-kit GitHub examples
Bekijk de `examples/` map in de agent-kit repo:
```
https://github.com/inngest/agent-kit/tree/main/examples
```

Relevante voorbeelden per use case:

| Use case | Voorbeeld |
|---|---|
| HITL / wachten op gebruikersinput | `support-agent-human-in-the-loop` |
| Multi-agent routing | `support-agent-human-in-the-loop` |
| Code-uitvoering / tools | `e2b-coding-agent`, `daytona-coding-agent` |
| RAG / kennisbasis | `code-assistant-rag` |
| Streaming UI | `realtime-ui-nextjs` |
| Deep research | `deep-research` |
| MCP tools | `mcp-neon-agent` |

Gebruik de GitHub CLI om snel bestanden te lezen:
```bash
gh api repos/inngest/agent-kit/contents/examples/<naam>/src/index.ts --jq '.content' | base64 -d
```

### 1b. AgentKit documentatie
```
https://agentkit.inngest.com/overview
https://agentkit.inngest.com/advanced-patterns/human-in-the-loop
```

### 1c. Inngest step-documentatie
```
https://www.inngest.com/docs/features/inngest-functions/steps-workflows/wait-for-event
https://www.inngest.com/docs/features/inngest-functions/steps-workflows/step-run
```

### 1d. Inngest skills (Claude Code)
De volgende skills zijn beschikbaar voor directe referentie:
- `inngest-steps` — step methods en patronen
- `inngest-durable-functions` — triggers, retries, cancellation
- `inngest-flow-control` — concurrency, throttle, debounce
- `inngest-middleware` — middleware lifecycle

## Stap 2: Begrijp het execution model

Inngest hervoert functies bij elke nieuwe stap. Dit is kritisch:

- **State-mutaties in step handlers worden niet herhaald bij replay** — gebruik state alleen buiten `step.run()` als het al eerder is gezet
- **`step.waitForEvent` pauzeert de héle functie** — gebruik dit voor HITL, nooit een blocking loop
- **Duplicate step IDs zijn harmless** maar wijzen op agent-kit's replay gedrag
- **Tools die `step` nodig hebben moeten controleren op `if (!step)`** — ze kunnen ook zonder Inngest context worden aangeroepen

## Stap 3: Implementeer volgens het patroon

Stel jezelf deze vragen voor je code schrijft:

1. **Is er een memoization-risico?** → Zet API calls in `step.run()`
2. **Moet de pipeline pauzeren?** → Gebruik `step.waitForEvent()`, niet een loop/flag
3. **Is de state-mutatie veilig bij replay?** → Zet state-updates ná de step call, of lees ze uit de state die agent-kit beheert
4. **Is er een officieel voorbeeld dat dit doet?** → Kopieer de structuur, pas aan voor onze use case

## Bekende patronen (uit ervaring)

### HITL: Wacht op gebruikersinput (WhatsApp)
```typescript
handler: async (input, { network, step }) => {
  // Stuur vraag
  await step?.run("send-question", () => twilioClient.messages.create(...));

  // Pauzeer pipeline totdat gebruiker antwoordt
  const reply = await step?.waitForEvent("wait-for-reply", {
    event: "message/whatsapp.received",
    timeout: "30m",
    if: `async.data.conversationId == "${conversationId}"`,
  });

  if (!reply) return "TIMEOUT";
  return reply.data.body; // antwoord van de gebruiker
};
```
→ Zie officieel voorbeeld: `examples/support-agent-human-in-the-loop/src/index.ts`

### Router: Stop bij awaiting HITL
```typescript
if (state.awaitingFollowUp) return undefined;
```
→ Voorkomt looping als HITL niet beschikbaar is (bijv. REST kanaal)

### Tool: Memoize zware operaties
```typescript
const result = await step?.run("mijn-operatie", async () => {
  return await externalApi.call();
});
```
→ Zorgt dat de call niet herhaald wordt bij Inngest replay

## Stap 4: Typecheck altijd na wijzigingen
```bash
npm run typecheck
```

---

## Referenties
- Agent-kit examples: https://github.com/inngest/agent-kit/tree/main/examples
- AgentKit docs: https://agentkit.inngest.com
- Inngest step docs: https://www.inngest.com/docs
- Debug workflow: `workflows/debug-run.md`
