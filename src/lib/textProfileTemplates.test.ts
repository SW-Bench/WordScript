import { describe, expect, it } from "vitest";
import { TEXT_PROFILE_TEMPLATES, createTextProfileFromTemplate, mergeTemplateIntoTextProfile } from "./textProfileTemplates";

describe("textProfileTemplates", () => {
  it("creates a profile from a curated template with unique labels and generated ids", () => {
    const supportTemplate = TEXT_PROFILE_TEMPLATES.find((template) => template.id === "customer-success");
    expect(supportTemplate).toBeDefined();

    const profile = createTextProfileFromTemplate(supportTemplate!, ["Customer success replies"]);

    expect(profile.label).toBe("Customer success replies 2");
    expect(profile.id).toMatch(/^profile-/);
    expect(profile.dictionary_entries).toHaveLength(supportTemplate!.dictionary_entries.length);
    expect(profile.snippet_entries).toHaveLength(supportTemplate!.snippet_entries.length);
    expect(profile.dictionary_entries.every((entry) => entry.id.startsWith("dict-"))).toBe(true);
    expect(profile.snippet_entries.every((entry) => entry.id.startsWith("snippet-"))).toBe(true);
  });

  it("merges template data into a profile without overwriting authored prompt or conflicting rules", () => {
    const supportTemplate = TEXT_PROFILE_TEMPLATES.find((template) => template.id === "customer-success");
    expect(supportTemplate).toBeDefined();

    const merged = mergeTemplateIntoTextProfile(
      {
        id: "general",
        label: "General writing",
        prompt: "ticket IDs\ncustom org names",
        dictionary_entries: [
          { id: "dict-1", phrase: "sev one", replace_with: "SEV 1 custom" },
        ],
        snippet_entries: [
          { id: "snippet-1", label: "Status update", trigger: "status update", expansion: "Custom update copy." },
        ],
      },
      supportTemplate!,
    );

    expect(merged.label).toBe("General writing");
    expect(merged.prompt).toContain("custom org names");
    expect(merged.prompt).toContain("incident severity");
    expect(merged.prompt.split("\n").filter((line) => line === "ticket IDs")).toHaveLength(1);
    expect(merged.dictionary_entries.find((entry) => entry.phrase === "sev one")?.replace_with).toBe("SEV 1 custom");
    expect(merged.dictionary_entries.some((entry) => entry.phrase === "s l a")).toBe(true);
    expect(merged.snippet_entries.find((entry) => entry.trigger === "status update")?.expansion).toBe("Custom update copy.");
    expect(merged.snippet_entries.some((entry) => entry.trigger === "escalation needed")).toBe(true);
  });
});