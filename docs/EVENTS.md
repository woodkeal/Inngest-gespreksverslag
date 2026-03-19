# Event Catalog

Alle events volgen de naamgevingsconventie `domain/entity.verb`.

## message/whatsapp.received

Getriggerd door de Twilio WhatsApp webhook.

```typescript
{
  from: string;              // E.164, bijv. "whatsapp:+31612345678"
  to: string;                // Twilio nummer
  body: string;              // Berichttekst
  messageSid: string;        // Twilio unieke bericht-ID
  conversationId: string;    // Zelfde als `from` — gebruikt als HITL filter key
  mediaUrl?: string;         // URL van bijgevoegd mediabestand (audio, foto, etc.)
  mediaContentType?: string; // MIME type, bijv. "audio/ogg"
}
```

**HITL gebruik**: Dit event wordt ook gebruikt als reply-event in `step.waitForEvent`.
Het filter `event.data.from == "${conversationId}"` discrimineert gesprekken.

## message/rest.received

Getriggerd door `POST /api/messages`.

```typescript
{
  sessionId: string;          // Unieke sessie-ID van de aanroeper
  content: string;            // Berichttekst
  replyCallbackUrl?: string;  // URL om het antwoord naar te sturen
  mediaUrl?: string;
  mediaContentType?: string;
}
```

## message/whatsapp.send

Intern event voor WhatsApp verzending (optioneel, niet vereist voor huidige flow).

```typescript
{
  to: string;
  body: string;
  conversationId: string;
}
```

## message/rest.send

Intern event voor REST callback (optioneel).

```typescript
{
  sessionId: string;
  body: string;
  replyCallbackUrl: string;
}
```

## report/email.sent

Getriggerd nadat een rapport per e-mail is verstuurd.

```typescript
{
  conversationId: string;
  toEmail: string;
  subject: string;
}
```

## system/error.unhandled

Getriggerd bij onverwachte fouten.

```typescript
{
  conversationId?: string;
  error: string;
  stack?: string;
  source: string;  // naam van de function/component waar de fout optrad
}
```
