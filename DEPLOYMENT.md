# Deployment checklist

- Set all variables from `.env.example` in the hosting provider.
- Set `WHATSAPP_ORDER_NUMBER` in international format without `+` or spaces.
- Configure Cloudinary for persistent product uploads. Without it, images are stored under `public/uploads`, which is suitable for localhost but not ephemeral hosting.
- Replace SQLite with PostgreSQL before a public launch: change Prisma's datasource provider to `postgresql`, set the hosted `DATABASE_URL`, and run `npx prisma db push` (or create a migration).
- Use a strong `NEXTAUTH_SECRET` and the public site URL for `NEXTAUTH_URL`.
- Back up the production database regularly.
- Admin accounts cannot be created publicly. Use the seeded admin account or add approved admins directly in the database.

## Love-letter subdomain (`love.larkvine.org`)

The private love experience lives at `/love` and is served on its own host. The
`larkvine` worker (`wrangler.jsonc`) already serves `larkvine.org` and
`www.larkvine.org` as Workers custom domains, so add the subdomain the same way
and no change to `wrangler.jsonc` is needed:

1. Cloudflare dashboard → Workers & Pages → `larkvine` → Settings → Domains &
   Routes → **Add** → Custom Domain → `love.larkvine.org`.
   (This creates the proxied DNS record and TLS certificate automatically.)
2. Deploy the worker so the middleware host rewrite is live:
   `npm run deploy`.
3. Verify `https://love.larkvine.org` shows the password gate and that
   `https://love.larkvine.org/anything` also resolves to the experience.

`src/middleware.ts` rewrites every request on `love.larkvine.org` to `/love`,
so the marketplace never appears on that host. The password is a case-insensitive
romantic gate (hash-checked client-side), not real authentication.

### Our song

The "Play our song ♫" button streams from `/api/love-song`, which serves the
track out of the `PRODUCT_IMAGES` R2 bucket at `love/girls-like-you.mp3` with
byte-range support (required for mobile Safari playback/seeking). To replace it:

```
npx wrangler r2 object put "adetola-luxe-product-images/love/girls-like-you.mp3" \
  --file path/to/song.mp3 --content-type audio/mpeg --remote
```

Set `NEXT_PUBLIC_LOVE_SONG_URL` to an absolute URL to bypass R2 and stream a
hosted file instead. The track is copyrighted — keep it out of source control.

## Runtime compatibility (important)

The known-good production combination is **Next.js `16.3.x` + `@opennextjs/cloudflare` `1.20.7`**
(both pinned in `package.json`). Next 16.3 with `@opennextjs/cloudflare` 1.20.2 hangs on the
Workers runtime (cross-request `IoContext` / `CacheSignal`) and must not be used. Before every
deploy run the mandatory gate `npm run verify:worker-runtime` (builds the worker, runs it under
workerd, checks critical routes). Full detail: `docs/FOUNDATION-DEPLOYMENT.md`.
