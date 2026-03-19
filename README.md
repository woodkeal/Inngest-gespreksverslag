# Gespreksverslag

Een multi-agent automatiseringsplatform dat WhatsApp-berichten en REST API-verzoeken verwerkt via een intelligente agentic network. Gebouwd op **Inngest** + **@inngest/agent-kit** als basis voor alle toekomstige automatiseringsprojecten.

## Wat doet het?

1. **Ontvang audio** → Transcribeer via OpenAI Whisper
2. **Genereer verslag** → Gestructureerd rapport met 4 secties (samenvatting, actiepunten, besluiten, sprekers)
3. **Converteer naar HTML** → Professionele e-mail layout
4. **Vraag e-mailadres op** → Human-in-the-Loop via WhatsApp
5. **Verstuur per e-mail** → Via SendGrid
6. **Bevestig** → WhatsApp bevestigingsbericht

## Quick start (3 commando's)

```bash
# 1. Installeer dependencies
npm install

# 2. Configureer je API keys
cp .env.example .env
# Vul in: ANTHROPIC_API_KEY, OPENAI_API_KEY, en optioneel Twilio/SendGrid voor volledige flow

# 3. Start (twee terminals)
npm run dev         # terminal 1 — app server op poort 3000
npm run dev:inngest # terminal 2 — Inngest dashboard op http://localhost:8288
```

Open het Inngest dashboard op **http://localhost:8288** en gebruik "Invoke" om een test event te sturen.

## Berichtenkanalen

| Kanaal | Endpoint | Event |
|---|---|---|
| WhatsApp (Twilio) | `POST /webhook/whatsapp` | `message/whatsapp.received` |
| REST API | `POST /api/messages` | `message/rest.received` |

## Architectuur

```
WhatsApp / REST → Inngest Event → handleWhatsApp/handleRest
    → conversationNetwork (code-based router)
        → classifierAgent → transcriptionAgent → reportAgent
        → htmlConverterAgent → emailAgent (HITL) → messengerAgent
```

Zie [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) voor het volledige plaatje.

## Documentatie

| Bestand | Inhoud |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Component diagram, data flow, state lifecycle |
| [docs/EVENTS.md](docs/EVENTS.md) | Volledig event catalog met payload schemas |
| [docs/AGENTS.md](docs/AGENTS.md) | Per agent: doel, model, tools, system prompt rationale |
| [docs/HUMAN_IN_THE_LOOP.md](docs/HUMAN_IN_THE_LOOP.md) | HITL sequentiediagram, timeout gedrag |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Lokale dev setup, ngrok, Inngest Cloud |
| [docs/EXTENDING.md](docs/EXTENDING.md) | Recepten: nieuwe agent, nieuw kanaal, nieuwe tool |

## Workflows (WAT Layer 1)

| Bestand | Inhoud |
|---|---|
| [workflows/audio-transcriptie.md](workflows/audio-transcriptie.md) | Whisper aanpak, edge cases |
| [workflows/rapport-generatie.md](workflows/rapport-generatie.md) | Rapportschema, kwaliteitsnorm |
| [workflows/gesprek-routing.md](workflows/gesprek-routing.md) | Intent classificatieregels |
| [workflows/berichten-versturen.md](workflows/berichten-versturen.md) | Twilio regels, retrybeleid |

## Tech stack

- **Runtime**: Node.js 22 met `--experimental-strip-types`
- **Orchestratie**: [Inngest](https://inngest.com) + [@inngest/agent-kit](https://agentkit.inngest.com)
- **AI**: Anthropic Claude (Sonnet 4.6 + Haiku 4.5), OpenAI Whisper
- **Messaging**: Twilio WhatsApp
- **E-mail**: SendGrid
- **Taal**: TypeScript (ESM)
