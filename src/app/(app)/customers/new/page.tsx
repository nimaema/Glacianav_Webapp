import { NewCustomerView } from "@/components/customers/new-customer-view";
import { getNewCustomerFormData } from "@/lib/data/customers";

// Reads live DB data — DATABASE_URL isn't available at Docker build time
// (deliberately kept server-only, out of the build stage), so this can't
// be statically prerendered.
export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  const data = await getNewCustomerFormData();
  return <NewCustomerView {...data} />;
}
