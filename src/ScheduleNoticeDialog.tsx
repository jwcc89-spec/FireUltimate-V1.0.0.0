type ScheduleNoticeDialogProps = {
  message: string | null;
  onClose: () => void;
  actionLabel?: string | null;
  onAction?: () => void;
};

/** Centered message with an OK button. Replaces the browser alert, which sits under the address bar. */
export function ScheduleNoticeDialog({ message, onClose, actionLabel, onAction }: ScheduleNoticeDialogProps) {
  if (!message) return null;
  return (
    <div className="schedule-notice-backdrop" role="dialog" aria-modal="true" aria-labelledby="schedule-notice-text">
      <div className="schedule-notice">
        <p id="schedule-notice-text">{message}</p>
        <div className="schedule-notice-actions">
          {actionLabel && onAction ? (
            <button type="button" className="primary-button compact-button" onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
          <button type="button" className="secondary-button compact-button" onClick={onClose}>
            {actionLabel ? "Cancel" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
