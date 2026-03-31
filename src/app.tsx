#!/usr/bin/env node
import { render } from "ink";
import { App } from "./components/App.js";
import { checkNpxAvailable } from "./services/repo.js";

const args = process.argv.slice(2);
if (args.includes("--version") || args.includes("-v")) {
  console.log("skills-tui v0.1.0");
  process.exit(0);
}

if (!checkNpxAvailable()) {
  console.warn("Warning: npx not found. Add/update/remove operations will not work.");
}

render(<App />);
