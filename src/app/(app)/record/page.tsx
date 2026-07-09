import { Suspense } from "react";
import { RecordView } from "@/components/record/record-view";

export default function RecordPage() {
  return (
    <Suspense>
      <RecordView />
    </Suspense>
  );
}
