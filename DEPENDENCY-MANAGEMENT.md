# Dependency Management

This document defines the rules for adding, updating, and removing packages in this project. Follow these rules every time you touch `package.json`.

---

## Rule 1: Always Use the Latest Stable Version

When adding or updating a package, install the current latest stable release — not an older pinned version, not a beta, not whatever happened to resolve first.

```bash
npm install package-name@latest
```

Use `^x.y.z` semver ranges so patch and minor updates apply automatically on install, but major bumps require an intentional upgrade. After installing, run `npm run build` and `npm run typecheck` to confirm nothing broke.

**Why:** Older versions carry known CVEs, deprecated APIs, and peer-dependency conflicts (see: the `openai@4 + zod@4` conflict we already fixed). Staying current is cheaper than catching up later.

---

## Rule 2: Prefer Existing Dependencies

Before reaching for a new package, check whether something already in `package.json` can do the job:

| Need | Existing option |
|------|----------------|
| Schema validation | `zod` |
| HTTP requests | Node built-in `fetch` |
| AI / LLM calls | `@anthropic-ai/sdk` (Claude) or `openai` (Groq/Whisper) |
| Workflow orchestration | `inngest` + `@inngest/agent-kit` |
| WhatsApp messaging | `twilio` |
| Email delivery | `@sendgrid/mail` |
| Env vars | `dotenv` |
| Logging | `src/lib/logger.ts` (internal) |

If an existing package covers 80% of what you need, use it. Only add a new package when the gap is real and significant.

---

## Rule 3: Pre-Addition Checklist

Before adding any new package, verify all of the following. If any item fails, find an alternative or solve the problem without the package.

### Maintenance
- [ ] Last publish on npm was within the last **6 months**
- [ ] The GitHub repository is active (recent commits, open issues being responded to)
- [ ] The package has a clear owner or organization backing it (not abandoned personal projects)
- [ ] Major version is stable (not stuck at `0.x` with breaking changes every release)

### License
- [ ] License is permissive: MIT, Apache-2.0, BSD-2/3, ISC, or similar
- [ ] Not GPL/AGPL (copyleft — incompatible with commercial use without careful review)
- [ ] License is clearly stated in `package.json` and the repository

### Security
- [ ] Run `npm audit` after installing — zero high/critical vulnerabilities
- [ ] Check the package's CVE history on [osv.dev](https://osv.dev) or [snyk.io](https://snyk.io/vuln)
- [ ] No history of supply-chain incidents (typosquatting, malicious publishes, compromised maintainer accounts)
- [ ] The package does not request excessive permissions (filesystem, network) beyond its stated purpose

### Relevance in 2026
- [ ] The package solves a problem that still exists (not a polyfill for something Node/browsers now handle natively)
- [ ] It is not superseded by a better-maintained alternative
- [ ] It works with Node.js 22 and ES modules (`"type": "module"`)
- [ ] It is compatible with `zod@^4` if it uses zod internally

### Size & Quality
- [ ] Bundle size is proportionate to the value it provides (check [bundlephobia.com](https://bundlephobia.com))
- [ ] The package has TypeScript types (built-in or via `@types/`)
- [ ] Weekly downloads on npm are in the thousands or more (signals ecosystem trust)

---

## Rule 4: Remove Unused Dependencies Promptly

Dead dependencies cause version conflicts, slow installs, and expand the attack surface. When you remove a feature or refactor code that used a package:

1. Remove the import from source files
2. Run `npm run build` to confirm no remaining references
3. Remove from `package.json`:
   ```bash
   npm uninstall package-name
   ```
4. Commit `package.json` and `package-lock.json` together

To audit for unused packages periodically:
```bash
npx depcheck
```

---

## Current Dependencies

### Runtime (`dependencies`)

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@anthropic-ai/sdk` | `^0.39.0` | Claude API (report generation, routing) | Keep on latest |
| `@inngest/agent-kit` | `^0.13.2` | Agent network orchestration | Core framework |
| `@sendgrid/mail` | `^8.1.6` | Email delivery | Keep on latest |
| `dotenv` | `^17.3.1` | Environment variable loading | Keep on latest |
| `inngest` | `^4.0.1` | Durable workflow orchestration | Core framework |
| `openai` | `^6.32.0` | Groq Whisper transcription via OpenAI-compatible API | v6+ required for zod v4 compat |
| `twilio` | `^5.13.0` | WhatsApp messaging | Keep on latest |
| `zod` | `^4.0.0` | Schema validation throughout | All new schemas use v4 syntax |

### Dev (`devDependencies`)

| Package | Version | Purpose |
|---------|---------|---------|
| `@types/node` | `^20.0.0` | Node.js type definitions |
| `tsx` | `^4.21.0` | TypeScript execution for dev server |
| `typescript` | `^5.4.0` | Type checking and compilation |

---

## Upgrade Process

When upgrading an existing package to a new major version:

1. Read the migration guide / changelog for breaking changes
2. Update `package.json` and run `npm install`
3. Run `npm run typecheck` — fix all type errors before proceeding
4. Run `npm run build` — confirm clean compilation
5. Start the server and test all affected endpoints
6. Commit `package.json` and `package-lock.json` with a clear message explaining why the upgrade was needed

Example: upgrading `openai` from v4 → v6 fixed the `zod@^3 vs zod@^4` peer-dependency conflict that required `--legacy-peer-deps`.
