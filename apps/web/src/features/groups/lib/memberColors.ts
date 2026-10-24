/** Eight distinct tones from the app card palette, matching the group capacity. */
export const MEMBER_COLORS = [
  "bg-mint", "bg-butter", "bg-peach", "bg-rose", "bg-lilac",
  "bg-mint-deep", "bg-peach-deep", "bg-lilac-deep",
] as const;

/** Roster order and message pagination must not change a member's color. */
export function memberColors(members: readonly { id: number }[]): Map<number, string> {
  return new Map([...new Set(members.map((member) => member.id))]
    .sort((a, b) => a - b)
    .map((id, index) => [id, MEMBER_COLORS[index % MEMBER_COLORS.length]]));
}
