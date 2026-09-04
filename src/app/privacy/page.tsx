import { LegalPage } from "@/components/legal/LegalLayout";

export const metadata = {
  title: "Privacy Policy — Larkvine",
  description:
    "How Larkvine collects, uses, and protects your personal information.",
};

const sections = [
  {
    id: "overview",
    heading: "1. Overview",
    body: (
      <>
        <p>
          This Privacy Policy explains how Larkvine collects, uses, discloses, and
          safeguards your personal information when you use the Marketplace. We are
          committed to protecting your privacy and to handling your information
          responsibly and transparently.
        </p>
      </>
    ),
  },
  {
    id: "information",
    heading: "2. Information We Collect",
    body: (
      <>
        <p>We collect information you provide directly, including:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Account details such as your name, email address, and password.</li>
          <li>Profile information such as shipping address, phone number, and WhatsApp contact.</li>
          <li>Store and product information if you sell on Larkvine.</li>
          <li>Order details, payment information, and communication content.</li>
        </ul>
        <p>
          We also automatically collect certain technical information, such as your
          IP address, browser type, and usage data, to operate and improve the
          platform.
        </p>
      </>
    ),
  },
  {
    id: "use",
    heading: "3. How We Use Your Information",
    body: (
      <>
        <p>We use your information to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Provide, operate, and maintain the Marketplace.</li>
          <li>Process transactions and communicate with you about your orders.</li>
          <li>Facilitate communication between Buyers and Sellers.</li>
          <li>Resolve disputes and respond to customer service enquiries.</li>
          <li>Improve our services and protect against fraud and abuse.</li>
        </ul>
      </>
    ),
  },
  {
    id: "sharing",
    heading: "4. How We Share Information",
    body: (
      <>
        <p>
          We do not sell your personal information. We share information only as
          necessary to operate the Marketplace, including:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>With Sellers to the extent needed to fulfil orders you place.</li>
          <li>With service providers who help us operate (e.g. hosting, payment, and delivery).</li>
          <li>Where required by law or to protect the rights and safety of our users.</li>
        </ul>
      </>
    ),
  },
  {
    id: "security",
    heading: "5. Data Security & Retention",
    body: (
      <>
        <p>
          We apply reasonable technical and organisational measures to protect your
          information. We retain personal information only as long as necessary for
          the purposes set out in this policy or as required by law.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    heading: "6. Your Rights & Choices",
    body: (
      <>
        <p>
          Depending on your jurisdiction, you may have the right to access,
          correct, or delete your personal information, and to object to or
          restrict certain processing. To exercise any of these rights, contact the
          administrator.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    heading: "7. Contact Us",
    body: (
      <>
        <p>
          For any questions about this Privacy Policy or how your information is
          handled, contact the administrator by email at{" "}
          <a href="mailto:jeremiahoshiokhame@gmail.com" className="text-primary no-underline hover:text-primary-light">
            jeremiahoshiokhame@gmail.com
          </a>{" "}
          or using the contact details shown in the site footer.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro="How we collect, use, and protect your personal information across the Larkvine marketplace — and the choices you have over your data."
      updated="September 4, 2026"
      sections={sections}
    />
  );
}
