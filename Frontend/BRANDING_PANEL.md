# Login branding panel

The existing project used JavaScript and plain CSS. This integration adds TypeScript for new components, Tailwind CSS v4 through the Vite plugin, and shadcn-compatible aliases and `components.json`. Existing JavaScript pages remain supported.

- `src/components/ui/3d-card.tsx`: reusable CardContainer, CardBody, and CardItem, adapted from the supplied Aceternity component. Motion springs provide bounded pointer tilt; touch and reduced-motion users get a static composition.
- `src/pages/Login/BrandingPanel.tsx` and `BrandingPanel.css`: branded scene and responsive layout.
- `src/lib/utils.ts`: shadcn-style `cn` helper.
- `src/styles/tailwind.css`: Tailwind theme/utilities without global Preflight, preserving the existing application's reset. Dark tokens are scoped to the branding panel.

`src/components/ui` is the reusable UI directory (the `@/components/ui` alias resolves here). Keeping UI primitives separate from page content makes them reusable and lets the shadcn CLI resolve components consistently. This is a Vite app, so no Next.js setup is required.

## Setup and verification

Run `npm install` after pulling the changes. For a fresh equivalent setup, install `motion clsx tailwind-merge tailwindcss @tailwindcss/vite`, then install `typescript` as a development dependency. The Vite alias, Tailwind plugin, TypeScript config, CSS imports, and shadcn config are already included. There is no need to rerun the shadcn initialization wizard over these files. For a new unconfigured project, `npx shadcn@latest init` creates the initial shadcn configuration; review its global CSS changes before applying them to an existing app.

Run `npm run typecheck` and `npm run build`. Run `npm run dev` to view the login page. Check pointer tilt and exit reset, role selection, password visibility, reset navigation, narrow screens, and the OS reduced-motion preference. Authentication still uses the existing API and the server-returned role controls permissions.

Implementation references: [Tailwind Vite installation](https://tailwindcss.com/docs/installation/using-vite), [Motion springs](https://motion.dev/docs/react-use-spring), and [reduced motion](https://motion.dev/docs/react-use-reduced-motion).

## Generated asset

Saved at `src/assets/thimadu-sedan-hero.png`. Generated with the built-in imagegen tool. No remote image request is required at runtime.

Final prompt:

> Use case: ads-marketing. Asset type: cinematic photographic background for the left half of a luxury automotive login page. A sleek black luxury executive sedan, BMW-inspired proportions, dynamic front three-quarter angle facing left, entire car visible, in a vast dark midnight-blue studio. Cool cyan rim lighting along body and roof, restrained teal accents, soft volumetric light rays from upper right, subtle reflective floor. Sophisticated, photorealistic, premium, slightly desaturated. Portrait 2:3 composition: car across lower-middle third, upper half mostly deep navy negative space for readable UI copy; generous dark space around car. No text, no watermark, no badges, no UI, no people. Crisp professionally photographed details, calm and powerful mood.
