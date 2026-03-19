# Workflow: Debug Inngest Run

## Doel
Analyseer een mislukte of verdachte Inngest run in detail: trace elke stap, lees input/output, identificeer de oorzaak en stel een fix voor. Werk daarna de relevante workflow bij zodat het probleem niet terugkomt.

## Vereiste inputs
- `runId` — de Inngest run ID (bijv. `01KM2YC2B0YCHHZNRSPKXP1K8F`)
- `eventId` — het event dat de run triggerde (te vinden in de Inngest dashboard of logs)

## Stap 1: Verzamel alle run data

### 1a. Inngest MCP (lokaal dev)
De Inngest dev server draait op `http://localhost:8288` en heeft een MCP endpoint op `/mcp`.

**Initialiseer een sessie:**
```json
POST http://localhost:8288/mcp
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"debug","version":"1.0"}}}
```
Sla de `Mcp-Session-Id` header op uit de response.

**Haal run status op:**
```json
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_run_status","arguments":{"runId":"<RUN_ID>"}}}
```

**Haal event details op:**
```
GET http://localhost:8288/v1/events/<EVENT_ID>
GET http://localhost:8288/v1/runs/<RUN_ID>
```

### 1b. App server logs
De app server schrijft naar `.tmp/server.log`. Lees alle log entries die horen bij het `conversationId` van de run:
- `REST bericht ontvangen` — bevestigt ontvangst en start
- `Transcriptie starten` / `Transcriptie voltooid` — confirmeert Groq Whisper
- `E-mail versturen` / `E-mail verstuurd` — bevestigt SendGrid delivery
- `REST pipeline voltooid` — eindstatus met `emailSent`, `emailTo`, `messageSent`, `intent`

Als een van deze log entries ontbreekt, is de pipeline vóór dat punt gestopt.

### 1c. Inngest dev server logs
Lees `.tmp/inngest.log` voor:
- `ERROR` entries — rate limits (429), timeouts, API fouten
- `inngest/function.finished` — bevestiging run beëindigd
- Timing tussen start en finish

## Stap 2: Analyseer de stappen

Maak een tijdlijn:
```
[tijdstip] [stap]              [status]  [opmerking]
11:40:55   run gestart         OK
11:40:56   classifier          OK        intent=transcribe_audio
11:41:20   transcriptie        OK        219 chars
11:42:00   rapport             OK / ERR  429? retry?
11:44:00   html converter      ?
11:44:35   e-mail versturen    ?         SendGrid response?
11:45:22   pipeline voltooid   OK
```

Let op de volgende patronen:

| Symptoom | Waarschijnlijke oorzaak |
|---|---|
| 429 in inngest.log | Anthropic/Groq rate limit — stap mislukt, Inngest retried |
| `emailSent: false` in pipeline voltooid log | E-mail stap niet bereikt of SendGrid fout |
| `E-mail versturen` log aanwezig, `E-mail verstuurd` ontbreekt | SendGrid API fout (key, sender verificatie) |
| Geen `Transcriptie voltooid` | Groq Whisper fout of audio URL onbereikbaar |
| `messageSent: false` bij REST channel | Normaal als `replyCallbackUrl` null is |
| Lege transcript | Audio stil of niet Nederlands |

## Stap 3: Voer de analyse tool uit

Gebruik `tools/analyze_run.ts` om automatisch een diagnose te genereren:

```bash
npx tsx tools/analyze_run.ts <RUN_ID> [SESSION_ID]
```

De tool:
1. Haalt run metadata op via Inngest API
2. Leest `.tmp/server.log` gefilterd op het conversationId
3. Leest `.tmp/inngest.log` voor errors
4. Stuurt alles naar Claude voor analyse
5. Schrijft een rapport naar `.tmp/debug_<RUN_ID>.md`

## Stap 4: Pas de fix toe

Na identificatie van de oorzaak:

1. Zoek het relevante bronbestand (`src/agents/`, `src/tools/`, `src/functions/`)
2. Pas de code aan
3. TypeScript check: `npm run typecheck`
4. Test opnieuw via MCP event inject
5. Bevestig via logs dat de fix werkt

## Stap 5: Update de workflow

Na succesvolle fix:
1. Voeg een notitie toe aan de relevante workflow in `workflows/` onder "Bekende valkuilen"
2. Beschrijf: symptoom, oorzaak, fix, hoe te herkennen in de toekomst

---

## Bekende valkuilen

### Rate limits (429)
- **Symptoom**: `error making inference request: unsuccessful status code: 429` in inngest.log
- **Oorzaak**: Anthropic Haiku/Sonnet API rate limit op dev tier
- **Inngest gedrag**: Automatische retry — run zal uiteindelijk slagen
- **Preventie**: Voeg `retries: 3` toe aan functies; gebruik Inngest rate limiting (`throttle`) om burst te voorkomen

### E-mail niet ontvangen / emailSent: false
- **Symptoom**: `emailSent: false` in pipeline voltooid log; `Inngest step error` + `ResponseError: Forbidden` (code 403) in server.log
- **Oorzaak 1**: SendGrid unverified sender — `EMAIL_FROM` adres is niet geverifieerd in SendGrid account
- **Oorzaak 2**: `SENDGRID_API_KEY` niet ingesteld → SendGrid geeft 403
- **Fix**: Ga naar SendGrid → Settings → Sender Authentication → Verify a Single Sender → voeg `EMAIL_FROM` adres toe. Of stel Domain Authentication in voor het domein.
- **Diagnose**: Kijk in server.log voor `Inngest step error` gevolgd door `ResponseError: Forbidden code: 403`. De errors array in de body bevat de specifieke boodschap (nu gelogd dankzij verbeterde foutafhandeling in `src/lib/email.ts`).
- **Let op**: `emailSent: true` in logs maar mail niet aangekomen → mogelijk spam/quarantaine; `emailSent: false` → SendGrid API fout vóór verzending

### Duplicate step ID "email" waarschuwing
- **Symptoom**: `Duplicate step ID "email" detected across parallel chains`
- **Oorzaak**: Agent-kit gebruikt de agent naam als step ID; bij meerdere re-executions ziet Inngest dit als parallel
- **Impact**: Geen — Inngest corrigeert automatisch via `AUTOMATIC_PARALLEL_INDEXING`
- **Status**: Pre-existing issue in agent-kit; niet oplosbaar zonder interne wijzigingen

### HTML truncatie in e-mail
- **Symptoom**: E-mail bevat incomplete HTML (afgesneden bij ~2000 chars)
- **Oorzaak**: Voorheen werd `htmlOutput` in de system prompt meegegeven aan het LLM dat het moest kopiëren
- **Fix (toegepast)**: `send_email` tool leest HTML direct uit state; LLM hoeft alleen `to` en `subject` mee te geven
