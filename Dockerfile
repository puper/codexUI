# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build

ARG PNPM_VERSION=10.25.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git make g++ python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm install -g "pnpm@${PNPM_VERSION}"

COPY package.json pnpm-lock.yaml ./
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile

COPY index.html tsconfig.json tsconfig.node.json tsconfig.server.json tsup.config.ts vite.config.ts vitest.config.ts ./
COPY public ./public
COPY documentation ./documentation
COPY src ./src

RUN pnpm run build

FROM node:22-bookworm-slim AS runtime

ARG CODEX_CLI_PACKAGE=@openai/codex@latest

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git openssh-client ripgrep bash tini \
  && rm -rf /var/lib/apt/lists/* \
  && if [ -n "$CODEX_CLI_PACKAGE" ]; then npm install -g "$CODEX_CLI_PACKAGE"; fi

WORKDIR /app

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-cli ./dist-cli

RUN mkdir -p /workspace /home/node/.codex /home/node/.cache \
  && chown -R node:node /workspace /home/node /app

USER node

ENV NODE_ENV=production
ENV CODEXUI_CODEX_COMMAND=codex
ENV CODEXUI_SANDBOX_MODE=workspace-write
ENV CODEXUI_APPROVAL_POLICY=on-request

EXPOSE 5900

WORKDIR /workspace

ENTRYPOINT ["tini", "--"]
CMD ["node", "/app/dist-cli/index.js", "--host", "0.0.0.0", "--port", "5900", "--no-open", "--no-login"]
