# Stage 1: install production dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

# Stage 2: runtime image
FROM node:20-alpine AS runtime
WORKDIR /app
RUN npm install -g npm@latest

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/

EXPOSE 3001
USER node
CMD ["node", "src/index.js"]
