import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: isCI,
	retries: isCI ? 2 : 0,
	workers: isCI ? 1 : undefined,
	reporter: isCI
		? [
				['github'],
				['html', { outputFolder: 'playwright-report', open: 'never' }]
			]
		: [['html', { outputFolder: 'playwright-report', open: 'on-failure' }]],
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'retain-on-failure'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] }
		},
		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'] }
		}
	],
	webServer: {
		command: 'npm run preview',
		url: 'http://localhost:4173',
		reuseExistingServer: !process.env.CI
	}
});
