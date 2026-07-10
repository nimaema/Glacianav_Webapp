import type { Icon } from "@phosphor-icons/react";
import { PageHeader } from "./page-header";

export function ModuleStub({
  title,
  icon,
  description,
  next,
}: {
  title: string;
  icon?: Icon;
  description: string;
  next: string;
}) {
  return (
    <>
      <PageHeader title={title} icon={icon} meta={description} />
      <div className="mx-auto max-w-[1600px] px-5 py-6 sm:px-7 lg:px-10">
        <div className="recessed max-w-[560px] px-5 py-4">
          <p className="text-[14.5px] text-ink-2">
            <span className="font-semibold text-ink">Coming in the next build phase. </span>
            {next}
          </p>
        </div>
      </div>
    </>
  );
}
