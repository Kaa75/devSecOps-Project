# ---- deps stage ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

# ---- runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/

EXPOSE 3003
USER node
CMD ["node", "src/index.js"]
