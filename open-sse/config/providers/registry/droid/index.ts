import type { RegistryEntry } from "../../shared.ts";
import { DROID_MODEL_CATALOG } from "./catalog.ts";

export const droidProvider: RegistryEntry = {
  id: "droid",
  alias: "dr",
  format: "openai",
  executor: "droid",
  baseUrl: "droid://acp/stdio",
  authType: "apikey",
  authHeader: "Authorization",
  authPrefix: "Bearer ",
  defaultContextLength: 200000,
  models: DROID_MODEL_CATALOG,
};
