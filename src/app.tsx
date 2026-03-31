#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { App } from "./components/App.js";

const args = process.argv.slice(2);
if (args.includes("--version") || args.includes("-v")) {
  console.log("skills-tui v0.1.0");
  process.exit(0);
}

render(<App />);
