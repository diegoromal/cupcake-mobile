FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma.config.ts tsconfig*.json nest-cli.json ./
COPY prisma ./prisma
COPY src ./src
RUN npm run prisma:generate && npm run build && test -f dist/main.js

FROM base AS production-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && rm -rf node_modules/prisma node_modules/.bin/prisma && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=production-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --chown=node:node scripts ./scripts
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM build AS ops
ENV NODE_ENV=production
USER node
CMD ["npm", "run", "db:migrate:deploy"]
