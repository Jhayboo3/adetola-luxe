import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { profileMissing } from "@/lib/measurements";
import CheckoutClient from "@/components/checkout/CheckoutClient";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/checkout");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");
  const missing = profileMissing(user);
  if (missing.length) return <div className="mx-auto max-w-[680px] px-8 py-24 text-center"><div className="mx-auto h-[2px] w-12 bg-gold" /><h1 className="mt-5 font-heading text-[26px]">Complete Your Profile</h1><p className="mt-4 font-body text-[14px] leading-relaxed text-muted">{user.gender ? "Your body measurements are incomplete. Please complete your measurements before placing this order." : "Please complete your profile and select your gender before proceeding to checkout."}</p><div className="mx-auto mt-6 max-w-md rounded-xl bg-[#F7F2E8] p-5 text-left font-body text-[12px]"><p className="font-semibold">Still required:</p><ul className="mt-2 grid list-disc grid-cols-2 gap-x-5 pl-5 text-muted">{missing.map((item) => <li key={item}>{item}</li>)}</ul></div><Link href="/account/profile" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-primary px-8 font-body text-[11px] font-semibold uppercase tracking-[1px] text-white no-underline">Complete Measurements</Link></div>;
  return <CheckoutClient profile={{ name: user.name, email: user.email, phone: user.phone!, whatsapp: user.whatsapp!, gender: user.gender!, address: user.address!, city: user.city!, state: user.state!, zip: user.zip ?? "", deliveryInfo: user.deliveryInfo ?? "" }} />;
}
