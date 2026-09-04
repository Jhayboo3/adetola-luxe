import { LegalPage } from "@/components/legal/LegalLayout";

export const metadata = {
  title: "Terms of Service — Larkvine",
  description:
    "The terms and conditions that govern your use of the Larkvine marketplace.",
};

const sections = [
  {
    id: "acceptance",
    heading: "1. Acceptance of Terms",
    body: (
      <>
        <p>
          By accessing or using Larkvine (the &ldquo;Marketplace&rdquo;), including
          its websites, storefronts, and services, you agree to be bound by these
          Terms of Service and by our Privacy Policy. If you do not agree, you may
          not use the Marketplace.
        </p>
        <p>
          Larkvine connects independent vendors (&ldquo;Sellers&rdquo;) with
          customers (&ldquo;Buyers&rdquo;). We are a technology platform that
          facilitates commerce; the relationship for any particular transaction is
          between the Buyer and the Seller unless expressly stated otherwise.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    heading: "2. Eligibility & Accounts",
    body: (
      <>
        <p>
          You must be at least 18 years of age, or the age of majority in your
          jurisdiction, to open an account or make a purchase. By creating an
          account, you confirm that the information you provide is accurate,
          current, and complete.
        </p>
        <p>
          You are responsible for safeguarding your account credentials and for
          all activity that occurs under your account. If you suspect unauthorized
          use, contact the administrator immediately at{" "}
          <a href="mailto:jeremiahoshiokhame@gmail.com" className="text-primary no-underline hover:text-primary-light">
            jeremiahoshiokhame@gmail.com
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "transactions",
    heading: "3. Orders, Payment & Fulfilment",
    body: (
      <>
        <p>
          Orders placed through the Marketplace are fulfilled by the Seller of the
          storefront you purchase from. Payment is processed through the payment
          channels indicated at checkout. By placing an order you authorise the
          charge associated with your purchase.
        </p>
        <p>
          Sellers are expected to fulfil orders in a timely manner and to
          communicate expected delivery timelines. Prices, availability, and
          product descriptions are the responsibility of the Seller and may change
          without notice.
        </p>
      </>
    ),
  },
  {
    id: "disputes",
    heading: "4. Disputes & Your Responsibility",
    body: (
      <>
        <p>
          We encourage Buyers and Sellers to resolve issues directly. If an order
          is delayed, not as described, or if you experience any issue with a
          vendor, you may contact the Larkvine administrator, who will step in to
          assist with resolution.
        </p>
        <p>
          To report an issue with a vendor, email the administrator at{" "}
          <a href="mailto:jeremiahoshiokhame@gmail.com" className="text-primary no-underline hover:text-primary-light">
            jeremiahoshiokhame@gmail.com
          </a>{" "}
          or contact them using the number provided in the site footer.
        </p>
      </>
    ),
  },
  {
    id: "conduct",
    heading: "5. Acceptable Use & Prohibited Conduct",
    body: (
      <>
        <p>
          You agree not to use the Marketplace for any unlawful purpose or in any
          way that could damage, disable, or impair the platform. Prohibited
          conduct includes fraud, impersonation, harvesting personal data, and
          posting content that infringes the rights of others.
        </p>
      </>
    ),
  },
  {
    id: "ip",
    heading: "6. Intellectual Property",
    body: (
      <>
        <p>
          The Larkvine name, logo, and the design of the Marketplace are protected
          intellectual property. Product listings, images, and descriptions remain
          the property of the Sellers who post them. You may not reproduce
          Larkvine&apos;s branding without prior written consent.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    heading: "7. Limitation of Liability",
    body: (
      <>
        <p>
          To the maximum extent permitted by law, Larkvine is a marketplace
          platform and is not liable for the actions, omissions, products, or
          services of individual Sellers. We make no warranties, express or
          implied, regarding the Marketplace beyond those expressly set out in
          these Terms.
        </p>
      </>
    ),
  },
  {
    id: "termination",
    heading: "8. Termination",
    body: (
      <>
        <p>
          We may suspend or terminate access to the Marketplace for conduct that
          we reasonably believe violates these Terms or is otherwise harmful to
          the community. You may stop using the Marketplace at any time.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    heading: "9. Changes to These Terms",
    body: (
      <>
        <p>
          We may update these Terms from time to time. The most current version
          will always be posted here with the date of last revision. Continued use
          of the Marketplace after changes are posted constitutes acceptance of the
          revised Terms.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    heading: "10. Contact & Notices",
    body: (
      <>
        <p>
          For any questions regarding these Terms, or to report a concern about a
          vendor or transaction, contact the administrator by email at{" "}
          <a href="mailto:jeremiahoshiokhame@gmail.com" className="text-primary no-underline hover:text-primary-light">
            jeremiahoshiokhame@gmail.com
          </a>{" "}
          or using the contact details shown in the site footer.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      intro="The terms that govern your use of the Larkvine marketplace — from opening an account and placing orders, to how we help resolve disputes with vendors."
      updated="September 4, 2026"
      sections={sections}
    />
  );
}
