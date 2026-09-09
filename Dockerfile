FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node public ./public
COPY --chown=node:node src ./src
COPY --chown=node:node data ./data
COPY --chown=node:node assets ./assets

ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1

CMD ["npm", "start"]
