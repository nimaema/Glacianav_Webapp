import { NewContactView } from "@/components/contacts/new-contact-view";
import { getNewContactFormData } from "@/lib/data/contacts";

// Reads live DB data — DATABASE_URL isn't available at Docker build time
// (deliberately kept server-only, out of the build stage), so this can't
// be statically prerendered.
export const dynamic = "force-dynamic";

export default async function NewContactPage() {
  const data = await getNewContactFormData();
  return <NewContactView {...data} />;
}
