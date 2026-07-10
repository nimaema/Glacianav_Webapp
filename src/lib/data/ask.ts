// Real Drizzle queries for Ask. No live RAG pipeline yet (same gap the
// Conversation Workspace's QaPanel already documents) — questions asked
// here persist to the real qaMessages table so they're real history, even
// though the assistant side is still a fixed "not live yet" placeholder.

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, customers, qaCitations, qaMessages } from "@/db/schema";
import type { Customer, QaMessage } from "@/lib/fixtures";
import { toCustomerRow } from "@/lib/data/rows";

export type ConversationOption = { id: string; title: string };

export type AnsweredItem = {
  conversationId: string;
  conversationTitle: string;
  content: string;
  citationMs?: number;
};

export type AskPageData = {
  customers: Customer[];
  conversations: ConversationOption[];
  recentAnswered: AnsweredItem[];
  everythingThread: QaMessage[];
};

export async function getAskPageData(): Promise<AskPageData> {
  const [customerRows, conversationRows, answeredRows, everythingRows] = await Promise.all([
    db.select().from(customers),
    db.select({ id: conversations.id, title: conversations.title }).from(conversations),
    db
      .select({
        id: qaMessages.id,
        conversationId: qaMessages.conversationId,
        content: qaMessages.content,
      })
      .from(qaMessages)
      .where(eq(qaMessages.role, "assistant"))
      .orderBy(desc(qaMessages.createdAt))
      .limit(8),
    db
      .select({ role: qaMessages.role, content: qaMessages.content })
      .from(qaMessages)
      .where(and(isNull(qaMessages.conversationId), isNull(qaMessages.customerId)))
      .orderBy(qaMessages.createdAt),
  ]);

  const conversationTitleById = new Map(conversationRows.map((c) => [c.id, c.title]));
  const citationRows = answeredRows.length
    ? await db.select().from(qaCitations)
    : [];
  const firstCitationByMessage = new Map<string, number>();
  for (const c of citationRows) {
    if (!firstCitationByMessage.has(c.qaMessageId)) firstCitationByMessage.set(c.qaMessageId, c.startMs);
  }

  return {
    customers: customerRows.map(toCustomerRow),
    conversations: conversationRows,
    recentAnswered: answeredRows
      .filter((r) => r.conversationId != null)
      .map((r) => ({
        conversationId: r.conversationId as string,
        conversationTitle: conversationTitleById.get(r.conversationId as string) ?? "Conversation",
        content: r.content,
        citationMs: firstCitationByMessage.get(r.id),
      })),
    everythingThread: everythingRows.map((r) => ({ role: r.role, content: r.content })),
  };
}
