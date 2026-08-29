import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseMeasurements } from "@/lib/measurements";
import ProfileForm from "@/components/account/ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/profile");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");
  return <div className="py-12 md:py-16"><div className="mx-auto max-w-[900px] px-6 sm:px-8">
    <div className="h-[2px] w-12 bg-gold" /><h1 className="mt-4 font-heading text-[28px] font-medium">My Profile</h1>
    <ProfileForm profile={{ name: user.name, email: user.email, phone: user.phone ?? "", whatsapp: user.whatsapp ?? "", gender: user.gender ?? "", address: user.address ?? "", state: user.state ?? "", city: user.city ?? "", zip: user.zip ?? "", deliveryInfo: user.deliveryInfo ?? "", measurements: parseMeasurements(user.measurements) }} />
  </div></div>;
}
