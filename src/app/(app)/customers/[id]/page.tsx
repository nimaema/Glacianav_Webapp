import { CustomerRoom } from "@/components/customers/customer-room";
import { getCustomersPageData } from "@/lib/data/customers";

export default async function CustomerRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getCustomersPageData();
  const customer = data.customers.find((c) => c.id === id) ?? null;
  return <CustomerRoom customer={customer} stages={data.stages} segments={data.segments} owners={data.owners} contacts={data.contacts} />;
}
