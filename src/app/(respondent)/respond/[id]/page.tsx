import { z } from "zod";
import { respondent } from "@/lib/questionnaires/respondent";
import {
  PublicResponse,
  RespondentUnavailable,
} from "@/components/questionnaires/respondent-page";
import { QuestionnaireError } from "@/lib/questionnaires/access";
export default async function ResponsePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return <RespondentUnavailable message="Reopen your invitation link." />;
  const result = await respondent(id)
    .then((data) => ({ data, error: null }))
    .catch((e) => {
      if (e instanceof QuestionnaireError)
        return { data: null, error: e.message };
      throw e;
    });
  if (!result.data) return <RespondentUnavailable message={result.error!} />;
  const { r, i } = result.data;
  return (
    <PublicResponse
      definition={i.definition}
      responseId={id}
      answers={r.answers}
      revision={r.revision}
      page={r.page}
      submitted={r.status === "submitted"}
      lockedFields={i.name_question_id ? [i.name_question_id] : []}
      publicLink={!!i.public_link_token}
    />
  );
}
