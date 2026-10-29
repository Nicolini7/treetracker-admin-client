# Capture tag write browser evidence

This validates commit `29ec4fe907da8bb262767250c360827614e29dbb` in the actual React Verify screen with Chrome and local fixtures. Authentication and API responses are synthetic; no Greenstand development or production account is used. All nonlocal browser requests are blocked. The tree illustration is explicitly labeled as a local test capture.

The scenario selects capture 42, adds `healthy` and `native`, and submits approval. Both tag responses are held. Processing remains active and the capture list does not reload with zero or one completed write. Releasing the second response completes approval and refreshes the pending list.

The focused scenario uses Cucumber with the Playwright CLI. It is separate from the repository's WDIO suite; it does not establish that the shared-environment BDD scenarios pass.

## Result

The recorded run passed: **1 scenario, 8 steps**, exit code 0.

| Assertion | Pending writes | Persisted tags | Capture-list reloads |
| --- | ---: | ---: | ---: |
| Both requests held | 2 | 0 | 0 |
| First response released | 1 | 1 | 0 |
| Both responses released | 0 | 2 | 1 |

The processing overlay stays open for the first two assertions and closes after the second response. The capture leaves the pending list after completion.

- [Compact MP4](output/playwright/passing-run/capture-tag-writes.mp4)
- [Animated GIF](output/playwright/passing-run/capture-tag-writes.gif)
- [Full original recording](output/playwright/passing-run/capture-tag-writes.webm)
- [Both writes pending](output/playwright/passing-run/two-pending.png)
- [One write pending](output/playwright/passing-run/one-pending.png)
- [Completed approval](output/playwright/passing-run/completed.png)
- [Cucumber HTML report](output/playwright/passing-run/cucumber-report.html)
- [Cucumber JSON](output/playwright/passing-run/cucumber-results.json)
- [Recorded fixture observations](output/playwright/passing-run/browser-observations.json)

The compact MP4 and GIF begin after tag selection and play at **2x speed**. They are 18.6-second excerpts from the actual 62.3-second browser recording. No interface elements, result text, or request counters were added to the recorded screen.

## Reproduce

Use Node 18 and the contribution branch with its npm dependencies installed. Install the Playwright CLI through npm if it is not cached. In each terminal set the repository path:

```powershell
$env:ADMIN_CLIENT_PATH = 'C:\path\to\treetracker-admin-client'
```

Run the local API in one terminal:

```powershell
node mock-api.cjs
```

Run the application in a second terminal:

```powershell
node start-app.cjs
```

After the app compiles, run the scenario in a third terminal:

```powershell
$cucumber = Join-Path $env:ADMIN_CLIENT_PATH 'node_modules\@cucumber\cucumber\bin\cucumber-js'
node $cucumber capture-tag-writes.feature --require capture-tag-writes.steps.cjs --format progress --format json:output/playwright/passing-run/cucumber-results.json --format html:output/playwright/passing-run/cucumber-report.html
```

Artifacts are written under `output/playwright/passing-run`. The JSON observations record pending/persisted writes and list reloads at each assertion. The PNGs and recording show the real interface. Existing React/Material UI deprecation warnings and intentionally blocked external analytics/fonts are outside this correction.
