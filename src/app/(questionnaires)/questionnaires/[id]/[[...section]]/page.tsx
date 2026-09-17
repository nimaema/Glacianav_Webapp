import { notFound } from "next/navigation";
import { z } from "zod";
import { QuestionnaireWorkspace } from "@/components/questionnaires/workspace";
import { PreviewPage } from "@/components/questionnaires/respondent-page";
import { getDetail } from "@/lib/questionnaires/service";
export default async function QuestionnairePage({
  params,
}: {
  params: Promise<{ id: string; section?: string[] }>;
}) {
  const { id, section } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const tab = section?.[0] ?? "overview";
  if (
    (section?.length ?? 0) > 1 ||
    ![
      "overview",
      "build",
      "logic",
      "share",
      "responses",
      "results",
      "settings",
      "preview",
    ].includes(tab)
  )
    notFound();
  const detail = await getDetail(id);
  return tab === "preview" ? (
    <PreviewPage id={id} definition={detail.questionnaire.draft} />
  ) : (
    <QuestionnaireWorkspace key={`${id}/${tab}`} initial={detail} tab={tab} />
  );
}
