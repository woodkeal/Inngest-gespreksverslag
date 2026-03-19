# Deployment

## Lokale ontwikkeling

### Vereisten
- Node.js 22+
- npm

### Instellen

```bash
# 1. Installeer dependencies
npm install

# 2. Kopieer .env.example naar .env en vul de keys in
cp .env.example .env
# Vul minimaal in voor lokaal testen:
# INNGEST_DEV=1, ANTHROPIC_API_KEY, OPENAI_API_KEY

# 3. Start de app server (terminal 1)
npm run dev

# 4. Start de Inngest dev server (terminal 2)
npm run dev:inngest
```

### Verificatie

- App server: `http://localhost:3000`
- Inngest dashboard: `http://localhost:8288`
- Health check: `curl http://localhost:3000/health`

Het Inngest dashboard toont alle geregistreerde functions. Klik "Invoke" om een test event te sturen.

### Twilio lokaal testen met ngrok

Twilio heeft een publiek toegankelijke URL nodig voor webhooks:

```bash
# Installeer ngrok (eenmalig)
npm install -g ngrok

# Maak een tunnel naar poort 3000
ngrok http 3000
```

Kopieer de HTTPS URL (bijv. `https://abc123.ngrok.io`) en:
1. Zet `PUBLIC_BASE_URL=https://abc123.ngrok.io` in `.env`
2. Configureer in Twilio Console → WhatsApp Sandbox → "When a message comes in":
   `https://abc123.ngrok.io/webhook/whatsapp`

## Productie

### Inngest Cloud

1. Maak een account aan op [inngest.com](https://inngest.com)
2. Maak een app aan en kopieer de keys
3. Zet in `.env` (of deployment environment):
   ```
   INNGEST_SIGNING_KEY=signkey_...
   INNGEST_EVENT_KEY=evt_...
   NODE_ENV=production
   INNGEST_DEV=   # verwijder of laat leeg
   ```

### Deploy vereisten

De server draait als een long-running Node.js process. Aanbevolen opties:
- **VPS met PM2**: `pm2 start npm -- start`
- **Docker**: Gebruik de `npm start` command als entrypoint
- **Railway / Render**: Automatische deploys via GitHub

### Environment variables productie

Alle keys uit `.env.example` zijn vereist voor productie. Zet ze als environment variables in je hosting platform — nooit committen naar git.
