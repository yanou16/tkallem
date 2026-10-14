# Tkallem design system (Miro-style)

Read this file before building or changing any UI. Use only the tokens below: no new colors, radii, fonts or shadows.
Tokens live in `tokens.css` (CSS variables) and `tailwind.preset.ts` (Tailwind classes). Components are built on shadcn/ui, restyled with these tokens.

## Feel

Friendly, calm, confident. A white canvas, black pill buttons, soft pastel cards, big numbers for progress.
It is a speaking coach for stressed students: every screen answers one question and has one primary action.
Inspiration from Miro's structure, not its identity: never use the word "Miro", never copy its logo.

## Colors

| Token | Hex | Use |
|---|---|---|
| canvas | #FFFFFF | Page background, cards |
| surface | #F7F8FA | Coach bubbles, inputs, quiet panels |
| ink | #1C1C1E | Main text, primary buttons, student bubbles, stat card |
| charcoal | #2C2C34 | Body text on pastel cards |
| slate | #555A6A | Secondary text |
| steel | #6B6F7E | Tertiary text, inactive tabs |
| stone | #8E91A0 | Captions, placeholders |
| hairline | #E0E2E8 | Borders |
| hairline-soft | #EEF0F3 | Dividers |
| hairline-strong | #C7CAD5 | Input and secondary button borders |
| brand-yellow | #FFD02F | ONLY: logo mark, mic button ring, prototype pill |

### Scenario tints (one meaning each, never decorative elsewhere)

Calmed on 14 October 2026 (same hues, less saturation, one lightness band) so that no pastel shouts and every text on them passes AA: charcoal 11 to 12:1, slate 5.3 to 6:1. **Steel and stone text never go on a tint** (steel is 3.9 to 4.4:1 there). The everyday scenes have no tint: they sit on `surface`. No other pastel exists: the retired mint, butter, peach, rose and lilac tokens are gone (a test guards it).

| Token | Hex | Scenario |
|---|---|---|
| tint-visa | #DDF4F1 | Visa interview |
| tint-campus | #F7F0D4 | Campus France interview |
| tint-job | #FAE8D8 | Remote job interview |
| tint-ielts | #F6DCDC | IELTS Speaking |

### Feedback colors (traffic light, fixed meaning)

| Status | Text | Background | Meaning |
|---|---|---|---|
| good | #0A7A4B | #D9F5E9 | Correct, clean sentence, on track |
| warn | #9A5B00 | #FFF1D6 | Small fixes, to work on |
| bad | #B42318 | #FDE2E1 | Priority, redo this answer |

Rules:
- Never use good/warn/bad colors for decoration.
- Never rely on color alone: always pair with a word ("Clean", "2 fixes", "Redo") or an icon.
- Text uses the dark "Text" values (AA contrast on white). The bright #00B473 is allowed only as a fill behind white bold text (badges).

## Typography

Font: **Figtree** (Google Fonts, free). One family, weights 400, 500, 600.

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| display | 48 / 1.15, tracking -1px | 500 | Page titles (web) |
| h2 | 36 / 1.2 | 500 | Page titles (mobile: 28) |
| h3 | 28 / 1.25 | 500 | Section titles, greeting |
| h4 | 22 / 1.3 | 500 | Card titles |
| h5 | 18 / 1.4 | 500 | Small titles, scenario names |
| body | 16 / 1.5 | 400 | Text, chat bubbles |
| small | 14 / 1.5 | 400 | Secondary text, explanations |
| caption | 13 / 1.4 | 600 | Badges, chips, labels |
| stat | 64 / 1.05, tracking -1.5px | 500 | Progress numbers |

Never use weight 700. Never use all caps except tiny labels.

## Shape and spacing

- Radius: 8 (inputs), 12 (tables, panels), 16 (correction card), 20 (chat bubbles, small stat tiles), 28 (scenario and stat cards), full (all buttons, tabs, chips, badges).
- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Mobile padding: 20. Web content padding: 44 to 56.
- Shadows: none by default. Only modals and dropdowns: `0 16px 48px -8px rgba(5,0,56,.12)`.
- Touch targets: at least 44 x 44 px.

## Components

### Buttons
- **Primary:** ink background, white text, pill, `14px/500`, padding 12 x 24. One per screen.
- **Secondary:** transparent, ink text, 1px hairline-strong border, pill.
- **Text link:** ink, underlined, 14/500.

### Pill tabs
Inactive: white, steel text, hairline border. Active: ink background, white text. Example: "Eligible 3 / Almost 1".

### Chips
White or outline pill, caption weight. Used for region, level ("B1"), streak.

### Scenario card
Radius 28, padding 16 (mobile) / 22 (web), background = the scenario tint. Title h5, subtitle small charcoal with duration. Whole card is tappable.

### Stat card
Radius 28, ink background, white stat number, stone label, a good/warn/bad badge for the trend ("-4 in 2 weeks").

### Chat bubbles
- Coach: surface background, ink text, radius 20, max width 78% (mobile) / 60% (web), left aligned.
- Student: ink background, white text, radius 20, right aligned.

### Correction (the key component)
Shown right under the student bubble, right aligned, radius 16, surface background, hairline-soft border:
1. Line 1, small slate: the original sentence with each wrong part as `<s>` in bad text color.
2. Line 2, small 500 ink: the corrected sentence with each fixed part in good text color, weight 600.
3. Line 3, small steel: one-sentence explanation in French.
Max 3 corrections per answer. Animate in with fade + 8px upward slide, 200ms, after the coach reply starts.

### Sentence status (session report)
A 4px vertical bar left of each transcript line: good / warn / bad color + a word label at the end ("Clean", "2 fixes", "Redo").

### State indicator (no avatar)
One component, three states, always with a text label:
- **Listening:** 12 ink bars, heights animated with scaleY (0.4 to 1), 900ms loop, staggered 60ms. Label "Listening…".
- **Thinking:** 3 ink dots pulsing opacity 0.3 to 1, 1200ms loop, staggered 150ms. Label "Thinking…".
- **Speaking:** a 64px ink circle scaling 1 to 1.06, 800ms loop. Label "Speaking…".
With `prefers-reduced-motion`, show the static shape and the label only.

### Mic button
76px ink circle (58px on web bars), white mic icon (lucide `Mic`), 6px brand-yellow ring when recording. Under it, a "Type instead" text link.

### Prototype banner
Full-width ink strip, white small text "Prototype with example data" + yellow pill "Always check the official page". Remove only when content is validated.

## Motion

Framer Motion only. Durations 150 to 250ms, ease-out. Screen transitions: fade 200ms. No bounce, no parallax, no confetti.

## Icons

lucide-react, 20px, stroke 1.75, ink or slate. No emojis in the UI.

## Do and don't

Do:
- One primary action per screen.
- Show the student's level on the practice screen ("Coach at B1").
- Show deadlines, numbers and corrections exactly as computed by the backend.

Don't:
- No purple, no gradients, no glow, no robot or sparkle icons.
- No yellow outside the logo, mic ring and prototype pill.
- No pastel used without its scenario meaning.
- No avatar or face for the coach.
- No AI clichés in copy ("Elevate", "Seamless", "Unleash").
