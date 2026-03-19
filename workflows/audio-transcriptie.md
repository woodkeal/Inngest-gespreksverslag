# Workflow: Audio Transcriptie

## Doel

Ontvang een audiobestand via WhatsApp of REST API en transcribeer het naar tekst via OpenAI Whisper.

## Vereiste inputs

- `mediaUrl`: De URL van het audiobestand (van Twilio of REST caller)
- `conversationId`: Voor terugkoppeling aan de gebruiker
- `channel`: "whatsapp" of "rest"

## Stappen

1. **Classifier** detecteert `intent = "transcribe_audio"` (aanwezig mediaUrl of gebruiker vraagt om transcriptie)
2. **TranscriptionAgent** roept de `transcribe_audio` tool aan met de `mediaUrl` uit state
3. Tool downloadt het audiobestand als buffer
4. Tool stuurt naar OpenAI Whisper (`whisper-1`, taal: `nl`)
5. Transcriptie wordt opgeslagen in `state.data.transcript`
6. Pipeline gaat verder naar rapport-generatie

## Edge cases

### Geen mediaUrl

Als `mediaUrl` null is maar de intent wel `transcribe_audio`:
- Messenger agent stuurt een verzoek om audio op te sturen
- Pipeline stopt (geen transcript, geen rapport)

### Whisper geeft lege transcriptie

- Tool retourneert `"Transcriptie mislukt"` als string
- `state.transcript` wordt toch gezet — rapport agent moet hier graceful mee omgaan
- Rapport agent zal aangeven dat de transcriptie onleesbaar was

### Ondersteunde audioformaten

Whisper ondersteunt: mp3, mp4, mpeg, mpga, m4a, wav, webm, ogg
Twilio verstuurt audio doorgaans als `audio/ogg; codecs=opus`

### Rate limits

- OpenAI Whisper: 50 requests/minuut (gratis tier)
- Bij rate limit: Inngest automatische retry met exponential backoff
- `step.run()` memoiseert het resultaat — Whisper wordt niet opnieuw aangeroepen bij retry

## Kwaliteitsnorm

- Minimale transcriptie: 10 woorden (anders waarschuw in rapport)
- Taal detectie: Whisper retourneert altijd de herkende taal — sla op in rapport metadata
