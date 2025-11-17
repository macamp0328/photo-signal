# Development Dockerfile
FROM node:20-bookworm

# Install GitHub CLI plus audio tooling (ffmpeg, Python, yt-dlp)
RUN apt-get update && \
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && \
    apt-get install -y --no-install-recommends gh ffmpeg python3 python3-pip python3-venv && \
    pip3 install --no-cache-dir yt-dlp mutagen && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Default command
CMD ["npm", "run", "dev", "--", "--host"]
