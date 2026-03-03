# Stage 0: Shared base
FROM node:20-alpine AS base
WORKDIR /app
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Stage 1: Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Development — inherits deps, mounts source at runtime via volume
FROM deps AS dev
ENV WATCHPACK_POLLING=true
CMD ["npm", "run", "dev"]

# Stage 3: Builder — compiles the production build
FROM deps AS builder
COPY . .
RUN npm run build

# Stage 4: Production runtime — copies only compiled output, no node_modules
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
CMD ["node", "server.js"]
