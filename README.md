# Thimadu Auto Traders

React 19, React Router and Vite website with live vehicle inventory and the existing Google Sheets / Apps Script integration.

## Run

```powershell
npm.cmd install
npm.cmd run dev -- --port 5174
```

Open `http://127.0.0.1:5174`. To build production files:

```powershell
npm.cmd run build
npm.cmd run preview
```

## Design and homepage

The layout follows the user-requested [Driveberry reference](https://driveberry.fr/), with Thimadu branding and a blue, white and light-blue palette. Ubuntu headings and Inter body text are self-hosted. The italic serif treatment is removed, and the existing transparent PNG logo is displayed without an added background, border or frame.

The full homepage includes:

1. Full-screen video using the supplied `public/Videos/hero1.mp4`, with a generated video-frame poster, mute, loop and a pause/play control.
2. A pinned, scroll-driven transition into a three-dimensional iPhone with metallic edge layers, camera island, bezel, glass reflection and side controls.
3. An animated, navigable mobile website demonstration inside the phone. The preview cycles through browsing, selling, sourcing and support, scrolls through the collection screen, and stops automatic cycling when interacted with.
4. Moving manufacturer tiles, floating phone callouts and an introduction beside the phone.
5. A semicircular animated gauge with moving benefit cards.
6. Four complete alternating service chapters for each of the four journey tabs. A sticky dropdown replaces the tabs on mobile.
7. Published customer stories with manual controls, pause and swipe support.
8. Horizontal photographic scenes and illustrative enquiry conversations.
9. An interactive Sri Lanka map that composes city-specific enquiries.
10. Current vehicle listings, search and category shortcuts.
11. Expanding service guides, FAQs, a large closing dial and the two-panel footer with outlined wordmark and an enquiry form.

Small screens use a stacked phone layout and stacked photographic scenes. Reduced motion disables pinned sequences, animated page curtains and automatic phone cycling. Hero video does not autoplay under reduced-motion or data-saving preferences; it can be played explicitly. Phone, film and story animations avoid unnecessary work when out of view. Keyboard focus is managed in mobile navigation and native dialogs.

## Routes

| Page | Path |
| --- | --- |
| Home | `/` or `/index.html` |
| Inventory | `/all-vehicles.html` |
| Vehicle details | `/car-details.html?vehicle=…` |
| About | `/aboutus.html` |
| Services | `/services.html` |
| Customer stories | `/reviews.html` |
| Video stories | `/reviews.html?tab=videos` |
| Sell a vehicle | `/sell-your-vehicle-sri-lanka.html` |
| Request a specific vehicle | `/vehicle-sourcing-sri-lanka.html` |
| Vehicle information | `/vehicle-information-support.html` |
| Not found / recovery search | `/404.html` |
| Existing administration | `/admin.html`, `/ADMIN-THIMADU.html` |

Search supports make, model, type, fuel, price, year, condition and availability. Filters are retained in the URL. Stock detail views refresh when the inventory source updates, label cached information and preserve the stock reference when opening a support enquiry. Reviews retain a working photo or video collection when the other source is unavailable.

Enquiry forms validate details and open a WhatsApp draft to `+94 77 181 3928`. Visitors review and send the draft themselves. The website does not claim an enquiry has been saved to a database or automatically sent.

## Production hosting

Publish the **contents of `dist/`** at the domain root, preserving the generated HTML entries, asset directories and query strings. Configure the host to return `404.html` with HTTP 404 for unknown URLs. The source folder is not the deployment output. The project has not been deployed during this work.

Before building for a known domain, run the existing sitemap generator:

```powershell
python generate-sitemap.py https://your-real-domain.example/
```

Use that real domain for absolute canonical and social metadata in static HTML and add its sitemap URL to `public/robots.txt`. Client-side metadata already follows the active host, but static social crawlers may not execute JavaScript. Google Sheets sharing and the existing Apps Script endpoint must remain available for live stock and stories.

## Local backend hardening

`Code.gs` now requires the **`THIMADU_ADMIN_TOKEN` Script Property**. There is no fallback admin password. If it is unset, admin authentication and write requests fail with `ADMIN_NOT_CONFIGURED` before accessing the spreadsheet. Set the property in Apps Script project settings before deploying this source. Use a strong private value and continue entering it through the existing admin login.

Public GET requests no longer initialize, repair or mutate spreadsheet structure. For a new database, run `setupDatabase` in Apps Script or use the authenticated setup action. These source changes take effect only when the Apps Script web app is redeployed; no remote configuration, database migration or deployment was performed here.

The public spreadsheet collections should contain information intended for public access. Hiding a record in the interface does not make a publicly shared spreadsheet private.

## Verification

```powershell
npm.cmd test
$env:TEST_URL = 'http://127.0.0.1:5174'
npm.cmd run test:ui
```

`npm test` covers inventory caching/timeouts and locally mocked Apps Script authentication/read-only behavior. Browser checks use installed Google Chrome and cover 10 routes at widths 320, 390, 768 and 1440; inventory, reviews, forms, navigation, all four service chapters, phone preview, reduced motion, dialogs and recovery paths. Synthetic stock and stories are limited to isolated test browsers. Tests never send WhatsApp messages or write to live sources. Reports and screenshots are in `.audit/`.

## Media and source layout

- `src/sections/HeroStory.jsx` and `hero-story.css`: video, scroll sequence, reusable iPhone preview and confidence gauge.
- `src/sections/JourneyTimeline.jsx` and `journey-timeline.css`: four full chapters per service journey.
- `src/reference-design.css`: active shared visual refinements. `src/refinements.css` is an unused previous design stylesheet.
- `src/navigation.jsx`: navigation, keyboard search, filtering preview and mobile focus management.
- `src/inventory.jsx`: inventory and exact-vehicle details.
- `src/pages/ReviewsPage.jsx`: published customer media and resilient collection loading.
- `public/Videos/hero1.mp4`: user-specified hero film. `public/images/hero1-poster.webp` is a frame extracted from this film.
- `public/images/hero.webp`, `journey.webp`, `coastal-journey.webp`: generated atmosphere images, not available-stock or customer-delivery evidence. The new coastal image was made using built-in image generation; exact prompt and provenance are recorded in `.audit/generated-assets.md`.
- `public/maps/README.md` and `public/fonts/*LICENSE*`: map and font attribution.

Previously downloaded reference media remain in the source folder for continuity. The production build excludes the two retired films and three unused reference photographs/posters. The current public React experience uses the supplied hero film and the generated atmosphere photographs. Manufacturer images remain the existing assets in `public/brands/`.
