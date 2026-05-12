import { useState } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppConfig } from "../../test/factories";
import { PromptsTab } from "./PromptsTab";

const invokeMock = vi.fn();
const openMock = vi.fn();
const saveMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => openMock(...args),
  save: (...args: unknown[]) => saveMock(...args),
}));

afterEach(() => {
  cleanup();
});

function Harness({ initialConfig }: { initialConfig?: ReturnType<typeof createAppConfig> }) {
  const [config, setConfig] = useState(initialConfig ?? createAppConfig());

  return (
    <PromptsTab
      config={config}
      onChange={(partial) => setConfig((current) => ({ ...current, ...partial }))}
    />
  );
}

describe("PromptsTab", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    openMock.mockReset();
    saveMock.mockReset();

    openMock.mockResolvedValue(null);
    saveMock.mockResolvedValue(null);
    invokeMock.mockImplementation(async (command: string, payload?: { request?: { sample_text?: string } }) => {
      if (command === "analyze_text_rules") {
        const sampleText = payload?.request?.sample_text?.trim() || "word script follow up note";
        return {
          blocking: false,
          issues: [],
          preview: {
            input: sampleText,
            output: `current preview: ${sampleText}`,
            applied_rules: [],
          },
          dictionary_count: 0,
          snippet_count: 0,
        };
      }

      if (command === "import_text_rules") {
        const sampleText = payload?.request?.sample_text?.trim() || "word script follow up note";
        return {
          document: {
            schema_version: 1,
            prompt: "Imported prompt",
            dictionary_entries: [],
            snippet_entries: [],
          },
          analysis: {
            blocking: true,
            issues: [
              {
                severity: "error",
                code: "empty_snippet_expansion",
                message: "Imported snippet expansion is empty.",
                rule_ids: ["snippet-imported"],
              },
            ],
            preview: {
              input: sampleText,
              output: `import preview: ${sampleText}`,
              applied_rules: ["snippet:follow-up"],
            },
            dictionary_count: 0,
            snippet_count: 1,
          },
        };
      }

      throw new Error(`Unexpected invoke command: ${command}`);
    });
  });

  it("adds and edits dictionary and snippet entries in the first native text-rules slice", async () => {
    const user = userEvent.setup();

    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /add dictionary term/i }));
    await user.type(screen.getByRole("textbox", { name: /heard as/i }), "word script");
    await user.type(screen.getByRole("textbox", { name: /replace with/i }), "WordScript");

    expect(screen.getByRole("textbox", { name: /heard as/i })).toHaveValue("word script");
    expect(screen.getByRole("textbox", { name: /replace with/i })).toHaveValue("WordScript");

    await user.click(screen.getByRole("button", { name: /add snippet/i }));
    await user.type(screen.getByRole("textbox", { name: /label/i }), "Support follow-up");
    await user.type(screen.getByRole("textbox", { name: /trigger phrase/i }), "follow up note");
    await user.type(
      screen.getByRole("textbox", { name: /expansion/i }),
      "Thanks for the update. We will send the next status tomorrow morning.",
    );

    expect(screen.getByRole("textbox", { name: /label/i })).toHaveValue("Support follow-up");
    expect(screen.getByRole("textbox", { name: /trigger phrase/i })).toHaveValue("follow up note");
    expect(screen.getByRole("textbox", { name: /expansion/i })).toHaveValue(
      "Thanks for the update. We will send the next status tomorrow morning.",
    );
  });

  it("keeps import preview diagnostics and sample output aligned with the pending import", async () => {
    const user = userEvent.setup();
    openMock.mockResolvedValue("/tmp/wordscript-text-rules.json");

    render(<Harness />);

    const sampleField = screen.getByRole("textbox", { name: /preview sample/i });
    await user.clear(sampleField);
    await user.type(sampleField, "custom merge preview");

    await user.click(screen.getByRole("button", { name: /import & merge/i }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("import_text_rules", {
      request: expect.objectContaining({
        sample_text: "custom merge preview",
      }),
    }));

    expect(screen.getByText("import preview: custom merge preview")).toBeInTheDocument();
    expect(screen.getByText("Imported snippet expansion is empty.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply import/i })).toBeDisabled();
  });

  it("explains literal matching and preview scope clearly", () => {
    render(<Harness />);

    expect(screen.getByText(/not raw audio and not semantic intent/i)).toBeInTheDocument();
    expect(screen.getByText(/dictionary runs first, snippets second/i)).toBeInTheDocument();
    expect(screen.getByText(/validation checks for empty fields, duplicates and collisions/i)).toBeInTheDocument();
    expect(screen.getByText(/preview runs the literal dictionary-plus-snippet pass/i)).toBeInTheDocument();
  });

  it("reorders dictionary entries so the current sequence matches the authored priority", async () => {
    const user = userEvent.setup();

    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /add dictionary term/i }));
    await user.type(screen.getByRole("textbox", { name: /heard as/i }), "alpha term");
    await user.type(screen.getByRole("textbox", { name: /replace with/i }), "Alpha");

    await user.click(screen.getByRole("button", { name: /add dictionary term/i }));

    const heardInputsBeforeMove = screen.getAllByRole("textbox", { name: /heard as/i });
    const replaceInputsBeforeMove = screen.getAllByRole("textbox", { name: /replace with/i });

    await user.type(heardInputsBeforeMove[1], "beta term");
    await user.type(replaceInputsBeforeMove[1], "Beta");

    const secondDictionaryCard = screen.getByText("Dictionary term 2").closest("article");
    expect(secondDictionaryCard).not.toBeNull();

    await user.click(within(secondDictionaryCard as HTMLElement).getByRole("button", { name: /move up/i }));

    const orderedHeardValues = screen
      .getAllByRole("textbox", { name: /heard as/i })
      .map((input) => (input as HTMLInputElement).value);

    expect(orderedHeardValues).toEqual(["beta term", "alpha term"]);
  });

  it("shows readable applied-rule labels and lets diagnostics jump to the affected rule", async () => {
    const user = userEvent.setup();
    const initialConfig = createAppConfig();
    initialConfig.dictionary_entries = [
      {
        id: "dict-1",
        phrase: "word script",
        replace_with: "WordScript",
      },
    ];
    initialConfig.snippet_entries = [
      {
        id: "snippet-1",
        label: "Support follow-up",
        trigger: "follow up note",
        expansion: "Thanks for the update.",
      },
    ];

    invokeMock.mockImplementation(async (command: string) => {
      if (command === "analyze_text_rules") {
        return {
          blocking: false,
          issues: [
            {
              severity: "warning",
              code: "dictionary_overlap",
              message: "Dictionary phrase collides with another rule.",
              rule_ids: ["dict-1"],
            },
          ],
          preview: {
            input: "word script follow up note",
            output: "WordScript Thanks for the update.",
            applied_rules: ["dictionary:dict-1", "snippet:snippet-1"],
          },
          dictionary_count: 1,
          snippet_count: 1,
        };
      }

      throw new Error(`Unexpected invoke command: ${command}`);
    });

    render(<Harness initialConfig={initialConfig} />);

    expect(await screen.findByText("Snippet: Support follow-up")).toBeInTheDocument();

    const dictionaryRuleLink = await screen.findByRole("button", { name: "Dictionary: word script" });
    const dictionaryCard = screen.getByText("Dictionary term 1").closest("article");
    expect(dictionaryCard).not.toBeNull();

    expect(within(dictionaryCard as HTMLElement).getByText("Dictionary phrase collides with another rule.")).toBeInTheDocument();

    await user.click(dictionaryRuleLink);

    expect(dictionaryCard).toHaveClass("settings__rule-card--active");
    expect(screen.getByRole("textbox", { name: /heard as/i })).toHaveFocus();
  });
});