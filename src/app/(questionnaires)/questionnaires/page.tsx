import { QuestionnaireLibrary } from "@/components/questionnaires/library";
import { listQuestionnaires } from "@/lib/questionnaires/service";
import { localMode } from "@/lib/questionnaires/database";
export default async function QuestionnairesPage() {
  return (
    <QuestionnaireLibrary
      initial={await listQuestionnaires()}
      local={localMode()}
    />
  );
}
