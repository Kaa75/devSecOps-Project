# ---- deps stage ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts

# ---- runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app
RUN npm install -g npm@latest

# Non-root user (node uid=1000 is built into the node image)
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/

ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["node", "src/index.js"]
