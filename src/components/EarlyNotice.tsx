import { fi } from '../i18n'
import { Sheet } from './Sheet'

/**
 * The early-stage notice: a strip that says only the part that cannot wait, and
 * a sheet behind it with the rest.
 *
 * Split that way because the three things it carries are not equally urgent. A
 * tester needs "your data may be lost" before they log a single set; the thanks
 * and the roadmap are worth reading once, not worth a wall on the landing screen.
 */

/**
 * The whole strip is the button, and there is no ×.
 *
 * A separate 20px dismiss target next to a data-loss warning is a warning that
 * gets retired by a mis-tap. The only way out of it is through the sheet.
 */
export function NoticeStrip({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="notice-strip" onClick={onOpen}>
      <WarnIcon />
      <span className="grow">{fi.noticeStrip}</span>
      <span className="notice-more t-data">{fi.noticeMore}</span>
    </button>
  )
}

/**
 * Sulje and Selvä are different actions, deliberately.
 *
 * `onClose` — the backdrop, Escape, and Sulje — leaves the strip up. Only Selvä
 * records that this version was read. Dismissing something you have not read
 * should not be one stray tap away.
 *
 * On `Sheet` rather than the hand-rolled markup, for the same reason `Dialogue`
 * is: this arrives over a screen someone was already reading, so the focus trap,
 * Escape and focus restore are load-bearing rather than nice to have.
 */
export function NoticeSheet({ onClose, onAck }: { onClose: () => void; onAck: () => void }) {
  return (
    <Sheet label={fi.noticeSheet} onClose={onClose}>
      <div className="sheet-head">
        <span className="t-data">{fi.noticeSheet}</span>
        <button className="revert" onClick={onClose}>
          {fi.close}
        </button>
      </div>

      <div className="notice-body">
        <h2 className="t-title">{fi.noticeTitle}</h2>
        <p>{fi.noticeLoss}</p>
        <p>{fi.noticeLocal}</p>

        <span className="t-data">{fi.noticeNow}</span>
        <p>{fi.noticeNowBody}</p>

        <span className="t-data">{fi.noticeNext}</span>
        <p>{fi.noticeNextBody}</p>

        <p className="note">{fi.noticeThanks}</p>
      </div>

      <button className="btn solid btn-tall sheet-commit" onClick={onAck}>
        {fi.noticeAck}
      </button>
      <p className="note notice-reopen">{fi.noticeReopenHint}</p>
    </Sheet>
  )
}

/** A triangle, not a circle: the circled-i reads as help, and this is not help. */
function WarnIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M10 3.2 18 17H2z" />
        <path d="M10 8.4v3.4" />
      </g>
      <circle cx="10" cy="14.4" r="0.9" fill="currentColor" />
    </svg>
  )
}
