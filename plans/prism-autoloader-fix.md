# Prism Autoloader — Fenced Code Blocks Never Highlighted on First Open

**Issue:** not filed upstream (found locally, in `MacDown3000-patched`'s
`WRITEUP.md`, against a resource-patched copy of the installed app rather
than the source tree — this is the source-level version of that same fix).
**Symptom:** Fenced code blocks are never syntax-highlighted on first open.
Any document, any language, every launch. Changing a preference is the only
way to get colour, and the effect doesn't survive closing and reopening the
document.
**Status:** Fixed at the source level, with regression tests, verified.
`xcodebuild test` against `MacDownTests/MPRendererEdgeCaseTests`: 67 tests,
0 failures, both new tests passing.

---

## Root Cause

`-prismScripts` in `MPRenderer.m` builds its list of Prism `<script>` tags
from `self.currentLanguages` — but the preview's *only* full page load
happens before the document has been parsed, so `currentLanguages` is
always empty at that point, and no language grammar script is ever emitted
for it.

Every content update after that first load goes through
`document.body.innerHTML = html; Prism.highlightAll();` — and a `<script>`
tag that arrives as part of an `innerHTML` string never executes; that's
standard DOM behaviour, not a MacDown bug. So a grammar can never arrive,
on any render, ever, unless something outside the innerHTML path injects it.

This also explains why the language *chip* (from Prism's `show-language`
plugin) disappears at the same time as the colour: the bundled Prism core
returns early from `highlightElement`, before the `before-highlight` hook
that `show-language` relies on, whenever `Prism.languages[lang]` is
undefined — i.e. whenever the grammar was never loaded.

---

## The Fix

Two things, both added unconditionally to `-prismScripts` (not gated on
`currentLanguages`):

1. **`Prism/plugins/autoloader/prism-autoloader.min.js`** — already vendored
   into every build via the existing "Fetch Prism Resources" / "Copy Styles
   and Prism Resources" build phases (they `cp -R` the submodule's entire
   `plugins/` directory), so no new resource needed for the plugin itself.
   The autoloader hooks Prism's `complete` callback, which the bundled core
   *does* run on the missing-grammar path, and fetches a grammar by
   creating a real `<script>` element via `document.createElement` +
   `appendChild` — which executes even when appended after an `innerHTML`
   replacement, unlike a `<script>` that was part of the replaced HTML
   string itself.

2. **A new small config script**, `MacDown/Resources/Extensions/prism-autoloader-config.js`.
   The autoloader's default `languages_path` is the relative string
   `'components/'`, and the preview's base URL is the user's home
   directory — so a relative path always resolves to
   `~/components/...` and 404s. This particular Prism version also predates
   `data-autoloader-path`, so there's no built-in way to configure this via
   a script tag attribute. Rather than hardcode an absolute path (which
   would break for anyone who doesn't install the app at exactly one
   assumed location), this script reads its own already-resolved absolute
   `file://` URL via `document.currentScript.src` and derives the sibling
   `Prism/components/` path from that.

   **Why `Resources/Extensions/` and not `Resources/Prism/`:** the `Prism`
   resource folder is deleted and regenerated from the submodule on every
   build (`rm -rf "$TARGET"; ...; cp -r`) — anything placed there directly
   would be silently wiped on the next build. `Extensions/` is MacDown's
   own committed, stable resource folder (already used for
   `tasklist.js`, `table-resize.js`, etc.) and is a genuine Xcode *folder
   reference*, so a new file dropped into it is picked up automatically —
   no `.xcodeproj` edits were needed.

Both are loaded the same way every other bundled script here is —
`MPScript javaScriptWithURL:`, i.e. a real external `<script src="file://...">`
tag — so nothing about this fix touches or needs to touch the app's CSP
(`script-src 'self' file: https://cdnjs.cloudflare.com 'unsafe-eval'`, no
`'unsafe-inline'`). This is exactly the constraint that made the *binary*
patch in `MacDown3000-patched` so fiddly (it had to move code out of inline
`<script>` tags after the fact); doing it at the source level means
everything is already emitted as an external URL from the start.

---

## Testing

Added two tests to `MPRendererEdgeCaseTests.m`, next to the existing CSP
test (same setup/assert-on-rendered-HTML style, not calling the private
`-prismScripts` method directly):

- `testPreviewRenderAlwaysIncludesPrismAutoloaderWhenHighlightingEnabled` —
  renders a plain paragraph (**no code block, deliberately** — this is
  exactly the empty-`currentLanguages` first-load scenario) with syntax
  highlighting on, and asserts both the autoloader script and the new
  config script appear in the rendered HTML.
- `testPreviewRenderOmitsPrismAutoloaderWhenHighlightingDisabled` — same
  input, syntax highlighting off, asserts neither appears (this is still
  gated by the existing `rendererHasSyntaxHighlighting` check, unchanged).

---

## Verification

**Done.** Full build + `xcodebuild test` against `MacDownTests/MPRendererEdgeCaseTests`:
**67 tests, 0 failures**, including both new tests. Getting there required
setting up this machine's build environment from scratch — see
`~/Documents/Projects/Daizerius/macdown3000-contribution.md` for the local
dev-environment setup notes (Ruby version, CocoaPods, a `LANG` gotcha that
broke CocoaPods itself, and a `CI=true` flag needed to skip an unrelated
build-number script). None of that is specific to this fix — it's one-time
machine setup for building this project at all.

Two things worth knowing if this test is ever re-run in an automated,
non-interactive context: running `xcodebuild test` from a shell that isn't
a real interactive terminal session can fail with *"The test runner hung
before establishing connection"* — the test host is a real GUI app and
needs an actual window-server session to launch. And the "Update Build
Number" script phase (`Tools/update_build_number.sh`) fails on a fresh
`DerivedData` build unless `CI=true` is set, which tells it to skip itself
(exactly what GitHub's own CI does, for the same reason).

---

## Files Changed

- `MacDown/Code/Document/MPRenderer.m` (`-prismScripts`, +19 lines)
- `MacDown/Resources/Extensions/prism-autoloader-config.js` (new file)
- `MacDownTests/MPRendererEdgeCaseTests.m` (+2 tests)

---

## Not addressed here

`WRITEUP.md`'s **PR 2** (the overlapping checkbox in Preferences → Rendering,
a missing `NSLayoutConstraint` in `MPHtmlPreferencesViewController.xib`) and
**Issue 3** (the highlighting theme popup not restoring its selection) are
separate, unrelated defects — not touched by this change.
