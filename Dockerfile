# syntax=docker/dockerfile:1

# ---- deps: install node_modules ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---- builder: build Next standalone ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time env: Next.js inlines NEXT_PUBLIC_* values into the client bundle
# at build time, not read at runtime — must be present here, not just in the
# runner stage's env_file. Server-only vars (DATABASE_URL, SUPABASE_SERVICE_
# ROLE_KEY, etc.) are NOT needed at build time and stay out of the image.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
RUN npm run build

# ---- runner: minimal production image ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Next.js standalone server + assets (self-contained — includes its own
# trimmed node_modules, no `npm install` needed in this stage).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

RUN chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
