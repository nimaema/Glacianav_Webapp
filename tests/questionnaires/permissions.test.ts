import test from "node:test";
import assert from "node:assert/strict";
import { questionnairePermissions } from "../../src/lib/questionnaires/permissions";

test("questionnaire roles separate editing, sending, raw results, and membership management", () => {
  assert.deepEqual(questionnairePermissions(true), {
    canOpen: true,
    canManage: true,
    canEdit: true,
    canSend: true,
    canRead: true,
  });
  assert.deepEqual(questionnairePermissions(false, "editor"), {
    canOpen: true,
    canManage: false,
    canEdit: true,
    canSend: false,
    canRead: false,
  });
  assert.deepEqual(questionnairePermissions(false, "sender"), {
    canOpen: true,
    canManage: false,
    canEdit: false,
    canSend: true,
    canRead: false,
  });
  assert.deepEqual(questionnairePermissions(false, "analyst"), {
    canOpen: true,
    canManage: false,
    canEdit: false,
    canSend: false,
    canRead: true,
  });
  for (const role of [undefined, "unknown"])
    assert.deepEqual(questionnairePermissions(false, role), {
      canOpen: false,
      canManage: false,
      canEdit: false,
      canSend: false,
      canRead: false,
    });
});
