/** Eight tones from the app card palette, matching the group capacity. The first four are the most distinct from each other
 *  (peach and rose are close, so they come late). Initials and names carry the identity; the student's own bubbles are not
 *  one of these: they are ink, like the student's answers in the chat. */
export const MEMBER_COLORS = [
  "bg-mint", "bg-butter", "bg-lilac", "bg-peach", "bg-rose",
  "bg-mint-deep", "bg-lilac-deep", "bg-butter-deep",
] as const;

/** Roster order and message pagination must not change a member's color. */
export function memberColors(members: readonly { id: number }[]): Map<number, string> {
  return new Map([...new Set(members.map((member) => member.id))]
    .sort((a, b) => a - b)
    .map((id, index) => [id, MEMBER_COLORS[index % MEMBER_COLORS.length]]));
}
