import { useRef, useState, type FocusEvent } from 'react'

export function NumberField({ label, value, max, onChange, onBegin, onEnd }: {
  label: string; value: number; max: number; onChange: (value: number) => void; onBegin: () => void; onEnd: () => void
}) {
  const [draft, setDraft] = useState('')
  const focused = useRef(false)
  const display = focused.current ? draft : String(Math.round(value))
  const blur = (_event: FocusEvent<HTMLInputElement>) => {
    if (draft.trim() !== '' && Number.isFinite(Number(draft))) onChange(Math.min(Math.max(Number(draft), 0), max))
    focused.current = false
    setDraft('')
    onEnd()
  }
  return <label>{label}<input type="number" min={0} max={max} step={1} value={display}
    onFocus={() => { focused.current = true; setDraft(String(Math.round(value))); onBegin() }}
    onChange={event => {
      setDraft(event.target.value)
      const next = Number(event.target.value)
      if (event.target.value.trim() !== '' && Number.isFinite(next) && next >= 0 && next <= max) onChange(next)
    }} onBlur={blur} /></label>
}
