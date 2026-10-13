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

The homepage now puts customer deliveries immediately after a compact introduction. The design uses Thimadu's blue branding, warm white surfaces, Inter typography, simple navigation and a compact contact footer.

1. A split introduction with the supplied `public/Videos/hero1.mp4`, vehicle link, delivery anchor and direct phone number.
2. A customer photo/video grid on desktop and phones, with All / Photos / Videos filters and up to six items per selection. It balances media types when both collections have records.
3. Current vehicle listings with search and category shortcuts.
4. Three straightforward links for buying, selling and sourcing, followed by FAQs.
5. A WhatsApp enquiry form and contact/navigation footer with the HICH WEB credit.

Both the homepage and `/reviews.html` use the same accessible delivery viewer. Photos open full size; videos support direct MP4/WebM/Ogg, YouTube, Google Drive and Vimeo. Other video links offer an original-source action. The viewer supports previous/next, arrow keys, Escape and focus restoration. No likes, comments or invented ratings are displayed.

Delivery content comes from the existing Apps Script `customers` and `videos` collections. Add active customer photos and videos through the existing admin portal; the website does not add sample customer media. A video thumbnail is optional for YouTube/Drive, and recommended for direct or externally hosted videos. Each card displays the published headline and customer/location details. Unavailable media shows an explicit fallback; missing feeds offer retry while keeping available collections usable.

Phones and reduced-motion/data-saving visitors see the hero poster until they choose Play. Desktop autoplay is muted and pauses when the hero leaves the viewport or the tab is hidden. The grid is stationary on all devices. The prior phone, gauge, story carousel and decorative journey sections are no longer mounted on the homepage; their source files remain in the repository.

Vehicle details reserve space beneath fixed navigation. Keyboard focus is managed in mobile navigation and native dialogs. Every public page retains the HICH WEB design/development credit, website and click-to-call phone number.

## Routes

| Page | Path |
| --- | --- |
| Home | `/` or `/index.html` |
| Inventory | `/all-vehicles.html` |
| Vehicle details | `/car-details.html?vehicle=…` |
| About | `/aboutus.html` |
| Services | `/services.html` |
| Customer deliveries | `/reviews.html` |
| Delivery videos | `/reviews.html?tab=videos` |
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

`Code.gs` requires the **`THIMADU_ADMIN_TOKEN` Script Property**. There is no password embedded in the public admin page and no insecure fallback. If the property is unset, admin authentication and write requests fail with `ADMIN_NOT_CONFIGURED` before accessing the spreadsheet.

To activate or repair the admin portal:

1. Open the Apps Script project behind the configured `/exec` URL.
2. Replace its script with the repository's complete `Code.gs` file.
3. In **Project Settings → Script Properties**, create or update `THIMADU_ADMIN_TOKEN` with the intended admin password. Do not add spaces around it.
4. Run `verifyAdminDeployment` once from the Apps Script editor and approve the Spreadsheet/Drive permissions. It should report `status: ready`, `apiVersion: 2.1.0`, and `tokenConfigured: true` without displaying the password.
5. Choose **Deploy → Manage deployments → Edit → New version**, keep **Execute as: Me** and **Who has access: Anyone**, then deploy. Updating the existing deployment preserves the URL already used by both admin HTML files.
6. Open `/ADMIN-THIMADU.html`. Its connection indicator must say **Secure admin service connected · API 2.1.0** before login.

If the indicator says the deployment belongs to another project, the configured URL is serving the wrong Apps Script project or an old deployment version. Authentication cannot work until steps 1–5 are completed.

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
