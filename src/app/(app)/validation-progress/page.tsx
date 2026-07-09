import { Suspense } from "react";
import { ValidationProgressView } from "@/components/customers/validation-progress-view";
import { getCustomersPageData } from "@/lib/data/customers";

export default async function ValidationProgressPage() {
  const data = await getCustomersPageData();
  return (
    <Suspense>
      <ValidationProgressView {...data} />
    </Suspense>
  );
}
