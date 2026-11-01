# PACKOUT: Design system

Source of truth for Packout's visual language. Built from the founder's logo files in `assets/` (2026-11-01, OPEN-DECISIONS D8). Tokens and shared components live in `packages/brand` (`@packout/brand`); this file explains how to use them.

## 1. World: the cracktro void

The logo is a white pixel figure on black, surrounded by a grey dithered portrait. Packout extends that into a demoscene title screen:

- **An emissive black void.** No panels, no cards, no drop shadows. Content sits directly on black.
- **One bitmap face riding baselines.** Headings, labels, statuses, numbers and hashes use Geist Pixel Square. Prose and form text use Host Grotesk for reading comfort.
- **Rank is depth, not boxes.** Hierarchy comes from brightness, letter-spacing and drift, which step together (section 3). Rules, borders and enclosures are avoided; a box needs a functional reason (a file drop target, a text field).
- **Fields of grey dust behind the work.** The dithered portrait (`DustField`) is the only texture. It never sits behind dense reading text without a void scrim.
- **One signal colour.** Amber marks the caret, keyboard focus and the single primary action on a view. Nothing else is coloured.
- **Failure is a reversed cell.** Ivory ground, black text, plus the word that names the failure. Success is ivory text and the word "Pass" or "Done".

Surfaces using this world: the landing page (`apps/site`), Packout Restore (`apps/client-b`, Client B in docs) and its public proof page. **Vendor A is deliberately not Packout-branded**: it stays an ordinary light SaaS so the exit reads as leaving one product for another (BUILD-PLAN 8.2).

## 2. Tokens (`packages/brand/src/tokens.css`)

| Token | Value | Use | Contrast on void |
| --- | --- | --- | --- |
| `void` | `#000000` | page ground | |
| `dust` | `#242424` | dither field, disabled ink; never text | 1.4:1 |
| `smoke` | `#7a7974` | labels, captions, rear planes; the dimmest text allowed | 4.8:1 |
| `ash` | `#a3a29c` | secondary text, body copy | 8.2:1 |
| `ivory` | `#f5f4ef` | primary text, the mark, reversed cells | 19:1 |
| `signal` | `#ffb21f` | caret, focus ring, primary action ground | 11:1 |
| `signal-ink` | `#120c00` | text on signal | |

Fonts: `--font-pixel` / `--font-mono` = Geist Pixel Square (vendored woff2, SIL OFL, `packages/brand/src/fonts`), `--font-sans` = Host Grotesk Variable. Easing: `--ease-out` `cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-in-out` `cubic-bezier(0.77, 0, 0.175, 1)`.

Browser surfaces are themed in the tokens: selection is amber on ink, the caret is amber, scrollbars are smoke on void, focus is a 2 px amber outline offset 3 px.

## 3. Depth

| Depth | Colour | Tracking | Motion | Used for |
| --- | --- | --- | --- | --- |
| 0, front | ivory | 0.16em | still | the current item, the thing to read now |
| 1 | ash | 0.10em | slowest drift | supporting facts |
| 2 | smoke | 0.06em | 2× faster | context, labels |
| 3, rear | `#333331` | 0.03em | 4× faster | pure atmosphere, never information (1.7:1, `aria-hidden`) |

Only rear planes move. The front plane holds still while it is read; focus and hover bring an item forward (brighter, wider), never sideways.

## 4. Type

- Display (`.display`): pixel face, line-height 0.98, no negative tracking (bitmap glyphs break), max 6rem. Balanced wrapping.
- Baseline labels (`.baseline`): pixel face, uppercase, tracking by depth, 11–15 px.
- Prose (`.prose-ash`): Host Grotesk 17–20 px, ash, line-height 1.6, measure ≤ 62ch.
- Hashes and addresses: pixel face, shortened as `0xA76a…61E0` with the full value in a link or title.

## 5. Components

- **Pixel mark** (`PixelMark`): the founder's figure traced edge by edge into 30 rectangles (`mark-geometry.ts`), rendered as crisp SVG. `drifting` lets the six loose pixels step outward and return, the pack still packing out. Never redraw or smooth it.
- **Wordmark** (`Wordmark`): mark + "Packout" in Host Grotesk 520 + ™, proportions from the logo artwork.
- **DustField**: canvas render of the logo's dithered portrait (124 × 70 cells, `face-field.ts`), plus two seeded dust layers that drift on one clock. The portrait flickers about 1 % of cells like a CRT and parts around the pointer. Pauses off-screen and in hidden tabs; static under `prefers-reduced-motion`.
- **Primary action** (`.signal`): amber ground, pixel face uppercase, scale 0.97 on press. One per view.
- **Secondary action** (`.ghost-link`, or bracketed `.command` "[ Label ]"): ash pixel text, underline or brackets in smoke, brightens to ivory with an amber underline on hover.
- **Caret**: an amber block blinking in steps at the end of the front line. One per view.
- **Reversed cell** (`.reversed`): failure and refusal only.
- **Status words**: `Pass`, `Failed`, `Not checked`, `Skipped` are always words, never colour alone.

## 6. Motion

- One authored moment per view: lines surfacing out of the void in the order they happened (`.surface`, 560 ms ease-out, 80 ms stagger; never on a heading that takes focus), the drifting rear planes, the dust field.
- UI feedback stays under 200 ms; buttons scale to 0.97 on press.
- Chain states animate only when they change state, never on a loop, except a working indicator, which has a timeout message.
- `prefers-reduced-motion`: no drift, no caret blink, no surfacing; the dust field renders once.

## 7. Copy

English. Short declarative sentences, the product's own nouns (workspace, operation, owner, writer, epoch, anchored). Every claim on the landing page links to a block or comes from `docs/technical/SMART-CONTRACT.md`. Illustrations are labelled as illustrations. No customers, metrics or prices are invented.
