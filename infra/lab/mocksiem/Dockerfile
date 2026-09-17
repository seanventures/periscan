FROM node:22-alpine
WORKDIR /app
COPY server.mjs ./
ENV PORT=9200
EXPOSE 9200
USER node
CMD ["node", "server.mjs"]
