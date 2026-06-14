import { useEffect, useRef, useState } from "react";
import type { SnapshotMeta } from "./api";
import { createSnapshot, deleteSnapshot, restoreSnapshot } from "./api";
import { EmptyState, Ico, ServiceTag } from "./shared";

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString("ja-JP")} ${d.toTimeString().slice(0, 8)}`;
}

function snapshotName(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `snapshot-${hh}${mm}${ss}`;
}

function RestoreModal({
  snapshot,
  onConfirm,
  onCancel,
}: {
  snapshot: SnapshotMeta;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div
      className="scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-label="Confirm snapshot restore"
        aria-modal="true"
        className="modal-dialog"
      >
        <div className="modal-head">
          <span className="modal-title">Confirm restore</span>
        </div>
        <div className="modal-body">
          <p className="modal-desc">
            Restoring <span className="mono">{snapshot.name}</span> will
            overwrite the state of the following services:
          </p>
          <div className="modal-svc-list">
            {snapshot.services.length === 0 ? (
              <span className="muted">No services</span>
            ) : (
              snapshot.services.map((svc) => <ServiceTag key={svc} svc={svc} />)
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            ref={confirmRef}
            onClick={onConfirm}
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}

export function Snapshots({
  snapshots,
  onRefresh,
}: {
  snapshots: SnapshotMeta[];
  onRefresh: () => void;
}) {
  const [dumping, setDumping] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<SnapshotMeta | null>(null);

  const handleDump = () => {
    setDumping(true);
    createSnapshot(snapshotName())
      .then(() => onRefresh())
      .catch(() => {})
      .finally(() => setDumping(false));
  };

  const handleRestore = () => {
    if (!restoreTarget) return;
    setRestoring(true);
    restoreSnapshot(restoreTarget.id)
      .then(() => {
        setRestoreTarget(null);
        onRefresh();
      })
      .catch(() => {})
      .finally(() => setRestoring(false));
  };

  const handleDelete = (id: string) => {
    deleteSnapshot(id)
      .then(() => onRefresh())
      .catch(() => {});
  };

  return (
    <>
      <div className="content snap-content">
        <div className="snap-toolbar">
          <button
            className="btn btn-primary"
            onClick={handleDump}
            disabled={dumping}
          >
            <Ico.snapshot width="15" height="15" />
            {dumping ? "Dumping…" : "Dump current state"}
          </button>
        </div>

        {snapshots.length === 0 ? (
          <EmptyState
            glyph={<Ico.snapshot width="22" height="22" />}
            title="No snapshots"
            sub="Save the current service state and restore it later."
            action={
              <button
                className="btn btn-secondary"
                onClick={handleDump}
                disabled={dumping}
              >
                Create the first dump
              </button>
            }
          />
        ) : (
          <div className="snap-table-wrap">
            <table className="snap-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Created at</th>
                  <th>Services</th>
                  <th>Size</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snap) => (
                  <tr key={snap.id}>
                    <td className="mono">{snap.name}</td>
                    <td className="mono">{fmtDateTime(snap.createdAt)}</td>
                    <td>
                      <div className="snap-svc-tags">
                        {snap.services.map((svc) => (
                          <ServiceTag key={svc} svc={svc} />
                        ))}
                      </div>
                    </td>
                    <td className="mono">{fmtSize(snap.sizeBytes)}</td>
                    <td>
                      <div className="snap-actions">
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setRestoreTarget(snap)}
                        >
                          Restore
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          aria-label={`Delete ${snap.name}`}
                          onClick={() => handleDelete(snap.id)}
                        >
                          <Ico.trash width="13" height="13" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {restoreTarget && (
        <RestoreModal
          snapshot={restoreTarget}
          onConfirm={handleRestore}
          onCancel={() => {
            if (!restoring) setRestoreTarget(null);
          }}
        />
      )}
    </>
  );
}
