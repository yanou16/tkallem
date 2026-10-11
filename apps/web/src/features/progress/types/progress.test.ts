import { describe, expect, it } from "vitest";
import { MISTAKE_LABELS, mistakeLabel } from "./progress";

const RULES = [
  "verb_tense", "subject_verb_agreement", "verb_pattern", "preposition", "article",
  "plural_uncountable", "word_order", "word_form", "other",
];
const TYPES = ["grammar", "vocabulary", "word_choice", "other"];

describe("mistakeLabel", () => {
  it("names the fine-grained rules", () => {
    expect(mistakeLabel("verb_tense")).toBe("Verb tenses");
    expect(mistakeLabel("preposition")).toBe("Prepositions");
    expect(mistakeLabel("subject_verb_agreement")).toBe("Subject-verb agreement");
  });

  it("names the correction types used when a mistake has no rule", () => {
    expect(mistakeLabel("grammar")).toBe("Grammar");
    expect(mistakeLabel("word_choice")).toBe("Word choice");
  });

  it("has a label for each of the 9 rules and 4 types", () => {
    for (const category of [...RULES, ...TYPES]) expect(MISTAKE_LABELS[category]).toBeTruthy();
  });

  it("shows an unknown category as the API sent it", () => {
    expect(mistakeLabel("spelling")).toBe("spelling");
  });
});
