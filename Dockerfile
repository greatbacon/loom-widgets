FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

# Use another Node.js Alpine image for the final stage
FROM node:24-alpine
WORKDIR /app

RUN apk add --no-cache python3 py3-pip ffmpeg ca-certificates \
	&& python3 -m venv /opt/ytdlp-venv \
	&& /opt/ytdlp-venv/bin/pip install --no-cache-dir -U yt-dlp
ENV PATH="/opt/ytdlp-venv/bin:${PATH}"

COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .
ADD scripts scripts
ADD migrations migrations
EXPOSE 3000
ENV NODE_ENV=production
CMD [ "./scripts/init.sh" ]