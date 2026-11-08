FROM node:24.12.0-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
ENV CYPRESS_INSTALL_BINARY=0
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:24.12.0-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3001 DATABASE_PATH=/app/data/portal.sqlite UPLOAD_DIR=/app/uploads
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/contracts ./contracts
COPY --from=build --chown=node:node /app/scripts/deployment-queue.ts ./scripts/deployment-queue.ts
COPY --from=build --chown=node:node /app/package.json ./package.json
RUN mkdir -p data uploads && chown node:node data uploads
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","--import","tsx","server/start.ts"]
