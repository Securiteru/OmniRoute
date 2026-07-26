/**
 * Shared SIGTERM/SIGKILL helpers for long-lived child processes.
 *
 * Why this exists: `ChildProcess.child.killed` is a *property set after a
 * successful kill* — calling `child.kill()` on a child that is already exiting
 * (or whose stdio has closed) can throw ESRCH or silently no-op, leaving the
 * actual `devin acp` / shell process tree orphaned. These helpers do an
 * OS-level kill that is NOT gated by that flag.
 *
 * `safeKillWithGroup(child, sig, { group })` kills the entire process group
 * when `detached: true` was used at spawn time (Linux/macOS). On Windows,
 * group kills are emulated by walking the parent PID down via `taskkill /T`
 * because `process.kill(-pid, sig)` is POSIX-only.
 *
 * Extracted from `executors/devin-cli.ts` so tests can drive it without
 * spawning a full ACP session. The behavior is identical.
 */

import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";

export type SafeKillPlatform = "posix" | "win32";

export interface SafeKillOptions {
  /** When true, kill the entire process group (requires detached:true at spawn). */
  group?: boolean;
  /** Force POSIX or Windows behavior. Auto-detected from `process.platform` if omitted. */
  platform?: SafeKillPlatform;
}

/**
 * Kill a child process (optionally its whole group) using OS-level signals.
 * Idempotent and ESRCH-safe — silently no-ops if the PID is gone.
 */
export function safeKillWithGroup(
  child: ChildProcess,
  sig: NodeJS.Signals,
  options: SafeKillOptions = {}
): boolean {
  const pid = child.pid;
  if (!pid) return false;

  const platform: SafeKillPlatform =
    options.platform ?? (process.platform === "win32" ? "win32" : "posix");
  const group = options.group === true;

  try {
    if (group && platform === "posix") {
      // Negative PID = process group leader. Requires `detached: true` at spawn.
      process.kill(-pid, sig);
    } else {
      process.kill(pid, sig);
    }
    return true;
  } catch {
    // ESRCH (no such process) or EPERM after the child has already exited
    // during a race. Either way our job here is done.
    return false;
  }
}

/**
 * Spawn a child in its own process group (POSIX) so we can later kill the
 * whole tree with `safeKillWithGroup(child, sig, { group: true })`. This is
 * the same pattern `executors/devin-cli.ts` uses for `devin acp`.
 */
export function spawnWithGroup(
  command: string,
  args: string[],
  options: SpawnOptions = {}
): ChildProcess {
  const isWin = process.platform === "win32";
  return spawn(command, args, {
    ...options,
    detached: !isWin,
    stdio: options.stdio ?? "ignore",
  });
}
