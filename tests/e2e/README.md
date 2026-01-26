# StepFever E2E Tests

Comprehensive end-to-end test suite for StepFever using Playwright.

## Test Structure

```
tests/e2e/
├── helpers/
│   ├── test-helpers.ts          # Reusable test utilities
│   └── navigation-helpers.ts    # Navigation utilities
├── 01-main-menu.spec.ts         # Main menu functionality
├── 02-song-select.spec.ts       # Song selection flow
├── 03-calibration.spec.ts       # Audio calibration
├── 04-gameplay.spec.ts          # Gameplay mechanics
├── 05-results.spec.ts           # Results screen
├── 07-state-persistence.spec.ts # LocalStorage & state
├── 08-error-handling.spec.ts    # Error scenarios
├── 09-url-routing.spec.ts       # URL routing & history
├── 10-accessibility.spec.ts     # Accessibility tests
├── 11-multiplayer-nav.spec.ts   # Multiplayer navigation
└── 12-user-journeys.spec.ts     # End-to-end user flows
```

## Running Tests

### Quick Start

```bash
# Run all E2E tests
bun test:e2e

# Run with UI mode (interactive, recommended for development)
bun test:e2e:ui

# Run in headed mode (see browser)
bun test:e2e:headed

# Debug specific test
bun test:e2e:debug

# View test report after run
bun test:e2e:report

# Generate new tests with codegen
bun test:e2e:codegen
```

### Running Specific Test Files

```bash
# Run only main menu tests
bunx playwright test 01-main-menu

# Run tests matching a pattern
bunx playwright test --grep "calibration"
```

### Running Specific Tests

```bash
# Run a specific test by name
bunx playwright test --grep "should persist player name"

# Run tests in a specific file
bunx playwright test tests/e2e/03-calibration.spec.ts
```

## Test Coverage

### 01. Main Menu
- Display and navigation
- Player name management
- XSS prevention
- State persistence
- Input validation

### 02. Song Select
- Song browsing from bundled index
- Keyboard navigation
- Difficulty selection
- Error handling
- XSS prevention
- Empty states

### 03. Calibration
- Audio offset calibration
- Sample collection
- Metronome functionality
- Offset calculation
- State persistence
- Outlier removal
- Edge cases

### 04. Gameplay
- Game initialization
- Keyboard input (Arrow keys, DFJK)
- Chart loading
- Audio loading
- Resource cleanup
- Performance
- Error recovery

### 05. Results
- Score display
- Judgment breakdown
- Grade calculation
- Navigation
- Color coding
- Data validation

### 07. State Persistence
- LocalStorage operations
- Player name persistence
- Offset persistence
- Data type preservation
- Corruption handling
- Unicode support
- Multi-tab behavior

### 08. Error Handling
- Network failures
- Missing resources
- XSS attacks
- Edge cases
- Rapid interactions
- Browser events

### 09. URL Routing
- Deep linking
- Browser history (back/forward)
- Route guards
- State restoration

### 10. Accessibility
- Screen-level a11y checks (axe-core)
- Keyboard focus management
- Modal dialog handling

### 11. Multiplayer Navigation
- Player setup flow
- Mode transitions
- Controller configuration
- State leakage prevention

### 12. User Journeys
- Complete single player flow (mouse)
- Complete single player flow (keyboard)
- Multiplayer setup and game
- Settings navigation
- Browser refresh recovery

## Test Utilities

### Helper Functions (`helpers/test-helpers.ts`)

```typescript
// Navigation
navigateToMainMenu(page)
navigateToSongSelect(page)
navigateToCalibration(page)

// Actions
setPlayerName(page, name)
selectSong(page, index)
selectDifficulty(page, index)
startGameplay(page)

// State Management
clearAppState(page)
getLocalStorageItem(page, key)
setLocalStorageItem(page, key, value)

// Verification
verifyJudgmentBreakdown(page)
verifyScoreDisplay(page)

// Utilities
pressKeyMultipleTimes(page, key, times, delay)
takeScreenshot(page, name)
```

### Navigation Helpers (`helpers/navigation-helpers.ts`)

```typescript
// URL helpers
getCurrentPath(page)
navigateToUrl(page, path)

// Browser navigation
goBack(page)
goForward(page)

// State setup
setupPlayerState(page, playerName)
```

## Test Patterns

### Standard Test Flow

```typescript
test("should do something", async ({ page }) => {
  // 1. Setup
  await clearAppState(page);
  await navigateToMainMenu(page);

  // 2. Action
  await page.click("#btn-play");

  // 3. Assert
  await expect(page.locator(".song-select")).toBeVisible();
});
```

### State Testing

```typescript
test("should persist data", async ({ page }) => {
  await setLocalStorageItem(page, "key", "value");
  await page.reload();

  const value = await getLocalStorageItem(page, "key");
  expect(value).toBe("value");
});
```

## Writing New Tests

### Best Practices

1. **Clear Test Names**: Use descriptive names that explain what is being tested
   ```typescript
   "should persist player name across sessions"
   "test player name"
   ```

2. **Arrange-Act-Assert**: Follow AAA pattern
   ```typescript
   // Arrange
   await navigateToMainMenu(page);

   // Act
   await page.click("#btn-play");

   // Assert
   await expect(page.locator(".song-select")).toBeVisible();
   ```

3. **Use Helper Functions**: Don't repeat common operations
   ```typescript
   await navigateToSongSelect(page);
   await page.click("#btn-play"); await page.waitForSelector(".song-select");
   ```

4. **Clean State**: Start each test with clean state
   ```typescript
   test.beforeEach(async ({ page }) => {
     await clearAppState(page);
   });
   ```

5. **Meaningful Assertions**: Assert on user-visible behavior
   ```typescript
   await expect(page.locator(".grade")).toHaveText("AAA");
   await expect(someInternalVariable).toBe(true);
   ```

6. **Handle Timing**: Use Playwright's auto-waiting
   ```typescript
   await expect(page.locator(".results")).toBeVisible();
   await page.waitForTimeout(5000);
   ```

## Debugging Tests

### Debug Mode

```bash
# Run with Playwright Inspector
bun test:e2e:debug

# Debug specific test
bunx playwright test --debug --grep "should persist player name"
```

### UI Mode (Recommended)

```bash
# Interactive test runner with time-travel debugging
bun test:e2e:ui
```

### Screenshots and Videos

Tests automatically capture:
- Screenshots on failure
- Videos on failure
- Traces on first retry

View in the HTML report:
```bash
bun test:e2e:report
```

### Console Logs

```typescript
// Add console logging
test("debug test", async ({ page }) => {
  page.on("console", (msg) => console.log("Browser:", msg.text()));

  // Your test code
});
```

## Configuration

See `playwright.config.ts` for:
- Browser configurations
- Timeouts
- Retry settings
- Server setup
- Report options

## CI/CD Integration

Tests are configured to run in CI with:
- Single worker (no parallel execution)
- 2 retries on failure
- HTML and list reporters
- Automatic server startup

```yaml
# GitHub Actions example
- name: Run E2E Tests
  run: bun test:e2e
```

## Test Data

Tests use seeded data from `charts/` directory:
- Test Song (minimal test chart)
- Goin' Under (full chart)

Songs are bundled at build time via `scripts/generate-songs.ts`.

## Troubleshooting

### Tests Failing Randomly
- Verify port 5173 is available
- Check that songs are bundled (run `bun run build` first)

### Timeout Errors
- Increase timeout in `playwright.config.ts`
- Check network speed (downloading assets)
- Verify gameplay duration is reasonable

### Visual Differences
- Update screenshots with `--update-snapshots` if UI changed intentionally

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [Trace Viewer](https://playwright.dev/docs/trace-viewer)
