# Orange catalogue design system

The established direction is white surfaces, restrained pink accents, dark text,
and real clothing photography. Staff workspaces use the same palette with denser
sans typography. There is no new checkout, independent photo/review screen, dark
mode, decorative dashboard palette, or generated product photography.

## Canonical tokens

`client/src/index.css` defines each token once, before component rules.

| Token                                | Value     | Role / contrast against white                          |
| ------------------------------------ | --------- | ------------------------------------------------------ |
| `--aw-bg`, `--aw-surface`            | `#FFFFFF` | Main solid surfaces                                    |
| `--orange-soft-blush`, `--aw-sunken` | `#FFF7FA` | Grouping / quiet feedback                              |
| `--orange-pink-deep`, `--aw-active`  | `#FFF0F5` | Selected surfaces                                      |
| `--orange-ink`, `--aw-text`          | `#111111` | Body / important identifiers, 18.88:1                  |
| `--orange-muted`, `--aw-muted`       | `#6F6B66` | Secondary text at full opacity, 5.29:1                 |
| `--orange-line`, `--aw-line`         | `#F7DBE5` | Decorative dividers; never the sole essential boundary |
| `--orange-pink`, `--aw-accent-dot`   | `#F7C4D3` | Button fills / restrained decoration; dark labels      |
| `--control-line`                     | `#A07D8B` | Essential controls, 3.62:1 white / 3.28:1 pink         |
| `--selected-line`                    | `#A85574` | Selected borders, 4.98:1 white / 4.51:1 pink           |
| `--focus`, `--aw-accent-icon`        | `#8B3D5A` | Focus / essential accent, 7.21:1 white                 |
| `--danger`                           | `#B3413A` | Error/destructive, white labels 5.62:1                 |
| `--danger-hover`                     | `#96332D` | Destructive hover, white labels 7.48:1                 |
| `--error-surface`                    | `#FFF2F3` | Error grouping                                         |
| `--success`                          | `#2F6B45` | Semantic success; no colored metric cards              |

Primary touch controls have a 44px minimum in each dimension; order actions have
48px minimum height. Focus is a 3px rose outline with a 2px offset. Panels/fields
use 8px radii; login uses 12px; actions/search use pill radii. Hover changes colors
only, with 140–160ms transitions. Reduced motion disables transitions/animations.
Native file inputs stay accessible through a visible focus-within outline.

## Typography and rhythm

| Role                 | Family / weight      | Phone   | Tablet  | Desktop | Line height          |
| -------------------- | -------------------- | ------- | ------- | ------- | -------------------- |
| Category title       | Playfair Display 500 | 32px    | 44px    | 64px    | 1.08                 |
| Product title        | Playfair Display 500 | 36px    | 44px    | 44–56px | 1.10                 |
| Staff page title     | DM Sans 600          | 28px    | 28px    | 32px    | 1.20                 |
| Staff section        | DM Sans 600          | 18–20px | 18–20px | 18–20px | 1.40                 |
| Card title           | DM Sans 500          | 14px    | 15px    | 16px    | 1.40                 |
| Detail price         | DM Sans 600, tabular | 20px    | 22px    | 22px    | 1.40                 |
| Card price           | DM Sans 400, tabular | 14px    | 14px    | 14px    | 1.50                 |
| Staff identifier     | DM Sans 700, tabular | 15px    | 15px    | 15px    | 1.50                 |
| Selected identifier  | DM Sans 700, tabular | 22px    | 22px    | 22px    | 1.40                 |
| Metric count         | DM Sans 700, tabular | 28px    | 28px    | 32px    | 1.20                 |
| Body                 | DM Sans 400          | 16px    | 16px    | 16px    | 1.50                 |
| Compact copy         | DM Sans 400          | 14px    | 14–15px | 14–15px | 1.50                 |
| Workspace navigation | DM Sans 400/600      | 12px    | 12px    | 14px    | 1.30                 |
| Field text           | DM Sans 400          | 16px    | 16px    | 16px    | 1.50                 |
| Eyebrow              | DM Mono 500          | 11px    | 11px    | 11px    | 1.50, .06em tracking |

Font sizes use rem. DM Sans 700 is explicitly loaded. Full identifiers and detail
names wrap; card names use two lines and retain complete text in the accessible
link and product page. Normal metadata stays sans, without small uppercase mono
codes. Disabled/unavailable states have text and semantics as well as color.

The spacing scale is 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64px, exposed as
`--space-*` tokens. Image → card title is 12/16px; title → code 4px; code → price
and price → swatches 8px. Detail title → code is 8px; code → price 20px; choices
and action groups use 24px. Fields use 16px gaps, 8px label gaps. Staff cards use
20px padding on phones, 24px thereafter; login uses 24/32px. Related staff sections
and columns use 24px gaps. Phone bottoms include 24px + the safe-area inset.

## Containers and responsive constraints

| Layout           | Constraint / behavior                                                                                                                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public content   | 1720px maximum; gutters 20px phone, 24px tablet, 48–64px desktop                                                                                                                                                                                          |
| Catalogue        | One column below 360px; two at 360px; three at 720px; four at 1200px. Those widths preserve approximately 180–300px card/image tracks. Stable 4:5 image frames; intentional 1px dividers.                                                                 |
| Public header    | Continuous white logo/nav surface; 104px logo row phone / 128px larger screens. Category nav is centered when it fits and horizontally scrollable otherwise. Active state includes a border/weight and `aria-pressed`.                                    |
| Product header   | 96px compact row with a separate 44px back control; no absolute narrow text slot                                                                                                                                                                          |
| Product          | Stacks below 960px; splits 56/44 thereafter, ensuring usable choices beside photography. Main image uses contain on white; capped by 62svh stacked / 720px desktop. Arrows align to the main frame; 44px pip targets and 72/84px color thumbnails follow. |
| Staff shell      | 1920px maximum; rail 224px at 1024px and above. Labelled four-workspace top navigation otherwise; sign-out stays visible. Main gutters 16/24/32px.                                                                                                        |
| Picker/editor    | Workspace container >=960px: 320–340px picker + remaining editor. Otherwise stack. Editor container >=720px: details/photos split 45/55; otherwise one column. Both tracks have `min-width: 0`.                                                           |
| Scroll regions   | Picker/history max 42svh/360px when stacked; max 72svh/760px when split. No minimum-height trap; natural document scrolling contains editor actions.                                                                                                      |
| Import workbench | One column until workspace >=960px; source/selection/action columns thereafter. Progress/feedback/preview span all columns. Tracker uses two columns below 640px, four otherwise. Expanded values wrap inside their panel.                                |
| Access forms     | Login 440px maximum, security 560px; grow naturally with content and short keyboard-height windows                                                                                                                                                        |

Safe-area padding applies separately on left/right and at the final actions.
`svh` is a stable minimum/cap, not a fixed-height clipping wrapper. There are no
fixed bottom actions obscuring mobile keyboards. Native keyboard/voice control,
pointer controls, and predominantly horizontal swipe gestures remain available.

## Preserved behavior

OfficiallyDavit remains the only ordering destination. The visible default size
matches the first POS variant that was already included in the order message.
Color changes reset the photo and size; exact color media and shared fallback,
availability/privacy, lifecycle, cleaned-code grouping, immutable POS identity,
Just In, category normalization, and catalogue return position are preserved.

The unified editor edits website presentation and manages color photos. Hidden
batch matching/archive reuse remain hidden. Native import disclosures and
preview/review/apply/removal safeguards remain; row validation now explains why
application is blocked. Card media falls back to the first remaining photograph
when a primary was deleted, without increasing the public card payload to a full
gallery. Authentication, visible sign-out, and the four-character owner password
minimum remain intact.
