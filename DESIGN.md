# PACKOUT: Design system

Source of truth for Packout's visual language. Built from the founder's logo files in `assets/` (2026-11-01, OPEN-DECISIONS D8). Tokens and shared components live in `packages/brand` (`@packout/brand`); this file explains how to use them. The landing page (`apps/site`) adds a layer on top of the brand (section 8); Packout Restore stays on the brand layer alone.

## 1. World: the cracktro void

The logo is a white pixel figure on black, surrounded by a grey dithered portrait. Packout extends that into a demoscene title screen:

- **An emissive black void.** Content sits directly on black. Drop shadows are not used; the only glows are the amber ones named in section 8.
- **One bitmap face riding baselines.** Headings, labels, statuses, numbers and hashes use Geist Pixel Square. Prose and form text use Host Grotesk for reading comfort.
- **Rank is depth.** Hierarchy comes from brightness, letter-spacing and drift, which step together (section 3). A box needs a functional reason: a file drop target, a text field, or on the landing page a lifted highlight panel that gives a section a clear start and end.
- **Fields of grey dust behind the work.** The dithered portrait (`DustField`) is the only texture. It never sits behind dense reading text without a void scrim.
- **One signal family.** Amber marks the caret, keyboard focus and the single primary action on a view. Packout Restore uses nothing else. The landing page also uses it, with its one deeper tint `ember`, for eyebrows, numerals, highlights and the aurora (section 8). There is no second hue anywhere.
- **Failure is a reversed cell.** Ivory ground, black text, plus the word that names the failure. Success is ivory text and the word "Pass" or "Done".

Surfaces using this world: the landing page (`apps/site`), Packout Restore (`apps/client-b`, Client B in docs) and its public proof page. **Vendor A is deliberately not Packout-branded**: it stays an ordinary light SaaS so the exit reads as leaving one product for another (BUILD-PLAN 8.2).

## 2. Tokens

Brand tokens, in `packages/brand/src/tokens.css`:

| Token | Value | Use | Contrast on void |
| --- | --- | --- | --- |
| `void` | `#000000` | page ground | |
| `dust` | `#242424` | dither field, disabled ink; never text | 1.4:1 |
| `smoke` | `#7a7974` | labels, captions, rear planes; the dimmest text allowed | 4.8:1 |
| `ash` | `#a3a29c` | secondary text | 8.2:1 |
| `ivory` | `#f5f4ef` | primary text, the mark, reversed cells | 19:1 |
| `signal` | `#ffb21f` | caret, focus ring, primary action ground | 11.6:1 |
| `signal-ink` | `#120c00` | text on signal | |

Landing tokens, in the `@theme` block of `apps/site/src/styles.css`:

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| `ember` | `#ff8a1f` | the aurora's hot core, glows; never text | |
| `mist` | `#d6d5cf` | body copy on lifted surfaces | 14.3:1 on void, 12.8:1 on panel, 12:1 on card |
| `lift` | `#0e0e0d` | the elevated surface (panel body, stat cells) | signal 10.7:1 |
| `lift-2` | `#161614` | a step above `lift` | |
| `hair` | ivory at 13 % | hairline border on panels and cards | |
| `hair-strong` | ivory at 24 % | hairline on pills, chips, inputs | |

Contrast on the panel's brightest stop (`#121210`): signal 10.4:1, mist 12.8:1, ash 7.3:1, ivory 17:1. Measured in the page, the lowest body-text ratio anywhere is smoke on void, 4.8:1.

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
- Prose: Host Grotesk, line-height 1.6, measure ≤ 62ch. Packout Restore uses `.prose-ash` (ash, 17–20 px). The landing page uses `.prose` (mist, `clamp(1.0625rem, 0.98rem + 0.3vw, 1.25rem)`) so copy on lifted surfaces keeps 12:1.
- Pull-statement (`.pull`): Host Grotesk 500, `clamp(1.5rem, 1.05rem + 1.7vw, 2.375rem)`, tracking −0.02em, line-height 1.22, ivory, ≤ 34ch. Landing only (section 8).
- Hashes and addresses: pixel face, shortened as `0xA76a…61E0` with the full value in a link or title.

## 5. Components

- **Pixel mark** (`PixelMark`): the founder's figure traced edge by edge into 30 rectangles (`mark-geometry.ts`), rendered as crisp SVG. `drifting` lets the six loose pixels step outward and return, the pack still packing out. Never redraw or smooth it.
- **Wordmark** (`Wordmark`): mark + "Packout" in Host Grotesk 520 + ™, proportions from the logo artwork. `size` is a number of pixels; the landing footer shows it at 44 on phones and 92 from 768 px.
- **DustField**: canvas render of the logo's dithered portrait (124 × 70 cells, `face-field.ts`), plus two seeded dust layers that drift on one clock. The portrait flickers about 1 % of cells like a CRT and parts around the pointer. Pauses off-screen and in hidden tabs; static under `prefers-reduced-motion`.
- **Primary action** (`.signal`): amber pill, pixel face uppercase, soft amber glow, scale 0.97 on press, 44 px minimum height. Exactly one per view; on the landing page one in the header and one in the hero.
- **Secondary action**: `.pill` (hairline pill, ivory pixel text, amber hairline on hover) for buttons; `.ghost-link` (mist pixel text, smoke underline that turns amber on hover) for inline links; the bracketed `.command` "[ Label ]" survives in Packout Restore.
- **Caret**: an amber block blinking in steps at the end of the front line. One per view.
- **Reversed cell** (`.reversed`): failure and refusal only.
- **Status words**: `Pass`, `Failed`, `Not checked`, `Skipped` are always words, never colour alone.

## 6. Motion

- One authored moment per view: lines surfacing out of the void in the order they happened (`.surface`, 560 ms ease-out, 80 ms stagger; never on a heading that takes focus), the drifting rear planes, the dust field.
- UI feedback stays under 200 ms for presses and hovers (buttons scale to 0.97 on press); the toggle thumb and step-through swap take 220–240 ms because they carry state.
- Chain states animate only when they change state, never on a loop, except a working indicator, which has a timeout message.
- Landing only: scroll reveal (`.reveal`, 640 ms ease-out, 18 px rise, once per block, hidden only after script has run so a failed script never blanks the page) and the aurora (section 8).
- `prefers-reduced-motion`: no drift, no aurora, no caret blink, no surfacing, no reveal, no thumb slide; the dust field renders once. The landing's "Pause motion" button sets `data-still` on `<html>`, which holds the same things still on demand.
- Layout properties are never animated. Decorative motion uses `transform` and `opacity`; the surfacing blur is the one exception.

## 7. Copy

English. Short declarative sentences, the product's own nouns (workspace, operation, owner, writer, epoch, anchored). Every claim on the landing page links to a block or comes from `docs/technical/SMART-CONTRACT.md`. Illustrations are labelled as illustrations. No customers, metrics or prices are invented; every number on the stat strip is a row of the README's "Packout in numbers" table and links to its source.

## 8. Landing layer (`apps/site`)

The landing page borrows the structure of a developer-tooling page (glass bar, install command, filterable resources) and keeps Packout's palette. Primitives live in `apps/site/src/components/` and `styles.css`.

- **Aurora** (`Aurora`, `.aurora`): four layered radial gradients in amber and ember (haze, sweep, core, streak) in the lower right of the hero, drifting 18–40 s on `transform` only (no filter, no blur), masked to fade upward. Two layers are dropped below 768 px. Sits behind the dust field; a void scrim covers the left of the hero so reading text never sits on the glow. `.glow-still` is the motionless version for the closing section.
- **Glass bar** (`SiteNav`): sticky, `black/55` with `backdrop-blur-xl`, a hairline underneath, the wordmark, section links from 1280 px, a GitHub pill and the header's one primary action.
- **Section eyebrow** (`.eyebrow`): `NN / Label` in pixel face, 12 px, 0.18em, signal, after a 24 × 2 px amber tick. Every section starts with one, numbered 01 to 10.
- **Highlight panel** (`.panel`, `Section tone="panel"`): a lifted rounded surface (`#121210` to `lift` to `#0a0a09`, hairline border, a 1 px amber top edge and two faint amber corner glows). Sections alternate between the plain void and a panel so each has a clear start and end. Panels carry content, not other panels.
- **Pull-statement** (`.pull`, `Pull`): the one sentence of a section that matters, directly under the heading. Its key phrase is wrapped in `<mark>`: a 20 % amber wash and a 3 px amber underline, text stays ivory.
- **Card** (`.card`): inset surface inside a panel or on the void, hairline border, 1.25 rem radius, ivory at 3 %. Used for resources, results, the step panel and the boundaries.
- **Pill toggle** (`PillToggle`): the Human / Agent switch. A `tablist` with an ivory thumb that slides by `translateX`; arrows, Home and End move between options and focus follows. Used in the hero (which command to run) and in Build (who is integrating).
- **Chips** (`.chip`): hairline pills, 11 px pixel text. `aria-pressed="true"` fills with amber at 16 %, an amber border and ivory text. Used for the resource filters and the tamper choices; 44 px high on phones, 36 px from 768 px.
- **Command block** (`CommandBlock`): amber `$`, the command in pixel face on `black/70`, and a copy button that confirms with a check and the word "Copied", or on failure selects the text and says how to finish by keyboard.
- **Stat strip** (`Numbers`, `.numeral`): a 1 px-gap grid on `lift`; each cell has an amber pixel numeral, a plain label and a link to the evidence in the repository.
- **Resources grid** (`Resources`): a search field, filter chips, an `aria-live` count ("N of 9 resources"), cards that link to a real path under `https://github.com/Dylansius11/packout/tree|blob/main/`, and an empty state with a "Clear filters" action.
- **Step-through** (`ExitMoves`): the seven moves of the demo as a `tablist` with a detail card; Previous and Next are `aria-disabled` at the ends, arrows and Home/End work on the list.
- **Footer** (`Footer`): the large wordmark, the two demo links with their one-sentence explanations, the source link and one line of honest status.

## 9. Pitch deck (`apps/site`, route `/deck`)

A twelve-slide web deck for judges and pilots, in the landing's world: the same void, bitmap face, amber, dust, aurora, hairlines, eyebrows and panels, staged as full-viewport slides. It is a lazy chunk (`src/deck/`, styles in `deck.css` scoped under `.deck`), so the landing's JavaScript does not carry it. Every string is in `src/deck/content.ts`.

- **Routing**: the hash is the source of truth (`/deck#6` opens slide 6). ArrowRight/ArrowLeft, Space and Shift+Space, PageDown/PageUp, Home/End, `1` to `9` and swipe move; `F` toggles full screen. The rail's twelve segments jump.
- **Slides**: type is Host Grotesk for headlines with one lit phrase in the bitmap face and amber; the opening and the close use the bitmap face throughout. Under 60 rem every slide is one column and scrolls inside its slide while the bars stay fixed.
- **Motion**: a slide's resting state is its final state. Animations attach only to the active slide (and only while `.deck[data-motion]` is set), so each slide replays on every arrival, and reduced motion, the "Pause motion" control (`data-still` on `<html>`, shared with the landing) and print show the finished slide. Counting numerals expose only their final value to assistive tech.
- **Print**: `@page` is 1280 by 720 px, one slide per page, chrome hidden, colours exact. The close slide carries a `Print / save as PDF` button.
- **Honesty**: the funnel's bars are fixed nested widths (100, 60, 30 %) and are labelled "not to scale"; the planning scenario label and the sourcing caption are always on screen.
