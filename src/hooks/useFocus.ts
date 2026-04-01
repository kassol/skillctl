import { useInput } from "ink";
import { disableSkill, enableSkill, removeSkill } from "../services/linker.js";
import type { AgentType, LocalSkill } from "../types.js";
import { CANONICAL_ROOT } from "../types.js";
import type { SkillsState } from "./useSkills.js";

interface UseFocusOptions {
  state: SkillsState;
  currentSkills: LocalSkill[];
  repoCount: number;
  marketResultCount: number;
  onReload: () => Promise<void>;
  disabled?: boolean;
  defaultAgents?: AgentType[];
  maxColumn?: number; // max focusable column (0-indexed), based on terminal width
}

export function useFocus({
  state,
  currentSkills,
  repoCount,
  marketResultCount,
  onReload,
  disabled,
  defaultAgents = ["claude-code"],
  maxColumn = 2,
}: UseFocusOptions) {
  useInput(
    (input, key) => {
      // Quit
      if (input === "q" || (key.ctrl && input === "c")) {
        process.exit(0);
      }

      // Tab / Shift+Tab: cycle visible columns only
      if (key.tab) {
        const cols = maxColumn + 1;
        if (key.shift) {
          state.setFocusedColumn((state.focusedColumn - 1 + cols) % cols);
        } else {
          state.setFocusedColumn((state.focusedColumn + 1) % cols);
        }
        return;
      }

      // Search activation
      if (input === "/") {
        state.setOverlayMode("search");
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
        handleEnter(state, repoCount, defaultAgents, onReload);
        return;
      }

      // Add repo — opens overlay in add-repo mode
      if (input === "a" && state.focusedColumn === 0 && !state.isMarketMode) {
        state.setOverlayMode("add-repo");
        state.setStatusMessage("Enter owner/repo to add");
        state.setSearchActive(true);
        return;
      }

      // Enable/disable single agent — Detail column only
      if (input === "e" && state.focusedColumn === 2) {
        handleSingleToggle(state, currentSkills, true, onReload);
        return;
      }
      if (input === "d" && state.focusedColumn === 2) {
        handleSingleToggle(state, currentSkills, false, onReload);
        return;
      }

      // Enable/disable all agents — Detail column only
      if (input === "E" && state.focusedColumn === 2) {
        handleAllToggle(state, currentSkills, true, onReload, defaultAgents);
        return;
      }
      if (input === "D" && state.focusedColumn === 2) {
        handleAllToggle(state, currentSkills, false, onReload);
        return;
      }

      // Space: toggle current agent — Detail column only
      if (input === " " && state.focusedColumn === 2) {
        handleSpaceToggle(state, currentSkills, onReload);
        return;
      }

      // Delete — only from skill or detail column
      if (
        input === "x" &&
        (state.focusedColumn === 1 || state.focusedColumn === 2) &&
        !state.isMarketMode
      ) {
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

async function handleEnter(
  state: SkillsState,
  _repoCount: number,
  defaultAgents: AgentType[],
  onReload: () => Promise<void>,
) {
  const { focusedColumn, isMarketMode } = state;
  if (focusedColumn === 0) {
    state.focusNext();
  } else if (focusedColumn === 1) {
    if (isMarketMode) {
      // Install from market
      const marketSkill = state.marketResults[state.selectedSkill];
      if (!marketSkill) return;
      state.setConfirmAction({
        type: "market-install",
        message: `Install ${marketSkill.name} from ${marketSkill.source}?`,
        onConfirm: async () => {
          state.setConfirmAction(null);
          state.setStatusMessage(`Installing ${marketSkill.name}...`);
          try {
            const { addRepo } = await import("../services/repo.js");
            await addRepo(marketSkill.source, defaultAgents, marketSkill.name);
            const { addRepo: addRepoConfig } = await import("../services/config.js");
            await addRepoConfig(marketSkill.source);
            state.setStatusMessage(`Installed ${marketSkill.name}`);
            await onReload();
          } catch (err) {
            state.setStatusMessage(
              `Install failed: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        },
      });
    } else {
      state.focusNext();
    }
  }
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
  defaultAgents?: AgentType[],
) {
  const skill = getSelectedSkill(state, currentSkills);
  if (!guardManaged(state, skill)) return;
  const action = enable ? "enable" : "disable";
  const scope = enable && defaultAgents ? "default agents" : "ALL agents";
  state.setConfirmAction({
    type: `${action}-all`,
    message: `${enable ? "Enable" : "Disable"} ${skill.name} for ${scope}?`,
    onConfirm: async () => {
      state.setConfirmAction(null);
      try {
        const bindings =
          enable && defaultAgents
            ? skill.agents.filter((b) => (defaultAgents as string[]).includes(b.agent))
            : skill.agents;
        for (const binding of bindings) {
          if (enable) {
            await enableSkill(skill.canonicalPath, binding.linkPath);
          } else {
            if (binding.linked) {
              await disableSkill(binding.linkPath, CANONICAL_ROOT);
            }
          }
        }
        state.setStatusMessage(`${enable ? "Enabled" : "Disabled"} ${skill.name} for ${scope}`);
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
