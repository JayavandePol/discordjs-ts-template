# syntax=docker/dockerfile:1

# ---- Build: compile TypeScript ----
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---- Runtime: production dependencies + compiled output only ----
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
# Migrations are applied automatically on startup
COPY drizzle ./drizzle

# SQLite lives in /app/data by default; mount a volume to keep it across deploys
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME ["/app/data"]

USER node
CMD ["node", "--enable-source-maps", "dist/index.js"]
