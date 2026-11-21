# syntax=docker/dockerfile:1

# Backend image: Express API (ESM) for the Telco Churn MERN app.
# Plain Node.js service with no build step; ships runtime dependencies only.

FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000

# Install dependencies first for Docker layer caching (lockfile = reproducible).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Application source (tests / dev deps are not shipped in the image).
COPY src ./src

# Run as the unprivileged user that ships with the base image.
USER node

EXPOSE 4000

# Liveness probe uses Node's built-in fetch (no curl in alpine).
# /api/health is public (no auth), so this works without a token.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]