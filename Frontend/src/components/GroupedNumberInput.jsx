import { useLayoutEffect, useRef, useState } from "react"
import { formatNumber, groupDigits } from "../utils/numberFormat"

export default function GroupedNumberInput({ value, onChange, fractionDigits, ...props }) {
  const inputRef = useRef(null)
  const cursorRef = useRef(null)
  const [focused, setFocused] = useState(false)
  const display = focused ? groupDigits(value) : fractionDigits === undefined
    ? groupDigits(value) : formatNumber(value, fractionDigits)

  useLayoutEffect(() => {
    if (cursorRef.current !== null && inputRef.current === document.activeElement) {
      inputRef.current.setSelectionRange(cursorRef.current, cursorRef.current)
      cursorRef.current = null
    }
  }, [display])

  function handleChange(event) {
    const typed = event.target.value
    const raw = typed.replaceAll(",", "")
    const decimals = fractionDigits === undefined ? "*" : `{0,${fractionDigits}}`
    if (!new RegExp(`^\\d*(?:\\.\\d${decimals})?$`).test(raw)) return
    const before = typed.slice(0, event.target.selectionStart).replaceAll(",", "")
    cursorRef.current = groupDigits(raw.slice(0, before.length)).length
    onChange(raw)
  }

  return <input
    {...props}
    ref={inputRef}
    type="text"
    inputMode="decimal"
    value={display}
    onFocus={() => setFocused(true)}
    onBlur={() => {
      setFocused(false)
      cursorRef.current = null
      if (value === ".") onChange("")
    }}
    onChange={handleChange}
  />
}
