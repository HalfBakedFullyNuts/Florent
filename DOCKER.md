# Docker Setup

This document explains how to run the Infinite Conflict Turn-Based Strategy Simulator in Docker containers.

## Prerequisites

- Docker Desktop or Docker Engine installed and running
- Docker Compose (included with Docker Desktop)

## Quick Start

### Production Mode

Build and run the optimized production image:

```bash
# Build the production image
docker compose build app

# Start the production server
docker compose up app

# Or build and start in one command
docker compose up app --build

# Run in background (detached)
docker compose up app -d
```

Access the application at: http://localhost:3000

### Development Mode (with Hot Reload)

Run the development server with live code reloading:

```bash
# Build the dev image
docker compose build dev

# Start the development server
docker compose up dev

# Or build and start in one command
docker compose up dev --build
```

Changes to source files will automatically trigger a rebuild in the browser.

### Running Tests

```bash
# Run tests in a container
docker compose run --rm test

# Run tests with watch mode
docker compose run --rm test npm run test -- --watch
```

## Available Services

| Service | Description | Port |
|---------|-------------|------|
| `app` | Production build (optimized, standalone) | 3000 |
| `dev` | Development server with hot reload | 3000 |
| `test` | Test runner (exits after completion) | - |

## Docker Commands Reference

```bash
# Build all services
docker compose build

# Build specific service
docker compose build app

# Start services
docker compose up [service]

# Start in background
docker compose up -d [service]

# Stop services
docker compose down

# View logs
docker compose logs -f [service]

# Remove all containers and volumes
docker compose down -v

# Rebuild without cache
docker compose build --no-cache
```

## Architecture

### Production Image (Dockerfile)

The production Dockerfile uses a multi-stage build:

1. **deps stage**: Installs npm dependencies
2. **builder stage**: Builds the Next.js application with standalone output
3. **runner stage**: Minimal Alpine image with only production files

Benefits:
- Small image size (~150MB vs ~1GB)
- Runs as non-root user for security
- Includes health check for container orchestration

### Development Image (Dockerfile.dev)

Single-stage image optimized for development:
- Includes all devDependencies
- Volume mounts for source code (hot reload)
- Preserves node_modules in container

## Configuration

### Environment Variables

Pass environment variables via docker-compose or command line:

```bash
# Via command line
docker compose run -e MY_VAR=value app

# Via .env file (create from .env.example)
cp .env.example .env
docker compose up app
```

### Port Mapping

Default port is 3000. To change:

```bash
# Use different host port
docker compose run -p 8080:3000 app
```

Or modify `docker-compose.yml`:

```yaml
services:
  app:
    ports:
      - "8080:3000"
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs app

# Check if port is in use
lsof -i :3000
```

### Hot reload not working in dev mode

The `WATCHPACK_POLLING=true` environment variable is set for file system polling. If issues persist:

```bash
# Rebuild the dev container
docker compose down
docker compose build --no-cache dev
docker compose up dev
```

### Build fails

```bash
# Clean Docker cache
docker builder prune

# Remove all project containers and rebuild
docker compose down -v
docker compose build --no-cache
```

### Permission issues

The production container runs as non-root user `nextjs`. If you encounter permission issues:

```bash
# Check container user
docker compose exec app whoami

# For debugging, run as root temporarily
docker compose run --user root app sh
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Build Docker image
  run: docker compose build app

- name: Run tests
  run: docker compose run --rm test

- name: Push to registry
  run: |
    docker tag florent_app:latest myregistry/florent:${{ github.sha }}
    docker push myregistry/florent:${{ github.sha }}
```

## Notes for Other Tools/Agents

### Building the Image

```bash
docker compose build app
```

### Running the Container

```bash
docker compose up app -d
```

### Health Check

The production container includes a health check. Verify status:

```bash
docker compose ps
# or
docker inspect --format='{{.State.Health.Status}}' florent-app-1
```

### Required Files

The Docker setup depends on these files:
- `Dockerfile` - Production multi-stage build
- `Dockerfile.dev` - Development image
- `docker-compose.yml` - Service orchestration
- `.dockerignore` - Build context exclusions
- `next.config.js` - Must have `output: 'standalone'` for production build
