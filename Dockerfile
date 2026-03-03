# Stage 0: Base — shared foundation for all stages
FROM node:20-alpine AS base
WORKDIR /app
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Stage 1: Install dependencies (reused by dev and builder)
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Development with hot reloading
FROM deps AS dev
ENV WATCHPACK_POLLING=true
CMD ["npm", "run", "dev"]

# Stage 3: Build the application
FROM deps AS builder
COPY . .
RUN npm run build

# Stage 4: Production runtime
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
CMD ["node", "server.js"]
