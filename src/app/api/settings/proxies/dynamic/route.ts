import {
  addDynamicProxyPoolMember,
  bindDynamicProxyPool,
  createDynamicProxyPool,
  deleteDynamicProxyPool,
  getDynamicProxyPool,
  getPoolReadyEgressCount,
  listDynamicProxyPoolBindings,
  listDynamicProxyPoolMembers,
  listDynamicProxyPools,
  listDynamicProxyTargetHealth,
  removeDynamicProxyPoolBinding,
  removeDynamicProxyPoolMember,
  updateDynamicProxyPool,
} from "@/lib/db/dynamicProxyPools";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { createErrorResponse, createErrorResponseFromUnknown } from "@/lib/api/errorResponse";
import { isFeatureFlagEnabled } from "@/shared/utils/featureFlags";

export const dynamic = "force-dynamic";

function featureDisabled() {
  return createErrorResponse({
    status: 404,
    message: "Dynamic proxy pools are disabled",
    type: "not_found",
  });
}

async function body(request: Request): Promise<Record<string, unknown>> {
  const value = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("JSON object body is required");
  }
  return value as Record<string, unknown>;
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  if (!isFeatureFlagEnabled("OMNIROUTE_DYNAMIC_PROXY_POOLS_ENABLED")) return featureDisabled();
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get("poolId");
    if (!poolId) return Response.json({ items: await listDynamicProxyPools() });
    const pool = await getDynamicProxyPool(poolId);
    if (!pool) return createErrorResponse({ status: 404, message: "Dynamic proxy pool not found" });
    return Response.json({
      pool,
      members: await listDynamicProxyPoolMembers(poolId),
      bindings: await listDynamicProxyPoolBindings(poolId),
      health: await listDynamicProxyTargetHealth(poolId, searchParams.get("provider") || undefined),
    });
  } catch (error) {
    return createErrorResponseFromUnknown(error, "Failed to load dynamic proxy pools");
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  if (!isFeatureFlagEnabled("OMNIROUTE_DYNAMIC_PROXY_POOLS_ENABLED")) return featureDisabled();
  try {
    const input = await body(request);
    const pool = await createDynamicProxyPool({
      name: String(input.name || ""),
      enabled: input.enabled !== false,
      desiredReadyCount:
        typeof input.desiredReadyCount === "number" ? input.desiredReadyCount : undefined,
      minReadyCount: typeof input.minReadyCount === "number" ? input.minReadyCount : undefined,
      maxCandidates: typeof input.maxCandidates === "number" ? input.maxCandidates : undefined,
      cooldownSeconds:
        typeof input.cooldownSeconds === "number" ? input.cooldownSeconds : undefined,
      failClosed: input.failClosed !== false,
    });
    return Response.json({ pool }, { status: 201 });
  } catch (error) {
    return createErrorResponseFromUnknown(error, "Failed to create dynamic proxy pool");
  }
}

export async function PUT(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  if (!isFeatureFlagEnabled("OMNIROUTE_DYNAMIC_PROXY_POOLS_ENABLED")) return featureDisabled();
  try {
    const input = await body(request);
    const action = String(input.action || "");

    if (action === "bind") {
      return Response.json(
        await bindDynamicProxyPool(
          String(input.poolId || ""),
          String(input.scope || ""),
          typeof input.scopeId === "string" ? input.scopeId : null,
          input.enabled !== false
        )
      );
    }
    if (action === "member") {
      return Response.json({
        member: await addDynamicProxyPoolMember(
          String(input.poolId || ""),
          String(input.proxyId || ""),
          typeof input.egressIp === "string" ? input.egressIp : null
        ),
      });
    }
    if (action === "update") {
      const pool = await updateDynamicProxyPool(String(input.poolId || ""), {
        name: typeof input.name === "string" ? input.name : undefined,
        enabled: typeof input.enabled === "boolean" ? input.enabled : undefined,
        desiredReadyCount:
          typeof input.desiredReadyCount === "number" ? input.desiredReadyCount : undefined,
        minReadyCount: typeof input.minReadyCount === "number" ? input.minReadyCount : undefined,
        maxCandidates: typeof input.maxCandidates === "number" ? input.maxCandidates : undefined,
        cooldownSeconds:
          typeof input.cooldownSeconds === "number" ? input.cooldownSeconds : undefined,
        failClosed: typeof input.failClosed === "boolean" ? input.failClosed : undefined,
      });
      return Response.json({ pool });
    }
    if (action === "unbind") {
      const removed = await removeDynamicProxyPoolBinding(
        String(input.scope || ""),
        String(input.scopeId || "")
      );
      return Response.json({ removed });
    }
    if (action === "removeMember") {
      const removed = await removeDynamicProxyPoolMember(
        String(input.poolId || ""),
        String(input.proxyId || "")
      );
      return Response.json({ removed });
    }
    if (action === "reconcile") {
      const { reconcileDynamicProxyPool } = await import("@/lib/dynamicProxyPool/reconciler");
      const result = await reconcileDynamicProxyPool(String(input.poolId || ""));
      const readyCount = getPoolReadyEgressCount(String(input.poolId || ""));
      return Response.json({ result, readyEgressCount: readyCount });
    }
    return createErrorResponse({
      status: 400,
      message: "action must be one of: bind, member, update, unbind, removeMember, reconcile",
    });
  } catch (error) {
    return createErrorResponseFromUnknown(error, "Failed to update dynamic proxy pool");
  }
}

export async function DELETE(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  if (!isFeatureFlagEnabled("OMNIROUTE_DYNAMIC_PROXY_POOLS_ENABLED")) return featureDisabled();
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get("poolId");
    if (!poolId) return createErrorResponse({ status: 400, message: "poolId is required" });
    const deleted = await deleteDynamicProxyPool(poolId);
    if (!deleted)
      return createErrorResponse({ status: 404, message: "Dynamic proxy pool not found" });
    return Response.json({ deleted: true });
  } catch (error) {
    return createErrorResponseFromUnknown(error, "Failed to delete dynamic proxy pool");
  }
}
