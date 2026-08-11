"use client";

import { useEffect, useState } from "react";
import { Button, Input, Modal } from "@/shared/components";

type Pool = {
  id: string;
  name: string;
  enabled: boolean;
  desiredReadyCount: number;
  minReadyCount: number;
  maxCandidates: number;
  cooldownSeconds: number;
  failClosed: boolean;
};

type Props = {
  connectionId: string;
  connectionLabel: string;
  providerId: string;
  onClose: () => void;
};

export default function DynamicProxyPoolModal({
  connectionId,
  connectionLabel,
  providerId,
  onClose,
}: Props) {
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPools = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/settings/proxies/dynamic");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || "Unable to load dynamic pools");
      setPools(Array.isArray(data.items) ? data.items : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load dynamic pools");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPools();
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      let poolId = selectedPoolId;
      if (!poolId) {
        if (!name.trim()) throw new Error("Enter a pool name");
        const created = await fetch("/api/settings/proxies/dynamic", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
        const createdBody = await created.json().catch(() => ({}));
        if (!created.ok) throw new Error(createdBody?.error?.message || "Unable to create pool");
        poolId = createdBody.pool.id;
      }

      const bound = await fetch("/api/settings/proxies/dynamic", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "bind",
          poolId,
          scope: "account",
          scopeId: connectionId,
          enabled: true,
        }),
      });
      const boundBody = await bound.json().catch(() => ({}));
      if (!bound.ok) throw new Error(boundBody?.error?.message || "Unable to attach pool");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save dynamic pool");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen title="Dynamic proxy pool" onClose={onClose} size="lg">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-text-muted">
          Attach a shared, sticky pool to {connectionLabel} for {providerId}.
        </p>
        {loading ? (
          <div className="py-6 text-center text-text-muted animate-pulse">Loading pools…</div>
        ) : (
          <>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Existing pool
              <select
                value={selectedPoolId}
                onChange={(event) => setSelectedPoolId(event.target.value)}
                className="w-full rounded-lg border border-border bg-bg-subtle px-3 py-2.5 text-text-primary"
              >
                <option value="">Create a new pool</option>
                {pools.map((pool) => (
                  <option key={pool.id} value={pool.id}>
                    {pool.name} ({pool.desiredReadyCount} ready identities)
                  </option>
                ))}
              </select>
            </label>
            {!selectedPoolId && (
              <Input
                label="New pool name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="shared-five"
              />
            )}
          </>
        )}
        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving} disabled={loading}>
            Attach pool
          </Button>
        </div>
      </div>
    </Modal>
  );
}
