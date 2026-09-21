import test from "node:test";
import assert from "node:assert/strict";
import {
  newQuestion,
  type QuestionnaireDetail,
} from "../../src/lib/questionnaires/types";

// Explicit opt-in: this writes synthetic fixtures ONLY into the isolated,
// loopback preview. It refuses a real workspace/database deployment.
const origin = process.env.QUESTIONNAIRE_TEST_ORIGIN;
test(
  "HTTP lifecycle: publishing, personal sessions, autosave, uploads, submit, export, revoke",
  { skip: !origin },
  async () => {
    assert.ok(origin && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin));
    async function request(
      path: string,
      body?: unknown,
      cookie = "",
      expected = 200,
    ) {
      const r = await fetch(origin + path, {
        method: body ? "POST" : "GET",
        headers: {
          Origin: origin!,
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await r.json();
      assert.equal(r.status, expected, JSON.stringify(data));
      return { data, response: r };
    }
    const page = await fetch(origin + "/questionnaires");
    assert.match(await page.text(), /Changes are saved on this Mac/);
    const { data: created } = await request("/api/questionnaires", {
      template: "blank",
    });
    const id = created.id;
    const endpoint = `/api/questionnaires/${id}`;
    try {
      const { data: detail } = await request(endpoint);
      assert.equal(detail.local, true);
      const q = newQuestion("checkbox");
      q.title = "Choose environments";
      q.isRequired = true;
      const follow = newQuestion("comment");
      follow.title = "Tell us more";
      follow.isRequired = true;
      follow.conditions = [
        { question: q.name, operator: "contains", value: q.choices[0].value },
      ];
      const f = newQuestion("file");
      f.title = "An optional attachment";
      f.acceptedTypes = ".txt";
      const d = detail.questionnaire.draft;
      const nameField = newQuestion("text");
      nameField.title = "Your name";
      nameField.recipientName = true;
      const context = newQuestion("content");
      context.title = "Research context";
      context.contentFormat = "markdown";
      context.description = "## Welcome\n\n**Read this** before answering.\n\n- One\n- Two";
      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64");
      const imageUpload = await fetch(origin + endpoint + "/media", { method: "POST", headers: { Origin: origin!, "X-File-Name": "qa.png" }, body: png });
      assert.equal(imageUpload.status, 200, await imageUpload.clone().text());
      context.mediaUrl = (await imageUpload.json()).url;
      context.mediaAlt = "A test pixel";
      context.mediaCaption = "Test image";
      const imageRead = await fetch(origin + context.mediaUrl);
      assert.equal(imageRead.headers.get("content-type"), "image/png");
      assert.deepEqual(Buffer.from(await imageRead.arrayBuffer()), png);
      const badImage = await fetch(origin + endpoint + "/media", { method: "POST", headers: { Origin: origin! }, body: "<svg onload='alert(1)'></svg>" });
      assert.equal(badImage.status, 400);
      d.title = "QA · automated lifecycle";
      d.pages[0].elements = [nameField, context, q, follow, f];
      await request(endpoint, { action: "save", definition: d, revision: 1 });
      await request(
        endpoint,
        { action: "save", definition: d, revision: 1 },
        "",
        409,
      );
      await request(endpoint, { action: "publish", revision: 2 });
      const { data: campaign } = await request(endpoint, {
        action: "campaign",
        name: "Synthetic QA cohort",
        closesAt: null,
      });
      const recipients = [
        { id: "", name: "QA Person A", email: "qa-person-a@example.test" },
        { id: "", name: "QA Person B", email: "qa-person-b@example.test" },
      ];
      const { data: invites } = await request(endpoint, {
        action: "invite",
        campaignId: campaign.id,
        recipients,
        channel: "manual",
        nameQuestionId: nameField.name,
      });
      assert.equal(invites.created, 2);
      const { data: duplicates } = await request(endpoint, {
        action: "invite",
        campaignId: campaign.id,
        recipients,
        channel: "manual",
      });
      assert.equal(duplicates.created, 0);
      assert.equal(duplicates.duplicates, 2);
      const namesOnly = await request(endpoint, { action: "invite", campaignId: campaign.id, recipients: [{ name: "Name Only A", email: "" }, { name: "Name Only B", email: "" }], channel: "manual", nameQuestionId: nameField.name });
      assert.equal(namesOnly.data.created, 2);
      await request(endpoint, { action: "invite", campaignId: campaign.id, recipients: [{ name: "No Email", email: "" }], channel: "email" }, "", 400);
      await request(endpoint, { action: "invite", campaignId: campaign.id, recipients, channel: "manual", nameQuestionId: q.name }, "", 400);
      const token = invites.links[0].path.split("/").at(-1);
      const landing = await fetch(origin + invites.links[0].path);
      assert.equal(landing.status, 200);
      assert.match(
        landing.headers.get("cache-control") ?? "",
        /no-store|no-cache/,
      );
      assert.equal(landing.headers.get("referrer-policy"), "no-referrer");
      assert.equal(
        (await request(endpoint)).data.responses.length,
        0,
        "GET link must not consume/start an invitation",
      );
      const { data: session, response: sessionRes } = await request(
        "/api/questionnaire-public/session",
        { token },
      );
      const cookie = sessionRes.headers.get("set-cookie")!.split(";")[0];
      const respondentPage = await fetch(origin + `/respond/${session.responseId}`, { headers: { Cookie: cookie } });
      assert.equal(respondentPage.status, 200);
      assert.match(sessionRes.headers.get("set-cookie")!, /HttpOnly/i);
      const responsePath = `/api/questionnaire-public/response/${session.responseId}`;
      await request(
        responsePath,
        { answers: {}, revision: 0, page: 0, submit: false },
        "",
        401,
      );
      const denied = await fetch(origin + responsePath, {
        method: "POST",
        headers: {
          Origin: "https://unrelated.example",
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answers: {},
          revision: 0,
          page: 0,
          submit: false,
        }),
      });
      assert.equal(denied.status, 403);
      const answers = {
        [nameField.name]: "FORGED NAME",
        [q.name]: [q.choices[0].value],
        [follow.name]: "Synthetic response, not customer research.",
      };
      await request(
        responsePath,
        { answers, revision: 0, page: 0, submit: false },
        cookie,
      );
      await request(
        responsePath,
        { answers, revision: 0, page: 0, submit: false },
        cookie,
        409,
      );
      const form = new FormData();
      form.set("responseId", session.responseId);
      form.set("questionId", f.name);
      form.append(
        "files",
        new File(["A synthetic questionnaire test attachment.\n"], "qa.txt", {
          type: "text/plain",
        }),
      );
      const upload = await fetch(origin + "/api/questionnaire-public/upload", {
        method: "POST",
        headers: { Origin: origin!, Cookie: cookie },
        body: form,
      });
      const uploaded = await upload.json();
      assert.equal(upload.status, 200, JSON.stringify(uploaded));
      assert.equal(uploaded.files.length, 1);
      const attachment = await fetch(origin + uploaded.files[0].content, {
        headers: { Cookie: cookie },
      });
      assert.equal(attachment.status, 200);
      assert.match(
        attachment.headers.get("content-disposition") ?? "",
        /attachment/,
      );
      const b = await request("/api/questionnaire-public/session", {
        token: invites.links[1].path.split("/").at(-1),
      });
      const cookieB = b.response.headers.get("set-cookie")!.split(";")[0];
      await request(
        `/api/questionnaire-public/response/${b.data.responseId}`,
        {
          answers: { [q.name]: [q.choices[1].value], [f.name]: uploaded.files },
          revision: 0,
          page: 0,
          submit: true,
        },
        cookieB,
        400,
      );
      const finalAnswers = { ...answers, [f.name]: uploaded.files };
      const expectedAnswers = { ...finalAnswers, [nameField.name]: "QA Person A" };
      await request(
        responsePath,
        { answers: finalAnswers, revision: 1, page: 0, submit: true },
        cookie,
      );
      await request(
        responsePath,
        { answers: finalAnswers, revision: 1, page: 0, submit: true },
        cookie,
      ); // Idempotent retry.
      const results = (await request(endpoint)).data as QuestionnaireDetail;
      assert.equal(
        results.responses.filter((r) => r.status === "submitted").length,
        1,
      );
      assert.deepEqual(
        results.responses.find((r) => r.id === session.responseId)?.answers,
        expectedAnswers,
      );
      d.title = "QA · changed draft";
      await request(endpoint, { action: "save", definition: d, revision: 2 });
      assert.equal(
        (await request(endpoint)).data.versions[0].definition.title,
        "QA · automated lifecycle",
      );
      for (const format of ["csv", "xlsx", "pdf"]) {
        const exp: Response = await fetch(
          origin +
            `${endpoint}/export?version=${results.versions[0].id}&format=${format}`,
        );
        assert.equal(exp.status, 200);
        const bytes = await exp.arrayBuffer();
        assert.ok(bytes.byteLength > 100);
      }
      await request(endpoint, {
        action: "invitation",
        invitationId: invites.links[1].id,
        operation: "revoke",
      });
      await request(
        `/api/questionnaire-public/response/${b.data.responseId}`,
        { answers: {}, revision: 0, page: 0, submit: false },
        cookieB,
        401,
      );
      await request(endpoint, {
        action: "invitation",
        invitationId: invites.links[0].id,
        operation: "reopen",
      });
      const reopened = (await request(endpoint)).data.responses.find(
        (r: { id: string }) => r.id === session.responseId,
      );
      assert.equal(reopened.status, "draft");
      assert.equal(reopened.revision, 3);
      const history = (
        await request(`${endpoint}/responses/${session.responseId}/history`)
      ).data.revisions;
      assert.equal(history.length, 1);
      assert.deepEqual(history[0].answers, expectedAnswers);
      const { data: publicLink } = await request(endpoint, { action: "publicLink", campaignId: campaign.id, enabled: true });
      const publicToken = publicLink.path.split("/").at(-1);
      const publicLanding = await fetch(origin + publicLink.path);
      assert.match(await publicLanding.text(), /An open invitation/);
      const publicA = await request("/api/questionnaire-public/session", { token: publicToken });
      const publicB = await request("/api/questionnaire-public/session", { token: publicToken });
      assert.notEqual(publicA.data.responseId, publicB.data.responseId);
      const publicCookieA = publicA.response.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
      const publicCookieB = publicB.response.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
      const resumed = await request("/api/questionnaire-public/session", { token: publicToken }, publicCookieA);
      assert.equal(resumed.data.responseId, publicA.data.responseId);
      const publicPathA = `/api/questionnaire-public/response/${publicA.data.responseId}`;
      await request(publicPathA, { answers: {}, revision: 0, page: 0, submit: false }, publicCookieB, 401);
      await request(publicPathA, { answers: { [nameField.name]: "My chosen public name", [q.name]: [q.choices[1].value] }, revision: 0, page: 0, submit: true }, publicCookieA);
      const publicResults = (await request(endpoint)).data.responses;
      assert.equal(publicResults.find((r: { id: string }) => r.id === publicA.data.responseId).answers[nameField.name], "My chosen public name");
      assert.deepEqual(publicResults.find((r: { id: string }) => r.id === publicB.data.responseId).answers, {});
      await request(endpoint, { action: "publicLink", campaignId: campaign.id, enabled: false });
      await request("/api/questionnaire-public/session", { token: publicToken }, publicCookieA, 404);
      await request(`/api/questionnaire-public/response/${publicB.data.responseId}`, { answers: {}, revision: 0, page: 0, submit: false }, publicCookieB, 410);
      const newPublic = await request(endpoint, { action: "publicLink", campaignId: campaign.id, enabled: true });
      assert.notEqual(newPublic.data.path, publicLink.path);
      await request(endpoint, {
        action: "collection",
        campaignId: campaign.id,
        state: "closed",
      });
      await request(
        responsePath,
        { answers: finalAnswers, revision: 3, page: 0, submit: true },
        cookie,
        410,
      );
      await request("/api/questionnaire-public/session", { token: newPublic.data.path.split("/").at(-1) }, "", 410);
      const { data: disposable } = await request("/api/questionnaires", { template: "blank" });
      const disposableEndpoint = `/api/questionnaires/${disposable.id}`;
      const disposableDetail = (await request(disposableEndpoint)).data;
      const disposableQuestion = newQuestion("text");
      disposableQuestion.title = "A removable published question";
      disposableDetail.questionnaire.draft.pages[0].elements = [disposableQuestion];
      await request(disposableEndpoint, { action: "save", definition: disposableDetail.questionnaire.draft, revision: 1 });
      await request(disposableEndpoint, { action: "publish", revision: 2 });
      await request(disposableEndpoint, { action: "remove", confirmation: true }, "", 409);
      await request(disposableEndpoint, { action: "archive", archived: true });
      await request(disposableEndpoint, { action: "remove", confirmation: true });
      await request(disposableEndpoint, undefined, "", 404);
    } finally {
      await request(endpoint, { action: "archive", archived: true });
    }
  },
);
