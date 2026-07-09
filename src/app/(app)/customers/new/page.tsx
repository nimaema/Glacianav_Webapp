import { NewCustomerView } from "@/components/customers/new-customer-view";
import { getNewCustomerFormData } from "@/lib/data/customers";

export default async function NewCustomerPage() {
  const data = await getNewCustomerFormData();
  return <NewCustomerView {...data} />;
}
