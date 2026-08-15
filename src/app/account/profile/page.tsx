import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseMeasurements, profileMissing } from "@/lib/measurements";
import ProfileForm from "@/components/account/ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/profile");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");
  const missing = profileMissing(user);
  return <div className="py-12 md:py-16"><div className="mx-auto max-w-[900px] px-6 sm:px-8">
    <div className="h-[2px] w-12 bg-gold" /><h1 className="mt-4 font-heading text-[28px] font-medium">My Profile</h1>
    <div className={`mt-6 rounded-2xl border p-5 ${missing.length ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}`}><p className="font-body text-[13px] font-semibold">{missing.length ? "Profile Incomplete" : "Profile Complete"}</p>{missing.length > 0 && <div className="mt-2 font-body text-[12px] text-muted"><p>Complete your profile:</p><ul className="mt-1 grid list-disc grid-cols-2 gap-x-6 pl-5">{missing.map((item) => <li key={item}>{item}</li>)}</ul></div>}</div>
    <ProfileForm profile={{ name: user.name, email: user.email, phone: user.phone ?? "", whatsapp: user.whatsapp ?? "", gender: user.gender ?? "", address: user.address ?? "", state: user.state ?? "", city: user.city ?? "", zip: user.zip ?? "", deliveryInfo: user.deliveryInfo ?? "", measurementUnit: user.measurementUnit, measurements: parseMeasurements(user.measurements) }} />
  </div></div>;
}
