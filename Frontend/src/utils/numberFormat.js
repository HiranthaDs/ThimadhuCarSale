export function groupDigits(value) {
  const text = String(value ?? "").replaceAll(",", "")
  const [whole, fraction] = text.split(".")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}

export function formatNumber(value, fractionDigits = null) {
  if (value === null || value === undefined || value === "") return ""
  const number = Number(String(value).replaceAll(",", ""))
  if (!Number.isFinite(number)) return String(value)
  return number.toLocaleString("en-US", fractionDigits === null ? {
    maximumFractionDigits: 20,
  } : {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}
