FROM oven/bun:1.2

ARG TRANSLATE_BACKEND_REF=main

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN git clone --depth 1 --branch "${TRANSLATE_BACKEND_REF}" \
  https://github.com/FOSWLY/translate-backend.git .

RUN bun install

ENV SERVICE_PORT=3313

EXPOSE 3313

CMD ["bun", "run", "start"]
