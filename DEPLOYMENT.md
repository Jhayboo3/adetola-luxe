# Deployment checklist

- Set all variables from `.env.example` in the hosting provider.
- Set `WHATSAPP_ORDER_NUMBER` in international format without `+` or spaces.
- Configure Cloudinary for persistent product uploads. Without it, images are stored under `public/uploads`, which is suitable for localhost but not ephemeral hosting.
- Replace SQLite with PostgreSQL before a public launch: change Prisma's datasource provider to `postgresql`, set the hosted `DATABASE_URL`, and run `npx prisma db push` (or create a migration).
- Use a strong `NEXTAUTH_SECRET` and the public site URL for `NEXTAUTH_URL`.
- Back up the production database regularly.
- Admin accounts cannot be created publicly. Use the seeded admin account or add approved admins directly in the database.
