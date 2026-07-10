import { statusChips } from "@/lib/conversation-status";
import type { Conversation, Customer, Owner, Topic } from "@/lib/fixtures";
import { NoteCard } from "./note-card";
import { RecordingCard, Wave } from "./recording-card";

export { statusChips, Wave };

type DragHandleProps = {
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
};

/** Dispatches to the recording- or note-specific card. Callers that render
 * a generic mixed list (e.g. a customer's own conversations) use this;
 * Library itself renders RecordingCard/NoteCard directly so it can group
 * the two content types into visually separate sections. */
export function ConversationRow(props: {
  conversation: Conversation;
  onOpen: (id: string) => void;
  showAuthor?: boolean;
  showVisibility?: boolean;
  dragProps?: DragHandleProps;
  dimmed?: boolean;
  topic?: Topic;
  owners?: Owner[];
  customers?: Customer[];
}) {
  if (props.conversation.noteBody) return <NoteCard {...props} />;
  return <RecordingCard {...props} />;
}
