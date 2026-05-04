import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

export async function confirm(message: string, yes = false): Promise<boolean> {
  if (yes) return true;
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`${message} [y/N] `);
    return answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes";
  } finally {
    rl.close();
  }
}

export async function requireConfirm(message: string, yes = false): Promise<void> {
  const ok = await confirm(message, yes);
  if (!ok) throw new Error("Canceled");
}
