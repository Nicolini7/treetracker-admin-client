# Capture detail concurrency browser evidence

This verifies commit `b2631a744966142f583461994ddc0b5af3a3a6d7` in the actual React Capture details drawer with Chrome and local fixtures. Authentication, image and API responses are synthetic. No Greenstand development or production account is used, and nonlocal browser requests are blocked. The image is labeled as a local test capture.

The focused Cucumber scenario outline passed: **2 scenarios, 12 steps**, exit code 0. It exercises both response orders for the same capture:

| Order | First completed response | State before the final response | Final drawer |
| --- | --- | --- | --- |
| Species first | Mango species | Mango is visible while the healthy tag remains pending | Mango and healthy both remain visible |
| Tag first | healthy tag | healthy is visible while the Mango species remains pending | Mango and healthy both remain visible |

Each scenario makes exactly one species-detail request and one tag-detail request for capture 42. The JSON observations record the controlled completion order. This covers concurrent fields for the same capture; it does not test navigation between different captures.

This is a focused Cucumber + Playwright browser check, separate from the repository's shared-environment WDIO suite. It does not establish that all WDIO scenarios pass.

## Media and reports

- [Full MP4 recording](output/playwright/passing-run/capture-detail.mp4)
- [GIF preview of the details area](output/playwright/passing-run/capture-detail.gif)
- [Original WebM recording](output/playwright/passing-run/capture-detail.webm)
- [Species-first completed screenshot](output/playwright/passing-run/species-first-completed.png)
- [Tag-first completed screenshot](output/playwright/passing-run/tag-first-completed.png)
- [Cucumber HTML report](output/playwright/passing-run/cucumber-report.html)
- [Cucumber JSON results](output/playwright/passing-run/cucumber-results.json)
- [Request observations](output/playwright/passing-run/browser-observations.json)

Both video formats preserve the complete 21.3-second recorded sequence at normal speed. The GIF shows the same sequence cropped to the right-hand details area (340 by 360 pixels). No annotations, simulated result text or counters were added to the screen recording. The initial application startup occurs before recording begins.

## Recorded environment

The React app ran under Node 18.20.8. The focused Cucumber/Playwright runner ran under Node 24.20.0. Cucumber emitted a notice that this runner version of Node had not been tested with its version of Cucumber; both scenarios passed. This browser result is distinct from the project's Node 18 Jest/build checks.

## Reproduce

Use the contribution branch with npm dependencies installed. Install/cache the Playwright CLI once:

```powershell
npx.cmd --yes @playwright/cli --version
```

In each terminal set the repository path:

```powershell
$env:ADMIN_CLIENT_PATH = 'C:\path\to\treetracker-admin-client'
```

Start the local fixture API in one terminal:

```powershell
node mock-api.cjs
```

Start the React app with Node 18 in another terminal:

```powershell
& 'C:\path\to\node18\node.exe' start-app.cjs
```

After the app compiles, run the focused browser scenario with Node 24:

```powershell
New-Item -ItemType Directory -Path output/playwright/passing-run -Force
$cucumber = Join-Path $env:ADMIN_CLIENT_PATH 'node_modules\@cucumber\cucumber\bin\cucumber-js'
& 'C:\path\to\node24\node.exe' $cucumber capture-detail.feature --require capture-detail.steps.cjs --format progress --format json:output/playwright/passing-run/cucumber-results.json --format html:output/playwright/passing-run/cucumber-report.html
```

The runner locates the cached Playwright CLI. Set `PLAYWRIGHT_CLI_PATH` explicitly if npm uses a different cache directory. Artifacts are written under `output/playwright/passing-run`. Chrome is launched in an isolated session, and the browser is closed after the run. Existing React/Material UI warnings and blocked external analytics/fonts are outside this correction.
