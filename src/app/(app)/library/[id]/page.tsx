import { ConversationRoute } from "@/components/library/conversation-route";
import { conversations } from "@/lib/fixtures";

export function generateStaticParams() {
  return conversations.map((c) => ({ id: c.id }));
}

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ConversationRoute id={id} />;
}
