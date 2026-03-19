# Agents

## Overzicht

| Agent | Model | Taak | Schrijft naar state |
|---|---|---|---|
| `classifier` | claude-haiku-4-5-20251001 | Intent classificeren | `intent` |
| `transcription` | — (tool-only) | Whisper aanroepen | `transcript` |
| `report` | claude-sonnet-4-6 | Gestructureerd rapport genereren | `report` |
| `html_converter` | claude-haiku-4-5-20251001 | Rapport JSON → semantische HTML | `htmlOutput` |
| `email` | claude-haiku-4-5-20251001 | E-mailadres opvragen + rapport versturen | `emailSent`, `userEmail` |
| `messenger` | claude-haiku-4-5-20251001 | WhatsApp bevestiging / chat antwoord | `messageSent` |

---

## classifierAgent

**Doel**: Bepaalt de intent van het inkomende bericht zodat de router weet welke pipeline te starten.

**Model**: `claude-haiku-4-5-20251001` — snelle, goedkope classificatie.

**Herkende intents**:
- `transcribe_audio` — audiobestand aanwezig of gebruiker vraagt om transcriptie
- `schedule` — afspraken plannen (pre-wired, workflow volgt)
- `chat` — algemeen gesprek / vragen
- `unknown` — onduidelijk of buiten scope

**Tool**: `set_intent` — slaat de intent op in `state.data.intent`

**tool_choice**: `"set_intent"` — forceert altijd een tool call (geen losse tekst output)

---

## transcriptionAgent

**Doel**: Roept OpenAI Whisper aan om audio te transcriberen naar tekst.

**Model**: Geen eigen LLM-aanroep — de agent dispatcht direct de `transcribe_audio` tool.

**Tool**: `transcribe_audio` — download audio, stuur naar Whisper, sla op in `state.data.transcript`

**tool_choice**: `"transcribe_audio"` — altijd forced

**Noot**: De `audioUrl` komt uit `state.data.mediaUrl`, ingebracht via het systeem-prompt.

---

## reportAgent

**Doel**: Transformeert de transcriptie naar een gestructureerd gespreksverslag met 4 secties.

**Model**: `claude-sonnet-4-6` — meer redenering nodig voor kwaliteitsrapportage.

**Rapport structuur** (`ReportStructure`):
```typescript
{
  samenvatting: string;        // 2-5 zinnen
  actiepunten: ActionItem[];   // {beschrijving, eigenaar, deadline}
  besluiten: string[];         // expliciete besluiten
  sprekers: Speaker[];         // {label, statements[]}
  metadata: {
    duur: string | null;
    taal: string;              // "nl" | "en" | "mixed"
    generatedAt: string;       // ISO timestamp
  }
}
```

**Tool**: `save_report` — valideert en slaat het rapport op in `state.data.report`

**tool_choice**: `"save_report"` — altijd forced

---

## htmlConverterAgent

**Doel**: Converteert het rapport JSON naar een professionele, semantische HTML-pagina.

**Model**: `claude-haiku-4-5-20251001` — structurele transformatie, geen diep redeneren nodig.

**Output**: Volledige HTML-pagina met inline CSS, semantische elementen, Nederlandse kopjes.

**Tool**: `save_html` — slaat de HTML op in `state.data.htmlOutput`

---

## emailAgent

**Doel**: Vraagt het e-mailadres op (HITL) en verstuurt het HTML-rapport.

**Model**: `claude-haiku-4-5-20251001`

**HITL flow**:
1. Als `state.data.userEmail` null is → roept `ask_follow_up` aan
2. `ask_follow_up` stuurt de vraag via WhatsApp en pauzeert de pipeline
3. Na ontvangst van het antwoord → `send_email` met het opgegeven adres

**Tools**: `ask_follow_up`, `send_email`

---

## messengerAgent

**Doel**: Stuurt een bevestiging of chatantwoord terug naar de gebruiker.

**Model**: `claude-haiku-4-5-20251001`

**Kanaal-bewust**: Kiest automatisch `send_whatsapp` (WhatsApp) of `send_rest_response` (REST) op basis van `state.data.channel`.

**Tools**: `send_whatsapp`, `send_rest_response`
