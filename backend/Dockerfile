# ── Stage 1: Dependencies ───────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: Production image ───────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Create non-root user for security
RUN addgroup -S securevault && adduser -S securevault -G securevault

# Copy production dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY .env.example .env.example

# Create logs directory with correct permissions
RUN mkdir -p logs && chown -R securevault:securevault /app

USER securevault

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["node", "src/server.js"]
