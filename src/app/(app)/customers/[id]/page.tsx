import { CustomerRoom } from "@/components/customers/customer-room";
import { customers } from "@/lib/fixtures";

export function generateStaticParams() {
  return customers.map((c) => ({ id: c.id }));
}

export default async function CustomerRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerRoom customerId={id} />;
}
