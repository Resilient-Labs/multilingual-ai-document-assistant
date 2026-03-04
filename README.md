# Multilingual AI Document Assistant

## Testing

> **Note:** Running tests locally requires **Node.js 20**. This matches the version used inside the Docker container. Using a different version may cause unexpected test failures.

## Docker

### Development (with hot reloading)

```bash
docker compose --profile dev up
```

### Production

```bash
docker compose --profile prod up --build
```

### Bring down

```bash
docker compose --profile dev down
docker compose --profile prod down
```

### Rebuild after dependency changes

```bash
docker compose --profile dev down && docker compose --profile dev up --build
docker compose --profile prod down && docker compose --profile prod up --build
```
