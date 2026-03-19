# Workflow: Rapport Generatie

## Doel

Transformeer een ruwe transcriptie naar een gestructureerd, professioneel gespreksverslag in het Nederlands.

## Vereiste inputs

- `state.transcript`: De ruwe transcriptietekst
- `conversationId`: Voor identificatie

## Rapportschema

Het rapport bevat precies deze vier secties:

### 1. Samenvatting (`samenvatting`)
- 2-5 zinnen die de kern van het gesprek samenvatten
- Objectief, geen interpretatie
- Beginnen met "In dit gesprek..."

### 2. Actiepunten (`actiepunten`)
Concrete taken die voortvloeien uit het gesprek:
```
{
  beschrijving: string    // Wat moet er gebeuren?
  eigenaar: string | null // Wie is verantwoordelijk? (naam of rol)
  deadline: string | null // Wanneer? (ISO datum of relatief: "volgende week")
}
```

### 3. Besluiten (`besluiten`)
- Alleen expliciete, definitieve beslissingen
- Geen meningen of voorstellen
- Als er geen besluiten zijn: lege array

### 4. Sprekers (`sprekers`)
- Identificeer sprekers op basis van contextuele cues
- Gebruik "Spreker 1", "Spreker 2" als namen onbekend zijn
- Noteer alleen key uitspraken (niet elke zin)

## Kwaliteitsnorm

- Alle secties verplicht aanwezig (ook als leeg)
- Actiepunten zijn concreet en actiegericht (begin met werkwoord)
- Samenvatting is neutraal en feitelijk
- Taaldetectie: `nl` / `en` / `mixed`

## Edge cases

### Korte of onvolledige transcriptie
- Maak het beste rapport van de beschikbare informatie
- Noteer in samenvatting dat de transcriptie onvolledig leek

### Meerdere sprekers onduidelijk
- Gebruik "Deelnemer A", "Deelnemer B" als onderscheid niet mogelijk is
- Noteer dit in samenvatting

### Gevoelige informatie
- De agent parafaseert persoonsnamen niet tenzij ze expliciet in de transcriptie staan
- Geen interpretatie of aanname over wie wat bedoelt
