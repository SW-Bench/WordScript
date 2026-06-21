import { Download, Upload } from "lucide-react";
import { FormCard, FormRow, Select, StatTiles, StatusBadge, Toggle } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AccountArea() {
  return (
    <div className="flex flex-col gap-8">
      <StatTiles
        items={[
          { label: "Account", value: "Local only", hint: "No cloud account required" },
          { label: "Sync", value: "Off", hint: "Self-hosting is a future option" },
          { label: "Data", value: "On this machine", hint: "Export anytime from History" },
        ]}
      />

      <FormCard
        title="Account"
        description="WordScript works fully without an account. All transcripts, profiles and settings stay on this machine. Self-hosting sync is a future option; this screen previews where it will live."
        action={
          <StatusBadge tone="warning" dot>
            Preview layout
          </StatusBadge>
        }
      >
        <FormRow
          label="Mode"
          hint="Local mode keeps everything on this device. Self-hosting will sync to your own server."
          control={
            <Select aria-label="Account mode" className="w-[200px]" defaultValue="local" disabled>
              <option value="local">Local only</option>
              <option value="self_hosted">Self-hosted (coming later)</option>
            </Select>
          }
        />
      </FormCard>

      <FormCard
        title="Self-hosting sync"
        description="When enabled, WordScript will sync transcripts, profiles and settings to your own server. This is a layout preview; no sync runs yet."
        bodyClassName="py-4"
      >
        <FormRow
          label="Enable sync"
          hint="Off by default. Turning it on will require a server URL below."
          htmlFor="sync-toggle"
          control={<Toggle id="sync-toggle" checked={false} onCheckedChange={() => {}} disabled />}
        />
        <FormRow
          label="Server URL"
          hint="The base URL of your self-hosted WordScript sync server."
          control={
            <Input
              aria-label="Server URL"
              className="w-[280px]"
              placeholder="https://sync.example.com"
              disabled
            />
          }
        />
        <FormRow
          label="Sync status"
          hint="Last sync time and pending changes will appear here once sync is wired."
          divider={false}
          control={<StatusBadge tone="neutral">Not configured</StatusBadge>}
        />
      </FormCard>

      <FormCard
        title="Data export & import"
        description="Export and import your full WordScript data — transcripts, profiles, dictionary, snippets and settings. Text-rule export/import also lives inside Profiles for single-profile JSON."
      >
        <FormRow
          label="Full export"
          hint="Exports all local data as a single archive. Transcription history export is also available in History."
          control={
            <Button size="sm" variant="outline" disabled>
              <Download className="size-3.5" /> Export all data
            </Button>
          }
        />
        <FormRow
          label="Full import"
          hint="Restores from a previously exported archive. Existing local data is merged or replaced."
          divider={false}
          control={
            <Button size="sm" variant="outline" disabled>
              <Upload className="size-3.5" /> Import archive
            </Button>
          }
        />
      </FormCard>

      <p className="px-1 text-[12px] leading-snug text-fg-muted">
        This is a layout preview. Self-hosting sync and full-data archive export/import ship in a future
        version. Single-profile text-rule export/import already works in Profiles, and transcription
        history export already works in History.
      </p>
    </div>
  );
}