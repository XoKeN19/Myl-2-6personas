FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build
FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=3001 DATA_DIR=/app/data
WORKDIR /app
COPY --from=build /app/dist/client ./dist/client
COPY server.mjs ./
COPY lib/game.mjs lib/effects.mjs ./lib/
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3001
CMD ["node", "server.mjs"]
