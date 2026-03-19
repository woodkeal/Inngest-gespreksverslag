# Human-in-the-Loop (HITL)

## Patroon

Het HITL-patroon zit **volledig in de `askFollowUp` tool handler** — niet in de outer Inngest function. Dit is het officiële patroon uit de agent-kit `support-agent-human-in-the-loop` voorbeelden.

```
emailAgent
    │
    ├─ roept ask_follow_up aan
    │       │
    │       ├─ stuur vraag via WhatsApp
    │       │
    │       └─ step.waitForEvent("message/whatsapp.received", {
    │              timeout: "10m",
    │              if: `event.data.from == "${conversationId}"`
    │          })
    │               │
    │               │  ← gebruiker antwoordt via WhatsApp
    │               │
    │               └─ geeft antwoord terug als tool result
    │
    └─ verwerkt antwoord (e-mailadres) → send_email
```

## Sequentiediagram

```
Gebruiker          Twilio         Server          Inngest         emailAgent
    │                │               │                │                │
    │  stuur audio   │               │                │                │
    ├───────────────►│  POST webhook │                │                │
    │                ├──────────────►│  emit event    │                │
    │                │               ├───────────────►│  trigger fn    │
    │                │               │                ├───────────────►│ pipeline start
    │                │               │                │                │
    │                │               │                │                │ emailAgent:
    │                │               │                │                │  ask_follow_up()
    │                │               │                │                │   stuur vraag
    │◄───────────────────────────────────────────────────────── WhatsApp│
    │                │               │                │                │
    │                │               │                │                │  waitForEvent
    │                │               │                │   [PAUZE]      │  (pipeline bevroren)
    │                │               │                │                │
    │  stuur email   │               │                │                │
    ├───────────────►│  POST webhook │                │                │
    │                ├──────────────►│  emit event    │                │
    │                │               ├───────────────►│  resume fn     │
    │                │               │                ├───────────────►│ hervat pipeline
    │                │               │                │                │  send_email()
    │◄──────────────────────────────────────────────────────── e-mail  │
    │                │               │                │                │
    │                │               │                │                │  messengerAgent
    │◄───────────────────────────────────────────────────────── WhatsApp│ bevestiging
```

## Timeout gedrag

- Default timeout: `10m` (via `HITL_TIMEOUT` env var)
- Als de gebruiker niet antwoordt → `step.waitForEvent` geeft `null` terug
- De tool retourneert: `"Geen reactie ontvangen binnen de timeout."`
- De pipeline eindigt zonder e-mail te versturen

## Lokaal testen

1. Start de server: `npm run dev`
2. Start Inngest: `npm run dev:inngest`
3. Open Inngest Dev Dashboard: `http://localhost:8288`
4. Stuur een test event `message/whatsapp.received` met een audio mediaUrl
5. De pipeline pauzeert bij de emailAgent (zichtbaar in het dashboard)
6. Stuur een tweede event `message/whatsapp.received` met hetzelfde `from` veld en een e-mailadres als body
7. De pipeline hervat en verstuurt de e-mail

## Conversatie-isolatie

Het `if`-filter in `waitForEvent` zorgt ervoor dat alleen berichten van dezelfde gebruiker de pipeline hervatten:

```typescript
if: `event.data.from == "${conversationId}"`
```

Combinatie met de `concurrency` key (`event.data.conversationId`, limit: 1) garandeert dat per gebruiker maar één pipeline tegelijk actief is.
