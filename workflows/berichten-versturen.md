# Workflow: Berichten Versturen

## Doel

Stuur berichten terug naar de gebruiker via het juiste kanaal (WhatsApp of REST).

## Kanaalregels

### WhatsApp (via Twilio)

**Tekenlimiet**: 1600 tekens per bericht (Twilio limiet)
- De `send_whatsapp` tool knipt automatisch bij 1600 tekens
- Voor langere content: splits in meerdere berichten

**Formaat**:
- Geen HTML — platte tekst
- Geen markdown (niet zichtbaar in WhatsApp)
- Gebruik newlines voor structuur
- Emoji zijn toegestaan voor visuele scheiding

**Sender ID**: Altijd `TWILIO_WHATSAPP_NUMBER` (sandbox of productienummer)

**Twilio WhatsApp sandbox**:
- Ontvangers moeten de sandbox activeren door te sturen naar het Twilio sandbox nummer
- Bericht: "join [jouw-sandbox-code]"
- Zie: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn

### REST API

**Format**: JSON via POST naar `replyCallbackUrl`
```json
{ "message": "string" }
```

**Foutafhandeling**:
- Als de callback URL niet bereikbaar is: `step.run()` zorgt voor automatische retry
- Na 3 mislukte pogingen: log de fout via `system/error.unhandled` event

## Retrybeleid

Alle verzendtools zijn gewikkeld in `step.run()`:
- Automatische retry bij netwerk/API fouten
- Memoïsatie: als de stap succesvol was, wordt hij niet opnieuw uitgevoerd bij een volgende retry
- Twilio duplicaatbeveiliging: gebruik `messageSid` als idempotency key

## Berichtinhoud richtlijnen

**Bevestigingsbericht** (na rapport):
- Kort en vriendelijk
- Vermeldt dat het verslag per e-mail is verstuurd
- Max 3 zinnen

**Chatantwoord**:
- Directe, behulpzame toon
- Geen onnodige intro's ("Zeker!" / "Natuurlijk!")
- Antwoord in dezelfde taal als de gebruiker

**Foutbericht aan gebruiker**:
- Geen technische details
- "Er is iets misgegaan. Probeer het opnieuw of stuur een nieuw bericht."
