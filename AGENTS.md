# VIM Tower - Agent Guidelines

## Testing

### Running Tests

```bash
# Unit tests (Vitest)
pnpm test

# E2E tests (Playwright - all browsers)
pnpm test:e2e

# E2E tests with UI mode
pnpm test:e2e:ui

# Smoke tests only
pnpm test:e2e:smoke
```

### Test Mode

The game supports a `testMode` flag that enables 10x speed multiplier for faster E2E test execution. Enable via URL parameter:

```
http://localhost:4173/?testMode=true
```

## Debugging Failed E2E Tests

### Viewing Trace Files

When tests fail, Playwright captures trace files that include:
- Screenshots at each step
- DOM snapshots
- Network requests
- Console logs

**To view traces locally:**

```bash
# After a failed test run, traces are saved in test-results/
pnpm exec playwright show-trace test-results/<test-folder>/trace.zip
```

**To view traces from CI:**

1. Download the `test-artifacts-<browser>` artifact from the failed GitHub Actions run
2. Extract the artifact
3. Run: `pnpm exec playwright show-trace <path-to-trace.zip>`

### Viewing HTML Reports

**Locally:**
```bash
# Open the HTML report after running tests
pnpm exec playwright show-report playwright-report
```

**From CI:**
1. Download the `playwright-report-<browser>` artifact
2. Extract and open `index.html` in a browser

### Debugging Strategies

1. **Use UI mode for interactive debugging:**
   ```bash
   pnpm test:e2e:ui
   ```

2. **Run a specific test file:**
   ```bash
   pnpm test:e2e tests/e2e/smoke.spec.ts
   ```

3. **Run a specific test by name:**
   ```bash
   pnpm test:e2e -g "test name pattern"
   ```

4. **Debug mode with browser DevTools:**
   ```bash
   pnpm exec playwright test --debug
   ```

5. **Headed mode to see browser:**
   ```bash
   pnpm exec playwright test --headed
   ```

### CI Reporter Output

In CI, the `github` reporter provides:
- Collapsible test output in GitHub Actions logs
- Inline annotations on PR diffs for failed tests
- Direct links to failing lines in test files

## Build and Lint

```bash
# Build
pnpm build

# Lint
pnpm lint

# Type check
pnpm check
```
