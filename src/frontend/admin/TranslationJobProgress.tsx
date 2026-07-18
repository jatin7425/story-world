import { useEffect, useRef, useState } from "react";
import { api, type TranslationJobWithItems } from "../api";
import Modal from "./Modal";

function fmtLogEntry(item: { entity_label: string; lang: string; status: string; log: string }): string {
  const header = `${item.entity_label} → ${item.lang}: ${item.status}`;
  if (!item.log) return header;
  return `${header}\n  ${item.log.split("\n").join("\n  ")}`;
}

export default function TranslationJobProgress({
  jobId,
  initialJob,
  onClose,
}: {
  jobId: number;
  initialJob: TranslationJobWithItems;
  onClose: () => void;
}) {
  const [job, setJob] = useState(initialJob);
  const [running, setRunning] = useState(true);
  const [logLines, setLogLines] = useState<string[]>([]);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    let active = true;

    const step = async () => {
      if (cancelledRef.current || !active) return;
      const result = await api.stepTranslationJob(jobId);
      if (!active || cancelledRef.current) return;

      if ("done" in result) {
        setRunning(false);
        return;
      }

      setLogLines((lines) => [...lines, fmtLogEntry(result.item)]);
      setJob((j) => ({
        job: { ...j.job, completed_items: result.completedItems, total_items: result.totalItems, status: result.jobStatus },
        items: j.items.map((it) => (it.id === result.item.id ? result.item : it)),
      }));

      if (result.jobStatus !== "running") {
        setRunning(false);
        return;
      }
      step();
    };
    step();

    return () => {
      active = false;
    };
  }, [jobId]);

  const cancel = () => {
    cancelledRef.current = true;
    setRunning(false);
  };

  const pct = job.job.total_items === 0 ? 100 : Math.round((job.job.completed_items / job.job.total_items) * 100);

  return (
    <Modal title="Translating" onClose={running ? cancel : onClose} wide>
      <div className="job-progress">
        <div className="job-progress-bar-track">
          <div className="job-progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="job-progress-label">
          {job.job.completed_items} / {job.job.total_items} items — {running ? "running" : job.job.status}
        </p>
        <div className="job-log-panel">
          {logLines.length === 0 ? (
            <p className="admin-empty">Starting…</p>
          ) : (
            logLines.map((line, i) => <pre key={i}>{line}</pre>)
          )}
        </div>
        <div className="admin-row-actions">
          {running ? (
            <button type="button" className="admin-btn-ghost" onClick={cancel}>
              Cancel (progress so far is kept — resumable later)
            </button>
          ) : (
            <button type="button" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
