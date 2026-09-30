import { useEffect, useRef } from "react";
import { useT } from "../i18n/index.js";

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="help" onClose={onClose} aria-labelledby="help-title">
      <h2 id="help-title">{t.helpTitle}</h2>
      <p>{t.helpRules}</p>
      <p>{t.helpScoring}</p>
      <p className="muted">{t.helpWeek}</p>
      <dl>
        {t.helpKeys.map(([k, v]) => (
          <div key={k}>
            <dt>
              <kbd>{k}</kbd>
            </dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="primary" onClick={onClose} autoFocus>
        {t.close}
      </button>
    </dialog>
  );
}
