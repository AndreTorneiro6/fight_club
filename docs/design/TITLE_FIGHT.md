# Title Fight visual reference

Reference: `templates/layout_title_fight.jpeg`, supplied by the user.

The page uses live HTML for the teams, match numbers, division, date, state and result. The reference's sample names and scores are not embedded in the artwork. The current Fight Club brand and official Neiva Padel Club logo are retained. The arena artwork is decorative, and the history is a keyboard-accessible native disclosure. Spectators open the public betting page rather than private challenge details.

## Arena artwork

- Built-in `image_gen` tool (not the CLI).
- Saved asset: [public/title-fight-arena.png](../../public/title-fight-arena.png).
- Reference used for visual style: the supplied layout image.
- Opaque landscape background,1536×1024. No live content, brand marks, names or scores rendered in the image.

Final generation prompt:

> Create one production website decorative BACKGROUND asset based on the supplied reference image (reference is a UI layout, not an image to copy wholesale). Output a single LANDSCAPE 1536x1024 rectangular illustration. Match the reference match card atmosphere: almost black distressed metal, subtle chain-link fencing at the outer edges, amber/gold burning smoke and sparse sparks at both sides; two anonymous dark padel player silhouettes facing each other with rackets, confined to the extreme left and right lower edges, cropped naturally, each occupies at most 17 percent of the width. They are generic sporting silhouettes, no real identities. Keep the middle 65 percent very dark and completely unobstructed, with barely visible metal texture; preserve lots of empty space in the upper middle for live HTML text. Light gold ember flares at the outer corners. Premium cinematic black-and-gold padel fight-night style, dramatic rim lighting, realistic smoky texture. This is BACKGROUND ART ONLY: absolutely NO letters, NO numbers, NO text, NO logos, NO badge, NO VS lettering, NO borders/frames, NO UI elements, NO cards, NO device mockup, NO watermark. Fill the entire rectangular output with the backdrop. Do not render the reference UI, just its decorative smoky black/gold sports atmosphere.

## Fonts

The existing Bebas Neue and Manrope families are served from `public/fonts` and preloaded by the root layout, so the layout and mobile navigation do not depend on a third-party font request. The browser regression blocks Google Fonts requests explicitly.

Original unmodified font binaries and their SIL Open Font License notices were obtained from the official [Bebas Neue](https://github.com/google/fonts/tree/main/ofl/bebasneue) and [Manrope](https://github.com/google/fonts/tree/main/ofl/manrope) directories in Google Fonts. License files are stored beside each font.
