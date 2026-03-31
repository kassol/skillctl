import { describe, it, expect } from "vitest";
import { createSkillsStore } from "../src/hooks/useSkills";
import type { Repo } from "../src/types";

describe("skills store", () => {
  it("initializes with empty state", () => {
    const store = createSkillsStore();
    const state = store.getState();
    expect(state.repos).toEqual([]);
    expect(state.focusedColumn).toBe(0);
    expect(state.loading).toBe(true);
  });

  it("setRepos updates repos and sets loading false", () => {
    const store = createSkillsStore();
    const repos: Repo[] = [{ source: "owner/repo", url: "", skills: [], skillCount: 0 }];
    store.getState().setRepos(repos);
    expect(store.getState().repos).toEqual(repos);
    expect(store.getState().loading).toBe(false);
  });

  it("selectRepo resets skill and agent selection", () => {
    const store = createSkillsStore();
    store.getState().selectSkill(3);
    store.getState().selectAgent(2);
    store.getState().selectRepo(1);
    expect(store.getState().selectedRepo).toBe(1);
    expect(store.getState().selectedSkill).toBe(0);
    expect(store.getState().selectedAgent).toBe(0);
  });

  it("focusNext wraps around", () => {
    const store = createSkillsStore();
    store.getState().focusNext();
    expect(store.getState().focusedColumn).toBe(1);
    store.getState().focusNext();
    expect(store.getState().focusedColumn).toBe(2);
    store.getState().focusNext();
    expect(store.getState().focusedColumn).toBe(0);
  });

  it("focusPrev wraps around", () => {
    const store = createSkillsStore();
    store.getState().focusPrev();
    expect(store.getState().focusedColumn).toBe(2);
  });
});
