export type AppUpdateStatusKind =
  | "release_path_building"
  | "update_available"
  | "up_to_date"
  | "check_failed";

export type ReleaseBuildState = "building" | "planned" | "published";

export interface ReleaseBuildTrack {
  platform: string;
  artifact: string;
  state: ReleaseBuildState;
  note: string;
}

export interface AppUpdateStatus {
  current_version: string;
  status: AppUpdateStatusKind;
  summary: string;
  release_version: string | null;
  release_url: string | null;
  release_notes: string | null;
  checked_at_ms: number;
  build_targets: ReleaseBuildTrack[];
}