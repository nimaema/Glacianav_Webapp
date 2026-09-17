"use client";
import { useState } from "react";
import {
  Plus,
  Trash,
  Copy,
  ArrowUp,
  ArrowDown,
  DotsSixVertical,
  SlidersHorizontal,
  GitBranch,
  CheckSquare,
  ArrowRight,
} from "@phosphor-icons/react";
import {
  allQuestions,
  newQuestion,
  TYPE_META,
  type Definition,
  type Question,
  type QuestionType,
  type Condition,
  type Choice,
} from "@/lib/questionnaires/types";
import { choiceTypes, numericTypes } from "@/lib/questionnaires/engine";
import { Button, Field, Modal, Toggle } from "./ui";

export function Builder({
  definition,
  onChange,
  readonly = false,
  logicOnly = false,
}: {
  definition: Definition;
  onChange: (d: Definition) => void;
  readonly?: boolean;
  logicOnly?: boolean;
}) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(
    allQuestions(definition)[0]?.name ?? "",
  );
  const [palette, setPalette] = useState(false);
  const [tab, setTab] = useState("settings");
  const [search, setSearch] = useState("");
  const [drag, setDrag] = useState<string | null>(null);
  const p = definition.pages[Math.min(page, definition.pages.length - 1)];
  const q = allQuestions(definition).find((x) => x.name === selected);
  function update(next: Definition) {
    if (!readonly) onChange(next);
  }
  function patchQuestion(patch: Partial<Question>) {
    if (!q) return;
    update({
      ...definition,
      pages: definition.pages.map((p) => ({
        ...p,
        elements: p.elements.map((x) =>
          x.name === q.name ? { ...x, ...patch } : x,
        ),
      })),
    });
  }
  function add(type: QuestionType) {
    const question = newQuestion(type);
    update({
      ...definition,
      pages: definition.pages.map((x) =>
        x.name === p.name ? { ...x, elements: [...x.elements, question] } : x,
      ),
    });
    setSelected(question.name);
    setPalette(false);
    setTab("settings");
  }
  function remove() {
    if (!q) return;
    update({
      ...definition,
      pages: definition.pages.map((p) => ({
        ...p,
        elements: p.elements.filter((x) => x.name !== q.name),
      })),
    });
    setSelected("");
  }
  function move(name: string, delta: number) {
    const index = p.elements.findIndex((x) => x.name === name);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= p.elements.length) return;
    const arr = [...p.elements];
    [arr[index], arr[target]] = [arr[target], arr[index]];
    update({
      ...definition,
      pages: definition.pages.map((x) =>
        x.name === p.name ? { ...x, elements: arr } : x,
      ),
    });
  }
  function duplicate() {
    if (!q) return;
    const copy = {
      ...structuredClone(q),
      name: newQuestion(q.type).name,
      title: `${q.title} — copy`,
    };
    update({
      ...definition,
      pages: definition.pages.map((x) =>
        x.name === p.name ? { ...x, elements: [...x.elements, copy] } : x,
      ),
    });
    setSelected(copy.name);
  }
  const preceding = q
    ? allQuestions(definition).slice(
        0,
        allQuestions(definition).findIndex((x) => x.name === q.name),
      )
    : [];
  return (
    <div className="qn-builder">
      <aside className="qn-outline">
        <div className="qn-outline-heading">
          <span className="qn-eyebrow">Your questionnaire</span>
          <span className="qn-count">{allQuestions(definition).length}</span>
        </div>
        <div className="qn-outline-scroll">
          {definition.pages.map((pg, pi) => (
            <div key={pg.name} className="qn-outline-page">
              <button
                className="qn-page-label"
                aria-pressed={p.name === pg.name}
                onClick={() => {
                  setPage(pi);
                  setSelected(pg.elements[0]?.name ?? "");
                }}
              >
                <span>Section {String(pi + 1).padStart(2, "0")}</span>
                <strong>{pg.title || "Untitled section"}</strong>
              </button>
              {pg.elements.map((item, i) => (
                <button
                  key={item.name}
                  className={`qn-outline-question ${selected === item.name ? "is-selected" : ""}`}
                  onClick={() => {
                    setSelected(item.name);
                    setPage(pi);
                  }}
                >
                  <span className="qn-type-glyph">
                    {TYPE_META[item.type].glyph}
                  </span>
                  <span>{item.title || TYPE_META[item.type].label}</span>
                  {item.conditions.length ? (
                    <GitBranch size={13} />
                  ) : (
                    <small>{String(i + 1).padStart(2, "0")}</small>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="qn-outline-footer">
          <Button disabled={readonly} onClick={() => setPalette(true)}>
            <Plus size={17} />
            Add question
          </Button>
          <Button
            variant="quiet"
            disabled={readonly}
            onClick={() => {
              const name = `page_${crypto.randomUUID().replaceAll("-", "")}`;
              update({
                ...definition,
                pages: [
                  ...definition.pages,
                  {
                    name,
                    title: `Section ${definition.pages.length + 1}`,
                    description: "",
                    elements: [],
                  },
                ],
              });
              setPage(definition.pages.length);
              setSelected("");
            }}
          >
            Add section
          </Button>
        </div>
      </aside>
      <section className="qn-builder-canvas">
        <div className="qn-canvas-meta">
          <span className="qn-eyebrow">
            {logicOnly ? "Conditional paths" : "Question canvas"}
          </span>
          <span>{p.elements.length} questions in this section</span>
        </div>
        <div className="qn-section-intro">
          {logicOnly ? (
            <details open>
              <summary>Section visibility</summary>
              <p className="qn-help">
                Apply these conditions to every question in this section.
              </p>
              <ConditionEditor
                conditions={p.conditions ?? []}
                previous={definition.pages
                  .slice(0, page)
                  .flatMap((p) => p.elements)}
                onChange={(conditions) =>
                  update({
                    ...definition,
                    pages: definition.pages.map((x) =>
                      x.name === p.name ? { ...x, conditions } : x,
                    ),
                  })
                }
              />
              <Field label="Section condition match">
                <select
                  value={p.conditionMode ?? "all"}
                  onChange={(e) =>
                    update({
                      ...definition,
                      pages: definition.pages.map((x) =>
                        x.name === p.name
                          ? {
                              ...x,
                              conditionMode: e.target.value as "all" | "any",
                            }
                          : x,
                      ),
                    })
                  }
                >
                  <option value="all">All conditions (AND)</option>
                  <option value="any">Any condition (OR)</option>
                </select>
              </Field>
            </details>
          ) : null}
          <input
            className="qn-section-title-input"
            aria-label="Section title"
            readOnly={readonly}
            value={p.title}
            placeholder="Name this section"
            onChange={(e) =>
              update({
                ...definition,
                pages: definition.pages.map((x) =>
                  x.name === p.name ? { ...x, title: e.target.value } : x,
                ),
              })
            }
          />
          <input
            aria-label="Section description"
            readOnly={readonly}
            value={p.description}
            placeholder="Add a little context for this section…"
            onChange={(e) =>
              update({
                ...definition,
                pages: definition.pages.map((x) =>
                  x.name === p.name ? { ...x, description: e.target.value } : x,
                ),
              })
            }
          />
          {definition.pages.length > 1 ? (
            <div className="qn-inline">
              <Button
                variant="quiet"
                disabled={readonly || page === 0}
                onClick={() => {
                  const pages = [...definition.pages];
                  [pages[page - 1], pages[page]] = [
                    pages[page],
                    pages[page - 1],
                  ];
                  update({ ...definition, pages });
                  setPage(page - 1);
                }}
              >
                <ArrowUp size={15} />
                Move section up
              </Button>
              <Button
                variant="quiet"
                disabled={readonly || page === definition.pages.length - 1}
                onClick={() => {
                  const pages = [...definition.pages];
                  [pages[page + 1], pages[page]] = [
                    pages[page],
                    pages[page + 1],
                  ];
                  update({ ...definition, pages });
                  setPage(page + 1);
                }}
              >
                <ArrowDown size={15} />
                Move section down
              </Button>
              <Button
                variant="quiet"
                disabled={readonly || p.elements.length > 0}
                title="Only empty sections can be removed"
                onClick={() => {
                  update({
                    ...definition,
                    pages: definition.pages.filter((x) => x.name !== p.name),
                  });
                  setPage(0);
                }}
              >
                Remove empty section
              </Button>
            </div>
          ) : null}
        </div>
        <div className="qn-question-cards">
          {p.elements.map((item, index) => (
            <article
              key={item.name}
              className={`qn-question-card ${selected === item.name ? "is-selected" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (drag) {
                  move(
                    drag,
                    index - p.elements.findIndex((x) => x.name === drag),
                  );
                  setDrag(null);
                }
              }}
            >
              <div className="qn-question-card-heading">
                <button
                  className="qn-drag-handle"
                  aria-label={`Move question ${index + 1}`}
                  draggable={!readonly}
                  onDragStart={() => setDrag(item.name)}
                >
                  <DotsSixVertical size={20} />
                </button>
                <button
                  className="qn-question-select"
                  onClick={() => setSelected(item.name)}
                >
                  <span className="qn-question-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{TYPE_META[item.type].label}</span>
                </button>
                {item.isRequired ? (
                  <span className="qn-required-label">Required</span>
                ) : (
                  <span className="qn-optional-label">Optional</span>
                )}
                <div className="qn-card-move">
                  <Button
                    variant="quiet"
                    aria-label={`Move question ${index + 1} up`}
                    disabled={readonly || index === 0}
                    onClick={() => move(item.name, -1)}
                  >
                    <ArrowUp size={14} />
                  </Button>
                  <Button
                    variant="quiet"
                    aria-label={`Move question ${index + 1} down`}
                    disabled={readonly || index === p.elements.length - 1}
                    onClick={() => move(item.name, 1)}
                  >
                    <ArrowDown size={14} />
                  </Button>
                </div>
              </div>
              <div
                className="qn-question-card-body"
                onClick={() => setSelected(item.name)}
              >
                {selected === item.name && !readonly ? (
                  <>
                    <textarea
                      rows={2}
                      className="qn-question-title-input"
                      aria-label="Question title"
                      placeholder="What would you like to ask?"
                      value={item.title}
                      onChange={(e) => patchQuestion({ title: e.target.value })}
                    />
                    <input
                      aria-label="Question description"
                      className="qn-question-description-input"
                      placeholder="A hint, an example, a little context…"
                      value={item.description}
                      onChange={(e) =>
                        patchQuestion({ description: e.target.value })
                      }
                    />
                  </>
                ) : (
                  <>
                    <h3>{item.title || "What would you like to ask?"}</h3>
                    {item.description ? <p>{item.description}</p> : null}
                  </>
                )}
                {logicOnly ? (
                  <div className="qn-logic-summary">
                    <GitBranch size={19} />
                    {item.conditions.length ? (
                      <span>
                        Shown when {item.conditions.length} condition
                        {item.conditions.length !== 1 ? "s" : ""}{" "}
                        {item.conditions.length === 1 ? "is" : "are"} met.
                      </span>
                    ) : (
                      <span>Shown to everyone on this path.</span>
                    )}
                    <button
                      onClick={() => {
                        setSelected(item.name);
                        setTab("logic");
                      }}
                    >
                      Edit logic
                      <ArrowRight size={14} />
                    </button>
                  </div>
                ) : (
                  <QuestionPreview question={item} />
                )}
              </div>
              {selected === item.name ? (
                <div className="qn-question-card-footer">
                  <span>
                    <CheckSquare size={15} /> {TYPE_META[item.type].description}
                  </span>
                  <Button
                    variant="quiet"
                    disabled={readonly}
                    onClick={duplicate}
                    aria-label="Duplicate selected question"
                  >
                    <Copy size={16} />
                  </Button>
                  <Button
                    variant="quiet"
                    disabled={readonly}
                    onClick={remove}
                    aria-label="Remove selected question"
                  >
                    <Trash size={16} />
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
        <button
          disabled={readonly}
          className="qn-add-question"
          onClick={() => setPalette(true)}
        >
          <span>
            <Plus size={21} />
          </span>
          <strong>Add a question</strong>
          <small>Choose from 23 question and content types</small>
        </button>
      </section>
      <aside className="qn-properties">
        <div className="qn-property-tabs">
          <button
            aria-pressed={tab === "settings" && !logicOnly}
            onClick={() => setTab("settings")}
          >
            <SlidersHorizontal size={16} />
            Properties
          </button>
          <button
            aria-pressed={tab === "logic" || logicOnly}
            onClick={() => setTab("logic")}
          >
            <GitBranch size={16} />
            Logic
          </button>
        </div>
        {q ? (
          <fieldset disabled={readonly} className="qn-property-body">
            {tab === "logic" || logicOnly ? (
              <>
                <h3>Show this question when</h3>
                <p className="qn-help">
                  Build a path around earlier answers. With no conditions,
                  everyone sees this question.
                </p>
                <ConditionEditor
                  conditions={q.conditions}
                  previous={preceding}
                  onChange={(conditions) => patchQuestion({ conditions })}
                />
                <Field label="Match">
                  <select
                    value={q.conditionMode}
                    onChange={(e) =>
                      patchQuestion({
                        conditionMode: e.target.value as "all" | "any",
                      })
                    }
                  >
                    <option value="all">All conditions (AND)</option>
                    <option value="any">Any condition (OR)</option>
                  </select>
                </Field>
                <h3 className="qn-property-section">Require an answer when</h3>
                <ConditionEditor
                  conditions={q.requiredConditions}
                  previous={preceding}
                  onChange={(requiredConditions) =>
                    patchQuestion({ requiredConditions })
                  }
                />
                {choiceTypes.has(q.type) ? (
                  <Field
                    label="Carry forward selected options"
                    hint="Uses selected options from an earlier multiple-choice question."
                  >
                    <select
                      value={q.choicesFromQuestion}
                      onChange={(e) => {
                        const source = preceding.find(
                          (x) => x.name === e.target.value,
                        );
                        patchQuestion({
                          choicesFromQuestion: e.target.value,
                          ...(source
                            ? { choices: structuredClone(source.choices) }
                            : {}),
                        });
                      }}
                    >
                      <option value="">Use this question’s own options</option>
                      {preceding
                        .filter((x) => ["checkbox", "tagbox"].includes(x.type))
                        .map((x) => (
                          <option key={x.name} value={x.name}>
                            {x.title}
                          </option>
                        ))}
                    </select>
                  </Field>
                ) : null}
              </>
            ) : (
              <>
                <div className="qn-property-type">
                  <span className="qn-type-glyph">
                    {TYPE_META[q.type].glyph}
                  </span>
                  <div>
                    <strong>{TYPE_META[q.type].label}</strong>
                    <small>{TYPE_META[q.type].group}</small>
                  </div>
                </div>
                {definition.pages.length > 1 ? (
                  <Field label="Section">
                    <select
                      value={
                        definition.pages.find((p) =>
                          p.elements.some((x) => x.name === q.name),
                        )?.name
                      }
                      onChange={(e) => {
                        const target = e.target.value;
                        update({
                          ...definition,
                          pages: definition.pages.map((p) => ({
                            ...p,
                            elements:
                              p.name === target
                                ? [...p.elements, q]
                                : p.elements.filter((x) => x.name !== q.name),
                          })),
                        });
                        setPage(
                          definition.pages.findIndex((p) => p.name === target),
                        );
                      }}
                    >
                      {definition.pages.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.title || "Untitled section"}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}
                {q.type !== "content" ? (
                  <Toggle
                    label="Required answer"
                    checked={q.isRequired}
                    onChange={(isRequired) => patchQuestion({ isRequired })}
                  />
                ) : null}
                {choiceTypes.has(q.type) || q.type.startsWith("matrix") ? (
                  <>
                    <h3 className="qn-property-section">Answer options</h3>
                    <ChoiceEditor
                      choices={q.choices}
                      image={q.type === "imagepicker"}
                      onChange={(choices) => patchQuestion({ choices })}
                    />
                    {!q.type.startsWith("matrix") && q.type !== "ranking" ? (
                      <>
                        <Toggle
                          label="Allow “Other”"
                          checked={q.showOtherItem}
                          onChange={(showOtherItem) =>
                            patchQuestion({ showOtherItem })
                          }
                        />
                        <Toggle
                          label="Include “None of these”"
                          checked={q.showNoneItem}
                          onChange={(showNoneItem) =>
                            patchQuestion({ showNoneItem })
                          }
                        />
                      </>
                    ) : null}
                    <Toggle
                      label="Shuffle options"
                      checked={q.randomize}
                      onChange={(randomize) => patchQuestion({ randomize })}
                    />
                  </>
                ) : null}
                {q.type.startsWith("matrix") ? (
                  <>
                    <h3 className="qn-property-section">Matrix rows</h3>
                    <ChoiceEditor
                      choices={q.rows}
                      onChange={(rows) => patchQuestion({ rows })}
                    />
                  </>
                ) : null}
                {["checkbox", "tagbox", "ranking", "imagepicker"].includes(
                  q.type,
                ) ? (
                  <div className="qn-field-pair">
                    <NumberField
                      label="Minimum selections"
                      value={q.minSelectedChoices}
                      onChange={(minSelectedChoices) =>
                        patchQuestion({ minSelectedChoices })
                      }
                    />
                    <NumberField
                      label="Maximum (0 = any)"
                      value={q.maxSelectedChoices}
                      onChange={(maxSelectedChoices) =>
                        patchQuestion({ maxSelectedChoices })
                      }
                    />
                  </div>
                ) : null}
                {q.type === "imagepicker" ? (
                  <p className="qn-help">
                    Set maximum to 1 for a single image, or 0 to allow any
                    number.
                  </p>
                ) : null}
                {q.type === "ranking" ? (
                  <p className="qn-help">
                    Set matching minimum and maximum values for a top-N ranking,
                    or set both to the number of options to rank every item.
                  </p>
                ) : null}
                {numericTypes.has(q.type) ? (
                  <>
                    <h3 className="qn-property-section">Scale and values</h3>
                    {q.type !== "nps" ? (
                      <>
                        <div className="qn-field-pair">
                          <NumberField
                            label="Minimum"
                            value={q.min}
                            onChange={(min) => patchQuestion({ min })}
                          />
                          <NumberField
                            label="Maximum"
                            value={q.max}
                            onChange={(max) => patchQuestion({ max })}
                          />
                        </div>
                        <NumberField
                          label="Step"
                          value={q.step}
                          onChange={(step) => patchQuestion({ step })}
                        />
                      </>
                    ) : (
                      <p className="qn-help">NPS uses a fixed 0–10 scale.</p>
                    )}
                    <Field label="Unit or currency">
                      <input
                        value={q.unit}
                        onChange={(e) =>
                          patchQuestion({ unit: e.target.value })
                        }
                        placeholder="€, %, hours…"
                      />
                    </Field>
                    {["rating", "nps", "slider"].includes(q.type) ? (
                      <>
                        <Field label="Low-end label">
                          <input
                            value={q.rateDescriptionMin}
                            onChange={(e) =>
                              patchQuestion({
                                rateDescriptionMin: e.target.value,
                              })
                            }
                            placeholder="Not at all"
                          />
                        </Field>
                        <Field label="High-end label">
                          <input
                            value={q.rateDescriptionMax}
                            onChange={(e) =>
                              patchQuestion({
                                rateDescriptionMax: e.target.value,
                              })
                            }
                            placeholder="Extremely"
                          />
                        </Field>
                      </>
                    ) : null}
                  </>
                ) : null}
                {["text", "comment", "email", "tel", "url"].includes(q.type) ? (
                  <NumberField
                    label="Maximum characters"
                    value={q.maxLength}
                    onChange={(maxLength) => patchQuestion({ maxLength })}
                  />
                ) : null}
                {q.type === "file" ? (
                  <>
                    <Field label="Accepted extensions">
                      <input
                        value={q.acceptedTypes}
                        onChange={(e) =>
                          patchQuestion({ acceptedTypes: e.target.value })
                        }
                      />
                    </Field>
                    <NumberField
                      label="Maximum files"
                      value={q.maxFiles}
                      onChange={(maxFiles) => patchQuestion({ maxFiles })}
                    />
                    <NumberField
                      label="Maximum file size (MB)"
                      value={q.maxSize / 1024 / 1024}
                      onChange={(v) =>
                        patchQuestion({ maxSize: v * 1024 * 1024 })
                      }
                    />
                    <p className="qn-help">
                      Uploads are private. The maximum allowed size is 25 MB per
                      file.
                    </p>
                  </>
                ) : null}
                {q.type === "content" ? (
                  <>
                    <Field label="Optional media type">
                      <select
                        value={q.mediaType}
                        onChange={(e) =>
                          patchQuestion({
                            mediaType: e.target.value as Question["mediaType"],
                          })
                        }
                      >
                        <option value="image">Image</option>
                        <option value="audio">Audio</option>
                        <option value="video">Video</option>
                      </select>
                    </Field>
                    <Field
                      label="Media URL"
                      hint="Use a direct HTTPS media link. Include captions or a transcript in the description."
                    >
                      <input
                        type="url"
                        value={q.mediaUrl}
                        onChange={(e) =>
                          patchQuestion({ mediaUrl: e.target.value })
                        }
                        placeholder="https://…"
                      />
                    </Field>
                  </>
                ) : null}
              </>
            )}
          </fieldset>
        ) : (
          <div className="qn-properties-empty">
            <SlidersHorizontal size={25} />
            <h3>Make it yours</h3>
            <p>Select a question to edit its options, validation, and logic.</p>
          </div>
        )}
      </aside>
      <Modal
        open={palette}
        onClose={() => setPalette(false)}
        title="A question for every perspective"
        description="Choose how people can share their answer."
        wide
      >
        <div className="qn-palette-search">
          <input
            autoComplete="off"
            aria-label="Find question type"
            placeholder="Find a question type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="qn-type-palette">
          {Object.entries(TYPE_META)
            .filter(([, m]) =>
              `${m.label} ${m.description}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map(([type, m]) => (
              <button key={type} onClick={() => add(type as QuestionType)}>
                <span className="qn-type-glyph">{m.glyph}</span>
                <span>
                  <strong>{m.label}</strong>
                  <small>{m.description}</small>
                </span>
                <Plus size={16} />
              </button>
            ))}
        </div>
      </Modal>
    </div>
  );
}
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}
function ChoiceEditor({
  choices,
  onChange,
  image = false,
}: {
  choices: Choice[];
  onChange: (c: Choice[]) => void;
  image?: boolean;
}) {
  const [paste, setPaste] = useState("");
  return (
    <div className="qn-choice-editor">
      {choices.map((c, i) => (
        <div key={c.value}>
          <div>
            <span>{i + 1}</span>
            <input
              aria-label={`Option ${i + 1} label`}
              value={c.text}
              onChange={(e) =>
                onChange(
                  choices.map((x) =>
                    x.value === c.value ? { ...x, text: e.target.value } : x,
                  ),
                )
              }
            />
            <button
              aria-label={`Move option ${i + 1} up`}
              disabled={i === 0}
              onClick={() => {
                const next = [...choices];
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                onChange(next);
              }}
            >
              <ArrowUp size={14} />
            </button>
            <button
              aria-label={`Remove option ${i + 1}`}
              onClick={() =>
                onChange(choices.filter((x) => x.value !== c.value))
              }
            >
              <Trash size={14} />
            </button>
          </div>
          {image ? (
            <input
              aria-label={`Image URL for option ${i + 1}`}
              value={c.imageLink ?? ""}
              type="url"
              placeholder="https://image-url…"
              onChange={(e) =>
                onChange(
                  choices.map((x) =>
                    x.value === c.value
                      ? { ...x, imageLink: e.target.value }
                      : x,
                  ),
                )
              }
            />
          ) : null}
        </div>
      ))}
      <Button
        variant="quiet"
        onClick={() =>
          onChange([
            ...choices,
            {
              value: `option_${crypto.randomUUID().replaceAll("-", "")}`,
              text: `Option ${choices.length + 1}`,
            },
          ])
        }
      >
        <Plus size={14} />
        Add option
      </Button>
      <details>
        <summary className="qn-help">Paste a list of options</summary>
        <textarea
          aria-label="Options to append, one per line"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="One option per line"
        />
        <Button
          disabled={!paste.trim()}
          onClick={() => {
            const values = paste
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter(Boolean);
            onChange(
              [
                ...choices,
                ...values.map((text) => ({
                  value: `option_${crypto.randomUUID().replaceAll("-", "")}`,
                  text,
                })),
              ].slice(0, 200),
            );
            setPaste("");
          }}
        >
          Append options
        </Button>
      </details>
    </div>
  );
}
function ConditionEditor({
  conditions,
  previous,
  onChange,
}: {
  conditions: Condition[];
  previous: Question[];
  onChange: (c: Condition[]) => void;
}) {
  return (
    <div className="qn-condition-editor">
      {conditions.map((c, i) => (
        <div key={i}>
          <select
            aria-label="Condition question"
            value={c.question}
            onChange={(e) =>
              onChange(
                conditions.map((v, n) =>
                  n === i ? { ...v, question: e.target.value } : v,
                ),
              )
            }
          >
            {previous.map((p) => (
              <option key={p.name} value={p.name}>
                {p.title || "Untitled question"}
              </option>
            ))}
          </select>
          <div>
            <select
              aria-label="Condition operator"
              value={c.operator}
              onChange={(e) =>
                onChange(
                  conditions.map((v, n) =>
                    n === i
                      ? {
                          ...v,
                          operator: e.target.value as Condition["operator"],
                        }
                      : v,
                  ),
                )
              }
            >
              {[
                { v: "equal", l: "Equals" },
                { v: "notequal", l: "Does not equal" },
                { v: "contains", l: "Includes" },
                { v: "greater", l: "Greater than" },
                { v: "less", l: "Less than" },
                { v: "empty", l: "Is empty" },
                { v: "notempty", l: "Is answered" },
              ].map((x) => (
                <option key={x.v} value={x.v}>
                  {x.l}
                </option>
              ))}
            </select>
            <Button
              variant="quiet"
              aria-label="Remove condition"
              onClick={() => onChange(conditions.filter((_, n) => n !== i))}
            >
              <Trash size={14} />
            </Button>
          </div>
          {!["empty", "notempty"].includes(c.operator) ? (
            previous.find((p) => p.name === c.question)?.choices.length &&
            choiceTypes.has(
              previous.find((p) => p.name === c.question)!.type,
            ) ? (
              <select
                aria-label="Condition value"
                value={c.value}
                onChange={(e) =>
                  onChange(
                    conditions.map((v, n) =>
                      n === i ? { ...v, value: e.target.value } : v,
                    ),
                  )
                }
              >
                <option value="">Choose an option</option>
                {previous
                  .find((p) => p.name === c.question)
                  ?.choices.map((x) => (
                    <option key={x.value} value={x.value}>
                      {x.text}
                    </option>
                  ))}
              </select>
            ) : (
              <input
                aria-label="Condition value"
                placeholder="Answer to match"
                value={c.value}
                onChange={(e) =>
                  onChange(
                    conditions.map((v, n) =>
                      n === i ? { ...v, value: e.target.value } : v,
                    ),
                  )
                }
              />
            )
          ) : null}
        </div>
      ))}
      <Button
        variant="quiet"
        disabled={!previous.length}
        onClick={() =>
          onChange([
            ...conditions,
            { question: previous[0].name, operator: "notempty", value: "" },
          ])
        }
      >
        <Plus size={14} />
        Add condition
      </Button>
    </div>
  );
}
function QuestionPreview({ question: q }: { question: Question }) {
  if (
    [
      "radiogroup",
      "checkbox",
      "dropdown",
      "tagbox",
      "imagepicker",
      "ranking",
    ].includes(q.type)
  )
    return (
      <div
        className={`qn-preview-options ${q.type === "imagepicker" ? "qn-preview-images" : ""}`}
        aria-hidden="true"
      >
        {q.choices.slice(0, 5).map((c, i) => (
          <div key={c.value}>
            {q.type === "ranking" ? (
              <span>{i + 1}</span>
            ) : q.type === "imagepicker" ? (
              <span className="qn-image-placeholder">
                {c.imageLink ? "Image" : "Add image"}
              </span>
            ) : (
              <i className={q.type === "radiogroup" ? "is-radio" : ""} />
            )}
            <span>{c.text}</span>
            {q.type === "ranking" ? <DotsSixVertical size={16} /> : null}
          </div>
        ))}
      </div>
    );
  if (["rating", "nps", "slider"].includes(q.type))
    return (
      <div className="qn-preview-scale" aria-hidden="true">
        <div>
          {Array.from(
            {
              length:
                q.type === "nps"
                  ? 11
                  : Math.min(10, Math.floor((q.max - q.min) / q.step) + 1),
            },
            (_, i) => (
              <span key={i}>{q.type === "nps" ? i : q.min + i * q.step}</span>
            ),
          )}
        </div>
        <p>
          <span>{q.rateDescriptionMin || "Low"}</span>
          <span>{q.rateDescriptionMax || "High"}</span>
        </p>
      </div>
    );
  if (q.type.startsWith("matrix"))
    return (
      <div className="qn-preview-matrix" aria-hidden="true">
        {q.rows.slice(0, 4).map((r) => (
          <div key={r.value}>
            <span>{r.text}</span>
            {q.choices.slice(0, 5).map((c) => (
              <i key={c.value} />
            ))}
          </div>
        ))}
      </div>
    );
  if (q.type === "file")
    return (
      <div className="qn-preview-upload" aria-hidden="true">
        <Plus size={22} />
        <span>Choose a file or drop it here</span>
        <small>
          Up to {q.maxFiles} files · {q.maxSize / 1024 / 1024} MB each
        </small>
      </div>
    );
  if (q.type === "boolean" || q.type === "consent")
    return (
      <div className="qn-preview-options" aria-hidden="true">
        {(q.type === "boolean" ? ["Yes", "No"] : ["I agree"]).map((l) => (
          <div key={l}>
            <i />
            <span>{l}</span>
          </div>
        ))}
      </div>
    );
  if (q.type === "content")
    return (
      <div className="qn-content-preview">
        Context and media · No answer needed
      </div>
    );
  return (
    <div
      className={`qn-preview-input ${q.type === "comment" ? "is-long" : ""}`}
      aria-hidden="true"
    >
      {q.type === "date"
        ? "dd / mm / yyyy"
        : q.type === "number"
          ? "Enter an amount…"
          : "Your answer goes here…"}
    </div>
  );
}
