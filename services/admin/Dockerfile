# Stage 1: install production dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

# Stage 2: runtime image
FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk upgrade --no-cache && npm install -g npm@latest

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src/ ./src/
COPY package.json ./

EXPOSE 3004
USER node
CMD ["node", "src/index.js"]
