# Architectuur

## Overzicht

Het systeem is gebouwd op de **WAT-architectuur** (Workflows, Agents, Tools) gecombineerd met **Inngest** als duurzaam orchestratieplatform.

```
┌─────────────────────────────────────────────────────────────┐
│  Input kanalen                                              │
│  ┌──────────────┐         ┌──────────────────────┐         │
│  │ WhatsApp     │         │ REST API             │         │
│  │ (Twilio)     │         │ POST /api/messages   │         │
│  └──────┬───────┘         └──────────┬───────────┘         │
│         │                            │                      │
│         ▼                            ▼                      │
│  ┌────────────────────────────────────────────────────┐     │
│  │  src/server.ts  (http.Server)                      │     │
│  │  /webhook/whatsapp   /api/messages   /api/inngest  │     │
│  └────────────────────────┬───────────────────────────┘     │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Inngest Event Bus                                  │     │
│  │  message/whatsapp.received | message/rest.received │     │
│  └────────────────────────┬───────────────────────────┘     │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Inngest Durable Functions                          │     │
│  │  handleWhatsApp | handleRestMessage                 │     │
│  └────────────────────────┬───────────────────────────┘     │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │  AgentKit Network: conversationNetwork              │     │
│  │                                                     │     │
│  │  [classifier] → [transcription] → [report]         │     │
│  │       → [htmlConverter] → [email] → [messenger]    │     │
│  │                                                     │     │
│  │  Router: code-based (defaultRouter), deterministisch│     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## State lifecycle

State (`ConversationStateData`) wordt aangemaakt per pipeline-run en doorstroomt alle agents:

```
intent: null → "transcribe_audio" | "chat" | "schedule" | "unknown"
transcript: null → string (na Whisper)
report: null → ReportStructure (na reportAgent)
htmlOutput: null → string (na htmlConverterAgent)
emailSent: false → true (na emailAgent)
messageSent: false → true (na messengerAgent)
```

## Componenten

| Component | Bestand | Rol |
|---|---|---|
| Server | `src/server.ts` | HTTP entry point, route multiplexer |
| Inngest client | `src/client.ts` | Getypeerde event bus |
| Twilio webhook | `src/webhooks/twilio.ts` | Parse + valideer + emit event |
| Network | `src/networks/conversationNetwork.ts` | Agent orchestratie + routing |
| Functions | `src/functions/` | Inngest durable functions |
| Agents | `src/agents/` | Intelligente beslissers per taak |
| Tools | `src/tools/` | Deterministische uitvoerders (API calls) |
| Lib | `src/lib/` | Singletons: logger, Anthropic, OpenAI, SendGrid |
| Types | `src/types/` | Zod schemas + TypeScript interfaces |

## AI-providers

| Provider | Model | Gebruik |
|---|---|---|
| Anthropic Claude | `claude-haiku-4-5-20251001` | Classifier, HTML converter, Email, Messenger |
| Anthropic Claude | `claude-sonnet-4-6` | Report generatie (meer redenering nodig) |
| OpenAI Whisper | `whisper-1` | Audio-naar-tekst transcriptie |

## Uitbreidbaarheid

1. **Nieuwe intent**: Voeg toe aan `Intent` type → classifier system prompt → router case
2. **Nieuw kanaal**: Nieuwe webhook handler → nieuw event type → nieuwe Inngest function
3. **Nieuwe agent**: Maak agent, voeg toe aan network, voeg router case toe
4. Zie [EXTENDING.md](EXTENDING.md) voor stap-voor-stap recepten
