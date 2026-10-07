# Deployment Guide

## Prerequisites
- Node.js 20+
- PostgreSQL database
- Docker (optional)
- Cloudinary, Stripe, SMTP credentials

## QuickBooks Online

Production needs these Vercel environment variables. The Intuit client secret stays on the server.

- `INTUIT_CLIENT_ID`
- `INTUIT_CLIENT_SECRET`
- `INTUIT_REDIRECT_URI` — `https://fixtray.app/api/shop/quickbooks/callback`
- `INTUIT_ENVIRONMENT` — `production` (or `sandbox` for a sandbox company)

## Steps
1. Clone repository
2. Set up .env file with production secrets
3. Run `npm install`
4. Run database migrations (`npx prisma migrate deploy`)
5. Build app: `npm run build`
6. Start server: `npm start`
7. (Optional) Build and run Docker container
8. Configure Nginx/SSL for production

## CI/CD
- See .github/workflows/ci.yml for pipeline
