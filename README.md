# VIM Tower

[![Tests](https://github.com/JoelLewis/VIM-Tower/actions/workflows/test.yml/badge.svg)](https://github.com/JoelLewis/VIM-Tower/actions/workflows/test.yml)

A tower defense game controlled with Vim keybindings.

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run unit tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Run smoke tests
pnpm test:e2e:smoke

# Build for production
pnpm build
```

## Testing

- **Unit Tests**: Run with `pnpm test` (Vitest)
- **E2E Tests**: Run with `pnpm test:e2e` (Playwright on Chromium, Firefox, and WebKit)
- **Smoke Tests**: Run with `pnpm test:e2e:smoke` (Quick sanity checks)
