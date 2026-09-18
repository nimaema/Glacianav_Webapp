export const QUESTION_TYPES = [
  "text",
  "comment",
  "radiogroup",
  "checkbox",
  "dropdown",
  "tagbox",
  "boolean",
  "rating",
  "nps",
  "slider",
  "number",
  "email",
  "tel",
  "url",
  "date",
  "time",
  "ranking",
  "matrix",
  "matrixdropdown",
  "imagepicker",
  "file",
  "consent",
  "content",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type Choice = { value: string; text: string; imageLink?: string };
export type Condition = {
  question: string;
  operator:
    | "equal"
    | "notequal"
    | "contains"
    | "greater"
    | "less"
    | "notempty"
    | "empty";
  value: string;
};
export type Question = {
  name: string;
  type: QuestionType;
  title: string;
  description: string;
  isRequired: boolean;
  choices: Choice[];
  rows: Choice[];
  conditions: Condition[];
  conditionMode: "all" | "any";
  requiredConditions: Condition[];
  choicesFromQuestion: string;
  showOtherItem: boolean;
  showNoneItem: boolean;
  min: number;
  max: number;
  step: number;
  minSelectedChoices: number;
  maxSelectedChoices: number;
  maxLength: number;
  unit: string;
  rateDescriptionMin: string;
  rateDescriptionMax: string;
  randomize: boolean;
  acceptedTypes: string;
  maxSize: number;
  maxFiles: number;
  mediaUrl: string;
  mediaType: "image" | "audio" | "video";
  contentFormat?: "plain" | "markdown";
  mediaAlt?: string;
  mediaCaption?: string;
  mediaWidth?: "full" | "medium" | "small";
  mediaAlign?: "left" | "center" | "right";
  recipientName?: boolean;
};
export type FormPage = {
  name: string;
  title: string;
  description: string;
  elements: Question[];
  conditions?: Condition[];
  conditionMode?: "all" | "any";
};
export type Definition = {
  format: 1;
  title: string;
  description: string;
  thankYou: string;
  pages: FormPage[];
  mode: "pages" | "single" | "question";
  showProgress: boolean;
  showReview: boolean;
};
export type Answers = Record<string, unknown>;
export type Person = {
  id: string;
  name: string;
  email: string;
  customerId?: string | null;
  customerName?: string | null;
  segment?: string | null;
};
export type Questionnaire = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  draft: Definition;
  draft_revision: number;
  published_version: number | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
  invited?: number;
  submitted?: number;
  campaign_count?: number;
};
export type Version = {
  id: string;
  questionnaire_id: string;
  number: number;
  definition: Definition;
  created_at: string;
};
export type Campaign = {
  public_token?: string | null;
  id: string;
  questionnaire_id: string;
  version_id: string;
  name: string;
  state: "open" | "closed";
  closes_at: string | null;
  created_at: string;
};
export type Invitation = {
  name_question_id?: string | null;
  id: string;
  campaign_id: string;
  name: string;
  email: string;
  customer_id: string | null;
  customer_name: string | null;
  segment: string | null;
  status: string;
  delivery: string;
  created_at: string;
  sent_at: string | null;
  last_reminder_at: string | null;
  started_at: string | null;
  submitted_at: string | null;
  response_id?: string;
  version_number?: number;
  campaign_name?: string;
};
export type ResponseRecord = {
  id: string;
  invitation_id: string;
  version_id: string;
  answers: Answers;
  states: Record<string, "answered" | "unanswered" | "skipped">;
  revision: number;
  status: string;
  page: number;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  name?: string;
  email?: string;
  customer_name?: string | null;
  segment?: string | null;
  campaign_id?: string;
  campaign_name?: string;
  version_number?: number;
  annotation: string;
};
export type QuestionnaireDetail = {
  questionnaire: Questionnaire;
  versions: Version[];
  campaigns: Campaign[];
  invitations: Invitation[];
  responses: ResponseRecord[];
  contacts: Person[];
  canEdit: boolean;
  canSend: boolean;
  canRead: boolean;
  canManage: boolean;
  members: { profile_id: string; role: string }[];
  profiles: { id: string; name: string; email: string | null }[];
  local: boolean;
  emailEnabled: boolean;
};

export const TYPE_META: Record<
  QuestionType,
  { label: string; description: string; group: string; glyph: string }
> = {
  text: {
    label: "Short answer",
    description: "A word, a name, a quick thought",
    group: "Written",
    glyph: "T",
  },
  comment: {
    label: "Long answer",
    description: "Room for a more thoughtful response",
    group: "Written",
    glyph: "¶",
  },
  radiogroup: {
    label: "Single choice",
    description: "Choose one from a set of options",
    group: "Choices",
    glyph: "◉",
  },
  checkbox: {
    label: "Multiple choice",
    description: "Choose all the options that apply",
    group: "Choices",
    glyph: "☑",
  },
  dropdown: {
    label: "Dropdown",
    description: "A searchable list of options",
    group: "Choices",
    glyph: "⌄",
  },
  tagbox: {
    label: "Multi-select",
    description: "Search and choose several options",
    group: "Choices",
    glyph: "+",
  },
  boolean: {
    label: "Yes / no",
    description: "A clear choice between two answers",
    group: "Choices",
    glyph: "±",
  },
  rating: {
    label: "Rating scale",
    description: "Measure an opinion on a labeled scale",
    group: "Scales",
    glyph: "★",
  },
  nps: {
    label: "Net promoter score",
    description: "Likelihood to recommend, from 0 to 10",
    group: "Scales",
    glyph: "10",
  },
  slider: {
    label: "Slider",
    description: "Find a point along a numeric range",
    group: "Scales",
    glyph: "↔",
  },
  number: {
    label: "Number",
    description: "An amount, percentage, or measurement",
    group: "Written",
    glyph: "#",
  },
  email: {
    label: "Email",
    description: "An email address with validation",
    group: "Details",
    glyph: "@",
  },
  tel: {
    label: "Phone",
    description: "A phone number, including country code",
    group: "Details",
    glyph: "+1",
  },
  url: {
    label: "Website",
    description: "A link to a website or resource",
    group: "Details",
    glyph: "↗",
  },
  date: {
    label: "Date",
    description: "Choose a calendar date",
    group: "Details",
    glyph: "31",
  },
  time: {
    label: "Time",
    description: "Choose a time of day",
    group: "Details",
    glyph: ":",
  },
  ranking: {
    label: "Ranking",
    description: "Put priorities in order",
    group: "Advanced",
    glyph: "≡",
  },
  matrix: {
    label: "Rating matrix",
    description: "Rate several items on the same scale",
    group: "Advanced",
    glyph: "▦",
  },
  matrixdropdown: {
    label: "Selection matrix",
    description: "Multiple choices for each row",
    group: "Advanced",
    glyph: "▤",
  },
  imagepicker: {
    label: "Image choice",
    description: "Choose with pictures and labels",
    group: "Advanced",
    glyph: "▧",
  },
  file: {
    label: "File upload",
    description: "Share a document, image, or recording",
    group: "Advanced",
    glyph: "↑",
  },
  consent: {
    label: "Acknowledgment",
    description: "Explicit agreement to a statement",
    group: "Content",
    glyph: "✓",
  },
  content: {
    label: "Text and media",
    description: "Give context between questions",
    group: "Content",
    glyph: "Aa",
  },
};

export function newQuestion(type: QuestionType): Question {
  return {
    name: `q_${crypto.randomUUID().replaceAll("-", "")}`,
    type,
    title: "",
    description: "",
    isRequired: false,
    choices: [1, 2, 3].map((n) => ({
      value: `option_${crypto.randomUUID().replaceAll("-", "")}`,
      text: `Option ${n}`,
    })),
    rows: [1, 2, 3].map((n) => ({
      value: `row_${crypto.randomUUID().replaceAll("-", "")}`,
      text: `Item ${n}`,
    })),
    conditions: [],
    requiredConditions: [],
    conditionMode: "all",
    choicesFromQuestion: "",
    showOtherItem: false,
    showNoneItem: false,
    min: type === "rating" ? 1 : 0,
    max: type === "rating" ? 5 : type === "nps" ? 10 : 100,
    step: 1,
    minSelectedChoices: 0,
    maxSelectedChoices: 0,
    maxLength: type === "comment" ? 10000 : 500,
    unit: "",
    rateDescriptionMin: "",
    rateDescriptionMax: "",
    randomize: false,
    acceptedTypes: ".pdf,.png,.jpg,.jpeg,.txt,.csv,.mp3,.wav,.mp4",
    maxSize: 10 * 1024 * 1024,
    maxFiles: 3,
    mediaUrl: "",
    mediaType: "image",
  };
}
export function blankDefinition(): Definition {
  return {
    format: 1,
    title: "Untitled questionnaire",
    description: "",
    thankYou:
      "Thank you for sharing your perspective. Your response has been received.",
    pages: [
      {
        name: `page_${crypto.randomUUID().replaceAll("-", "")}`,
        title: "Getting started",
        description: "",
        elements: [],
      },
    ],
    mode: "pages",
    showProgress: true,
    showReview: true,
  };
}
export function normalizeDefinition(value: unknown): Definition {
  let candidate = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      candidate = null;
    }
  }
  if (
    candidate &&
    typeof candidate === "object" &&
    Array.isArray((candidate as { pages?: unknown }).pages)
  ) {
    return candidate as Definition;
  }
  throw new Error("This questionnaire has an invalid saved definition. Please contact the workspace administrator; its content has been preserved.");
}
export function allQuestions(definition: Definition | null | undefined) {
  return definition?.pages?.flatMap((p) => p.elements) ?? [];
}
export function alignCarriedChoices(definition: Definition): Definition {
  const seen = new Map<string, Question>();
  return {
    ...definition,
    pages: definition.pages.map((p) => ({
      ...p,
      elements: p.elements.map((question) => {
        const source = seen.get(question.choicesFromQuestion);
        const q = source
          ? { ...question, choices: source.choices.map((c) => ({ ...c })) }
          : question;
        seen.set(q.name, q);
        return q;
      }),
    })),
  };
}
export function template(kind: string): Definition {
  const d = blankDefinition();
  if (kind === "blank") return d;
  const add = (type: QuestionType, title: string, labels?: string[]) => {
    const q = newQuestion(type);
    q.title = title;
    q.isRequired = type !== "comment" && type !== "file";
    if (labels)
      q.choices = labels.map((text, i) => ({ value: `choice_${i}`, text }));
    return q;
  };
  if (kind === "feedback") {
    d.title = "Customer experience";
    d.description =
      "Help us understand what works well and where we can do better.";
    d.pages[0].elements = [
      add("nps", "How likely are you to recommend GlaciaNav?"),
      add("rating", "How was your overall experience?"),
      add("checkbox", "What made the biggest difference?", [
        "Ease of use",
        "Reliability",
        "Support",
        "Time saved",
      ]),
      add("comment", "What could we do better?"),
    ];
  } else if (kind === "research") {
    d.title = "Field research";
    d.description =
      "A closer look at how your team plans, operates, and makes decisions in the field.";
    const environment = add("checkbox", "Where does your team operate?", [
      "Mountains",
      "Coast and water",
      "Remote terrain",
      "Urban environments",
    ]);
    const rank = add("ranking", "Which challenges matter most?", [
      "Changing conditions",
      "Team coordination",
      "Offline access",
      "Planning time",
    ]);
    const matrix = add(
      "matrix",
      "How well do your current tools support you?",
      ["Not well", "Somewhat", "Very well"],
    );
    matrix.rows = ["Planning", "Communication", "Decision-making"].map(
      (text, i) => ({ value: `row_${i}`, text }),
    );
    d.pages[0].elements = [environment, rank, matrix];
    d.pages.push({
      name: `page_${crypto.randomUUID().replaceAll("-", "")}`,
      title: "Your perspective",
      description: "A little more context helps us build the right things.",
      elements: [
        add("comment", "Tell us about a recent challenge."),
        add("file", "Share an example, if you have one."),
        add("consent", "You may contact me about my answers."),
      ],
    });
  } else {
    d.title = "Project discovery";
    d.description = "Tell us about your goals, priorities, and the work ahead.";
    d.pages[0].elements = [
      add("text", "What are you working on?"),
      add("radiogroup", "What stage are you at?", [
        "Exploring",
        "Planning",
        "Building",
        "Improving",
      ]),
      add("ranking", "Put your priorities in order.", [
        "Quality",
        "Speed",
        "Cost",
        "Flexibility",
      ]),
      add("comment", "What would a successful outcome look like?"),
    ];
  }
  return d;
}
