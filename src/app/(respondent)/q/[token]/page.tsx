import { landing } from "@/lib/questionnaires/respondent";
import {
  InvitationLanding,
  RespondentUnavailable,
} from "@/components/questionnaires/respondent-page";
import { QuestionnaireError } from "@/lib/questionnaires/access";
export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await landing(token)
    .then((data) => ({ data, error: null }))
    .catch((e) => {
      if (e instanceof QuestionnaireError)
        return { data: null, error: e.message };
      throw e;
    });
  if (!result.data) return <RespondentUnavailable message={result.error!} />;
  return <InvitationLanding token={token} data={result.data} />;
}
