# Workflow: Audio Transcriptie

## Doel

Ontvang een audiobestand via WhatsApp of REST API, transcribeer het naar tekst via OpenAI Whisper, genereer een gestructureerd rapport en stuur het per e-mail.

## Vereiste inputs

- `mediaUrl`: De URL van het audiobestand (van Twilio of REST caller)
- `conversationId`: Voor terugkoppeling aan de gebruiker
- `channel`: "whatsapp" of "rest"
- `userEmail` (optioneel): E-mailadres voor rapportbezorging (kan ook via HITL worden gevraagd)

## Stappen

1. **Dispatcher** (`handleWhatsApp` / `handleRestMessage`) detecteert `intent = "transcribe_audio"` via `classifyIntent()` (aanwezig `mediaUrl`)
2. **Dispatcher** stuurt directe ACK-bevestiging aan de gebruiker via `step.run("send-ack")`
3. **Dispatcher** start `transcribeAudioPipeline` via `step.invoke`
4. **`transcribeAudioPipeline`** roept `step.run("transcribe-audio", doTranscribeAudio)` aan:
   - Downloadt het audiobestand (met Twilio Basic Auth indien nodig)
   - Detecteert audioformaat via URL-extensie en Content-Type header
   - Stuurt naar OpenAI Whisper (`whisper-1`, taal: `nl`)
   - Resultaat wordt opgeslagen in `state.data.transcript`
5. **`transcribeAudioNetwork`** runt de agent-pipeline:
   - `reportAgent` → genereert gestructureerd rapport (samenvatting, actiepunten, sprekers)
   - `htmlConverterAgent` → converteert rapport naar HTML e-mailtemplate
   - `emailAgent` → verstuurt e-mail (vraagt via HITL om e-mailadres als het ontbreekt)
   - `messengerAgent` → stuurt WhatsApp/REST bevestiging

## Transcriptie provider

**OpenAI Whisper** (`whisper-1`) via `src/lib/openai.ts`.
- API key: `OPENAI_API_KEY`
- Functie: `doTranscribeAudio(audioUrl, conversationId)` in `src/tools/transcribeAudio.ts`
- Stap-ID roteert per retry-poging: `"transcribe-audio"`, `"transcribe-audio-retry-1"`, etc.

## Foutafhandeling

### Niet-herstelbare fouten (NonRetriableError)
Bij HTTP-fouten bij het downloaden van audio (bijv. 403, 404) wordt `NonRetriableError` gegooid. Inngest stopt direct en roept de `onFailure` handler aan die de gebruiker informeert.

### Herstelbare fouten (errorHandlerAgent)
Bij transcriptiefouten (netwerk, rate limit) wordt `state.failedStep = "transcription"` gezet. De `transcribeAudioNetwork` runt `errorHandlerAgent` → `messengerAgent`. De `errorHandlerAgent` beslist of er een retry plaatsvindt.

### Geen mediaUrl
Als de dispatcher `transcribe_audio` detecteert maar `mediaUrl` is null (kan niet voorkomen in de huidige flow — de classifier controleert `mediaUrl !== null`) → pipeline start niet.

### Whisper lege transcriptie
Tool retourneert `"(geen spraak gedetecteerd)"` als string. De `reportAgent` verwerkt dit graceful.

## Ondersteunde audioformaten

Whisper ondersteunt: mp3, mp4, mpeg, mpga, m4a, wav, webm, ogg, flac, opus
Twilio verstuurt audio doorgaans als `audio/ogg; codecs=opus`

## Concurrency en cancellatie

- `transcribeAudioPipeline` heeft `concurrency: { key: "event.data.conversationId", limit: 1 }` — één actieve run per gebruiker
- Cancelleer een lopende pipeline via: `POST /api/conversations/:conversationId/cancel`
- Beëindigt de functierun via `cancelOn: [{ event: "conversation/cancel", match: "data.conversationId" }]`

## HITL: E-mailadres ontbreekt

Als `userEmail` null is, pauzeert de `emailAgent` via `askFollowUp` tool:
1. Stuurt een WhatsApp-vraag: "Op welk e-mailadres wil je het verslag ontvangen?"
2. Wacht tot 30 minuten op antwoord via `step.waitForEvent`
3. Bij timeout: pipeline stopt, gebruiker wordt geïnformeerd
4. Bij antwoord: pipeline hervat met het opgegeven e-mailadres

## Kwaliteitsnorm

- Minimale transcriptie: 10 woorden (anders waarschuw in rapport)
- Taaldetectie: Whisper transcribeert altijd in `nl` (geforceerd via `language: "nl"`)
