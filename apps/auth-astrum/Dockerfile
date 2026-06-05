FROM node:18-alpine

WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --filter @astrum/auth...
RUN pnpm --filter @astrum/auth build

EXPOSE 4580

ENV NODE_ENV=production

WORKDIR /app/apps/auth-astrum

CMD ["node", "dist/src/main.js"]