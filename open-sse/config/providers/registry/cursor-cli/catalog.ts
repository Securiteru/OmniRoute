import type { RegistryModel } from "../../shared.ts";

// Fork-only: Cursor Agent CLI (`cursor-agent -p`) catalog. Model ids map 1:1
// onto `cursor-agent --model <id>`; "auto" is Cursor's own router. The live
// list is account-scoped (`cursor-agent models`); this is a static baseline.
const M = (id: string, name: string): RegistryModel => ({ id, name, toolCalling: false });

export const CURSOR_CLI_MODEL_CATALOG: RegistryModel[] = [
  M("auto", "Auto (Cursor Router)"),
  M("composer-2", "Composer 2"),
  M("composer-1.5", "Composer 1.5"),
  M("composer-1", "Composer 1"),
  M("sonnet-4.6", "Claude Sonnet 4.6"),
  M("sonnet-4.6-thinking", "Claude Sonnet 4.6 Thinking"),
  M("opus-4.6", "Claude Opus 4.6"),
  M("opus-4.6-thinking", "Claude Opus 4.6 Thinking"),
  M("gpt-5.3-codex", "GPT-5.3 Codex"),
  M("gpt-5.2", "GPT-5.2"),
  M("gemini-3-pro", "Gemini 3 Pro"),
  M("grok", "Grok"),
];
