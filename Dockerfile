# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS deps
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

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
COPY next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs ./
COPY questions.json mbti_final_cleaned.json ./
COPY public ./public
COPY content ./content
COPY src ./src

RUN npx next build --webpack

FROM node:24-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

USER nextjs

EXPOSE 3000

CMD ["npm", "run", "start"]
