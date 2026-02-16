# Stage 1: Build
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.base.json tsconfig.json ./
COPY packages/ packages/
RUN npm run build

# Stage 2: Frontend assets
FROM node:20-slim AS frontend
WORKDIR /app
COPY --from=build /app .
RUN npx vite build packages/app --outDir /app/dist-app

# Stage 3: Production
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/packages/ packages/
COPY --from=frontend /app/dist-app/ dist-app/
COPY data/ data/

EXPOSE 4444
CMD ["node", "--import", "tsx", "packages/server/src/index.ts"]
