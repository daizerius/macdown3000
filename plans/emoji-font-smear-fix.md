# Emoji Font-Family Smear — Analysis and Fix

**Issue:** not filed upstream (found locally); the pattern echoes Issue #376's size/color smear, which self-corrected — this one didn't.
**Symptom:** After typing an emoji, every character typed afterward in that stretch of text renders in a sans-serif font instead of the editor's monospace font.
**Status:** Fixed, with a regression test. Uncommitted, pending review.

---

## Reproduction Case

1. Set the editor's font to a monospace font (e.g. Menlo).
2. Type an emoji.
3. Keep typing.

Text typed after the emoji silently switches to a sans-serif font. Point size stays correct throughout — only the family drifts.

---

## Root Cause

`-clearHighlightingForRange:` in `HGMarkdownHighlighter.m` runs on every edit and is responsible for resetting any text run whose font doesn't match the editor's base font. Its check only compared `font.pointSize` against the recorded default size — it never checked the font's family/name.

AppKit substitutes a fallback font for any glyph the current font can't render — emoji being the common case, since a monospace font typically has no emoji glyphs. That substituted font almost always keeps the surrounding point size (so the size check passed), but its family is different. Because family was never checked, the substitution was left in place instead of being reset, and nothing downstream in the highlighting pipeline ever corrected it — so it persisted onto whatever was typed next in that run.

---

## The Fix

`-clearHighlightingForRange:` now also compares `font.familyName` against the base font's family. If either the size *or* the family is wrong, the run is reset to the editor's actual base font at the default size — rather than just resizing whatever wrong-family font happened to already be there.

---

## Testing

Added `testClearHighlightingResetsFontFamilySmearedByFontSubstitution` in `HGMarkdownHighlighterTests.m`:

1. Sets a monospace base font on a text view.
2. Simulates AppKit's font substitution directly — applies a same-size, different-family font to a range, standing in for what a real emoji substitution produces (no actual emoji rendering needed to trigger the bug deterministically in a test).
3. Confirms the precondition: the wrong-family font really is in place before the fix runs.
4. Calls `clearHighlighting`.
5. Asserts the range is restored to the base font's *family*, not just resized to the right point size.

---

## Files Changed

- `Dependency/peg-markdown-highlight/HGMarkdownHighlighter.m` (+24, -4)
- `MacDownTests/HGMarkdownHighlighterTests.m` (+60)
