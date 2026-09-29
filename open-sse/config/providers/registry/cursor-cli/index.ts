import type { RegistryEntry } from "../../shared.ts";
import { CURSOR_CLI_MODEL_CATALOG } from "./catalog.ts";

export const cursor_cliProvider: RegistryEntry = {
  id: "cursor-cli",
  alias: "cuc",
  format: "openai",
  executor: "cursor-cli",
  baseUrl: "cursor://cli/stdio",
  authType: "apikey",
  authHeader: "Authorization",
  authPrefix: "Bearer ",
  defaultContextLength: 200000,
  models: CURSOR_CLI_MODEL_CATALOG,
};
