FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY server ./server
COPY config ./config
COPY public ./public
ENV HOST=0.0.0.0 PORT=3003
EXPOSE 3003
USER node
CMD ["node", "server/local.mjs"]
