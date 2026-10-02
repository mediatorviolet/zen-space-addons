# Per-space extensions for Zen

[Français](README.fr.md)

An extension for [Zen Browser](https://zen-browser.app) that enables some extensions only in some spaces.

In Zen, extensions are shared by all spaces, and containers don't isolate them either. This extension enables or disables the other extensions each time you switch spaces.

The interface is in French.

## Usage

The « Extensions par espace » button opens a grid: one row per extension, one column per space. The active space is highlighted. The same grid is available in `about:addons` → Extensions par espace → Options.

- **Checked box:** the extension is enabled in this space.
- **Row checked everywhere:** the extension isn't managed and is never touched.
- **New space:** a managed extension stays disabled there until its box is checked. This is on purpose, so that a password manager doesn't turn on in a space you didn't pick.
- **Disabling or uninstalling this extension:** it first re-enables everything it managed.

The extension uses `AddonManager`, which enables and disables an extension for the whole browser, not tab by tab. That's enough because you only see one space at a time. With two windows open on two different spaces, the last space switch wins.

## Installation

The extension is unsigned and uses an experimental API to get browser privileges: it's the only way to enable or disable another extension, since `management.setEnabled()` only works for themes. Zen honours the two prefs below because it's built with `MOZ_REQUIRE_SIGNING: false`. Firefox ignores them.

1. In `about:config`, set:
   - `extensions.experiments.enabled` → `true`
   - `xpinstall.signatures.required` → `false`. This applies to the whole browser: any unsigned extension installed by hand will be accepted, possibly with full privileges. Only install extensions whose code you have read.
2. Download `zen-space-addons.xpi` from the [Releases](../../releases) page, or build it:
   ```sh
   mkdir -p dist && rm -f dist/zen-space-addons.xpi \
     && zip -qr dist/zen-space-addons.xpi manifest.json background.js health.js grid.* icon.svg api
   ```
3. In `about:addons`, click the gear icon, then "Install Add-on From File…", and pick the `.xpi`.

To update, install the new `.xpi` the same way. Your rules are kept. If you build the `.xpi` yourself, bump `version` in `manifest.json` first.

**For development** (only `extensions.experiments.enabled` is needed): open `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on…" and pick `manifest.json`. A temporary add-on goes away on restart, along with its rules.

## Structure

- `api/parent.js`: the privileged part, running in the parent process. It watches for space switches, applies the rules and lists the spaces.
- `api/schema.json`: the `browser.zenSpaceAddons` API exposed to the rest of the extension.
- `background.js`: sends the rules from `storage.local` to `api/parent.js` at startup and on every change, then reports problems on the button.
- `health.js`: checks that the extension works, for the button and the grid.
- `grid.html`, `grid.js`, `grid.css`: the grid.

## If a Zen update breaks the extension

The extension relies on Zen internals, not on a public API. They live in `modules/zen/ZenSpaceManager.mjs`, inside `browser/omni.ja` (a zip archive) in Zen's install folder:

- **The `zen.workspaces.active` pref,** where Zen writes the active space's uuid on every switch. If it goes away, switching spaces no longer enables or disables anything.
- **The `gZenWorkspaces.getWorkspaces()` function,** which returns the list of spaces. If it changes, the grid shows « Aucun espace trouvé. » (no space found).

The extension checks these at browser startup and whenever the rules change. If one of them stops responding, or if the privileged part fails to load, a « ! » appears on its button (the tooltip gives the first problem) and the grid lists the problems at the top. An error that happens while switching spaces shows up the next time you open the grid.

Error details are in the Browser Console (Tools → Browser Tools → Browser Console), prefixed with `[zen-space-addons]`.

## Why not fx-autoconfig

fx-autoconfig can also run JS with browser privileges, but it writes files into Zen's install folder, which has two drawbacks:
- **it breaks the app's signature,** which can break extensions that check it to talk to their desktop app (some password managers, for instance);
- **every Zen update wipes those files.**

This extension lives in the profile and doesn't modify Zen.

## License

[MIT](LICENSE)
