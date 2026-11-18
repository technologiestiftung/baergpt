#!/usr/bin/env python3
"""Pull and read logs during a security incident.

  alert NAME   replay one rule from alerts_security.tf and show what matched
  pull         export every access-log stream for a time window, with checksums
  actor        find one client or account in the pulled files and print its timeline
  export       write a scrubbed copy of everything in raw/ to a separate folder

Reads LOKI_URL, LOKI_USERNAME, LOKI_PASSWORD and, for the Render stream,
RENDER_BACKEND_RESOURCE. Read-only: it only calls Loki's query_range endpoint.

Files go to ~/baergpt-incidents/<incident>/ (raw/ and scrubbed/). The terminal shows counts
and tokens instead of addresses, account ids and emails unless --raw is given. Tokens are
HMAC-SHA256 over a local key: stable, so correlation still works, but reversible with the
key. Scrubbed output is pseudonymised, not anonymous, and is still personal data.
"""
import argparse, base64, gzip, hashlib, hmac, ipaddress, json, os, re, secrets, subprocess, sys, time
import urllib.error, urllib.parse, urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
TF = REPO / "infra/terraform/observability/alerts_security.tf"
NS = 1_000_000_000
NAMESPACE = {"production": "prod", "staging": "staging"}
RENDER_PLACEHOLDER = "\x00render\x00"
ENVOY = '{service_name="ske-envoy-gateway-system"}'
KEY_FILE = Path(os.environ.get("SCRUB_KEY_FILE") or "~/.config/baergpt/scrub.key").expanduser()

RULE = re.compile(r'alert\s*=\s*"(\w+)"\s*\n\s*expression\s*=\s*trimspace\(<<-EOT\n(.*?)\n\s*EOT', re.S)
STRING_LOCAL = re.compile(r'^\s*(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"\s*$', re.M)
PIPELINE = re.compile(r"count_over_time\((.*)\s\[\d+[smhd]\]\)", re.S)

COMBINED = re.compile(r'^(\S+) \S+ \S+ \[([^\]]*)\] "(\S+) (\S+)[^"]*" (\d{3}) \S+ "([^"]*)" "([^"]*)"')
LOGFMT = re.compile(r'([A-Za-z_][\w.]*)=("(?:[^"\\]|\\.)*"|\S*)')
FIELD_KEYS = {
    "method": ("method", "requestMethod", "http_method"),
    "path": ("path", "requestPath", "url", "uri", "x_envoy_origin_path", "x-envoy-origin-path", ":path"),
    "status": ("statusCode", "status", "status_code", "response_code"),
    "ua": ("userAgent", "user_agent", "ua", "http_user_agent", "user-agent"),
    "ip": ("clientIP", "client_ip", "remote_addr", "ip", "downstream_remote_address", "x-forwarded-for"),
}

# A value may directly follow a percent-escape ("%2F1.2.3.4"), whose last digit is no word boundary.
AFTER_ESCAPE = r'(?<=%[0-9A-Fa-f]{2})'
EMAIL = re.compile(r'\b[A-Za-z0-9._%+\-]+(?:@|%40)[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b')
UUID = re.compile(r'(?:' + AFTER_ESCAPE + r'|(?<![0-9A-Za-z]))'
                  r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?![0-9A-Za-z])')
JWT = re.compile(r'(?:' + AFTER_ESCAPE + r'|(?<![0-9A-Za-z_\-]))eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+')
IPV4 = re.compile(r'(?:' + AFTER_ESCAPE + r'|(?<![\w.]))((?:\d{1,3}\.){3}\d{1,3})(?![\w.])')
LOOSE_IPV4 = re.compile(r'(?<![\w./])((?:\d{1,3}\.){3}\d{1,3})(?![\w.])')
# Loose on purpose so "::" forms match; Scrubber.ip and is_public reject what is not an address.
IPV6 = re.compile(r'(?:' + AFTER_ESCAPE + r'|(?<![\w:]))(?:[0-9a-fA-F]{0,4}:){2,7}(?:(?:\d{1,3}\.){3}\d{1,3}|[0-9a-fA-F]{0,4})(?![\w:])')
HEX = re.compile(r'^[0-9a-f]{12,}$', re.I)
# A backslash and the character after it count as one: \x22, &, \" or a path like \think\app.
STORAGE_PATH = re.compile(r'/storage/v1/(?:[^\s"?\\]|\\.)+')
# The request of an nginx-style line. A client can send it with spaces, so it is not split on them.
REQUEST = re.compile(r'^(\S+ \S+ \S+ \[[^\]]*\] ")([^"]*)(?=")')
PROTOCOL = re.compile(r' HTTP/\d(?:\.\d)?$')
STORAGE_WORDS = {"object", "public", "sign", "authenticated", "info", "list", "copy", "move", "upload",
                 "resumable", "render", "image"}
BUCKET = re.compile(r'^[a-z0-9][a-z0-9_.\-]{0,62}$')
FILE_EXT = re.compile(r'\.[A-Za-z0-9]{1,5}$')
QUERY = re.compile(r'\?(?:[^\s"\\]|\\.)+')
QUERY_SEP = re.compile(r'(&|\\u0026)')
# Set by the client code, never typed by a user, and needed to read what a request did.
QUERY_KEEP = {"select", "order", "limit", "offset", "on_conflict", "columns", "grant_type", "type"}
FILTER_OP = re.compile(r'^(?:not\.)?(?:eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd|ov|fts|plfts|phfts|wfts'
                       r'|match|imatch)(?:\([a-z_]+\))?\.')
SNAKE_IDENT = re.compile(r'^[a-z]+(_[a-z0-9]+)+$')
SAFE_KEY = re.compile(r'^[A-Za-z0-9_.\-]{1,40}$')
SAFE_TOKEN = re.compile(r'^[A-Za-z0-9._\-]{1,30}$')

TOOL_UAS = [(n, re.compile(p, re.I)) for n, p in [
    ("curl", r"curl/|libcurl"), ("wget", r"wget"), ("python-requests", r"python-requests"),
    ("python-httpx", r"python-httpx|^httpx"), ("aiohttp", r"aiohttp"), ("python", r"python"),
    ("go-http-client", r"go-http-client"), ("node-fetch", r"node-fetch"), ("undici", r"undici"),
    ("axios", r"axios"), ("node", r"^node$|^node/"), ("okhttp", r"okhttp"), ("java", r"^java/|apache-httpclient"),
    ("postman", r"postman"), ("insomnia", r"insomnia"), ("httpie", r"httpie"), ("perl", r"libwww-perl"),
    ("scrapy", r"scrapy"), ("sqlmap", r"sqlmap"), ("nikto", r"nikto"), ("nuclei", r"nuclei"),
    ("zgrab", r"zgrab"), ("masscan", r"masscan"), ("nmap", r"nmap"), ("ffuf", r"ffuf|fuzz faster"),
    ("gobuster", r"gobuster"), ("feroxbuster", r"feroxbuster"), ("wfuzz", r"wfuzz"),
    ("headless", r"headless|phantomjs|playwright|puppeteer|selenium"),
]]
CRAWLER = re.compile(r"(googlebot|bingbot|applebot|duckduckbot|yandexbot|ahrefsbot|semrushbot|gptbot"
                     r"|claudebot|ccbot|bytespider|uptimerobot|bot\b|crawler|spider)", re.I)


def die(msg):
    sys.exit(f"error: {msg}")


def note(msg):
    print(msg, file=sys.stderr)


def parse_time(text, now):
    """ISO 8601 (no offset means UTC) or an age such as 90m, 3h, 2d."""
    m = re.fullmatch(r"(\d+)([mhd])", text)
    if m:
        return now - int(m.group(1)) * {"m": 60, "h": 3600, "d": 86400}[m.group(2)]
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        die(f"cannot read time {text!r}: use ISO 8601 (2026-11-18T09:30) or an age (3h, 2d)")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


def utc(ts_ns):
    return datetime.fromtimestamp(ts_ns / NS, timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def nginx_time_ns(text):
    try:
        return int(datetime.strptime(text, "%d/%b/%Y:%H:%M:%S %z").timestamp()) * NS
    except ValueError:
        return None


class Scrubber:
    def __init__(self, key):
        self.key = key

    @classmethod
    def load(cls):
        if KEY_FILE.exists():
            return cls(KEY_FILE.read_bytes().strip())
        KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
        key = secrets.token_hex(32).encode()
        with os.fdopen(os.open(KEY_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "wb") as fh:
            fh.write(key)
        return cls(key)

    def tok(self, value, n=8):
        return hmac.new(self.key, value.encode(), hashlib.sha256).hexdigest()[:n]

    def ip(self, raw):
        try:
            addr = ipaddress.ip_address(raw)
        except ValueError:
            return raw
        if addr.version == 6 and addr.ipv4_mapped:
            return "::ffff:" + self.ip(str(addr.ipv4_mapped))
        # "Chrome/131.0.0.0" parses as an address; N.0.0.0 is never a client.
        if raw.endswith(".0.0.0"):
            return raw
        # Docker bridge, loopback and RFC1918 identify no person and are needed to read the logs.
        if addr.is_private or addr.is_loopback or addr.is_reserved:
            return raw
        if addr.version == 6:
            return "ip6_" + self.tok(addr.compressed)
        net = str(ipaddress.ip_network(f"{raw}/24", strict=False).network_address)
        return f"net_{self.tok(net)}.h{self.tok(raw, 4)}"

    def storage_path(self, path):
        segs = path.split("/")[3:]
        kept = 0
        while kept < len(segs) and segs[kept] in STORAGE_WORDS:
            kept += 1
        if kept < len(segs) and BUCKET.match(segs[kept]) and "resumable" not in segs[:kept]:
            kept += 1
        out = segs[:kept]
        for seg in segs[kept:]:
            name = urllib.parse.unquote(seg)
            if not name or UUID.fullmatch(name):
                out.append(seg)
            else:
                ext = FILE_EXT.search(name)
                out.append("file_" + self.tok(name) + (ext.group(0).lower() if ext else ""))
        return "/storage/v1/" + "/".join(out)

    def query_value(self, value):
        """Keeps the filter operator, gives ids, emails and addresses their usual token, hashes the rest."""
        dec = urllib.parse.unquote_plus(value)
        op = FILTER_OP.match(dec)
        head, rest = (op.group(0), dec[op.end():]) if op else ("", dec)

        def atom(m):
            a = m.group(0)
            if a.lower() in ("null", "true", "false"):
                return a
            if any(rx.fullmatch(a) for rx in (UUID, EMAIL, JWT)):
                return self.identifiers(a)
            try:
                ipaddress.ip_address(a)
                return self.ip(a)
            except ValueError:
                return "val_" + self.tok(a)

        return head + re.sub(r'[^(),]+', atom, rest)

    def query(self, text):
        out = []
        for part in QUERY_SEP.split(text):
            key, eq, value = part.partition("=")
            if QUERY_SEP.fullmatch(part) or not part:
                out.append(part)
                continue
            if not eq:
                out.append("val_" + self.tok(urllib.parse.unquote_plus(part)))
                continue
            key = key if SAFE_KEY.match(key) else "k_" + self.tok(key)
            out.append(key + eq + (value if key in QUERY_KEEP else self.query_value(value)))
        return "".join(out)

    def request(self, text):
        protocol = PROTOCOL.search(text)
        body, tail = (text[:protocol.start()], protocol.group(0)) if protocol else (text, "")
        head, mark, query = body.partition("?")
        method, space, path = head.partition(" ")
        if path.startswith("/storage/v1/"):
            path = self.storage_path(path)
        return method + space + path + mark + self.query(query) + tail

    def urls(self, s):
        s = STORAGE_PATH.sub(lambda m: self.storage_path(m.group(0)), s)
        return QUERY.sub(lambda m: "?" + self.query(m.group(0)[1:]), s)

    def line(self, s):
        m = REQUEST.match(s)
        if m:
            s = m.group(1) + self.request(m.group(2)) + self.urls(s[m.end():])
        else:
            s = self.urls(s)
        return self.identifiers(s)

    def identifiers(self, s):
        s = JWT.sub(lambda m: "jwt_" + self.tok(m.group(0)), s)
        s = EMAIL.sub(lambda m: "usr_" + self.tok(m.group(0).lower().replace("%40", "@")) + "@redacted", s)
        s = UUID.sub(lambda m: "uid_" + self.tok(m.group(0).lower(), 12), s)
        s = IPV6.sub(lambda m: self.ip(m.group(0)), s)
        return IPV4.sub(lambda m: self.ip(m.group(1)), s)

    def walk(self, obj):
        if isinstance(obj, str):
            return self.line(obj)
        if isinstance(obj, dict):
            return {k: self.walk(v) for k, v in obj.items()}
        return obj


# --- Loki -----------------------------------------------------------------------------------

class Loki:
    def __init__(self, limit=5000):
        missing = [k for k in ("LOKI_URL", "LOKI_USERNAME", "LOKI_PASSWORD") if not os.environ.get(k)]
        if missing:
            die(f"set {', '.join(missing)} (see README: op run --env-file .op.env.incident -- …)")
        self.base = os.environ["LOKI_URL"].rstrip("/")
        cred = f"{os.environ['LOKI_USERNAME']}:{os.environ['LOKI_PASSWORD']}"
        self.auth = "Basic " + base64.b64encode(cred.encode()).decode()
        self.limit = limit

    def _get(self, params):
        url = f"{self.base}/loki/api/v1/query_range?{urllib.parse.urlencode(params)}"
        for attempt in range(4):
            req = urllib.request.Request(url, headers={"Authorization": self.auth})
            try:
                with urllib.request.urlopen(req, timeout=180) as resp:
                    return json.load(resp)
            except urllib.error.HTTPError as e:
                body = e.read()[:600].decode(errors="replace").strip()
                if e.code in (429, 500, 502, 503, 504) and attempt < 3:
                    time.sleep(2 ** attempt * 3)
                    continue
                # Loki echoes series labels and addresses into its error text.
                body = re.sub(r"\d+\.\d+\.\d+\.\d+", ":ip", body.split(" for series")[0].split("{")[0])
                die(f"Loki returned HTTP {e.code}: {body[:200]}")
            except (urllib.error.URLError, TimeoutError) as e:
                if attempt < 3:
                    time.sleep(2 ** attempt * 3)
                    continue
                die(f"cannot reach Loki: {getattr(e, 'reason', e)}")

    def entries(self, query, start, end, cap=None):
        """Yield (ts_ns, labels, line) oldest first, paging past Loki's per-request limit."""
        cursor, end_ns, seen, count = start * NS, end * NS, set(), 0
        while cursor < end_ns:
            data = self._get({"query": query, "start": cursor, "end": end_ns,
                              "limit": self.limit, "direction": "forward"})
            batch = []
            for stream in data.get("data", {}).get("result", []):
                labels = stream.get("stream", {})
                lkey = json.dumps(labels, sort_keys=True)
                batch.extend((int(ts), lkey, labels, line) for ts, line in stream.get("values", []))
            batch.sort(key=lambda e: e[0])
            for ts, lkey, labels, line in batch:
                if ts == cursor and (lkey, line) in seen:
                    continue
                yield ts, labels, line
                count += 1
                if cap and count >= cap:
                    note(f"  stopped at {cap} lines (--max-lines); narrow the window for the rest")
                    return
            if len(batch) < self.limit:
                return
            last = batch[-1][0]
            at_last = {(lk, ln) for ts, lk, _, ln in batch if ts == last}
            if last == cursor:
                if at_last <= seen:
                    note(f"  more than {self.limit} lines share one timestamp; some were skipped")
                    cursor, seen = cursor + 1, set()
                    continue
                seen |= at_last
            else:
                cursor, seen = last, at_last


def client_ip(raw):
    """First X-Forwarded-For hop, without the :port Envoy appends."""
    if not raw:
        return None
    ip = raw.split(",")[0].strip()
    if ip.startswith("["):
        return ip[1:ip.find("]")]
    return ip.split(":")[0] if ip.count(":") == 1 else ip


def parse_record(labels, line):
    """Returns {ts_ns, ip, method, target, status, ua, event} for a request line, else None.

    ts_ns is set for nginx lines only, event for GoTrue lines that carry an auth action.
    """
    m = COMBINED.match(line)
    if m:
        ip, when, method, target, status, _, ua = m.groups()
        return {"ts_ns": nginx_time_ns(when), "ip": ip, "method": method.upper(), "target": target,
                "status": status, "ua": ua, "event": None}
    fields, event = dict(labels), None
    stripped = line.strip()
    if stripped.startswith("{"):
        try:
            obj = json.loads(stripped)
            if isinstance(obj, dict):
                fields.update({k: str(v) for k, v in obj.items()
                               if v is not None and not isinstance(v, (dict, list))})
                if isinstance(obj.get("auth_event"), dict):
                    event = obj["auth_event"].get("action")
        except ValueError:
            pass
    else:
        for k, v in LOGFMT.findall(line):
            fields.setdefault(k, v[1:-1].replace('\\"', '"') if v.startswith('"') else v)
    rec = {name: next((fields[k] for k in keys if fields.get(k) not in (None, "")), None)
           for name, keys in FIELD_KEYS.items()}
    if not rec["path"] or not rec["status"] or not re.fullmatch(r"\d{3}", rec["status"]):
        return None
    return {"ts_ns": None, "ip": client_ip(rec["ip"]), "method": (rec["method"] or "?").upper(),
            "target": rec["path"], "status": rec["status"], "ua": rec["ua"] or "", "event": event}


def norm_segment(seg):
    dec = urllib.parse.unquote(seg)
    if "@" in dec:
        return ":email"
    if UUID.fullmatch(dec):
        return ":uuid"
    if dec.isdigit():
        return ":n"
    try:
        ipaddress.ip_address(dec)
        return ":ip"
    except ValueError:
        pass
    if HEX.match(dec):
        return ":hex"
    if SNAKE_IDENT.match(dec) and len(dec) <= 63:
        return dec
    if dec.startswith("eyJ") or len(dec) >= 24:
        return ":tok"
    return dec


def path_template(target):
    """The path with ids, tokens and query values removed, so it can be shown and shared."""
    path, _, query = target.partition("?")
    if "://" in path:
        path = urllib.parse.urlsplit(path).path or "/"
    segs = [norm_segment(s) for s in path.split("/") if s]
    if segs[:3] == ["storage", "v1", "object"] and len(segs) > 5:
        segs = segs[:5] + [":path"]
    tpl = "/" + "/".join(segs)
    keys = sorted({k if SAFE_KEY.match(k) else ":k"
                   for k, _ in urllib.parse.parse_qsl(query, keep_blank_values=True)})
    return tpl + ("?" + "&".join(keys) if keys else "")


def ua_family(ua):
    if ua in ("", "-"):
        return "empty"
    if ua.strip() == "Mozilla/5.0":
        return "mozilla-bare"
    for name, rx in TOOL_UAS:
        if rx.search(ua):
            return name
    m = CRAWLER.search(ua)
    if m:
        return "crawler:" + m.group(1).lower()
    if ua.startswith("Mozilla/5.0 ("):
        mobile = "-mobile" if "Mobile" in ua else ""
        for token, name in (("Edg/", "edge"), ("OPR/", "opera"), ("Firefox/", "firefox"),
                            ("Chrome/", "chrome"), ("Safari/", "safari")):
            if token in ua:
                return f"browser:{name}{mobile}"
        return "mozilla-other"
    product = re.split(r"[/ ;(]", ua, 1)[0]
    return "other:" + (product.lower() if SAFE_TOKEN.match(product) else ":unparseable")


def is_public(ip):
    try:
        a = ipaddress.ip_address(ip)
    except (ValueError, TypeError):
        return False
    return not (a.is_private or a.is_loopback or a.is_reserved or a.is_link_local)


def render_id():
    rid = os.environ.get("RENDER_BACKEND_RESOURCE")
    if rid and not re.fullmatch(r"srv-[a-z0-9]+", rid):
        die("RENDER_BACKEND_RESOURCE is a Render service id (srv-…)")
    return rid


def rules_for(env):
    """[{group, alert, pipeline}] for <env>: every rule's log pipeline as alerts_security.tf ships it."""
    if not TF.exists():
        die(f"{TF} not found")
    text = TF.read_text().replace('${coalesce(var.render_backend_resource, "none")}', RENDER_PLACEHOLDER)
    loc = {}
    for name, raw in STRING_LOCAL.findall(text):
        loc.setdefault(name, re.sub(r"\\(.)", r"\1", raw))
    ns, rid = NAMESPACE[env], render_id()

    def subst(s):
        for _ in range(3):
            s = re.sub(r"\$\{local\.(\w+)\}", lambda m: loc.get(m.group(1), m.group(0)), s)
        return (s.replace("${var.target_source}", f"supabase-{env}").replace("${ns}", ns)
                .replace(RENDER_PLACEHOLDER, rid or "none"))

    at_render, at_ske = text.find("security_render_rules"), text.find("security_envoy_rules")
    if at_render < 0 or at_ske < 0:
        die(f"{TF.name}: rule lists not found; this script reads its layout and needs updating")
    rules = []
    for m in RULE.finditer(text):
        group = "kong" if m.start() < at_render else "render" if m.start() < at_ske else f"ske/{ns}"
        if group == "render" and (env != "production" or not rid):
            continue
        body = subst(" ".join(line.strip() for line in m.group(2).splitlines()))
        pipe = PIPELINE.search(body)
        if not pipe or "${" in pipe.group(1):
            die(f"{TF.name}: cannot read the expression of {m.group(1)}; this script needs updating")
        rules.append({"group": group, "alert": m.group(1), "pipeline": pipe.group(1).strip()})
    return rules


def streams_for(env):
    ns = NAMESPACE[env]
    streams = {
        "kong": f'{{service_name="supabase-{env}"}}',
        "auth": f'{{service_name="supabase-{env}-auth"}}',
        "anon-egress": f'{{service_name="supabase-{env}-anon-egress"}}',
        "envoy": f'{ENVOY} |= "httproute/{ns}/"',
    }
    if env == "production":
        if render_id():
            streams["render"] = f'{{source="render", resource="{render_id()}"}}'
        else:
            note("RENDER_BACKEND_RESOURCE is not set: skipping the Render stream")
    return streams


def incident_dir(name):
    root = Path(os.environ.get("INCIDENT_DIR") or "~/baergpt-incidents").expanduser().resolve()
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", name):
        die("--incident: letters, digits, dot, dash and underscore only")
    path = root / name
    if path == REPO or REPO in path.parents:
        die(f"{path} is inside the repository; evidence must stay outside it")
    for sub in (path, path / "raw", path / "scrubbed"):
        sub.mkdir(parents=True, exist_ok=True)
        os.chmod(sub, 0o700)
    return path


def run_dirs(out, label):
    """A new raw/ and scrubbed/ subfolder for this run, so no run overwrites an earlier one."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dirs = [out / kind / f"{stamp}-{label}" for kind in ("raw", "scrubbed")]
    for d in dirs:
        try:
            d.mkdir(mode=0o700)
        except FileExistsError:
            die(f"{d} exists: wait a second and run again")
    return dirs


def write_private(path, text, append=False):
    flags = os.O_WRONLY | os.O_CREAT | (os.O_APPEND if append else os.O_TRUNC)
    with os.fdopen(os.open(path, flags, 0o600), "a" if append else "w") as fh:
        fh.write(text)


def auth_record(line):
    """GoTrue's audit and login lines as a dict, else None. Fixed fields, apart from the actor's name."""
    if not line.startswith("{"):
        return None
    try:
        obj = json.loads(line)
    except ValueError:
        return None
    if not isinstance(obj, dict):
        return None
    events = [obj[k] for k in ("auth_event", "auth_audit_event") if isinstance(obj.get(k), dict)]
    if not events and not (obj.get("msg") == "Login" and "user_id" in obj):
        return None
    for event in events:
        if "actor_name" in event:
            event["actor_name"] = "(removed)"
    return obj


def auth_actor(record):
    """(action, account id or None) of an audit or login line."""
    events = [record[k] for k in ("auth_event", "auth_audit_event") if isinstance(record.get(k), dict)]
    action = next((e.get("action") for e in events if e.get("action")), record.get("action"))
    account = next((e.get("actor_id") for e in events if e.get("actor_id")), record.get("user_id"))
    return str(action or "?"), account if isinstance(account, str) and UUID.fullmatch(account) else None


def scrubbed_line(scrub, labels, line):
    """(text, kept). Only requests and auth events have known fields; other lines could hold anything."""
    record = auth_record(line.strip())
    if record:
        return scrub.line(json.dumps(record, ensure_ascii=False)), True
    if parse_record(labels, line):
        return scrub.line(line), True
    return f"(not a request line, {len(line)} characters; the raw file has it)", False


def save(path, entries, scrub=None):
    """Write (ts_ns, labels, line) as JSON lines; returns (count, first_ts, last_ts). No file for no lines."""
    count, first, last = 0, None, None
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as fh:
        for ts, labels, line in entries:
            row = {"ts": ts, "labels": labels, "line": line}
            if scrub:
                row = {"ts": ts, "labels": scrub.walk(labels), "line": scrubbed_line(scrub, labels, line)[0]}
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            count, first, last = count + 1, first or ts, ts
    if not count:
        path.unlink()
    return count, first, last


def record(out, run_dir, title, rows):
    """Append this run to manifest.md and rebuild SHA256SUMS over everything in raw/."""
    lines = [f"## {run_dir.name}", "", title, "",
             "| source | query | lines | first (UTC) | last (UTC) |", "| --- | --- | --- | --- | --- |"]
    for name, query, count, first, last in rows:
        shown = re.sub(r"srv-[a-z0-9]+", "srv-…", query).replace("|", "\\|")
        lines.append(f"| {name} | {shown} | {count} | {utc(first) if first else '-'} | {utc(last) if last else '-'} |")
    write_private(out / "manifest.md", "\n".join(lines) + "\n\n", append=True)
    raw = out / "raw"
    files = sorted(p for p in raw.rglob("*") if p.is_file())
    write_private(out / "SHA256SUMS", "".join(f"{sha256(p)}  {p.relative_to(raw).as_posix()}\n" for p in files))
    for d in (run_dir, out / "scrubbed" / run_dir.name):
        if not any(d.iterdir()):
            d.rmdir()


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def read_evidence(path):
    """Yield (ts_ns or None, labels, line) from a pulled .jsonl or a plain (optionally gzipped) log."""
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8", errors="replace") as fh:
        if path.suffix == ".jsonl":
            for raw in fh:
                row = json.loads(raw)
                yield row["ts"], row["labels"], row["line"]
        else:
            for raw in fh:
                yield None, {}, raw.rstrip("\n")


def cmd_alert(a, start, end):
    rules = [r for r in rules_for(a.env) if r["alert"] == a.name]
    if not rules:
        known = sorted({r["alert"] for r in rules_for(a.env)})
        die(f"no rule named {a.name} for {a.env}. Known: {', '.join(known)}")
    loki, scrub, out = Loki(), Scrubber.load(), incident_dir(a.incident)
    raw_dir, scrubbed_dir = run_dirs(out, f"alert-{a.name}")
    title = f"{a.name}, {a.env}, {utc(start * NS)} to {utc(end * NS)} UTC"
    print(f"# {title}\n")
    table = []
    for r in rules:
        note(f"querying {r['group']} …")
        rows = list(loki.entries(r["pipeline"], start, end, a.max_lines))
        stem = r["group"].replace("/", "-") + ".jsonl"
        save(raw_dir / stem, rows)
        save(scrubbed_dir / stem, rows, scrub)
        table.append((r["group"], "rule in alerts_security.tf", len(rows),
                      rows[0][0] if rows else None, rows[-1][0] if rows else None))

        print(f"## {r['group']}")
        if not rows:
            print("- no matching lines in this window\n")
            continue
        combos, clients, answered = Counter(), Counter(), 0
        for _, labels, line in rows:
            rec = parse_record(labels, line)
            if not rec:
                combos[("-", "-", "(not a request line)", "-")] += 1
                continue
            combos[(rec["method"], rec["status"], path_template(rec["target"]), ua_family(rec["ua"]))] += 1
            answered += rec["status"].startswith("2")
            if is_public(rec["ip"]):
                clients[rec["ip"]] += 1
        print(f"- matching lines: {len(rows)}, first {utc(rows[0][0])}, last {utc(rows[-1][0])} UTC")
        print(f"- answered with 2xx: {answered} of {len(rows)}")
        if clients:
            top = ", ".join(f"{ip if a.raw else scrub.ip(ip)} ({n})" for ip, n in clients.most_common(5))
            print(f"- client addresses: {len(clients)}; most lines: {top}")
        else:
            print("- client addresses: not in this log (Kong records the proxy's address)")
        print("- count · method · status · path · client type:")
        for (method, status, tpl, fam), n in combos.most_common(15):
            print(f"  - {n} · {method} · {status} · {tpl} · {fam}")
        if len(combos) > 15:
            print(f"  - … {len(combos) - 15} more combinations")
        print()
    record(out, raw_dir, f"Lines matching {title}.", table)
    if any(row[2] for row in table):
        print(f"Lines saved in {raw_dir} (and scrubbed/).")


def cmd_pull(a, start, end):
    loki, scrub, out = Loki(), Scrubber.load(), incident_dir(a.incident)
    raw_dir, scrubbed_dir = run_dirs(out, "pull")
    table = []
    for name, selector in streams_for(a.env).items():
        note(f"pulling {name} …")
        raw = raw_dir / f"{name}.jsonl"
        count, first, last = save(raw, loki.entries(selector, start, end, a.max_lines))
        if count:
            save(scrubbed_dir / raw.name, read_evidence(raw), scrub)
        table.append((name, f"`{selector}`", count, first, last))
        print(f"{name}: {count} lines" + ("" if count else "  (no requests in this window, or older than Loki keeps)"))
    record(out, raw_dir, f"All streams, {a.env}, {utc(start * NS)} to {utc(end * NS)} UTC.", table)
    print(f"\nWrote {raw_dir} (and scrubbed/); manifest.md and SHA256SUMS updated.")


def export_dir(text, incident):
    dest = Path(text).expanduser().resolve()
    if dest == incident or incident in dest.parents:
        die("--dest must be outside the incident folder, or its reader can open raw/ as well")
    if dest == REPO or REPO in dest.parents:
        try:
            ignored = subprocess.run(["git", "-C", str(REPO), "check-ignore", "-q", str(dest)]).returncode == 0
        except OSError:
            ignored = False
        if not ignored:
            die(f"{dest} is inside the repository and not git-ignored")
    if dest.exists() and any(dest.iterdir()):
        die(f"{dest} is not empty: give a new folder")
    dest.mkdir(parents=True, exist_ok=True)
    os.chmod(dest, 0o700)
    return dest


def cmd_export(a, start, end):
    out = incident_dir(a.incident)
    files = sorted(p for p in (out / "raw").rglob("*") if p.is_file())
    if not files:
        die(f"nothing in {out}/raw: run pull first, and copy the nginx access log there")
    dest, scrub = export_dir(a.dest, out), Scrubber.load()
    print("lines · of them readable · file")
    for path in files:
        rel = path.relative_to(out / "raw")
        target = dest / (rel.with_suffix("") if path.suffix == ".gz" else rel)
        target.parent.mkdir(parents=True, exist_ok=True)
        os.chmod(target.parent, 0o700)
        total = kept = 0
        try:
            fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            die(f"{target} exists already: two files in raw/ differ only by .gz")
        with os.fdopen(fd, "w") as fh:
            for ts, labels, line in read_evidence(path):
                text, is_kept = scrubbed_line(scrub, labels, line)
                if path.suffix == ".jsonl":
                    text = json.dumps({"ts": ts, "labels": scrub.walk(labels), "line": text}, ensure_ascii=False)
                fh.write(text + "\n")
                total, kept = total + 1, kept + is_kept
        print(f"{total} · {kept} · {target.relative_to(dest)}")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    write_private(out / "manifest.md", f"## {stamp}-export\n\nScrubbed copy of raw/ written to {dest}.\n\n", append=True)
    print(f"\nWrote {dest}. Line N there is line N of the file with the same name in raw/.")


def needle_patterns(a):
    pats = []
    for ip in a.ip or []:
        try:
            ipaddress.ip_address(ip)
        except ValueError:
            die(f"--ip {ip!r} is not an address")
        edge = (r"(?<![\d.])", r"(?!\d|\.\d)") if "." in ip else (r"(?<![0-9a-f:])", r"(?![0-9a-f:])")
        pats.append(re.compile(edge[0] + re.escape(ip) + edge[1], re.I))
    pats += [re.compile(re.escape(v), re.I) for v in (a.user or []) + (a.ua or []) + (a.match or [])]
    if not pats:
        die("give at least one of --ip, --user, --ua, --match")
    return pats


def cmd_actor(a, start, end):
    out = incident_dir(a.incident)
    files = sorted(p for p in (out / "raw").rglob("*") if p.is_file() and "-alert-" not in p.parent.name)
    if not files:
        die(f"nothing in {out}/raw: run pull first, and copy the nginx access log there")
    pats, scrub = needle_patterns(a), Scrubber.load()
    hits, first_file, preflights = [], {}, 0
    seen_with = {"addresses": Counter(), "accounts": Counter(),
                 "ids in requests (accounts, documents, chats)": Counter(), "emails": Counter()}
    for path in files:
        source = path.name.split(".")[0]
        for ts, labels, line in read_evidence(path):
            hay = line + " " + json.dumps(labels) if labels else line
            if not any(p.search(hay) for p in pats):
                continue
            rec = parse_record(labels, line)
            ts = ts or (rec and rec["ts_ns"])
            if a.window and ts and not start * NS <= ts <= end * NS:
                continue
            # Overlapping pulls hold the same line twice; repeats inside one file are real requests.
            if first_file.setdefault((ts, source, line), path) != path:
                continue
            if rec and rec["method"] == "OPTIONS" and not a.options:
                preflights += 1
                continue
            hits.append((ts or 0, source, rec, line))
            found = [rec["ip"]] if rec else LOOSE_IPV4.findall(hay) + IPV6.findall(hay)
            seen_with["addresses"].update(ip for ip in found if is_public(ip))
            # Not every uuid on a line: request ids and pod ids would bury the account.
            event = auth_record(line.strip())
            if event:
                seen_with["accounts"].update(a.lower() for a in [auth_actor(event)[1]] if a)
            elif rec:
                seen_with["ids in requests (accounts, documents, chats)"].update(
                    u.lower() for u in UUID.findall(rec["target"]))
            seen_with["emails"].update(e.lower() for e in EMAIL.findall(hay))
    hits.sort(key=lambda h: h[0])
    show = (lambda s: s) if a.raw else scrub.line

    left_out = f", {preflights} OPTIONS lines left out (--options shows them)" if preflights else ""
    print(f"# {len(hits)} lines in {len(files)} files{left_out}\n")
    for ts, source, rec, line in hits[:a.max_lines]:
        when = utc(ts) if ts else "(no time)          "
        if a.raw:
            print(f"{when}  {source:<12} {line}")
        elif rec:
            ip = scrub.ip(rec["ip"]) if rec["ip"] else "-"
            what = f"auth:{rec['event']}" if rec["event"] else ua_family(rec["ua"])
            print(f"{when}  {source:<12} {rec['status']} {rec['method']:<6} {path_template(rec['target'])}"
                  f"  [{what}]  {ip}")
        elif auth_record(line.strip()):
            action, account = auth_actor(auth_record(line.strip()))
            print(f"{when}  {source:<12} event  {action}  {scrub.line(account) if account else '-'}")
        else:
            print(f"{when}  {source:<12} {scrubbed_line(scrub, {}, line)[0]}")
    if len(hits) > a.max_lines:
        print(f"… {len(hits) - a.max_lines} more lines (raise --max-lines)")

    statuses = Counter(rec["status"][0] + "xx" for _, _, rec, _ in hits if rec)
    print("\n## Summary")
    print("- by status: " + (", ".join(f"{k} {v}" for k, v in sorted(statuses.items())) or "no request lines"))
    for label, counter in seen_with.items():
        if counter:
            print(f"- {label} on these lines: {len(counter)}: "
                  + ", ".join(f"{show(v)} ({n})" for v, n in counter.most_common(8)))
    if not a.raw:
        print("\nTokens stand in for addresses, account ids and emails; --raw prints the lines as logged.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def command(name, run, help, default_from, max_lines):
        p = sub.add_parser(name, help=help)
        p.add_argument("--env", choices=sorted(NAMESPACE), default="production")
        p.add_argument("--incident", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                       help="folder name under ~/baergpt-incidents (default: today's date, UTC)")
        p.add_argument("--from", dest="start", default=default_from,
                       help="ISO 8601 (UTC unless it has an offset) or an age: 3h, 2d")
        p.add_argument("--to", dest="end", help="same format (default: now)")
        p.add_argument("--max-lines", type=int, default=max_lines, help="stop after this many lines per stream")
        p.add_argument("--raw", action="store_true", help="print addresses and lines as logged")
        p.set_defaults(run=run)
        return p

    p = command("alert", cmd_alert, "replay one alert rule (default window: last 3h)", "3h", 20000)
    p.add_argument("name", help="alert name from the email, e.g. SecurityScriptObtainedSession")

    command("pull", cmd_pull, "export all access-log streams for a window", None, None)

    p = command("actor", cmd_actor, "search the pulled files for one client or account", None, 500)
    p.add_argument("--ip", action="append", help="client address (repeatable)")
    p.add_argument("--user", action="append", help="account id or email (repeatable)")
    p.add_argument("--ua", action="append", help="text from the user agent (repeatable)")
    p.add_argument("--match", action="append", help="any other text, case-insensitive (repeatable)")
    p.add_argument("--options", action="store_true", help="include the OPTIONS requests browsers send before a call")

    p = sub.add_parser("export", help="write a scrubbed copy of everything in raw/ to a separate folder")
    p.add_argument("--incident", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    p.add_argument("--dest", required=True, help="new or empty folder outside the incident folder")
    p.set_defaults(run=cmd_export, start=None, end=None)

    a = ap.parse_args()
    now = int(time.time())
    a.window = bool(a.start or a.end)
    if a.cmd == "pull" and not a.start:
        die("pull needs --from")
    start = parse_time(a.start, now) if a.start else 0
    end = parse_time(a.end, now) if a.end else now
    if start >= end:
        die("--from must be before --to")
    a.run(a, start, end)


if __name__ == "__main__":
    main()
