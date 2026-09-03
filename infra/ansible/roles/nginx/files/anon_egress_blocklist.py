#!/usr/bin/env python3
"""Rebuild the nginx `geo` include that blocks Tor exits and Mullvad VPN ranges.

Three public sources feed the list:
  - the Tor bulk exit list (single addresses)
  - Mullvad's relay list, which publishes entry addresses; exits differ, so each
    relay is widened to its /24 (IPv4) or /64 (IPv6)
  - the address blocks the RIPE database registers to Mullvad VPN AB

The new file is installed only when every source was fetched, the counts look
sane and `nginx -t` accepts it. Otherwise the previous file stays in place.
Standard library only.
"""
import ipaddress
import json
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

TOR_EXIT_LIST_URL = "https://check.torproject.org/torbulkexitlist"
MULLVAD_RELAYS_URL = "https://api.mullvad.net/www/relays/all/"
RIPE_SEARCH_URL = "https://rest.db.ripe.net/search.json"
MULLVAD_ORG_NAME = "Mullvad VPN AB"

OUTPUT = Path("/etc/nginx/anon-egress-blocklist.conf")

MIN_TOR_EXITS = 500
MIN_MULLVAD_RELAYS = 200
MIN_RIPE_BLOCKS = 20
MAX_SHRINK_RATIO = 0.5
MAX_GROWTH_RATIO = 4
# Nothing legitimate in these lists is wider than a /20 or an IPv6 /32. Anything wider
# would take out a large part of the internet if a source were wrong or tampered with.
MIN_PREFIXLEN = {4: 20, 6: 32}
MAX_RESPONSE_BYTES = 20 * 1024 * 1024
HTTP_TIMEOUT_SECONDS = 30


class RefreshError(Exception):
    pass


# ---------------------------------------------------------------------------
# Fetching
# ---------------------------------------------------------------------------

def fetch(url):
    request = urllib.request.Request(url, headers={
        "User-Agent": "baergpt-anon-egress-blocklist",
        "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
            if not response.geturl().startswith("https://"):
                raise RefreshError(f"{url}: redirected off https to {response.geturl()}")
            body = response.read(MAX_RESPONSE_BYTES + 1)
    except urllib.error.HTTPError as error:
        # RIPE answers "no entries found" with a 404, which is a valid empty result here.
        if error.code == 404 and url.startswith(RIPE_SEARCH_URL):
            return "{}"
        raise RefreshError(f"{url}: HTTP {error.code}") from error
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise RefreshError(f"{url}: {error}") from error

    if len(body) > MAX_RESPONSE_BYTES:
        raise RefreshError(f"{url}: response larger than {MAX_RESPONSE_BYTES} bytes")
    return body.decode("utf-8")


def ripe_search(**params):
    query = urllib.parse.urlencode(list(params.items()) + [("flags", "no-referenced")], doseq=True)
    return fetch(f"{RIPE_SEARCH_URL}?{query}")


# ---------------------------------------------------------------------------
# Parsing: every function below turns one response body into a set of networks
# ---------------------------------------------------------------------------

def parse_tor(text):
    networks = set()
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            address = ipaddress.ip_address(line)
        except ValueError as error:
            raise ValueError(f"tor exit list: unexpected line {line!r}") from error
        networks.add(ipaddress.ip_network(address))
    return networks


def parse_mullvad(text):
    relays = json.loads(text)
    if not isinstance(relays, list):
        raise ValueError("mullvad relay list: expected a JSON array")

    networks = set()
    for relay in relays:
        if not isinstance(relay, dict):
            raise ValueError("mullvad relay list: expected relay objects")
        ipv4 = relay.get("ipv4_addr_in")
        ipv6 = relay.get("ipv6_addr_in")
        if ipv4:
            networks.add(ipaddress.ip_network(f"{ipv4}/24", strict=False))
        if ipv6:
            networks.add(ipaddress.ip_network(f"{ipv6}/64", strict=False))
    return networks


def ripe_objects(text):
    """Yield (type, {attribute name: value}) for each object in a RIPE search response."""
    body = json.loads(text)
    for obj in body.get("objects", {}).get("object", []):
        try:
            attributes = {a["name"]: a["value"] for a in obj["attributes"]["attribute"]}
        except (KeyError, TypeError) as error:
            raise ValueError("ripe: unexpected object shape") from error
        yield obj.get("type"), attributes


def ripe_org_handles(text, org_name):
    handles = []
    for obj_type, attributes in ripe_objects(text):
        if obj_type == "organisation" and attributes.get("org-name", "").strip().lower() == org_name.lower():
            handles.append(attributes["organisation"])
    return handles


def parse_ripe(text):
    networks = set()
    for _, attributes in ripe_objects(text):
        if "inetnum" in attributes:
            first, last = attributes["inetnum"].split("-")
            networks.update(ipaddress.summarize_address_range(
                ipaddress.ip_address(first.strip()), ipaddress.ip_address(last.strip())))
        elif "inet6num" in attributes:
            networks.add(ipaddress.ip_network(attributes["inet6num"].strip()))
    return networks


def fetch_mullvad_ripe_blocks():
    handles = ripe_org_handles(
        ripe_search(**{"query-string": MULLVAD_ORG_NAME, "type-filter": "organisation"}),
        MULLVAD_ORG_NAME)
    if not handles:
        raise RefreshError(f"ripe: no organisation named {MULLVAD_ORG_NAME!r}")

    networks = set()
    for handle in handles:
        response = ripe_search(**{"query-string": handle, "inverse-attribute": "org",
                                  "type-filter": ["inetnum", "inet6num"]})
        networks |= parse_ripe(response)
    return networks


# ---------------------------------------------------------------------------
# Sanity checks: each raises RefreshError, which keeps the previous file
# ---------------------------------------------------------------------------

def check_source_sizes(tor, mullvad, ripe):
    if tor < MIN_TOR_EXITS:
        raise RefreshError(f"tor exit list has {tor} entries, expected at least {MIN_TOR_EXITS}")
    if mullvad < MIN_MULLVAD_RELAYS:
        raise RefreshError(f"mullvad relay list has {mullvad} entries, expected at least {MIN_MULLVAD_RELAYS}")
    if ripe < MIN_RIPE_BLOCKS:
        raise RefreshError(f"ripe registrations have {ripe} entries, expected at least {MIN_RIPE_BLOCKS}")


def check_prefixes(networks):
    too_broad = sorted(str(n) for n in networks if n.prefixlen < MIN_PREFIXLEN[n.version])
    if too_broad:
        raise RefreshError(f"refusing overly broad networks: {too_broad}")


def check_shrink(new, old):
    if old == 0:
        return
    if new < old * MAX_SHRINK_RATIO:
        raise RefreshError(f"new list has {new} entries, previous had {old}; refusing to shrink that far")
    if new > old * MAX_GROWTH_RATIO:
        raise RefreshError(f"new list has {new} entries, previous had {old}; refusing to grow that far")


# ---------------------------------------------------------------------------
# Rendering and installing
# ---------------------------------------------------------------------------

def render(networks):
    ipv4 = sorted(ipaddress.collapse_addresses(n for n in networks if n.version == 4))
    ipv6 = sorted(ipaddress.collapse_addresses(n for n in networks if n.version == 6))
    lines = ["# Generated by anon-egress-blocklist. Do not edit; edits are overwritten on the next refresh."]
    lines += [f"{network} 1;" for network in ipv4 + ipv6]
    return "\n".join(lines) + "\n"


def count_entries(text):
    return sum(1 for line in text.splitlines() if line.endswith(" 1;"))


def install(live, text, validate, reload):
    """Swap the new file in, roll back if nginx rejects it. Returns True when nginx was reloaded."""
    live = Path(live)
    previous = live.read_text() if live.exists() else None
    if previous == text:
        return False

    live.write_text(text)
    if not validate():
        if previous is None:
            live.unlink()
        else:
            live.write_text(previous)
        raise RefreshError("nginx -t rejected the new blocklist; previous file restored")

    reload()
    return True


def nginx_test():
    return subprocess.run(["nginx", "-t"], capture_output=True).returncode == 0


def nginx_reload():
    subprocess.run(["systemctl", "reload", "nginx"], check=True)


# ---------------------------------------------------------------------------

def main():
    try:
        tor = parse_tor(fetch(TOR_EXIT_LIST_URL))
        mullvad = parse_mullvad(fetch(MULLVAD_RELAYS_URL))
        ripe = fetch_mullvad_ripe_blocks()
        networks = tor | mullvad | ripe

        check_source_sizes(tor=len(tor), mullvad=len(mullvad), ripe=len(ripe))
        check_prefixes(networks)

        text = render(networks)
        previous_count = count_entries(OUTPUT.read_text()) if OUTPUT.exists() else 0
        check_shrink(new=count_entries(text), old=previous_count)

        changed = install(OUTPUT, text, validate=nginx_test, reload=nginx_reload)
    except Exception as error:
        print(json.dumps({"status": "error", "reason": f"{type(error).__name__}: {error}"}), file=sys.stderr)
        return 1

    print(json.dumps({"status": "ok", "tor": len(tor), "mullvad": len(mullvad), "ripe": len(ripe),
                      "entries": count_entries(text), "changed": changed}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
