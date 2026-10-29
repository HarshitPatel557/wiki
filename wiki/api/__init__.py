import os

import frappe
from frappe.translate import get_all_translations

CONVERTIBLE_IMAGE_EXTENSIONS = (".png", ".jpeg", ".jpg")


def _get_space_doc_counts(space: str) -> dict:
	space_route, root_group = frappe.db.get_value("Wiki Space", space, ["route", "root_group"]) or ("", "")
	total_docs = frappe.db.count("Wiki Document", {"wiki_space": space, "is_group": 0})
	pub_docs = frappe.db.count("Wiki Document", {"wiki_space": space, "is_group": 0, "is_published": 1})
	if total_docs == 0 and root_group:
		total_docs = frappe.db.count("Wiki Document", {"parent_wiki_document": root_group, "is_group": 0})
		pub_docs = frappe.db.count("Wiki Document", {"parent_wiki_document": root_group, "is_group": 0, "is_published": 1})
	if total_docs == 0 and space_route:
		clean_route = space_route.strip("/")
		total_docs = frappe.db.count("Wiki Document", {"route": ["like", f"{clean_route}/%"], "is_group": 0})
		pub_docs = frappe.db.count("Wiki Document", {"route": ["like", f"{clean_route}/%"], "is_group": 0, "is_published": 1})
	return {
		"has_documents": total_docs > 0,
		"has_published_documents": pub_docs > 0,
		"total_documents": total_docs,
		"published_documents": pub_docs,
	}


@frappe.whitelist()
def get_space_capabilities(space: str, page: str = None) -> dict:
	"""Return the current user's read/write capabilities for a Wiki Space.

	Used by the SPA to show/hide the Merge and contribute actions. Enforcement
	always remains server-side in the permission hooks and Change Request
	controller.
	"""
	from wiki.permissions import can_contribute_to_space, can_read_space, can_write_space

	can_read = can_read_space(space)
	can_write = can_write_space(space)
	can_contribute = can_contribute_to_space(space)
	is_read_only = bool(can_read and not (can_write or can_contribute))

	doc_counts = _get_space_doc_counts(space)
	has_published = doc_counts["has_published_documents"]

	page = page or frappe.form_dict.get("page")
	space_route = frappe.db.get_value("Wiki Space", space, "route") or ""
	reader_url = None
	if page:
		doc_route = frappe.db.get_value("Wiki Document", page, "route")
		if doc_route:
			reader_url = f"/{doc_route.strip('/')}"
	elif space_route and has_published:
		reader_url = f"/{space_route.strip('/')}/"

	is_personal = bool(frappe.db.get_value("Wiki Space", space, "is_personal"))

	return {
		"can_read": can_read,
		"can_write": can_write,
		"can_contribute": can_contribute,
		"is_read_only": is_read_only,
		"is_personal": is_personal,
		"enable_cr_workflow": not is_personal,
		"reader_url": reader_url,
		"space_route": space_route,
		"has_documents": doc_counts["has_documents"],
		"has_published_documents": has_published,
		"total_documents": doc_counts["total_documents"],
		"published_documents": doc_counts["published_documents"],
	}


@frappe.whitelist(allow_guest=False)
def create_personal_space(space_name: str, route: str | None = None) -> dict:
	"""Create a personal Wiki Space owned by the current user."""
	user = frappe.session.user
	if not user or user == "Guest":
		frappe.throw(frappe._("Login is required to create a personal space."), frappe.PermissionError)

	space_name = (space_name or "").strip()
	if not space_name:
		frappe.throw(frappe._("Space Name is required."))

	if not route:
		from wiki.frappe_wiki.doctype.wiki_change_request.wiki_change_request import slugify
		route = slugify(space_name)
	else:
		route = route.strip().lstrip("/")

	if not route:
		frappe.throw(frappe._("Route is required."))

	suffix = 1
	base_route = route
	while frappe.db.exists("Wiki Space", {"route": route}):
		route = f"{base_route}-{suffix}"
		suffix += 1

	doc = frappe.get_doc(
		{
			"doctype": "Wiki Space",
			"space_name": space_name,
			"route": route,
			"is_personal": 1,
			"is_published": 1,
			"owner": user,
		}
	)
	doc.insert(ignore_permissions=True)
	return {
		"name": doc.name,
		"space_name": doc.space_name,
		"route": doc.route,
		"is_personal": 1,
	}


@frappe.whitelist(allow_guest=False)
def direct_merge_change_request(name: str):
	"""Directly approve and merge a change request in a personal space (no PR workflow)."""
	cr = frappe.get_doc("Wiki Change Request", name)
	from wiki.permissions import can_write_space
	if not can_write_space(cr.wiki_space):
		frappe.throw(frappe._("You do not have permission to edit this space."), frappe.PermissionError)

	if cr.status in ("Draft", "Changes Requested"):
		cr.status = "In Review"
		cr.save(ignore_permissions=True)
	if cr.status == "In Review":
		cr.status = "Approved"
		cr.reviewed_by = frappe.session.user
		cr.reviewed_at = frappe.utils.now_datetime()
		cr.save(ignore_permissions=True)

	from wiki.frappe_wiki.doctype.wiki_change_request.wiki_change_request import merge_change_request
	return merge_change_request(name)


@frappe.whitelist()
def get_user_info() -> dict:
	"""Get basic information about the logged-in user."""
	if frappe.session.user == "Guest":
		return {"is_logged_in": False}

	user = frappe.get_cached_doc("User", frappe.session.user)

	return {
		"name": user.name,
		"is_logged_in": True,
		"first_name": user.first_name,
		"last_name": user.last_name,
		"full_name": user.full_name,
		"email": user.email,
		"user_image": user.user_image,
		"roles": user.roles,
		"brand_image": frappe.get_single_value("Website Settings", "banner_image"),
		"language": user.language,
	}


@frappe.whitelist(allow_guest=True)
def get_translations():
	if frappe.session.user != "Guest":
		language = frappe.db.get_value("User", frappe.session.user, "language")
	else:
		language = frappe.db.get_single_value("System Settings", "language")

	return get_all_translations(language)


def _to_webp(path_or_url: str) -> str:
	"""Swap any file extension for `.webp` (works for both fs paths and URLs)."""
	return os.path.splitext(path_or_url)[0] + ".webp"


def convert_file_to_webp(file_doc) -> str:
	"""Convert a local PNG/JPEG File doc to WebP in place.

	Replaces the file on disk, deletes the original, and updates the doc's
	file_url. Returns the new (or unchanged, if not convertible) file_url.
	"""
	from frappe.core.doctype.file.file import get_local_image
	from frappe.core.doctype.file.utils import delete_file, generate_file_name
	from frappe.utils import get_files_path

	if not file_doc:
		return ""

	file_url = file_doc.file_url or ""
	# Only act on local site files of a convertible raster format.
	if not file_url.startswith("/files") or not file_url.lower().endswith(CONVERTIBLE_IMAGE_EXTENSIONS):
		return file_url

	webp_name = generate_file_name(_to_webp(file_doc.file_name or os.path.basename(file_url)))

	try:
		image, _, _ = get_local_image(file_url)
		image.save(get_files_path(webp_name), "WEBP")
	except Exception:
		# Corrupt or unsupported image — keep the original upload rather than
		# failing the whole request and losing the author's image.
		frappe.log_error(title="Wiki WebP conversion failed")
		return file_url

	# delete_file resolves public/private from the URL's leading segment, so it
	# must be given the /files/... url — not the absolute filesystem path.
	delete_file(file_url)

	file_doc.file_url = f"/files/{webp_name}"
	file_doc.file_name = webp_name
	file_doc.save()
	return file_doc.file_url


@frappe.whitelist()
def upload_wiki_asset():
	"""Upload handler for wiki editor assets.

	Wraps Frappe's standard file upload. When the `auto_convert_images_to_webp`
	Wiki Setting is enabled, uploaded PNG/JPEG images are converted to WebP
	before the File doc is returned, so the editor receives the optimized URL.
	"""
	from frappe.handler import upload_file

	file_doc = upload_file()
	if (
		file_doc
		and (file_doc.file_url or "").lower().endswith(CONVERTIBLE_IMAGE_EXTENSIONS)
		and frappe.get_cached_value("Wiki Settings", "Wiki Settings", "auto_convert_images_to_webp")
	):
		convert_file_to_webp(file_doc)
	return file_doc


@frappe.whitelist()
def get_wiki_notifications(limit=30) -> dict:
	"""Fetch recent notifications and unread/tagged counts for the current user in Wiki."""
	if frappe.session.user == "Guest":
		return {"unread_count": 0, "tagged_count": 0, "notifications": []}

	user = frappe.session.user

	# 1. Total unread notification logs for user
	unread_count = frappe.db.count("Notification Log", {"for_user": user, "read": 0})

	# 2. Count of active Wiki Change Requests tagged to user
	tagged_count = frappe.db.count(
		"Wiki Change Request",
		filters=[
			["_user_tags", "like", f"%{user}%"],
			["status", "in", ["In Review", "Draft"]],
		],
	)

	# 3. Notification logs
	logs = frappe.db.get_list(
		"Notification Log",
		filters={"for_user": user},
		fields=[
			"name",
			"subject",
			"read",
			"type",
			"document_type",
			"document_name",
			"link",
			"from_user",
			"creation",
			"modified",
		],
		order_by="creation desc",
		limit=limit,
	)

	# Resolve user full names and avatars
	from_users = {log["from_user"] for log in logs if log.get("from_user")}
	user_details = {}
	if from_users:
		users_data = frappe.db.get_all(
			"User",
			filters={"name": ["in", list(from_users)]},
			fields=["name", "full_name", "user_image"],
		)
		for u in users_data:
			user_details[u["name"]] = u

	result = []
	for log in logs:
		sender = user_details.get(log.get("from_user")) or {}
		link = log.get("link") or ""
		if not link and log.get("document_type") == "Wiki Change Request" and log.get("document_name"):
			link = f"/wiki-app/change-requests/{log['document_name']}"
		elif "/app/wiki-change-request/" in link:
			cr_name = link.split("/")[-1]
			link = f"/wiki-app/change-requests/{cr_name}"

		result.append({
			"name": log["name"],
			"subject": log.get("subject"),
			"read": bool(log.get("read")),
			"type": log.get("type"),
			"document_type": log.get("document_type"),
			"document_name": log.get("document_name"),
			"link": link,
			"from_user": log.get("from_user"),
			"from_user_name": sender.get("full_name") or log.get("from_user"),
			"from_user_image": sender.get("user_image"),
			"creation": str(log.get("creation")),
			"pretty_date": frappe.utils.pretty_date(log.get("creation")),
		})

	return {
		"unread_count": unread_count,
		"tagged_count": tagged_count,
		"notifications": result,
	}


@frappe.whitelist()
def mark_wiki_notification_as_read(docname: str = None) -> dict:
	"""Mark a single notification or all notifications as read for current user."""
	if frappe.session.user == "Guest":
		return {"success": False}

	user = frappe.session.user
	if docname and docname != "all":
		frappe.db.set_value(
			"Notification Log",
			{"name": docname, "for_user": user},
			"read",
			1,
			update_modified=False,
		)
	else:
		frappe.db.set_value(
			"Notification Log",
			{"for_user": user, "read": 0},
			"read",
			1,
			update_modified=False,
		)
	frappe.db.commit()
	return {"success": True}

