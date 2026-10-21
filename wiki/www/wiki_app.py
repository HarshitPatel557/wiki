# Copyright (c) 2022, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

import frappe
from frappe.utils import get_system_timezone

from wiki.utils import get_asset_hash

no_cache = 1
sitemap = 0

ROBOTS_DIRECTIVE = "noindex, nofollow"


def get_context():
	if getattr(frappe.local, "response_headers", None):
		frappe.local.response_headers.set("X-Robots-Tag", ROBOTS_DIRECTIVE)

	# Direct URL access: redirect read-only users to their space / document reader page
	user = frappe.session.user
	if user and user != "Guest":
		raw_path = getattr(frappe.local, "request", None) and getattr(frappe.local.request, "path", "")
		app_path = frappe.form_dict.get("app_path") or (raw_path.replace("/wiki-app", "").strip("/") if raw_path else "")
		if app_path:
			import re
			match = re.match(r"^spaces/([^/]+)(?:/page/([^/]+))?", app_path)
			if match:
				space_id = match.group(1)
				page_id = match.group(2)
				caps = None
				try:
					from project_documentation.api.project_access import custom_get_space_capabilities
					caps = custom_get_space_capabilities(space_id, page=page_id)
				except ImportError:
					from wiki.api import get_space_capabilities
					caps = get_space_capabilities(space_id, page=page_id)
				except Exception:
					pass
				if caps and caps.get("is_read_only"):
					if caps.get("reader_url"):
						frappe.redirect(caps["reader_url"])
					elif not caps.get("has_published_documents"):
						frappe.redirect("/wiki-app/spaces?empty_space=1")

	csrf_token = frappe.sessions.get_csrf_token()
	frappe.db.commit()  # nosemgrep
	context = frappe._dict()
	context.metatags = {"robots": ROBOTS_DIRECTIVE}
	context.boot = get_boot()
	context.boot.csrf_token = csrf_token
	return context


@frappe.whitelist(methods=["POST"], allow_guest=True)
def get_context_for_dev():
	if not frappe.conf.developer_mode:
		frappe.throw(frappe._("This method is only meant for developer mode"))
	return get_boot()


def get_boot():
	return frappe._dict(
		{
			"frappe_version": frappe.__version__,
			"site_name": frappe.local.site,
			"read_only_mode": frappe.flags.read_only,
			"system_timezone": get_system_timezone(),
			"asset_hashes": get_asset_hashes(),
		}
	)


def get_asset_hashes() -> dict:
	"""Content hashes for the app assets the SPA pulls in at runtime.

	Those are served with far-future `immutable` caching, so a bare URL pins
	whichever copy the browser fetched first — a stale one keeps failing long
	after the fix ships. The SPA appends these hashes so a changed file is
	always a new URL.
	"""
	return {"mermaid_loader": get_asset_hash("public/js/mermaid-loader.js")}
