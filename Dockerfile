# Development Dockerfile
FROM node:20-bullseye

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
