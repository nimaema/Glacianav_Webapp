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
  if (kind === "ice-navigation") {
    d.title = "GlaciaNav ice navigation and product-fit questionnaire";
    d.description =
      "Help us understand ice-navigation challenges, current tools, forecasting needs, and product fit for GlaciaNav’s ice forecasting solution.";
    d.thankYou =
      "Thank you for sharing your experience. Your input directly shapes the GlaciaNav ice forecasting product.";
    const question = (type: QuestionType, title: string, labels?: string[]) =>
      add(type, title, labels);
    const text = (title: string, required = true) => {
      const q = question("text", title);
      q.isRequired = required;
      return q;
    };
    const number = (title: string, unit = "") => {
      const q = question("number", title);
      q.min = 0;
      q.unit = unit;
      return q;
    };
    const profileRole = question("radiogroup", "What is your role?", [
      "Master / Captain",
      "Ice Navigator / Ice Advisor",
      "Fleet / Operations Manager (shore-based)",
      "Ship Owner / Charterer",
    ]);
    profileRole.showOtherItem = true;
    const purchaseRole = question(
      "radiogroup",
      "Are you involved in purchasing decisions for navigation or software tools?",
      [
        "Yes, I am the primary decision-maker",
        "Yes, I influence the decision",
        "No, but I use the tools day-to-day",
        "No involvement",
      ],
    );
    const contactName = text("Name for potential pilot follow-up", false);
    contactName.recipientName = true;
    const contactEmail = question("email", "Email for potential pilot follow-up");
    contactEmail.isRequired = false;
    const operatingRegions = question(
      "checkbox",
      "In which primary regions do you operate during ice seasons?",
      ["Baltic Sea", "Arctic routes (for example, Northern Sea Route or Northwest Passage)"],
    );
    operatingRegions.showOtherItem = true;
    const operatingMode = question(
      "radiogroup",
      "Do you operate independently, with icebreaker escort, or in convoy?",
      [
        "Primarily independent navigation",
        "Regularly request icebreaker escort",
        "Regularly travel in convoy",
        "A mix of the above, depending on conditions",
      ],
    );
    operatingMode.description =
      "This helps us understand how forecasting data should integrate with escort and convoy coordination.";
    const severity = question(
      "radiogroup",
      "How often does your vessel encounter severe ice conditions that impede standard navigation?",
      ["Rarely", "Occasionally", "Frequently", "Almost every voyage during the season"],
    );
    const costs = question(
      "checkbox",
      "Which operational costs are most impacted by ice conditions?",
      [
        "Route delays",
        "Increased fuel consumption",
        "Hull or equipment damage",
        "Increased insurance premiums",
        "Escort or icebreaker fees",
        "Crew fatigue or overtime costs",
      ],
    );
    const delayImpact = number("If route delays are impacted, estimate the average time lost per affected voyage", "hours or days");
    delayImpact.isRequired = false;
    delayImpact.conditions = [{ question: costs.name, operator: "contains", value: costs.choices[0].value }];
    const fuelImpact = question("slider", "If fuel consumption is impacted, estimate the percentage increase", []);
    fuelImpact.isRequired = false;
    fuelImpact.min = 0;
    fuelImpact.max = 50;
    fuelImpact.step = 5;
    fuelImpact.unit = "%";
    fuelImpact.rateDescriptionMin = "0%";
    fuelImpact.rateDescriptionMax = "50%+";
    fuelImpact.conditions = [{ question: costs.name, operator: "contains", value: costs.choices[1].value }];
    const sources = question(
      "checkbox",
      "Which solutions or data sources do you currently use, or have used in the past, to navigate ice?",
      [
        "National ice service charts",
        "Onboard marine radar",
        "Visual observation or bridge watch",
        "Commercial satellite imagery or forecasting software",
        "FOS",
        "ECDIS",
      ],
    );
    sources.showOtherItem = true;
    sources.showNoneItem = true;
    const shortcomings = question(
      "checkbox",
      "What are the main shortcomings of the solutions you currently use or have abandoned?",
      [
        "Data is outdated by the time it reaches the bridge",
        "Resolution is too low to make tactical route decisions",
        "Difficult to interpret or integrate into current workflows",
        "Inaccurate predictions of ice thickness or concentration",
        "Too expensive relative to the value provided",
      ],
    );
    shortcomings.showOtherItem = true;
    const hazards = question(
      "checkbox",
      "Which hazards cause the most severe operational difficulties? Select up to three.",
      [
        "Brash ice or jammed brash barriers",
        "Ridged ice and ice keels",
        "Rubble fields",
        "Multi-year or old ice",
        "Thick first-year ice",
        "Fast ice boundaries",
        "Glacial ice hazards (icebergs, bergy bits, growlers)",
      ],
    );
    hazards.maxSelectedChoices = 3;
    const routeFactors = question(
      "ranking",
      "Rank these parameters for route decisions, from most critical to least critical.",
      [
        "Ice concentration",
        "Ice edge",
        "Ice type, age, and stage of development",
        "Ice thickness",
        "Ice deformation and topography",
        "Openings and navigation paths",
      ],
    );
    const delivery = question(
      "radiogroup",
      "How would you prefer to interact with this forecasting data?",
      [
        "Direct overlay or integration into existing bridge ECDIS / navigation systems",
        "Standalone, dedicated web interface or tablet application",
      ],
    );
    delivery.showOtherItem = true;
    const approval = question(
      "radiogroup",
      "Who typically approves a new software or data subscription in your organization?",
      [
        "Captain or Master, independently",
        "Fleet or Operations Manager",
        "Procurement or Purchasing department",
        "Ship owner or senior management",
      ],
    );
    approval.showOtherItem = true;
    const providers = question(
      "checkbox",
      "Have you evaluated or used any of the following providers?",
      ["ICYSEA", "Polar View", "National meteorological or ice service (for example, FMI, DMI, AARI)"],
    );
    providers.showOtherItem = true;
    providers.showNoneItem = true;
    d.pages = [
      {
        name: "respondent_company_profile",
        title: "Respondent and company profile",
        description: "A little context helps us interpret your operational experience.",
        elements: [
          profileRole,
          text("Company name"),
          number("Fleet size: number of vessels operating in ice", "vessels"),
          purchaseRole,
          contactName,
          contactEmail,
          question("consent", "I consent to being contacted for a follow-up interview or pilot program."),
        ],
      },
      {
        name: "vessel_route_profile",
        title: "Vessel and route profile",
        description: "Tell us about the vessel and routes you operate during ice season.",
        elements: [
          operatingRegions,
          text("What type of vessel do you operate?"),
          text("What ice class do you currently operate? For example, PC1-PC7, 1A Super, or 1A."),
          number("How many vessels in your fleet regularly transit ice-covered waters?", "vessels"),
          operatingMode,
        ],
      },
      {
        name: "operational_impact",
        title: "Operational impact of sea ice",
        description: "Help us understand the consequences of challenging ice conditions.",
        elements: [severity, costs, delayImpact, fuelImpact],
      },
      {
        name: "current_solutions",
        title: "Current navigational solutions",
        description: "Share the tools you rely on today and where they fall short.",
        elements: [
          sources,
          shortcomings,
          question("radiogroup", "How often do you need updated ice data for it to be operationally useful?", ["Real-time or continuous", "Every 1-6 hours", "Once or twice a day", "Daily is sufficient"]),
        ],
      },
      {
        name: "hazards_forecasting_needs",
        title: "Critical ice hazards and forecasting needs",
        description: "Identify the hazards and route information that matter most on the bridge.",
        elements: [
          hazards,
          routeFactors,
          question("radiogroup", "What spatial resolution is required for an ice forecast to be genuinely useful for your bridge team?", [
            "40-50 m grid: detects narrow leads and individual ridges",
            "100-250 m grid: identifies local ice structure and channels",
            "250-500 m grid: suitable for port approaches and ice belts",
            "1 km or more grid: broad macro-planning for seasonal or regional routes",
          ]),
        ],
      },
      {
        name: "integration_delivery",
        title: "GlaciaNav integration and delivery",
        description: "Let us know how the information should fit into your operating environment.",
        elements: [
          delivery,
          question("radiogroup", "What is the typical data bandwidth available on the bridge?", ["High (VSAT / Starlink)", "Medium (FleetBroadband)", "Low (Iridium / Inmarsat C)", "Don’t know"]),
          question("radiogroup", "How valuable would an automated POLARIS Risk Index Outcome calculation be to your operation?", ["Extremely valuable", "Somewhat valuable", "Not valuable"]),
          question("radiogroup", "Would documentation support for Polar Water Operational Manual (PWOM) or classification-society ice audits add value?", ["Yes, this is a significant purchase driver", "Somewhat useful, but not essential", "Not relevant to our operation"]),
        ],
      },
      {
        name: "purchase_fit_trial",
        title: "Purchase fit and willingness to trial",
        description: "These answers help us scope a trial and the right commercial model.",
        elements: [
          question("radiogroup", "What would a highly accurate, real-time ice forecasting solution be worth to your operation each month?", ["Under $500", "$500-$1,500", "$1,500-$3,000", "$3,000+"]),
          approval,
          question("radiogroup", "Would you be willing to participate in a free pilot or trial of GlaciaNav’s forecasting tool?", ["Yes, immediately", "Yes, but only after seeing a demo or case study", "Possibly, need more information", "No"]),
          question("radiogroup", "How much crew training or onboarding time would be acceptable to adopt a new ice-forecasting tool?", ["Under 1 hour: it must be intuitive with no training", "1-3 hours", "Half-day session", "Full day or more, if benefits are clear"]),
          providers,
        ],
      },
      {
        name: "open_feedback",
        title: "Open feedback",
        description: "Your direct experience can reveal the needs a standard question misses.",
        elements: [
          (() => {
            const q = question("comment", "Do you have any additional comments or specific pain points regarding ice navigation that were not covered here?");
            q.isRequired = false;
            return q;
          })(),
        ],
      },
    ];
  } else if (kind === "feedback") {
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
