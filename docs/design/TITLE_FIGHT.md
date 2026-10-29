# Title Fight: original supplied artwork

The user requested preserving their images everywhere on 29 October 2026. This supersedes the previous generated arena and recreated vector crests.

## Page cards

`public/title-fight-original-layout.jpeg` is a byte-identical copy of `templates/layout_title_fight.jpeg`. `OriginalTitleArt` uses SVG viewports to display the original header and each division card without recoloring, filtering or redrawing its emblems, fighters, frames and VS graphics. Phone chrome and navigation from the screenshot are cropped away.

Only rectangles containing example match numbers, status, team names and dates receive localized text restoration from `public/title-fight-text-restoration.webp`. All remaining pixels come from the original JPEG. Accessible HTML displays actual data over those fields. Scores/results remain below the artwork. Frozen titles remain visible to all three workspaces; public spectators still open betting rather than private challenge details.

The restoration was produced with the built-in image_gen editing tool, using the original layout as the sole input. Output was copied from the Codex generated_images directory into the workspace; it is used only through field-sized SVG clips, never as a replacement illustration. No CLI/API key was used.

Final edit prompt:

> Precise local text cleanup, NOT a redesign. Edit the supplied screenshot, preserve its exact 740x1600 composition, crop, borders, logos, colors, fighters, rackets, laurels, gold crown emblem, silver star emblem, bronze helmet emblem, VS brush graphics, lights, particles, typography outside the editable fields, and every other element. Remove ONLY the printed example match numbers (#001/#002/#003), the small TITLE FIGHT next to those match numbers, the word Marcado and its green dot inside each status pill (keep pill glass and frame), the player/team names inside all six attack/defense strips (keep Ataque, Defesa, icons and strip frames), the two large centered team names in each of the three cards (keep their VS artwork exactly), and all three bottom-right example dates and times (keep calendar icons). Reconstruct the original dark smoky/metallic textures smoothly behind those removed strings, without black blocks, boxes, blurring or covers. Do not remove or modify LIGA OURO, LIGA PRATA, LIGA BRONZE, the whole page header, the subtitle, the history heading or navigation. There are three card rectangles approximately gold x19 y355 w704 h320; silver x19 y681 w704 h320; bronze x19 y1008 w704 h327. Do not move anything. Do not redraw or reinterpret any illustration. Output the same full screenshot at the same composition. Only tiny rectangles containing variable data from your output will be used; every other pixel will still come from the untouched original file.

## Exported posters

The existing original JPEG plus localized field restoration approach is retained. The additional Bronze belt/emblem replacement has been removed: original three-star artwork is preserved. Browser regression compares the entire top 1200 pixels of all three exported title posters against the originals, including the belt. Regular ranking/fixtures retain their existing canonical division emblem.

## Fonts

Existing local Bebas Neue and Manrope families remain in use, with their SIL Open Font License files under `public/fonts`. No external font request is needed.
