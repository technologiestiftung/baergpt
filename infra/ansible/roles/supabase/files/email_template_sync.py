#!/usr/bin/env python3
"""Keep the email templates GoTrue sends in sync with a branch of the repository.

Each run asks the GitHub API for the latest commit that touched the template folder on the branch.
When it differs from the deployed one, the templates are downloaded at that commit, checked and
swapped in. A manifest with the commit and the sha256 of every template is written last; nginx
serves it so CI can confirm a merge reached the host.

The templates can make mail clients load URLs that contain the login code, so a template that
links anywhere but baergpt.berlin, or uses template expressions beyond the ones below, is refused
and the previous files stay. `--check DIR` runs the same checks on local files.
Standard library only.
"""
import argparse
import hashlib
import html
import json
import os
import re
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

TEMPLATE_PATH = "apps/backend/supabase/templates"
MANIFEST_NAME = "email-templates.json"
MAX_TEMPLATE_BYTES = 64 * 1024
MAX_API_RESPONSE_BYTES = 1024 * 1024
HTTP_TIMEOUT_SECONDS = 20

ALLOWED_HOST = r"(?:www\.)?baergpt\.berlin"
# Stand-ins with the shape of the real values, so text right after an expression is checked as part of the URL it forms.
TEMPLATE_EXPRESSIONS = {
    ".ConfirmationURL": "https://www.baergpt.berlin/verify",
    ".SiteURL": "https://www.baergpt.berlin",
    ".Token": "0",
    ".Email": "user@example.org",
    ".NewEmail": "user@example.org",
    ".Data.first_name": "x",
    ".Data.last_name": "x",
}


class SyncError(Exception):
    pass


# ---------------------------------------------------------------------------
# Template checks
# ---------------------------------------------------------------------------

def template_problems(text):
    """Return what makes a template unsafe to deploy; empty when it is fine."""
    problems = []

    def expand(match):
        expression = match.group(1).strip()
        if expression not in TEMPLATE_EXPRESSIONS:
            problems.append(f"template expression {match.group(0)!r} is not allowed")
            return ""
        return TEMPLATE_EXPRESSIONS[expression]

    expanded = re.sub(r"\{\{(.*?)\}\}", expand, text, flags=re.S)
    if "{{" in expanded or "}}" in expanded:
        problems.append("unbalanced template delimiters")

    # Read the URLs the way a mail client does: entities decoded, tabs and newlines dropped, any case.
    url_text = re.sub(r"[\t\r\n]", "", html.unescape(expanded)).lower()
    if "\\" in url_text:
        problems.append("backslashes are not allowed")
    for match in re.finditer(r"https?:", url_text):
        # Only these end the host for every URL parser; after a quote or ")" an "@evil.com" can still follow.
        if not re.match(r"https://" + ALLOWED_HOST + r"(?=[/?#])", url_text[match.start():]):
            problems.append(f"URL {url_text[match.start():match.start() + 60]!r} does not point to baergpt.berlin over https")
    for match in re.finditer(r"//", url_text):
        if not url_text[:match.start()].endswith("https:"):
            problems.append(f"URL {url_text[max(match.start() - 20, 0):match.start() + 40]!r} has no https scheme")
    return problems


def check_templates(templates):
    """templates: {file name: text}. Raises SyncError listing every problem."""
    problems = [f"{name}: {problem}" for name, text in sorted(templates.items()) for problem in template_problems(text)]
    if problems:
        raise SyncError("refusing templates:\n  " + "\n  ".join(problems))


# ---------------------------------------------------------------------------
# Fetching
# ---------------------------------------------------------------------------

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def fetch(url, max_bytes, accept):
    request = urllib.request.Request(url, headers={"User-Agent": "baergpt-email-template-sync", "Accept": accept})
    try:
        with OPENER.open(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
            body = response.read(max_bytes + 1)
    except urllib.error.HTTPError as error:
        raise SyncError(f"{url}: HTTP {error.code}") from error
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise SyncError(f"{url}: {error}") from error

    if len(body) > max_bytes:
        raise SyncError(f"{url}: response larger than {max_bytes} bytes")
    try:
        return body.decode("utf-8")
    except UnicodeDecodeError as error:
        raise SyncError(f"{url}: not UTF-8") from error


def latest_template_commit(repo, branch):
    query = urllib.parse.urlencode({"sha": branch, "path": TEMPLATE_PATH, "per_page": 1})
    body = fetch(f"https://api.github.com/repos/{repo}/commits?{query}", MAX_API_RESPONSE_BYTES, "application/vnd.github+json")
    try:
        sha = json.loads(body)[0]["sha"]
    except (ValueError, LookupError, TypeError) as error:
        raise SyncError(f"unexpected GitHub API response for {repo}@{branch}") from error
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise SyncError(f"unexpected commit id {sha!r}")
    return sha


def download_templates(repo, commit, names):
    return {
        f"{name}.html": fetch(f"https://raw.githubusercontent.com/{repo}/{commit}/{TEMPLATE_PATH}/{name}.html",
                              MAX_TEMPLATE_BYTES, "text/html")
        for name in names
    }


# ---------------------------------------------------------------------------
# Installing
# ---------------------------------------------------------------------------

def sha256(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def file_sha256(path):
    # Bytes, not read_text(): that turns \r\n into \n and would never match the manifest.
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_atomic(path, text):
    """Replace path in one rename, so GoTrue never reads a partly written template."""
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def deployed_commit(dest, names):
    """The commit of the deployed templates, or None when any file is missing or differs from the manifest."""
    try:
        manifest = json.loads((dest / MANIFEST_NAME).read_text())
        for name in names:
            if file_sha256(dest / f"{name}.html") != manifest["templates"][f"{name}.html"]:
                return None
        return manifest["commit"]
    except (OSError, ValueError, LookupError, TypeError):
        return None


def install(dest, commit, templates):
    for file_name, text in templates.items():
        write_atomic(dest / file_name, text)
    manifest = {"commit": commit, "templates": {name: sha256(text) for name, text in sorted(templates.items())}}
    write_atomic(dest / MANIFEST_NAME, json.dumps(manifest, indent=2) + "\n")


# ---------------------------------------------------------------------------

def sync(args):
    dest = Path(args.dest)
    commit = latest_template_commit(args.repo, args.branch)
    if commit == deployed_commit(dest, args.templates):
        return {"status": "ok", "commit": commit, "changed": False}

    templates = download_templates(args.repo, commit, args.templates)
    check_templates(templates)
    install(dest, commit, templates)
    return {"status": "ok", "commit": commit, "changed": True}


def check(args):
    templates = {path.name: path.read_text(encoding="utf-8") for path in sorted(Path(args.check).glob("*.html"))}
    if not templates:
        raise SyncError(f"no templates in {args.check}")
    check_templates(templates)
    return {"status": "ok", "checked": sorted(templates)}


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", metavar="DIR", help="only check the *.html templates in DIR")
    parser.add_argument("--repo", help="GitHub repository, owner/name")
    parser.add_argument("--branch")
    parser.add_argument("--dest", help="directory the templates are served from")
    parser.add_argument("--templates", type=lambda value: value.split(","), help="comma-separated template names")
    args = parser.parse_args()
    if not args.check and not all([args.repo, args.branch, args.dest, args.templates]):
        parser.error("--repo, --branch, --dest and --templates are required unless --check is given")

    try:
        result = check(args) if args.check else sync(args)
    except SyncError as error:
        print(json.dumps({"status": "error", "reason": str(error)}), file=sys.stderr)
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
