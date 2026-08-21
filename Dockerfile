FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY tsconfig.json ./
COPY src/ src/
COPY seed.py ./

# Create data directory and copy seed database
RUN mkdir -p /app/data
COPY flashcards.db /app/data/flashcards.db

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
