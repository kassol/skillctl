import { useInput } from "ink";
import { disableSkill, enableSkill, removeSkill } from "../services/linker.js";
import type { LocalSkill } from "../types.js";
import { CANONICAL_ROOT } from "../types.js";
import type { SkillsState } from "./useSkills.js";

interface UseFocusOptions {
  state: SkillsState;
  currentSkills: LocalSkill[];
  repoCount: number;
  marketResultCount: number;
  onReload: () => Promise<void>;
  disabled?: boolean;
}

export function useFocus({
  state,
  currentSkills,
  repoCount,
  marketResultCount,
  onReload,
  disabled,
}: UseFocusOptions) {
  useInput(
    (input, key) => {
      // Quit
      if (input === "q" || (key.ctrl && input === "c")) {
        process.exit(0);
      }

      // Tab / Shift+Tab: cycle columns
      if (key.tab) {
        if (key.shift) state.focusPrev();
        else state.focusNext();
        return;
      }

      // Search activation
      if (input === "/") {
        state.setSearchActive(true);
        return;
      }

      // Navigation: up/down/j/k
      if (key.upArrow || input === "k") {
        navigateUp(state, currentSkills);
        return;
      }
      if (key.downArrow || input === "j") {
        navigateDown(state, currentSkills, repoCount, marketResultCount);
        return;
      }

      // Enter: context-dependent
      if (key.return) {
        handleEnter(state, repoCount);
        return;
      }

      // Add repo
      if (input === "a" && state.focusedColumn === 0) {
        state.setSearchActive(true);
        return;
      }

      // Enable/disable single agent
      if (input === "e") {
        handleSingleToggle(state, currentSkills, true, onReload);
        return;
      }
      if (input === "d") {
        handleSingleToggle(state, currentSkills, false, onReload);
        return;
      }

      // Enable/disable all agents
      if (input === "E") {
        handleAllToggle(state, currentSkills, true, onReload);
        return;
      }
      if (input === "D") {
        handleAllToggle(state, currentSkills, false, onReload);
        return;
      }

      // Space: toggle current agent
      if (input === " ") {
        handleSpaceToggle(state, currentSkills, onReload);
        return;
      }

      // Delete
      if (input === "x") {
        handleDelete(state, currentSkills, onReload);
        return;
      }

      // Update
      if (input === "u") {
        handleUpdate(state, onReload);
        return;
      }
    },
    { isActive: !disabled },
  );
}

function navigateUp(state: SkillsState, currentSkills: LocalSkill[]) {
  const { focusedColumn, selectedRepo, selectedSkill, selectedAgent, isMarketMode } = state;
  if (focusedColumn === 0) {
    if (isMarketMode) {
      // Move from market to last repo
      state.setMarketMode(false);
      // selectedRepo stays as is
    } else if (selectedRepo > 0) {
      state.selectRepo(selectedRepo - 1);
    }
  } else if (focusedColumn === 1) {
    if (selectedSkill > 0) state.selectSkill(selectedSkill - 1);
  } else {
    const skill = currentSkills[selectedSkill];
    if (skill && selectedAgent > 0) state.selectAgent(selectedAgent - 1);
  }
}

function navigateDown(
  state: SkillsState,
  currentSkills: LocalSkill[],
  repoCount: number,
  marketResultCount: number,
) {
  const { focusedColumn, selectedRepo, selectedSkill, selectedAgent, isMarketMode } = state;
  if (focusedColumn === 0) {
    if (isMarketMode) return; // already at bottom (market)
    if (selectedRepo < repoCount - 1) {
      state.selectRepo(selectedRepo + 1);
    } else {
      // Move to market
      state.setMarketMode(true);
    }
  } else if (focusedColumn === 1) {
    const maxIndex = isMarketMode ? marketResultCount - 1 : currentSkills.length - 1;
    if (selectedSkill < maxIndex) state.selectSkill(selectedSkill + 1);
  } else {
    const skill = currentSkills[selectedSkill];
    if (skill && selectedAgent < skill.agents.length - 1) {
      state.selectAgent(selectedAgent + 1);
    }
  }
}

function handleEnter(state: SkillsState, _repoCount: number) {
  const { focusedColumn } = state;
  if (focusedColumn === 0) {
    // Enter on repo → focus skill list
    state.focusNext();
  } else if (focusedColumn === 1) {
    // Enter on skill → focus detail panel
    state.focusNext();
  }
  // Detail panel enter: no-op for now
}

function getSelectedSkill(state: SkillsState, currentSkills: LocalSkill[]): LocalSkill | null {
  if (state.isMarketMode) return null;
  return currentSkills[state.selectedSkill] ?? null;
}

function guardManaged(state: SkillsState, skill: LocalSkill | null): skill is LocalSkill {
  if (!skill) {
    state.setStatusMessage("No skill selected");
    return false;
  }
  if (!skill.managed) {
    state.setStatusMessage("Cannot modify unmanaged skill");
    return false;
  }
  return true;
}

async function handleSingleToggle(
  state: SkillsState,
  currentSkills: LocalSkill[],
  enable: boolean,
  onReload: () => Promise<void>,
) {
  const skill = getSelectedSkill(state, currentSkills);
  if (!guardManaged(state, skill)) return;
  const binding = skill.agents[state.selectedAgent];
  if (!binding) return;
  try {
    if (enable) {
      await enableSkill(skill.canonicalPath, binding.linkPath);
      state.setStatusMessage(`Enabled ${skill.name} for ${binding.agent}`);
    } else {
      await disableSkill(binding.linkPath, CANONICAL_ROOT);
      state.setStatusMessage(`Disabled ${skill.name} for ${binding.agent}`);
    }
    await onReload();
  } catch (err) {
    state.setStatusMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function handleAllToggle(
  state: SkillsState,
  currentSkills: LocalSkill[],
  enable: boolean,
  onReload: () => Promise<void>,
) {
  const skill = getSelectedSkill(state, currentSkills);
  if (!guardManaged(state, skill)) return;
  const action = enable ? "enable" : "disable";
  state.setConfirmAction({
    type: `${action}-all`,
    message: `${enable ? "Enable" : "Disable"} ${skill.name} for ALL agents?`,
    onConfirm: async () => {
      state.setConfirmAction(null);
      try {
        for (const binding of skill.agents) {
          if (enable) {
            await enableSkill(skill.canonicalPath, binding.linkPath);
          } else {
            if (binding.linked) {
              await disableSkill(binding.linkPath, CANONICAL_ROOT);
            }
          }
        }
        state.setStatusMessage(`${enable ? "Enabled" : "Disabled"} ${skill.name} for all agents`);
        await onReload();
      } catch (err) {
        state.setStatusMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  });
}

async function handleSpaceToggle(
  state: SkillsState,
  currentSkills: LocalSkill[],
  onReload: () => Promise<void>,
) {
  const skill = getSelectedSkill(state, currentSkills);
  if (!guardManaged(state, skill)) return;
  const binding = skill.agents[state.selectedAgent];
  if (!binding) return;
  try {
    if (binding.linked) {
      await disableSkill(binding.linkPath, CANONICAL_ROOT);
      state.setStatusMessage(`Disabled ${skill.name} for ${binding.agent}`);
    } else {
      await enableSkill(skill.canonicalPath, binding.linkPath);
      state.setStatusMessage(`Enabled ${skill.name} for ${binding.agent}`);
    }
    await onReload();
  } catch (err) {
    state.setStatusMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function handleDelete(
  state: SkillsState,
  currentSkills: LocalSkill[],
  onReload: () => Promise<void>,
) {
  const skill = getSelectedSkill(state, currentSkills);
  if (!guardManaged(state, skill)) return;
  state.setConfirmAction({
    type: "delete",
    message: `Delete ${skill.name}? This cannot be undone.`,
    onConfirm: async () => {
      state.setConfirmAction(null);
      try {
        const linkPaths = skill.agents.map((b) => b.linkPath);
        await removeSkill(skill.canonicalPath, linkPaths, CANONICAL_ROOT);
        state.setStatusMessage(`Deleted ${skill.name}`);
        await onReload();
      } catch (err) {
        state.setStatusMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  });
}

async function handleUpdate(state: SkillsState, onReload: () => Promise<void>) {
  state.setStatusMessage("Updating...");
  try {
    const { updateAll } = await import("../services/repo.js");
    await updateAll();
    state.setStatusMessage("Update complete");
    await onReload();
  } catch (err) {
    state.setStatusMessage(`Update failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
