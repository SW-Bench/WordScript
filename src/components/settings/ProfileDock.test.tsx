import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppConfig } from "../../test/factories";
import { ProfileDock } from "./ProfileDock";

afterEach(() => {
  cleanup();
});

describe("ProfileDock", () => {
  it("renders the active profile and switches to another one from the sidebar", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ProfileDock
        config={createAppConfig({
          active_text_profile_id: "support",
          prompt: "Escalation contacts",
          dictionary_entries: [
            { id: "dict-1", phrase: "sev one", replace_with: "SEV-1" },
          ],
          snippet_entries: [
            { id: "snippet-1", label: "Status", trigger: "status update", expansion: "We will send the next status at 10:00." },
          ],
          text_profiles: [
            {
              id: "general",
              label: "General writing",
              prompt: "",
              dictionary_entries: [],
              snippet_entries: [],
            },
            {
              id: "support",
              label: "Support reply",
              prompt: "Escalation contacts",
              dictionary_entries: [
                { id: "dict-1", phrase: "sev one", replace_with: "SEV-1" },
              ],
              snippet_entries: [
                { id: "snippet-1", label: "Status", trigger: "status update", expansion: "We will send the next status at 10:00." },
              ],
            },
          ],
        })}
        onChange={onChange}
        onOpenTextRules={vi.fn()}
      />,
    );

    const dock = screen.getByLabelText(/active text profile/i);

    expect(within(dock).getByText("Support reply", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Context set")).toBeInTheDocument();
    expect(screen.getByText("1 term")).toBeInTheDocument();
    expect(screen.getByText("1 snippet")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: /active profile/i }), "general");

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      active_text_profile_id: "general",
      prompt: "",
      dictionary_entries: [],
      snippet_entries: [],
    }));
  });

  it("creates a new profile from the sidebar and opens the text rules editor", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onOpenTextRules = vi.fn();

    render(
      <ProfileDock
        config={createAppConfig()}
        onChange={onChange}
        onOpenTextRules={onOpenTextRules}
      />,
    );

    await user.click(screen.getByRole("button", { name: /new profile/i }));

    expect(onOpenTextRules).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      active_text_profile_id: expect.any(String),
      text_profiles: expect.arrayContaining([
        expect.objectContaining({ label: "New profile" }),
      ]),
    }));
  });
});