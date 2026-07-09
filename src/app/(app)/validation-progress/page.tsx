import { Suspense } from "react";
import { ValidationProgressView } from "@/components/customers/validation-progress-view";

export default function ValidationProgressPage() {
  return (
    <Suspense>
      <ValidationProgressView />
    </Suspense>
  );
}
