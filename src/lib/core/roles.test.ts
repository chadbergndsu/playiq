import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canManageTeam,
  canUseFilmRoom,
  isParent,
  isStaff,
  isTeamRole,
  normalizeEmail,
  parseAdminEmailsEnv,
  postLoginPath,
} from "./roles";

describe("roles", () => {
  it("normalizes emails", () => {
    assert.equal(normalizeEmail("  Chad@Example.COM "), "chad@example.com");
    assert.equal(normalizeEmail(""), null);
    assert.equal(normalizeEmail("nope"), null);
  });

  it("parses PLAYIQ_ADMIN_EMAILS", () => {
    assert.deepEqual(parseAdminEmailsEnv("a@x.com, B@Y.com ,a@x.com"), [
      "a@x.com",
      "b@y.com",
    ]);
    assert.deepEqual(parseAdminEmailsEnv("  "), []);
  });

  it("classifies capabilities", () => {
    assert.equal(isStaff("admin"), true);
    assert.equal(isStaff("coach"), true);
    assert.equal(isStaff("parent"), false);
    assert.equal(isStaff(null), false);
    assert.equal(canManageTeam("admin"), true);
    assert.equal(canManageTeam("head_coach"), false);
    assert.equal(canUseFilmRoom("coach"), true);
    assert.equal(canUseFilmRoom("parent"), false);
    assert.equal(isParent("parent"), true);
  });

  it("routes post-login", () => {
    assert.equal(postLoginPath("parent"), "/parent");
    assert.equal(postLoginPath("coach"), "/app");
    assert.equal(postLoginPath(null), "/app");
  });

  it("validates role strings", () => {
    assert.equal(isTeamRole("admin"), true);
    assert.equal(isTeamRole("varsity"), false);
  });
});
