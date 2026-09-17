export function questionnairePermissions(
  ownerOrAdmin: boolean,
  memberRole?: string,
) {
  return {
    canOpen:
      ownerOrAdmin ||
      ["editor", "sender", "analyst"].includes(memberRole ?? ""),
    canManage: ownerOrAdmin,
    canEdit: ownerOrAdmin || memberRole === "editor",
    canSend: ownerOrAdmin || memberRole === "sender",
    canRead: ownerOrAdmin || memberRole === "analyst",
  };
}
