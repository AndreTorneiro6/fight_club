# Profile-photo cartoon (private admin preview)

Admin → Gamificação → Cartas e avatares. Select a player with an uploaded Perfil photograph. The front keeps the original; the back automatically loads a locally processed cartoon from that same photograph. The nickname and social values remain editable. Both-face PNG export includes the generated cartoon. Without a photo the existing customizable illustration remains available. An unsupported external photo asks the admin to upload it through Perfil; the server never fetches arbitrary image URLs.

The Python/Pillow filter smooths, reduces the palette and draws contours, retaining the actual subject rather than generating a different face. It is a deterministic cartoon filter, not a generative illustration model. No third-party image service receives photos.

Original photos remain in MongoDB `photos`; derived PNGs are cached in `photoCartoons` keyed by immutable source photo ID and filter version. Neither originals nor derivatives are written to `public/` or any filesystem photo folder. EXIF is removed. Changing the Perfil photo ID automatically selects a different derivative. The authenticated same-origin POST endpoint is admin-workspace-only, including when returning a cached image, with no-store responses. Two subprocesses maximum per application process, coalesced requests, input/pixel/output bounds and a 15-second timeout constrain resource use. Failures expose a retry button; export waits for a successful cartoon.

Runtime requires Python 3 and Pillow: Debian/Ubuntu `sudo apt-get install python3-pil`; production Docker installs `python3 py3-pillow`. CI installs the Debian dependency before tests. No separate service or paid model needed. Unit tests cover real Python output, invalid input and coalescing; the browser scenario checks uploaded-photo reuse, image dimensions, cache response, PNG export and player-workspace denial.

Initial cartoon integration released via PR #3 on 23 October 2026. No production photographs or competition data were changed during implementation.

## Reference-style cards

The administrator preview follows the angular dark/metallic layout of the supplied Untitled.jpeg with original SVG artwork, automatically using Ouro, Prata or Bronze from the current division. Verified Fight Club counts and recent confirmed results appear on the front; unavailable self-assessments remain dashes. No invented division history, awards or excluded game modes are introduced.

In Admin → Gamificação → Cartas e avatares, choose a player, edit **Slogan da carta**, draw **Assinatura na carta** with a finger or mouse, and save. Clear removes the drawn signature. These optional fields are versioned and audited with the card and remain admin-only during the private preview. Export produces a 1520×1060 PNG of both faces with their actual theme, slogan and signature, embedding profile/cartoon photos only in memory. Signature is decorative rather than legal authentication.
