# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS deps
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --legacy-peer-deps

FROM node:24-bookworm-slim AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* variables are baked into the browser bundle at build time.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_OPERATOR_NAME
ARG NEXT_PUBLIC_CUSTOMER_SERVICE_EMAIL
ARG NEXT_PUBLIC_ICP_NUMBER
ARG NEXT_PUBLIC_PUBLIC_SECURITY_NUMBER

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_OPERATOR_NAME=$NEXT_PUBLIC_OPERATOR_NAME
ENV NEXT_PUBLIC_CUSTOMER_SERVICE_EMAIL=$NEXT_PUBLIC_CUSTOMER_SERVICE_EMAIL
ENV NEXT_PUBLIC_ICP_NUMBER=$NEXT_PUBLIC_ICP_NUMBER
ENV NEXT_PUBLIC_PUBLIC_SECURITY_NUMBER=$NEXT_PUBLIC_PUBLIC_SECURITY_NUMBER

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY next.config.ts tsconfig.json postcss.config.mjs ./
COPY questions.json mbti_final_cleaned.json ./
COPY public ./public
COPY content ./content
COPY src ./src

COPY scripts/deploy/prepare-runtime.mjs ./scripts/deploy/prepare-runtime.mjs
RUN --mount=type=cache,id=next-compile-v1,target=/app/.next/cache npx next build --webpack \
  && node scripts/deploy/prepare-runtime.mjs

FROM node:24-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# No development dependencies, build cache, source tree, or npm CLI required.
COPY --from=builder --chown=1001:1001 /app/.next/standalone/node_modules ./node_modules
COPY --from=builder --chown=1001:1001 /app/public ./public
COPY --from=builder --chown=1001:1001 /app/static/media ./.next/static/media
COPY --from=builder --chown=1001:1001 /app/static/chunks ./.next/static/chunks
COPY --from=builder --chown=1001:1001 /app/static/css ./.next/static/css
COPY --from=builder --chown=1001:1001 /app/server-chunks ./.next/server/chunks
COPY --from=builder --chown=1001:1001 /app/runtime ./
ARG RELEASE_SHA=local
ENV RELEASE_SHA=$RELEASE_SHA
LABEL org.opencontainers.image.revision=$RELEASE_SHA \
      org.opencontainers.image.source="https://github.com/oneand2/the-one"
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
