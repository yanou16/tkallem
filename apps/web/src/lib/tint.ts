/** DESIGN.md: each pastel carries one scenario meaning, never decoration. Visa interviews (travel), Campus France
 *  (study), remote job (work) and IELTS (exams) get their tint; any other scenario sits on the quiet surface. */
const TINT: Record<string, string> = {
  travel: "bg-tint-visa",
  study: "bg-tint-campus",
  work: "bg-tint-job",
  exams: "bg-tint-ielts",
};

export function scenarioTint(category?: string | null): string {
  return (category && TINT[category]) || "bg-surface";
}
