# ==============================================================================
# Stage 1: Build Vite Frontend
# ==============================================================================
FROM node:18-alpine AS frontend-builder

WORKDIR /frontend

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files for Vite build
COPY src ./src
COPY index.html ./
COPY vite.config.js ./

# Build frontend (outputs to dist/)
RUN npm run build

# ==============================================================================
# Stage 2: Python Flask Backend with Built Frontend
# ==============================================================================
FROM python:3.11-alpine

# By default, listen on port 5000
EXPOSE 5000/tcp

# Set the working directory in the container
WORKDIR /app

# Copy Python dependencies and source
ADD newvelles_web /app/newvelles_web
ADD requirements.txt /app
ADD setup.py /app

# Install Python dependencies
RUN cd /app && python setup.py install

# Copy backend entrypoint
COPY run.py .

# Copy built frontend from stage 1
COPY --from=frontend-builder /frontend/dist /app/dist

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

# Specify the command to run on container start
CMD [ "python", "./run.py" ]
