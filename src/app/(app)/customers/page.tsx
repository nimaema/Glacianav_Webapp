import { Suspense } from "react";
import { CustomersView } from "@/components/customers/customers-view";

export default function CustomersPage() {
  return (
    <Suspense>
      <CustomersView />
    </Suspense>
  );
}
