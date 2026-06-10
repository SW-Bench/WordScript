import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppConfig } from "../../test/factories";
import type { AppConfig } from "../../types/ipc";
import { ModesTab } from "./ModesTab";

afterEach(() => {
  cleanup();
});

describe("ModesTab", () => {
  const onChange = vi.fn<(p: Partial<AppConfig>) => void>();

  beforeEach(() => {
    onChange.mockReset();
  });

  it("renders the processing mode radio selectors with cleanup as default", () => {
    render(<ModesTab config={createAppConfig()} onChange={onChange} />);

    expect(screen.getByText("Default processing mode")).toBeInTheDocument();

    const modeSection = screen.getByLabelText("Processing mode selector");
    const allModes = modeSection.querySelectorAll("input[type='radio']");
    expect(allModes.length).toBe(5);
    const cleanupInput = modeSection.querySelector("input[value='cleanup']") as HTMLInputElement;
    expect(cleanupInput.checked).toBe(true);
  });

  it("fires onChange when selecting a different processing mode", () => {
    render(<ModesTab config={createAppConfig()} onChange={onChange} />);

    const modeSection = screen.getByLabelText("Processing mode selector");
    const verbatimRadio = modeSection.querySelector("input[value='verbatim']") as HTMLInputElement;
    fireEvent.click(verbatimRadio);

    expect(onChange).toHaveBeenCalledWith({ processing_mode: "verbatim" });
  });

  it("shows enhance sub-mode options only when prompt_enhance is selected", () => {
    render(
      <ModesTab
        config={createAppConfig({ processing_mode: "prompt_enhance" })}
        onChange={onChange}
      />
    );

    expect(screen.getByText("Enhance sub-mode")).toBeInTheDocument();
    expect(screen.getByText("Prompt target")).toBeInTheDocument();
    expect(screen.getByLabelText(/target platform/i)).toBeInTheDocument();
  });

  it("hides enhance sub-mode when cleanup is selected", () => {
    render(
      <ModesTab
        config={createAppConfig({ processing_mode: "cleanup" })}
        onChange={onChange}
      />
    );

    expect(screen.queryByText("Enhance sub-mode")).not.toBeInTheDocument();
    expect(screen.queryByText("Prompt target")).not.toBeInTheDocument();
  });

  it("toggles auto-detect checkbox", () => {
    render(<ModesTab config={createAppConfig()} onChange={onChange} />);

    const checkbox = screen.getByLabelText(/extend overlay with detected app/i);
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith({ auto_detect_mode: true });
  });

  it("renders auto-detect section", () => {
    render(<ModesTab config={createAppConfig()} onChange={onChange} />);

    expect(screen.getByText("Auto-detection")).toBeInTheDocument();
    expect(screen.getByLabelText(/extend overlay with detected app/i)).toBeInTheDocument();
  });

  it("renders per-app mapping section", () => {
    render(<ModesTab config={createAppConfig()} onChange={onChange} />);

    expect(screen.getByText("Per-app mapping")).toBeInTheDocument();
    expect(screen.getByText("Add mapping")).toBeInTheDocument();
  });

  it("shows existing app mappings", () => {
    render(
      <ModesTab
        config={createAppConfig({
          workspace_app_map: {
            ide: "prompt_enhance",
            browser: "cleanup",
          },
        })}
        onChange={onChange}
      />
    );

    const appMappingSection = screen.getByLabelText("Per-app mode mappings");
    expect(appMappingSection).toBeInTheDocument();
    const chips = appMappingSection.querySelectorAll(".settings__rule-chip");
    const chipTexts = Array.from(chips).map((c) => c.textContent);
    expect(chipTexts).toContain("IDE");
    expect(chipTexts).toContain("Browser");
    expect(chipTexts).toContain("Prompt Enhance");
    expect(chipTexts).toContain("Cleanup");
  });

  it("removes an app mapping when trash button clicked", () => {
    render(
      <ModesTab
        config={createAppConfig({
          workspace_app_map: {
            ide: "prompt_enhance",
          },
        })}
        onChange={onChange}
      />
    );

    const removeButton = screen.getByLabelText(/remove ide mapping/i);
    fireEvent.click(removeButton);

    expect(onChange).toHaveBeenCalledWith({
      workspace_app_map: {},
    });
  });

  it("renders hotkey recorders", () => {
    render(<ModesTab config={createAppConfig()} onChange={onChange} />);

    expect(screen.getByText("Hotkeys")).toBeInTheDocument();
    expect(screen.getByText("Mode picker")).toBeInTheDocument();
    expect(screen.getByText("Cycle mode")).toBeInTheDocument();
    const hotkeyRecorderLabels = screen.getAllByText(/^(Verbatim|Cleanup|Rewrite|Agent|Prompt Enhance)$/);
    expect(hotkeyRecorderLabels.length).toBeGreaterThanOrEqual(5);
  });

  it("fires onChange for mode picker hotkey", () => {
    render(<ModesTab config={createAppConfig()} onChange={onChange} />);

    const recorders = screen.getAllByRole("button", { name: /click to record/i });
    const modePickerRecorder = recorders[0];
    fireEvent.click(modePickerRecorder);

    expect(screen.getByText(/press your shortcut/i)).toBeInTheDocument();
  });
});
