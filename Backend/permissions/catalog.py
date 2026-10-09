from auth.model import UserRole


def _perm(key, section, label, requires=None, ceo_only=False):
    return {"key": key, "section": section, "label": label, "requires": requires, "ceo_only": ceo_only}


# Every action the owner can switch on or off per employee in the Customize panel.
# `key` is what endpoints check and what the frontend receives in the signed-in
# user's `permissions` list; `requires` is a permission switched on along with
# it (you can't approve a profile you aren't allowed to see); `ceo_only`
# actions live in the owner panel, so only the CEO can be given them.
PERMISSIONS = (
    _perm("accounts.manage", "Team Accounts", "Create, deactivate and delete accounts", ceo_only=True),
    _perm("clients.view", "Client Profiles", "View"),
    _perm("clients.create", "Client Profiles", "Create", "clients.view"),
    _perm("clients.edit", "Client Profiles", "Edit (until approved)", "clients.view"),
    _perm("clients.approve", "Client Profiles", "Approve (required before the owner)", "clients.view"),
    _perm("clients.delete", "Client Profiles", "Delete", "clients.view"),
    _perm("blacklist.view", "Vehicle Blacklist", "View"),
    _perm("blacklist.create", "Vehicle Blacklist", "Add", "blacklist.view"),
    _perm("blacklist.edit", "Vehicle Blacklist", "Edit", "blacklist.view"),
    _perm("blacklist.delete", "Vehicle Blacklist", "Delete", "blacklist.view"),
    _perm("reports.create", "Inspection Reports", "Create (and edit own until checked)"),
    _perm("reports.view", "Inspection Reports", "View all reports"),
    _perm("reports.approve", "Inspection Reports", "Approve (required before the owner)", "reports.view"),
    _perm("reports.review", "Inspection Reports", "Review (mark checked, edit details, delete any report)",
          "reports.view", ceo_only=True),
    _perm("reports2.view", "Inspection Report 2", "View"),
    _perm("reports2.create", "Inspection Report 2", "Create / edit", "reports2.view"),
    _perm("reports2.approve", "Inspection Report 2", "Approve (required before the owner)", "reports2.view"),
    _perm("activity.view", "Activity Log", "View"),
)

PERMISSION_KEYS = frozenset(p["key"] for p in PERMISSIONS)
CEO_ONLY_KEYS = frozenset(p["key"] for p in PERMISSIONS if p["ceo_only"])
REQUIRES = {p["key"]: p["requires"] for p in PERMISSIONS if p["requires"]}

# What each role starts with, used for an employee until the owner saves their
# access. The CEO starts with everything; the owner always has everything and
# can't be restricted.
DEFAULT_PERMISSIONS = {
    UserRole.ceo: set(PERMISSION_KEYS),
    UserRole.admin: {
        "clients.view", "clients.create", "clients.edit", "clients.approve",
        "blacklist.view", "blacklist.create", "blacklist.edit",
    },
    UserRole.accountant: {
        "clients.view", "clients.create", "clients.edit",
        "blacklist.view", "blacklist.create", "blacklist.edit",
    },
    UserRole.technician: {
        "reports.create", "reports.view", "reports2.view", "reports2.create",
        "blacklist.view", "blacklist.create", "blacklist.edit",
    },
}
