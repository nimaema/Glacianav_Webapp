// Click + keyboard handlers shared by every lens row that opens the drawer.
// role="button" is added per element (not here) so table rows keep row semantics.
export function rowOpenHandlers(onOpen: (id: string) => void, id: string) {
  return {
    tabIndex: 0,
    onClick: () => onOpen(id),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen(id);
      }
    },
  };
}
