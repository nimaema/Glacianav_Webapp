import { ContactsView } from "@/components/contacts/contacts-view";
import { getContactsPageData } from "@/lib/data/contacts";

// Reads live DB data — DATABASE_URL isn't available at Docker build time
// (deliberately kept server-only, out of the build stage), so this can't
// be statically prerendered.
export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const data = await getContactsPageData();
  return <ContactsView {...data} />;
}
