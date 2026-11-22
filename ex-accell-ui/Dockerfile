FROM node:26-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Prune dev dependencies
RUN npm ci --omit=dev

FROM node:26-slim

# The runtime stage never runs as root: the node user (uid/gid 1000) from the base image serves the
# app. It needs to write /app/.jupyter (the Jupyter launch state, src/lib/server/jupyterRuntime.ts)
# and, at run time, /tmp (world-writable) and the bind-mounted /data/ipfs and /data/packages volumes,
# which compose's ui-init one-shot step hands to this user (docs-site/guide/deployment.md).
WORKDIR /app
COPY --from=builder --chown=node:node /app/build ./build
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./
RUN chown node:node /app

EXPOSE 3000
ENV PORT=3000
ENV HOST=0.0.0.0

USER node

CMD ["node", "build"]
