# ── Stage 1: Install dependencies ─────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Stage 2: Runtime image ─────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# Copy only production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src/ ./src/
COPY package.json ./

EXPOSE 3002

# Run as non-root node user
USER node

CMD ["node", "src/index.js"]
