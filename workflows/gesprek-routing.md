# Workflow: Gesprek Routing

## Doel

Bepaal de juiste pipeline op basis van de intent van het inkomende bericht en dispatch via `step.invoke`.

## Architectuur (twee lagen)

```
Laag 1: Dispatcher (handleWhatsApp / handleRestMessage)
  ├─ step.run("send-ack")        — directe bevestiging voor audio
  ├─ classifyIntent()            — deterministische TypeScript functie
  └─ step.invoke → sub-pipeline — op basis van intent

Laag 2: Sub-pipelines
  ├─ transcribeAudioPipeline    — trigger: pipeline/transcribe-audio.start
  ├─ chatPipeline               — trigger: pipeline/chat.start
  └─ handleTest                 — trigger: test/invoked (via step.invoke)
```

## Intent classificatieregels

Classificatie gebeurt deterministisch in `src/lib/classifier.ts` — geen LLM nodig.

### transcribe_audio
- `mediaUrl` is niet null → altijd `transcribe_audio`

### testing
- Berichttekst bevat "test" (hoofdletterongevoelig)

### chat
- Geen mediaUrl, geen "test", berichttekst ≥ 3 tekens

### unknown
- Geen van bovenstaande (te kort, leeg bericht)

## Routeringspaden

```
intent = transcribe_audio
  └─► transcribeAudioPipeline
        └─► step.run(transcribeAudio) → reportAgent → htmlConverterAgent
              → emailAgent → messengerAgent

intent = testing
  └─► handleTest (step.invoke)

intent = chat | unknown
  └─► chatPipeline
        └─► messengerAgent (direct antwoord of verduidelijking)
```

## Event namen

| Event | Gepubliceerd door | Ontvangen door |
|-------|-------------------|----------------|
| `message/whatsapp.received` | Twilio webhook | `handleWhatsApp` |
| `message/rest.received` | `/api/messages` endpoint | `handleRestMessage` |
| `pipeline/transcribe-audio.start` | `handleWhatsApp` / `handleRestMessage` via step.invoke | `transcribeAudioPipeline` |
| `pipeline/chat.start` | `handleWhatsApp` / `handleRestMessage` via step.invoke | `chatPipeline` |
| `test/invoked` | Dispatcher via step.invoke | `handleTest` |
| `conversation/cancel` | `/api/conversations/:id/cancel` endpoint | `transcribeAudioPipeline`, `chatPipeline` |

## Uitbreiden

Om een nieuwe intent toe te voegen:
1. Voeg toe aan `Intent` type in `src/types/state.ts`
2. Voeg een regel toe in `classifyIntent()` in `src/lib/classifier.ts`
3. Maak een nieuwe `xxxPipeline` functie in `src/functions/`
4. Voeg een `step.invoke` case toe in `handleWhatsApp.ts` en `handleRestMessage.ts`
5. Registreer netwerk + functie in `src/server.ts`
6. Documenteer in dit bestand

Zie `workflows/wat-layer-guide.md` voor de volledige architectuurreferentie.
