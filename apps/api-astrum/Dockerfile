FROM node:18-alpine

WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --filter @astrum/api...
RUN pnpm --filter @astrum/api build

EXPOSE 3580

ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@astrum/api", "start:prod"]
