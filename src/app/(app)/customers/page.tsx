import { Suspense } from "react";
import { CustomersView } from "@/components/customers/customers-view";
import { getCustomersPageData } from "@/lib/data/customers";

export default async function CustomersPage() {
  const data = await getCustomersPageData();
  return (
    <Suspense>
      <CustomersView {...data} />
    </Suspense>
  );
}
