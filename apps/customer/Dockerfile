FROM node:20-alpine

WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages

ARG API_GATEWAY_INTERNAL_URL=http://astrum-api:3580
ENV API_GATEWAY_INTERNAL_URL=$API_GATEWAY_INTERNAL_URL

RUN pnpm install --filter @astrum/customer...
RUN pnpm --filter @astrum/customer build

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@astrum/customer", "start"]