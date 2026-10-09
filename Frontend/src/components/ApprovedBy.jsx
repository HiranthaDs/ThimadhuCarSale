const ROLE_LABELS = { ceo: "CEO", admin: "Admin", accountant: "Accountant", technician: "Technician" }

// "Approved by: CEO – Kamal Perera · Accountant – Saman Silva" — the people who
// approved a client profile or inspection report before the owner.
export default function ApprovedBy({ approvals }) {
  if (!approvals?.length) return null
  return (
    <span className="tp-approved-by">
      <span className="tp-approved-by-label">Approved by:</span>{" "}
      {approvals.map((a, i) => (
        <span
          key={`${a.role}-${i}`}
          title={a.at ? new Date(a.at).toLocaleString() : undefined}
        >
          {i > 0 && " · "}
          {ROLE_LABELS[a.role] || a.role}
          {a.name ? ` – ${a.name}` : ""}
        </span>
      ))}
    </span>
  )
}
