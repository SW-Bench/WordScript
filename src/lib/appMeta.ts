import packageJson from "../../package.json";

export const APP_VERSION = packageJson.version;
export const APP_REPOSITORY_URL = "https://github.com/sw-forge-org/WordScript";
export const APP_ORGANIZATION_URL = "https://github.com/sw-forge-org";
export const APP_SITE_URL = "https://sw-labs.de/";
export const APP_RELEASE_WORKFLOW_URL = `${APP_REPOSITORY_URL}/actions/workflows/release.yml`;
export const APP_RELEASE_RUNBOOK_URL = `${APP_REPOSITORY_URL}/blob/main/docs/RELEASE_RUNBOOK.md`;