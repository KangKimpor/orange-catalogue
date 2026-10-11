import { type FormEvent, useEffect, useRef, useState } from "react";

type SavedImport = {
  id: number;
  originalFilename: string;
  isCurrent: boolean;
  canRestore: boolean;
  canRemove: boolean;
  restoreUnavailableReason: string | null;
};
export default function ImportHistoryActions({
  savedImport,
  pending,
  onRestore,
  onDelete,
}: {
  savedImport: SavedImport;
  pending: boolean;
  onRestore: (pin: string) => Promise<void>;
  onDelete: (pin: string) => Promise<void>;
}) {
  const [action, setAction] = useState<"restore" | "delete" | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (action) input.current?.focus();
  }, [action]);
  useEffect(() => {
    if (error && !pending) input.current?.focus();
  }, [error, pending]);
  function close() {
    setAction(null);
    setPin("");
    setError("");
    trigger.current?.focus();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!action || pending || !pin) return;
    setError("");
    try {
      await (action === "restore" ? onRestore(pin) : onDelete(pin));
      setPin("");
      setAction(null);
      requestAnimationFrame(() =>
        (
          document.querySelector<HTMLHeadingElement>(
            ".import-history-detail h3"
          ) ??
          document.querySelector<HTMLHeadingElement>("#import-history-heading")
        )?.focus()
      );
    } catch (cause) {
      setPin("");
      setError(
        cause instanceof Error
          ? cause.message
          : "The import action failed. Please try again."
      );
      input.current?.focus();
    }
  }
  const pinId = `import-pin-${savedImport.id}`;
  return (
    <section
      className="import-history-actions"
      aria-label="Saved import actions"
    >
      <div className="import-history-action-row">
        {!savedImport.isCurrent && (
          <button
            type="button"
            className="quiet-action"
            disabled={pending || !savedImport.canRestore}
            aria-expanded={action === "restore"}
            aria-controls={`import-confirm-${savedImport.id}`}
            onClick={event => {
              trigger.current = event.currentTarget;
              setAction("restore");
              setPin("");
              setError("");
            }}
          >
            Restore this import
          </button>
        )}
        {savedImport.canRemove && (
          <button
            type="button"
            className="quiet-action danger-action"
            disabled={pending}
            aria-expanded={action === "delete"}
            aria-controls={`import-confirm-${savedImport.id}`}
            onClick={event => {
              trigger.current = event.currentTarget;
              setAction("delete");
              setPin("");
              setError("");
            }}
          >
            Delete this import
          </button>
        )}
      </div>
      {savedImport.restoreUnavailableReason && (
        <p className="import-action-help">
          {savedImport.restoreUnavailableReason}
        </p>
      )}
      {action && (
        <form
          id={`import-confirm-${savedImport.id}`}
          className="import-pin-confirmation"
          onSubmit={submit}
          aria-busy={pending}
        >
          <h4>
            {action === "restore" ? "Restore" : "Delete"}{" "}
            {savedImport.originalFilename}
          </h4>
          <p>
            {action === "restore"
              ? "This import's saved POS prices, quantities, colors, and sizes will become current. Later-only items will leave the storefront. Website names, categories, photos, and all saved imports remain available."
              : "This saved import will be permanently deleted. The catalogue will be rebuilt from the remaining POS files in their original order, and the latest retained import will become current. Website names, categories, lifecycle choices, and photos are preserved."}
          </p>
          <label htmlFor={pinId}>Admin PIN</label>
          <input
            ref={input}
            id={pinId}
            type="password"
            autoComplete="current-password"
            maxLength={1024}
            value={pin}
            onChange={event => setPin(event.target.value)}
            disabled={pending}
            required
            aria-invalid={Boolean(error)}
            aria-describedby={`${pinId}-help${error ? ` ${pinId}-error` : ""}`}
          />
          <small id={`${pinId}-help`}>
            Use your current admin login password or PIN.
          </small>
          {error && (
            <p id={`${pinId}-error`} className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button
              type="submit"
              className={`primary-action${action === "delete" ? " danger-action" : ""}`}
              disabled={pending || !pin}
            >
              {pending
                ? action === "restore"
                  ? "Restoring…"
                  : "Deleting and rebuilding…"
                : action === "restore"
                  ? "Confirm restore"
                  : "Confirm delete"}
            </button>
            <button
              type="button"
              className="quiet-action"
              disabled={pending}
              onClick={close}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
