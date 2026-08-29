# Larkvine — Human Testing Guide

Welcome to the Larkvine marketplace test! This guide walks you through everything to test and exactly what to check at each step.

**Live URL:** https://larkvine.jeremiahoshiokhame.workers.dev

> **Tip:** Test on both **mobile** (phone browser) and **desktop** (laptop) for the best coverage. The site should work well on both.

---

## Part 1 — Browsing the marketplace (no login needed)

### 1. Homepage
Open the homepage.
- [ ] The hero section shows "One marketplace. / Every store you love." with a dark green background, gold accents, and animated glow effects
- [ ] Stats show the number of stores and products (e.g. "1 Store / 38 Products")
- [ ] A row of store avatars appears (shows the first store's initial)
- [ ] "Shop by Store" section lists stores with logo/initial and product count
- [ ] Product carousels: "New Arrivals", "Trending", and category sections scroll horizontally
- [ ] All links on the page are clickable and go to the right place

### 2. Search (new feature — important to test!)
Click the **search icon** (magnifying glass) at the top-right of the header.
- [ ] A search panel drops down and the cursor is already in the box
- [ ] Type part of a product name (e.g. "dress", "kaftan", "blazer") — results appear as you type (products + their store)
- [ ] Type a store name (e.g. "TNC") — the store appears in results
- [ ] Type a category name (e.g. "Ready-to-Wear") — the category appears in results
- [ ] Press Enter → you go to the full `/search` results page
- [ ] Test a search **with no matches** (e.g. "zzzz") — you should see a friendly "No results found" empty-state message
- [ ] Test search on **mobile** — the same search button and panel should work

### 3. Stores directory
Go to **Stores** (from the header menu or the "Browse Stores" button).
- [ ] Lists all open stores with logo/initial, name, and product count
- [ ] "Visit →" links open each storefront
- [ ] If you click a store, you land on that store's page

### 4. Storefront page
Open a store (e.g. TNC Collections).
- [ ] Store header shows the store name, initial logo (or uploaded logo), and "Storefront" label
- [ ] "Shop the Collection" shows the store's products in a grid
- [ ] Product cards show image, name, price, stock status, and a store badge
- [ ] Clicking a product opens its detail page

### 5. Product page
Open a product.
- [ ] Image, name, price, and description display correctly
- [ ] Sizes and colours are selectable (if the product has them)
- [ ] "Add to Cart" works and shows feedback
- [ ] The cart icon in the header updates its count

---

## Part 2 — Cart & Checkout (the money path)

### 6. Cart
Add a few products, then open the cart.
- [ ] Each item shows name, **store name**, size, colour, price, and quantity
- [ ] You can change quantity or remove items
- [ ] The store name on each item links to that store

### 7. Checkout — multi-store order (important)
At checkout (requires a **customer account** — see Part 4 to create one):
- [ ] You can check out with items from **more than one store** in the same cart
- [ ] On submit, a WhatsApp chat opens for **each store** (one per store, to that store's own number)
- [ ] Each WhatsApp message contains: NEW ORDER, Order ID, Customer Name, the items (Product / Size / Colour / Quantity / Price), Total, "Payment Status: Paid", and the delivery address
- [ ] After ordering, you land on an **order confirmation** page that lists all your orders grouped by store, with a Marketplace Total

---

## Part 3 — Customer account (for checkout)

### 8. Create an account & login
- [ ] **Register** at `/signup` — create a customer account (name, email, password)
- [ ] **Login** at `/login`
- [ ] Sign out and sign back in to confirm the session works
- [ ] Update your profile (address, phone) at `/account/profile` — needed for checkout

---

## Part 4 — Selling on Larkvine (vendor onboarding) (important)

### 9. Apply to open a store (new approval workflow — important to test!)
Go to **"Sell on Larkvine"** (`/sell`).
- [ ] Signup form asks for store name, description, contact/WhatsApp details, and account info
- [ ] After submitting, you see **"Application submitted successfully."** with a message that your application is under review (you are NOT redirected to a storefront)
- [ ] A vendor account is created with role "vendor"
- [ ] Your store is in **Pending** status — it does NOT appear:
  - On the homepage "Shop by Store" or product carousels
  - In the `/stores` directory
  - In search (`/search` or the header search)
  - At its public storefront URL (should be a 404)

### 10. Pending vendor sees a notice
Log in as that pending vendor and open the header menu → a store dashboard link (e.g. "Products").
- [ ] You see **"Your store application is under review."** and **"You will be able to manage your storefront once your application has been approved."**
- [ ] You CANNOT access Dashboard, Products, Orders, Categories, Discounts, or Store settings yet

### 11. Approved vendor dashboard
Once a super admin approves your store (see Part 5):
- [ ] Log in, open the menu → "Store Dashboard" — the full dashboard appears (Dashboard, Store, Products, Categories, Orders, Discounts)
- [ ] **Dashboard** shows your order revenue, order count, product count, low stock
- [ ] **Products:** add a new product (name, price, stock, images, description, sizes, colours, category), and confirm it appears in your storefront and the marketplace homepage after saving
- [ ] **Products:** edit and delete (unpublish) a product
- [ ] Your storefront URL is now live (e.g. `/{your-store-slug}`) and your store appears on the homepage and `/stores`

### 12. Store logo (new feature — important to test!)
Go to **Store** in the vendor dashboard (or the "Store" link).
- [ ] You see your store name and current logo (or initial)
- [ ] **Upload** a logo (JPG/PNG/WebP, under 2 MB) — you should see a **preview** before saving
- [ ] Save — confirm the logo now appears on:
  - Your storefront header
  - The homepage "Shop by Store" cards
  - The `/stores` directory
  - The product-card store badge
- [ ] **Replace** the logo with a new image and confirm it updates everywhere
- [ ] **Remove** the logo and confirm it returns to the initial/letter fallback everywhere
- [ ] Test uploading an oversized or wrong-format image — you should get a clear error, not a crash

---

## Part 5 — Super Admin (platform approval dashboard) (important)

### 13. Super Admin account
Log in as the platform super admin (e.g. `jeremiahoshiokhame@gmail.com`).
- [ ] Open the header menu → **Platform Admin** section shows **Store Applications** and **All Stores**
- [ ] Access to `/admin` redirects you to the platform dashboard

### 14. Approve / reject a store application
Go to **Store Applications** (`/admin/applications`).
- [ ] Pending applications are listed with: store name, owner, email, WhatsApp/phone, application date, description, product/order counts, and status pill
- [ ] Click **Approve** → status changes to **Approved** and the store goes live immediately:
  - Its storefront URL now returns 200
  - It appears on the homepage "Shop by Store", `/stores`, and search
- [ ] The now-approved vendor can log in and manage their full dashboard
- [ ] For a different application click **Reject** → it becomes **Rejected**. Optionally add a rejection reason. The store stays hidden, but the record remains visible with the reason
- [ ] The rejected vendor, if they log in, sees the "Application not approved" message (with the reason if provided)

### 15. Manage all stores
Go to **All Stores** (`/admin/stores`).
- [ ] Lists every store with owner email, product/order/category counts, status, and a "View storefront" link for approved stores
- [ ] **Suspend** a store → it disappears from the marketplace (404 storefront), can be **Reactivated**
- [ ] **Delete** a store → a confirmation dialog appears: **"Delete Store?"** with the warning about permanent removal. You must confirm twice. Other stores/orders remain unaffected

### 16. Security checks
- [ ] A **normal customer** visiting `/admin/stores` or `/admin/applications` is redirected to the admin login
- [ ] A **pending vendor** cannot reach `/admin/stores` or `/admin/applications` (role-checked server-side)
- [ ] Only the super admin's approve/reject/delete buttons work; actions are enforced on the server (not just hidden in the UI)

---

## Part 6 — Product card alignment (important)

### 17. Check button alignment across sections
Open the **homepage**, **a storefront**, **/shop**, **/search?q=…**, and a **product page** (You May Also Like).
- [ ] Every product card in a row has its **"View Product"** button on the same horizontal line (bottom-aligned)
- [ ] Cards in a row are equal height even when name/description/price/store-name lengths differ
- [ ] Long product names wrap (up to 2 lines) without moving the button
- [ ] The layout stays aligned on **mobile**, **tablet**, and **desktop**

---

## Part 7 — Everything else to sanity-check

### 18. Links & navigation
- [ ] Header menu (hamburger) opens and closes, Escape key closes it, and links work: Home, Search, Shop, Stores, Cart, About, Contact, Sell on Larkvine
- [ ] Footer links and copyright all render
- [ ] Cart count badge updates as you add/remove items

### 19. Edge cases & errors
- [ ] Empty states: a store with no products shows "This store is getting ready"
- [ ] A search with no results shows an empty-state message
- [ ] Cart is empty → checkout/cart shows an appropriate empty message
- [ ] Refresh the page mid-browsing — nothing breaks (this is a server-rendered app)
- [ ] Long product/store names don't break layouts (they should truncate or wrap)

### 20. Performance & polish
- [ ] Images load (products, logos) — no broken-image icons
- [ ] Pages feel reasonably fast on both mobile and desktop
- [ ] No text overlapping or clipped boxes
- [ ] Everything looks consistent with the green/gold brand colours

---

## What to report

For **every issue**, please report:
1. **Step number** (from above)
2. **What you did** exactly
3. **What you expected** to happen
4. **What actually happened** (screenshot/error text if possible)
5. Device + browser you were using (e.g. "iPhone Safari", "Desktop Chrome")

**Great to capture, especially:**
- Any page that won't load or throws an error
- Any broken image / missing logo
- Search not returning something you expected
- Checkout or WhatsApp routing problems
- Store logo upload failing or not updating everywhere
- Any layout/visual glitches

Thank you for helping make Larkvine better!
