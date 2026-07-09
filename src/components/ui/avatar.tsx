import type { Owner } from "@/lib/fixtures";

export function Avatar({
  owner,
  size = 22,
}: {
  owner: Owner;
  size?: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        background: owner.color,
        fontSize: Math.max(11, Math.round(size * 0.42)),
      }}
      title={owner.name}
    >
      {owner.initials}
    </span>
  );
}
