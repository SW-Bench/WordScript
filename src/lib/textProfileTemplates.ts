import type { DictionaryEntry, SnippetEntry, TextProfile } from "../types/ipc";
import { cloneTextProfile } from "./textProfiles";

type TemplateDictionaryEntry = Omit<DictionaryEntry, "id">;
type TemplateSnippetEntry = Omit<SnippetEntry, "id">;

export interface TextProfileTemplate {
  id: string;
  label: string;
  audience: string;
  summary: string;
  highlights: string[];
  prompt: string;
  dictionary_entries: TemplateDictionaryEntry[];
  snippet_entries: TemplateSnippetEntry[];
}

function createEntityId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function normalizedKey(value: string) {
  return value.trim().toLowerCase();
}

function uniqueProfileLabel(label: string, takenLabels: string[]) {
  const trimmed = label.trim() || "New profile";
  const taken = new Set(takenLabels.map((entry) => normalizedKey(entry)));

  if (!taken.has(normalizedKey(trimmed))) {
    return trimmed;
  }

  let suffix = 2;
  while (taken.has(normalizedKey(`${trimmed} ${suffix}`))) {
    suffix += 1;
  }

  return `${trimmed} ${suffix}`;
}

function promptLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function mergePrompt(currentPrompt: string, templatePrompt: string) {
  const lines = promptLines(currentPrompt);
  const seen = new Set(lines.map((line) => normalizedKey(line)));

  for (const line of promptLines(templatePrompt)) {
    const key = normalizedKey(line);
    if (!key || seen.has(key)) {
      continue;
    }

    lines.push(line);
    seen.add(key);
  }

  return lines.join("\n");
}

function dictionaryEntryFromTemplate(entry: TemplateDictionaryEntry): DictionaryEntry {
  return {
    id: createEntityId("dict"),
    phrase: entry.phrase,
    replace_with: entry.replace_with,
  };
}

function snippetEntryFromTemplate(entry: TemplateSnippetEntry): SnippetEntry {
  return {
    id: createEntityId("snippet"),
    label: entry.label,
    trigger: entry.trigger,
    expansion: entry.expansion,
  };
}

export const TEXT_PROFILE_TEMPLATES: TextProfileTemplate[] = [
  {
    id: "customer-success",
    label: "Customer success replies",
    audience: "Customer success",
    summary: "Inbox-ready support follow-ups, escalation language and status updates for customer-facing work.",
    highlights: ["Status updates", "Escalations", "Incident comms", "Closing notes"],
    prompt: [
      "customer names",
      "ticket IDs",
      "incident severity",
      "SLA commitments",
      "next update time",
      "account owner names",
      "product plan names",
      "refund policy",
    ].join("\n"),
    dictionary_entries: [
      { phrase: "sev one", replace_with: "SEV-1" },
      { phrase: "sev two", replace_with: "SEV-2" },
      { phrase: "s l a", replace_with: "SLA" },
      { phrase: "r c a", replace_with: "RCA" },
      { phrase: "k b", replace_with: "KB" },
      { phrase: "word script", replace_with: "WordScript" },
    ],
    snippet_entries: [
      {
        label: "Status update",
        trigger: "status update",
        expansion: "Thanks for the update. We are reviewing this now and will send the next status by the agreed time.",
      },
      {
        label: "Escalation note",
        trigger: "escalation needed",
        expansion: "Escalating this now and will return with the next update as soon as the owning team responds.",
      },
      {
        label: "Closing note",
        trigger: "closing note",
        expansion: "Thanks again for the details. We are closing this now, but if anything changes you can reply here and we will reopen it.",
      },
      {
        label: "Handoff summary",
        trigger: "handoff summary",
        expansion: "Handoff summary: current customer impact, latest findings, next update owner and communication deadline are captured here for the next responder.",
      },
    ],
  },
  {
    id: "sales",
    label: "Sales follow-ups",
    audience: "Sales",
    summary: "Discovery recaps, demo follow-ups and next-step language for pipeline and deal work.",
    highlights: ["Discovery", "Demo recaps", "Procurement blockers", "Next steps"],
    prompt: [
      "account names",
      "pipeline stage",
      "decision makers",
      "procurement timing",
      "renewal scope",
      "security review",
      "mutual action plan",
      "contract terms",
    ].join("\n"),
    dictionary_entries: [
      { phrase: "c r m", replace_with: "CRM" },
      { phrase: "m r r", replace_with: "MRR" },
      { phrase: "a c v", replace_with: "ACV" },
      { phrase: "p o c", replace_with: "POC" },
      { phrase: "r o i", replace_with: "ROI" },
      { phrase: "m s a", replace_with: "MSA" },
      { phrase: "word script", replace_with: "WordScript" },
    ],
    snippet_entries: [
      {
        label: "Demo follow-up",
        trigger: "demo follow up",
        expansion: "Thanks for the time today. Attached is the recap from the demo along with the open questions and next proposed steps.",
      },
      {
        label: "Next-step recap",
        trigger: "next steps recap",
        expansion: "Next steps: confirm internal stakeholders, align on evaluation criteria and book the follow-up once the team has reviewed the material.",
      },
      {
        label: "Pricing handoff",
        trigger: "pricing handoff",
        expansion: "Sharing the pricing outline here so the team can review scope, rollout assumptions and commercial timing in one pass.",
      },
      {
        label: "Security review follow-up",
        trigger: "security review follow up",
        expansion: "Following up on the security review items here so legal, security and the buyer team can close the remaining blockers without losing momentum.",
      },
    ],
  },
  {
    id: "founder-ops",
    label: "Founder ops notes",
    audience: "Founder / Ops",
    summary: "Decision logs, weekly updates and action-item language for operating reviews and internal syncs.",
    highlights: ["Decision log", "Weekly update", "Board notes", "Action items"],
    prompt: [
      "company priorities",
      "board updates",
      "owner names",
      "deadlines",
      "financial terms",
      "quarter goals",
      "budget variance",
      "hiring plan",
    ].join("\n"),
    dictionary_entries: [
      { phrase: "p and l", replace_with: "P&L" },
      { phrase: "o k r", replace_with: "OKR" },
      { phrase: "q b r", replace_with: "QBR" },
      { phrase: "s o p", replace_with: "SOP" },
      { phrase: "one on one", replace_with: "1:1" },
      { phrase: "word script", replace_with: "WordScript" },
    ],
    snippet_entries: [
      {
        label: "Decision log",
        trigger: "decision log",
        expansion: "Decision: move forward on this path. Owner: confirm rollout details and report back with risks, timeline and dependencies.",
      },
      {
        label: "Weekly update",
        trigger: "weekly update",
        expansion: "This week: progress is on track, key blockers are listed below and the next owner updates are due before the next operating review.",
      },
      {
        label: "Action items",
        trigger: "action items",
        expansion: "Action items: confirm owner, due date and success signal for each item before the meeting closes.",
      },
      {
        label: "Risk review",
        trigger: "risk review",
        expansion: "Risk review: top risk, current exposure, mitigation owner and next checkpoint are captured here so follow-up does not drift.",
      },
    ],
  },
  {
    id: "recruiting",
    label: "Hiring pipeline",
    audience: "Recruiting / People ops",
    summary: "Interview debriefs, candidate updates and hiring-manager coordination for recruiting workflows.",
    highlights: ["Debriefs", "Candidate updates", "Offer loop", "Hiring syncs"],
    prompt: [
      "candidate names",
      "role titles",
      "interview stages",
      "hiring manager feedback",
      "offer timing",
      "levelling",
      "salary band",
      "start date",
    ].join("\n"),
    dictionary_entries: [
      { phrase: "human resources", replace_with: "HR" },
      { phrase: "a t s", replace_with: "ATS" },
      { phrase: "h m", replace_with: "HM" },
      { phrase: "e o d", replace_with: "EOD" },
      { phrase: "one on one", replace_with: "1:1" },
      { phrase: "score card", replace_with: "scorecard" },
      { phrase: "word script", replace_with: "WordScript" },
    ],
    snippet_entries: [
      {
        label: "Interview debrief",
        trigger: "interview debrief",
        expansion: "Debrief summary: strengths, open concerns and recommended next step are captured here so the hiring team can decide quickly.",
      },
      {
        label: "Candidate update",
        trigger: "candidate update",
        expansion: "Thanks again for the conversation. We are aligning internally and will send the next update once the panel feedback is complete.",
      },
      {
        label: "Offer follow-up",
        trigger: "offer follow up",
        expansion: "Following up on the offer details here. If anything feels unclear, reply with the questions and we will walk through them together.",
      },
      {
        label: "Hiring manager recap",
        trigger: "hiring manager recap",
        expansion: "Hiring manager recap: panel signal, open concerns, timeline risk and recommended next step are summarized here for fast alignment.",
      },
    ],
  },
  {
    id: "product-engineering",
    label: "Product and engineering",
    audience: "Product / Engineering",
    summary: "Triage, release and QA handoff language for product, engineering and debugging conversations.",
    highlights: ["Triage", "Release notes", "QA handoff", "Incident update"],
    prompt: [
      "feature names",
      "bug IDs",
      "release scope",
      "API names",
      "platform constraints",
      "service names",
      "migration steps",
      "infra constraints",
    ].join("\n"),
    dictionary_entries: [
      { phrase: "api", replace_with: "API" },
      { phrase: "sdk", replace_with: "SDK" },
      { phrase: "s q l", replace_with: "SQL" },
      { phrase: "ci cd", replace_with: "CI/CD" },
      { phrase: "s l o", replace_with: "SLO" },
      { phrase: "pull request", replace_with: "PR" },
      { phrase: "word script", replace_with: "WordScript" },
    ],
    snippet_entries: [
      {
        label: "Triage summary",
        trigger: "triage summary",
        expansion: "Triage summary: confirmed scope, current impact, likely owner and the next debugging step are listed below.",
      },
      {
        label: "Release note",
        trigger: "release note",
        expansion: "Release note: this change improves the main workflow, keeps the active limitations explicit and documents any rollout caveats.",
      },
      {
        label: "QA handoff",
        trigger: "qa handoff",
        expansion: "QA handoff: please verify the main happy path, the known edge case and the regression check noted here before sign-off.",
      },
      {
        label: "Incident update",
        trigger: "incident update",
        expansion: "Incident update: current impact, likely root cause, mitigation status and next checkpoint are captured here for the active response loop.",
      },
    ],
  },
];

export function createTextProfileFromTemplate(template: TextProfileTemplate, takenLabels: string[] = []): TextProfile {
  return {
    id: createEntityId("profile"),
    label: uniqueProfileLabel(template.label, takenLabels),
    prompt: template.prompt.trim(),
    dictionary_entries: template.dictionary_entries.map((entry) => dictionaryEntryFromTemplate(entry)),
    snippet_entries: template.snippet_entries.map((entry) => snippetEntryFromTemplate(entry)),
  };
}

export function mergeTemplateIntoTextProfile(profile: TextProfile, template: TextProfileTemplate): TextProfile {
  const nextProfile = cloneTextProfile(profile);

  nextProfile.prompt = mergePrompt(nextProfile.prompt, template.prompt);

  const dictionaryKeys = new Set(nextProfile.dictionary_entries.map((entry) => normalizedKey(entry.phrase)));
  for (const entry of template.dictionary_entries) {
    const key = normalizedKey(entry.phrase);
    if (!key || dictionaryKeys.has(key)) {
      continue;
    }

    nextProfile.dictionary_entries.push(dictionaryEntryFromTemplate(entry));
    dictionaryKeys.add(key);
  }

  const snippetKeys = new Set(
    nextProfile.snippet_entries.map((entry) => normalizedKey(entry.trigger || entry.label)),
  );
  for (const entry of template.snippet_entries) {
    const key = normalizedKey(entry.trigger || entry.label);
    if (!key || snippetKeys.has(key)) {
      continue;
    }

    nextProfile.snippet_entries.push(snippetEntryFromTemplate(entry));
    snippetKeys.add(key);
  }

  return nextProfile;
}