# Campus XI Public Site (Astro)

Public site with these pages:

- `/privacy-policy`
- `/terms-of-use`
- `/install`
- `/help-center`
- `/report-bug`

## Run locally

```bash
npm install
npm run dev
```

## Email delivery setup (for Help Center + Report Bug forms)

1. Copy `.env.example` to `.env`.
2. Fill these values:

- `RESEND_API_KEY`
- `SUPPORT_TO_EMAIL`
- `SUPPORT_FROM_EMAIL`

Bug reports support up to 3 images (8MB each).
