import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import CheckoutClient from "@/components/checkout/CheckoutClient";


export default async function CheckoutPage() {
  const session = await auth();
  const user = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id } }) : null;
  const profile = user ? { name: user.name, email: user.email, phone: user.phone ?? "", whatsapp: user.whatsapp ?? "", gender: user.gender ?? "", address: user.address ?? "", city: user.city ?? "", state: user.state ?? "", zip: user.zip ?? "", deliveryInfo: user.deliveryInfo ?? "" } : { name: "", email: "", phone: "", whatsapp: "", gender: "", address: "", city: "", state: "", zip: "", deliveryInfo: "" };
  return <CheckoutClient profile={profile} />;
}
