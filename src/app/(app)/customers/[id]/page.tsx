import { CustomerRoom } from "@/components/customers/customer-room";
import { getCustomerRoomData, getCustomersPageData } from "@/lib/data/customers";
import { getCurrentProfile } from "@/lib/data/current-user";

// Reads live DB data — DATABASE_URL isn't available at Docker build time
// (deliberately kept server-only, out of the build stage), so this can't
// be statically prerendered. Dynamic route segments already default to
// per-request rendering without generateStaticParams, but explicit here
// too now that implicit inference has proven fragile elsewhere (see Home).
export const dynamic = "force-dynamic";

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
