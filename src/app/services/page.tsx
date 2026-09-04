import { LegalPage } from "@/components/legal/LegalLayout";

export const metadata = {
  title: "Our Services — Larkvine",
  description:
    "The services Larkvine provides, our service standards, and how we support you when things go wrong with an order or a vendor.",
};

const sections = [
  {
    id: "marketplace",
    heading: "1. The Marketplace",
    body: (
      <>
        <p>
          Larkvine is a curated marketplace that brings together independent
          fashion houses, artisans, and vendors. We provide the platform, tools,
          and support that make it possible for vendors to sell and for customers
          to shop with confidence.
        </p>
        <p>
          Every storefront on Larkvine is reviewed before it opens, and we work to
          maintain a trusted community for all parties.
        </p>
      </>
    ),
  },
  {
    id: "for-vendors",
    heading: "2. Services for Vendors",
    body: (
      <>
        <p>We give vendors the tools to build and run their storefront, including:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>A dedicated storefront to showcase products and profile details.</li>
          <li>Tools to manage listings, categories, and stock.</li>
          <li>Order management and customer communication support.</li>
          <li>Verification and trust signals that help build buyer confidence.</li>
        </ul>
      </>
    ),
  },
  {
    id: "for-buyers",
    heading: "3. Services for Buyers",
    body: (
      <>
        <p>For customers, Larkvine provides a simple, trustworthy way to shop:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Browse storefronts, the archive, and marketplace categories.</li>
          <li>Place orders directly with vendors through WhatsApp and email.</li>
          <li>Clear product, sizing, and stock information.</li>
          <li>Direct access to administrator support if a purchase goes wrong.</li>
        </ul>
      </>
    ),
  },
  {
    id: "standards",
    heading: "4. Our Service Standards & Turnaround",
    body: (
      <>
        <p>
          We expect vendors to fulfil orders in a reasonable and communicated
          timeframe. Where a vendor indicates a delay or a lead time, we ask them
          to keep you informed. If a vendor is unresponsive or an order is delayed
          without explanation, you can escalate the matter to us and we will
          intervene to help resolve it.
        </p>
      </>
    ),
  },
  {
    id: "dispute-resolution",
    heading: "5. Dispute & Delay Support",
    body: (
      <>
        <p>
          If you have any issue or delay with a vendor — an order that has not
          arrived, a product that is not as described, or a vendor who is not
          responding — our administrator is here to help. Email the administrator at{" "}
          <a href="mailto:jeremiahoshiokhame@gmail.com" className="text-primary no-underline hover:text-primary-light">
            jeremiahoshiokhame@gmail.com
          </a>{" "}
          or contact them using the number provided in the site footer.
        </p>
        <p>
          We will review your case, liaise with the vendor, and work toward a fair
          outcome. If a vendor is unable to fulfil an order, we will do our best to
          arrange a resolution or refund.
        </p>
      </>
    ),
  },
  {
    id: "scope",
    heading: "6. Scope & Exclusions",
    body: (
      <>
        <p>
          Larkvine facilitates transactions but individual sales remain between the
          Buyer and the Seller. Our support covers matters within our control,
          including platform access, order escalation, and facilitating
          communication. Specific product quality, tailoring, and delivery logistics
          are primarily the responsibility of the vendor you purchase from.
        </p>
      </>
    ),
  },
  {
    id: "fees",
    heading: "7. Fees & Payments",
    body: (
      <>
        <p>
          Browsing and shopping on Larkvine is free for customers. Vendor fee
          structures, where applicable, are communicated to vendors as part of the
          onboarding process. Any platform fees will be disclosed clearly and are
          subject to change with notice.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    heading: "8. Contact Us",
    body: (
      <>
        <p>
          For questions about our services, or to raise a concern about a vendor or
          order, contact the administrator by email at{" "}
          <a href="mailto:jeremiahoshiokhame@gmail.com" className="text-primary no-underline hover:text-primary-light">
            jeremiahoshiokhame@gmail.com
          </a>{" "}
          or using the contact details shown in the site footer.
        </p>
      </>
    ),
  },
];

export default function ServicesPage() {
  return (
    <LegalPage
      eyebrow="Legal Storefront"
      title="Our Services"
      intro="A clear account of what Larkvine offers to vendors and buyers — our service standards, and how we step in to help when an order is delayed or a vendor falls short."
      updated="September 4, 2026"
      sections={sections}
    />
  );
}
