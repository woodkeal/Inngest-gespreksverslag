# Workflow: Debug Inngest Run

## Doel
Analyseer een mislukte of verdachte Inngest run: trace elke stap, lees input/output, identificeer de oorzaak en stel een fix voor. Werk daarna de relevante workflow bij zodat het probleem niet terugkomt.

## Vereiste input
- `runId` — de Inngest run ID (bijv. `01KM2YC2B0YCHHZNRSPKXP1K8F`)

## Stap 1: Voer de analyse tool uit

Dit is de snelste route. De tool verzamelt automatisch alle data (Inngest API, server logs, Inngest logs) en stuurt het naar Claude:

```bash
npx tsx tools/analyze_run.ts <RUN_ID> [conversationId]
```

Rapport wordt geschreven naar `.tmp/debug_<RUN_ID>.md`.

**Alternatief:** Gebruik de MCP tools rechtstreeks in Claude Code:
- `mcp__inngest-dev__get_run_status` — run status + stappenlijst
- `mcp__inngest-dev__poll_run_status` — wacht tot run klaar is

## Stap 2: Lees de logs

De app server logt naar `.tmp/server.log`. Filter op `conversationId` van de run:

| Log entry | Betekenis |
|---|---|
| `WhatsApp bericht ontvangen` / `REST bericht ontvangen` | Pipeline gestart |
| `Transcriptie starten` / `Transcriptie voltooid` | Groq Whisper bezig/klaar |
| `E-mail versturen` / `E-mail verstuurd` | SendGrid bezig/klaar |
| `WhatsApp pipeline voltooid` / `REST pipeline voltooid` | Eindstatus met `emailSent`, `messageSent`, `intent` |

Als een entry ontbreekt, is de pipeline vóór dat punt gestopt.

Inngest dev server logt naar `.tmp/inngest.log`. Zoek op `ERROR`, `WARN`, of het run ID.

## Stap 3: Maak een tijdlijn

```
[tijdstip] [stap]              [status]  [opmerking]
11:40:55   run gestart         OK
11:40:56   classifier          OK        intent=transcribe_audio
11:41:20   transcriptie        OK        219 chars
11:42:00   rapport             ERR       429 rate limit, retry
11:44:00   html converter      OK
11:44:35   e-mail versturen    OK
11:45:22   pipeline voltooid   OK
```

Veelvoorkomende symptomen:

| Symptoom | Waarschijnlijke oorzaak |
|---|---|
| `400` direct na ontvangst-log | Lege message body (bijv. voice note zonder tekst) — zie Bekende valkuilen |
| `429` in inngest.log | Anthropic/Groq rate limit — Inngest retried automatisch |
| `emailSent: false` in pipeline log | E-mail stap niet bereikt of SendGrid fout |
| `E-mail versturen` aanwezig, `E-mail verstuurd` ontbreekt | SendGrid API fout (key of sender niet geverifieerd) |
| Geen `Transcriptie voltooid` | Groq Whisper fout, audio URL onbereikbaar, of Twilio auth vereist |
| `messageSent: false` bij REST channel | Normaal als `replyCallbackUrl` null is |

## Stap 4: Pas de fix toe

1. Zoek het bronbestand (`src/agents/`, `src/tools/`, `src/functions/`)
2. Pas de code aan
3. Typecheck: `npm run typecheck`
4. Test via MCP event inject of WhatsApp
5. Bevestig via logs dat de fix werkt

## Stap 5: Update de workflow

Voeg een notitie toe onder "Bekende valkuilen" hieronder: symptoom, oorzaak, fix, hoe te herkennen.

---

## Bekende valkuilen

### 400-fout bij WhatsApp audiobericht (leeg bericht body)
- **Symptoom**: `error making inference request: unsuccessful status code: 400` direct na ontvangst van een WhatsApp voice note of mediabericht
- **Oorzaak**: WhatsApp voice notes hebben geen tekstinhoud — `event.data.body` is `""`. De Anthropic API weigert lege content met 400.
- **Fix (toegepast)**: In `src/functions/handleWhatsApp.ts` valt de body terug op `"[Audiobestand ontvangen]"` als body leeg is en er een mediaUrl aanwezig is.
- **Herkennen**: 400-error verschijnt vrijwel direct na de ontvangst-log, zonder classifier- of transcriptie-log ertussen.

### Rate limits (429)
- **Symptoom**: `error making inference request: unsuccessful status code: 429` in inngest.log
- **Oorzaak**: Anthropic/Groq rate limit op dev tier
- **Inngest gedrag**: Automatische retry — run zal uiteindelijk slagen
- **Preventie**: `retries: 3` op functies; gebruik Inngest `throttle` om burst te voorkomen

### E-mail niet ontvangen / emailSent: false
- **Symptoom**: `emailSent: false` in pipeline log; `ResponseError: Forbidden` (403) in server.log
- **Oorzaak 1**: `EMAIL_FROM` adres niet geverifieerd in SendGrid
- **Oorzaak 2**: `SENDGRID_API_KEY` niet ingesteld
- **Fix**: SendGrid → Settings → Sender Authentication → Verify a Single Sender

### Duplicate step ID "email" waarschuwing
- **Symptoom**: `Duplicate step ID "email" detected across parallel chains`
- **Oorzaak**: Agent-kit gebruikt de agent naam als step ID bij meerdere re-executions
- **Impact**: Geen — Inngest corrigeert automatisch via `AUTOMATIC_PARALLEL_INDEXING`

### HTML truncatie in e-mail
- **Symptoom**: E-mail bevat incomplete HTML (afgesneden bij ~2000 chars)
- **Oorzaak**: Voorheen stuurde het LLM de HTML als tekst terug via het systeem-prompt
- **Fix (toegepast)**: `send_email` tool leest HTML direct uit state; LLM geeft alleen `to` en `subject` mee

### Groq 400: bestand moet één van [flac mp3 mp4 ...] zijn
- **Symptoom**: `400 file must be one of the following types: [flac mp3 mp4 mpeg mpga m4a ogg opus wav webm]` bij transcriptie
- **Oorzaak**: Twilio media-URLs (bijv. `https://api.twilio.com/.../Media/ME4b...`) hebben geen bestandsextensie. Oude code deed `url.split(".").pop()` op de volledige URL, wat de garbage-string `com/2010-04-01/Accounts/...` opleverde als bestandsnaam.
- **Fix (toegepast)**: In `src/tools/transcribeAudio.ts` wordt de extensie nu uit het **laatste padsegment** gehaald (na de laatste `/`). Als de URL geen bekende extensie bevat, wordt de `Content-Type` response header gebruikt als fallback.
- **Herkennen**: 400-error verschijnt tijdens de transcriptie-stap, niet bij het downloaden van het bestand.
