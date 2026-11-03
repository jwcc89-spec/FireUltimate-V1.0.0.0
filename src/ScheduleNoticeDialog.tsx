type ScheduleNoticeDialogProps = {
  message: string | null;
  onClose: () => void;
};

/** Centered message with an OK button. Replaces the browser alert, which sits under the address bar. */
export function ScheduleNoticeDialog({ message, onClose }: ScheduleNoticeDialogProps) {
  if (!message) return null;
  return (
    <div className="schedule-notice-backdrop" role="dialog" aria-modal="true" aria-labelledby="schedule-notice-text">
      <div className="schedule-notice">
        <p id="schedule-notice-text">{message}</p>
        <button type="button" className="primary-button compact-button" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}
