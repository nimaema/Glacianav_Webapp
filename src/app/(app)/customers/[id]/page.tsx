import { CustomerRoom } from "@/components/customers/customer-room";
import { getCustomerRoomData, getCustomersPageData } from "@/lib/data/customers";
import { getCurrentProfile } from "@/lib/data/current-user";

export default async function CustomerRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, profile] = await Promise.all([getCustomersPageData(), getCurrentProfile()]);
  const customer = data.customers.find((c) => c.id === id) ?? null;
  const roomData = customer ? await getCustomerRoomData(id) : null;
  return (
    <CustomerRoom
      customer={customer}
      stages={data.stages}
      segments={data.segments}
      owners={data.owners}
      contacts={data.contacts}
      conversations={roomData?.conversations ?? []}
      validationNotes={roomData?.validationNotes ?? []}
      tasks={roomData?.tasks ?? []}
      activity={roomData?.activity ?? []}
      currentUserId={profile?.id ?? ""}
    />
  );
}
