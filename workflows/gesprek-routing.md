# Workflow: Gesprek Routing

## Doel

Bepaal de juiste pipeline op basis van de intent van het inkomende bericht.

## Intent classificatieregels

### transcribe_audio
Triggercondities (één van):
- Het bericht bevat een `mediaUrl` met een audiobestand
- `mediaContentType` bevat "audio"
- De berichttekst bevat woorden als "transcribeer", "verslag", "opname", "audio"

### schedule
Triggercondities (één van):
- De berichttekst bevat woorden als "afspraak", "inplannen", "agenda", "vergadering plannen"
- Gebruiker vraagt om een datum/tijd te reserveren

### chat
Triggercondities:
- Geen audio, geen planning-intent
- Gebruiker stelt een vraag, maakt een opmerking, of start een gesprek

### unknown
- Intent is onduidelijk
- Bericht is te kort om te classificeren (< 3 woorden)
- Buiten scope van alle bovenstaande intents

## Routeringspaden

```
intent = transcribe_audio
  └─► transcriptionAgent → reportAgent → htmlConverterAgent → emailAgent → messengerAgent

intent = schedule (pre-wired, workflow volgt)
  └─► schedulingAgent (nog niet geïmplementeerd)

intent = chat
  └─► messengerAgent (direct antwoord)

intent = unknown
  └─► messengerAgent (vraag om verduidelijking)
```

## Escalatiepad

Als de classifier `unknown` retourneert:
1. Messenger agent stuurt een vriendelijk bericht: "Ik begreep je bericht niet helemaal. Kun je het anders formuleren?"
2. De conversatie eindigt — geen verdere pipeline stappen

## Uitbreiden

Om een nieuwe intent toe te voegen:
1. Voeg toe aan `Intent` type in `src/types/state.ts`
2. Update de classifier system prompt in `src/agents/classifierAgent.ts`
3. Voeg een routercase toe in `src/networks/conversationNetwork.ts`
4. Maak de bijbehorende agent(en) en tools
5. Documenteer in deze workflow
