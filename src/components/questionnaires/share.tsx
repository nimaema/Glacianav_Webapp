"use client";
import { useState } from "react";
import {
  Plus,
  Link as LinkIcon,
  EnvelopeSimple,
  Users,
  ArrowUpRight,
  Copy,
  UploadSimple,
  Clock,
  Prohibit,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import type { QuestionnaireDetail, Person } from "@/lib/questionnaires/types";
import {
  Button,
  Field,
  Modal,
  Message,
  Status,
  Empty,
  api,
  errorMessage,
  shortDate,
} from "./ui";
export function Share({
  detail,
  refresh,
}: {
  detail: QuestionnaireDetail;
  refresh: () => Promise<void>;
}) {
  const id = detail.questionnaire.id;
  const [campaignId, setCampaignId] = useState(detail.campaigns[0]?.id ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [recipients, setRecipients] = useState<Person[]>([]);
  const [personName, setPersonName] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<"manual" | "email">("manual");
  const [scheduled, setScheduled] = useState("");
  const [reminderDays, setReminderDays] = useState(0);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<
    { id: string; name: string; email: string; path: string }[]
  >([]);
  const campaign = detail.campaigns.find((c) => c.id === campaignId);
  const invitations = detail.invitations.filter(
    (i) => i.campaign_id === campaignId,
  );
  async function mutate(body: unknown) {
    setBusy(true);
    setError("");
    try {
      const result = await api<Record<string, unknown>>(
        `/api/questionnaires/${id}`,
        body,
      );
      await refresh();
      return result;
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function createCampaign() {
    const r = await mutate({
      action: "campaign",
      name: name || `Collection ${detail.campaigns.length + 1}`,
      closesAt: deadline ? new Date(deadline).toISOString() : null,
    });
    if (r) {
      setCampaignId(String(r.id));
      setCreateOpen(false);
    }
  }
  function add(p: Person) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) || !p.name.trim()) {
      setError("Add a name and a valid email address.");
      return;
    }
    if (recipients.some((x) => x.email.toLowerCase() === p.email.toLowerCase()))
      return;
    setRecipients([...recipients, p]);
    setPersonName("");
    setEmail("");
    setError("");
  }
  async function send() {
    const r = await mutate({
      action: "invite",
      campaignId,
      recipients,
      channel,
      reminderDays: channel === "email" ? reminderDays : 0,
      ...(channel === "email" && scheduled
        ? { scheduledAt: new Date(scheduled).toISOString() }
        : {}),
    });
    if (r) {
      setLinks(r.links as typeof links);
      setNote(
        `${r.created} invitations created${r.duplicates ? ` · ${r.duplicates} existing recipients skipped` : ""}.`,
      );
      setRecipients([]);
    }
  }
  async function importFile(file: File) {
    try {
      if (file.size > 1024 * 1024)
        throw new Error("Use a recipient file smaller than 1 MB.");
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(
        workbook.Sheets[workbook.SheetNames[0]],
        { defval: "" },
      );
      const parsed = rows.slice(0, 200).map((row) => {
        const lower = Object.fromEntries(
          Object.entries(row).map(([k, v]) => [
            k.trim().toLowerCase(),
            String(v),
          ]),
        );
        return {
          id: "",
          name: lower.name || lower["full name"] || "",
          email: lower.email || lower["email address"] || "",
        };
      });
      if (rows.length > 200)
        throw new Error(
          "Import up to 200 people at a time. Split this file into smaller lists; no rows were imported.",
        );
      if (
        new Set([...recipients, ...parsed].map((p) => p.email.toLowerCase()))
          .size > 200
      )
        throw new Error(
          "Keep the selected audience to 200 people per send. No rows were imported.",
        );
      if (
        parsed.some(
          (p) => !p.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email),
        )
      )
        throw new Error(
          "Include Name and Email columns, with a name and valid email on every row.",
        );
      setRecipients(
        [
          ...new Map(
            [...recipients, ...parsed].map((p) => [p.email.toLowerCase(), p]),
          ).values(),
        ].slice(0, 200),
      );
      setNote(
        "Recipients imported. Review the list before creating invitations.",
      );
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <div className="qn-share qn-tab-content">
      <div className="qn-section-heading">
        <div>
          <span className="qn-eyebrow">From questions to conversations</span>
          <h2>Invite a perspective.</h2>
          <p>Every person gets a private link and their own place to answer.</p>
        </div>
        <Button
          disabled={!detail.canSend || !detail.questionnaire.published_version}
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={17} />
          New collection
        </Button>
      </div>
      {!detail.questionnaire.published_version ? (
        <Empty
          icon={<LinkIcon size={30} />}
          title="Ready when you are"
          description="Publish your questionnaire to create a collection and invite people."
        />
      ) : (
        <>
          <div className="qn-collection-selector">
            <Field label="Collection">
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
              >
                <option value="">Choose a collection</option>
                {detail.campaigns.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name} · {c.state}
                  </option>
                ))}
              </select>
            </Field>
            {campaign ? (
              <>
                <Status tone={campaign.state === "open" ? "green" : "neutral"}>
                  {campaign.state === "open" ? "Accepting responses" : "Closed"}
                </Status>
                <span className="qn-muted">
                  {campaign.closes_at
                    ? `Closes ${shortDate(campaign.closes_at)}`
                    : "No deadline"}
                </span>
                <Button
                  disabled={!detail.canSend}
                  variant="quiet"
                  onClick={() =>
                    mutate({
                      action: "collection",
                      campaignId,
                      state: campaign.state === "open" ? "closed" : "open",
                    })
                  }
                >
                  {campaign.state === "open"
                    ? "Close collection"
                    : "Reopen collection"}
                </Button>
              </>
            ) : null}
          </div>
          {campaign && detail.canSend ? (
            <div className="qn-share-grid">
              <section className="qn-panel">
                <div className="qn-panel-heading">
                  <Users size={20} />
                  <h3>Who would you like to hear from?</h3>
                </div>
                <div className="qn-field-pair">
                  <Field label="Name">
                    <input
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      placeholder="Full name"
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                    />
                  </Field>
                </div>
                <div className="qn-inline">
                  <Button
                    onClick={() => add({ id: "", name: personName, email })}
                  >
                    <Plus size={16} />
                    Add person
                  </Button>
                  <label className="qn-import">
                    <UploadSimple size={16} />
                    Import CSV or Excel
                    <input
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void importFile(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {detail.contacts.length ? (
                  <>
                    <div className="qn-divider" />
                    <Field label="Find a workspace contact">
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search people or companies…"
                      />
                    </Field>
                    <div className="qn-contact-picker">
                      {detail.contacts
                        .filter((c) =>
                          `${c.name} ${c.email} ${c.customerName ?? ""}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                        )
                        .slice(0, 8)
                        .map((c) => (
                          <label key={c.id}>
                            <input
                              type="checkbox"
                              checked={recipients.some(
                                (r) => r.email === c.email,
                              )}
                              onChange={(e) =>
                                e.target.checked
                                  ? add(c)
                                  : setRecipients(
                                      recipients.filter(
                                        (r) => r.email !== c.email,
                                      ),
                                    )
                              }
                            />
                            <span>
                              <strong>{c.name}</strong>
                              <small>{c.customerName ?? c.email}</small>
                            </span>
                          </label>
                        ))}
                    </div>
                  </>
                ) : null}
                {recipients.length ? (
                  <div className="qn-recipient-chips">
                    {recipients.map((p) => (
                      <button
                        key={p.email}
                        title={`Remove ${p.email}`}
                        onClick={() =>
                          setRecipients(
                            recipients.filter((r) => r.email !== p.email),
                          )
                        }
                      >
                        {p.name}
                        <span>×</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
              <section className="qn-panel qn-send-panel">
                <span className="qn-eyebrow">Personal, by design</span>
                <h3>
                  {recipients.length
                    ? `${recipients.length} personal invitation${recipients.length === 1 ? "" : "s"}`
                    : "Choose your delivery"}
                </h3>
                <p>
                  Links are unique to each person. Responses stay connected to
                  the right contact.
                </p>
                <label className="qn-delivery-option">
                  <input
                    type="radio"
                    name="delivery"
                    checked={channel === "manual"}
                    onChange={() => setChannel("manual")}
                  />
                  <LinkIcon size={22} />
                  <span>
                    <strong>Create personal links</strong>
                    <small>Share individually in your own messages</small>
                  </span>
                </label>
                <label
                  className={`qn-delivery-option ${!detail.emailEnabled ? "is-disabled" : ""}`}
                >
                  <input
                    type="radio"
                    name="delivery"
                    disabled={!detail.emailEnabled}
                    checked={channel === "email"}
                    onChange={() => setChannel("email")}
                  />
                  <EnvelopeSimple size={22} />
                  <span>
                    <strong>Send email invitations</strong>
                    <small>
                      {detail.emailEnabled
                        ? "Send directly from GlaciaNav"
                        : "Email delivery needs workspace setup"}
                    </small>
                  </span>
                </label>
                {channel === "email" ? (
                  <div>
                    <Field label="Schedule (optional)">
                      <input
                        type="datetime-local"
                        value={scheduled}
                        onChange={(e) => setScheduled(e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Reminder after sending"
                      hint="One reminder, only to people who have not submitted or declined, and only before the deadline."
                    >
                      <select
                        value={reminderDays}
                        onChange={(e) =>
                          setReminderDays(Number(e.target.value))
                        }
                      >
                        <option value={0}>No automatic reminder</option>
                        <option value={3}>3 days</option>
                        <option value={7}>7 days</option>
                        <option value={14}>14 days</option>
                      </select>
                    </Field>
                    <p className="qn-help">
                      Email preview: “Hello [name], you are invited to complete{" "}
                      {detail.questionnaire.title}.” Each message includes a
                      personal link, privacy notice, and a way to decline.
                    </p>
                  </div>
                ) : null}
                <Button
                  variant="primary"
                  disabled={
                    busy || !recipients.length || campaign.state !== "open"
                  }
                  onClick={send}
                >
                  {channel === "email"
                    ? "Send invitations"
                    : "Create personal links"}
                  <ArrowUpRight size={17} />
                </Button>
                <small className="qn-help">
                  You can revoke an invitation at any time.
                </small>
              </section>
            </div>
          ) : null}
          {links.length ? (
            <section className="qn-panel qn-created-links">
              <h3>Your personal links are ready</h3>
              <p>
                Copy them now. To protect access, the original links are not
                stored in the dashboard.
              </p>
              {links.map((l) => (
                <div key={l.id}>
                  <span>
                    <strong>{l.name}</strong>
                    <small>{l.email}</small>
                  </span>
                  <Button
                    onClick={async () => {
                      await navigator.clipboard.writeText(
                        new URL(l.path, location.origin).href,
                      );
                      setNote(`Link copied for ${l.name}.`);
                    }}
                  >
                    <Copy size={15} />
                    Copy link
                  </Button>
                  <a
                    className="qn-button qn-button--quiet"
                    href={l.path}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                    <ArrowUpRight size={15} />
                  </a>
                </div>
              ))}
            </section>
          ) : null}
          <div className="qn-section-heading">
            <h3>Invitation activity</h3>
            <span className="qn-count">{invitations.length}</span>
          </div>
          {!invitations.length ? (
            <Empty
              icon={<EnvelopeSimple size={26} />}
              title="Your audience is still taking shape"
              description="Add people above to create the first invitations for this collection."
            />
          ) : (
            <div className="qn-table-wrap">
              <table className="qn-table">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Participation</th>
                    <th>Delivery</th>
                    <th>Invited</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <strong>{i.name}</strong>
                        <small>{i.email}</small>
                      </td>
                      <td>
                        <Status
                          tone={
                            i.status === "submitted"
                              ? "green"
                              : i.status === "started"
                                ? "blue"
                                : "neutral"
                          }
                        >
                          {i.status}
                        </Status>
                      </td>
                      <td>{i.delivery}</td>
                      <td>{shortDate(i.created_at)}</td>
                      <td>
                        {detail.canSend ? (
                          <div className="qn-inline">
                            {!["submitted", "revoked", "declined"].includes(
                              i.status,
                            ) ? (
                              <>
                                <Button
                                  variant="quiet"
                                  title="Generate a new link; the old link stops working"
                                  onClick={async () => {
                                    const r = await mutate({
                                      action: "invitation",
                                      invitationId: i.id,
                                      operation: "link",
                                    });
                                    if (r)
                                      setLinks([
                                        {
                                          id: i.id,
                                          name: i.name,
                                          email: i.email,
                                          path: String(r.path),
                                        },
                                      ]);
                                  }}
                                >
                                  <LinkIcon size={16} />
                                  <span className="sr-only">
                                    New link for {i.name}
                                  </span>
                                </Button>
                                <Button
                                  variant="quiet"
                                  disabled={!detail.emailEnabled || busy}
                                  title="Send reminder"
                                  onClick={() =>
                                    mutate({
                                      action: "invitation",
                                      invitationId: i.id,
                                      operation: "remind",
                                    })
                                  }
                                >
                                  <Clock size={16} />
                                  <span className="sr-only">
                                    Remind {i.name}
                                  </span>
                                </Button>
                                <Button
                                  variant="quiet"
                                  title="Revoke invitation"
                                  onClick={() =>
                                    mutate({
                                      action: "invitation",
                                      invitationId: i.id,
                                      operation: "revoke",
                                    })
                                  }
                                >
                                  <Prohibit size={16} />
                                  <span className="sr-only">
                                    Revoke {i.name}
                                  </span>
                                </Button>
                              </>
                            ) : i.status === "submitted" ? (
                              <Button
                                variant="quiet"
                                title="Reopen for a revised response"
                                onClick={() =>
                                  mutate({
                                    action: "invitation",
                                    invitationId: i.id,
                                    operation: "reopen",
                                  })
                                }
                              >
                                <ArrowCounterClockwise size={16} />
                                <span className="sr-only">Reopen {i.name}</span>
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {note ? (
        <p className="qn-toast" role="status">
          {note}
        </p>
      ) : null}
      {error ? <Message>{error}</Message> : null}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="A new collection"
        description="Each collection uses the current published version and has its own audience."
      >
        <Field label="Collection name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="September customer research"
          />
        </Field>
        <Field label="Closing date (optional)">
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </Field>
        <div className="qn-modal-actions">
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={createCampaign}>
            Create collection
          </Button>
        </div>
      </Modal>
    </div>
  );
}
