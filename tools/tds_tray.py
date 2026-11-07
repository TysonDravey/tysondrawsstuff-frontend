"""
TysonDrawsStuff — Railway Tray

A streamlined publish manager for the Railway workflow. It sits in the Windows
system tray. The old publish-manager.py (local Strapi + Cloudflare tunnel) is
left exactly as it was and keeps working on its own.

New workflow (content only, no git needed):
    edit in Strapi on Railway  ->  Deploy Preview  ->  check it  ->  Publish Live

Strapi on Railway sleeps when idle to keep the bill near $0. Anything that
talks to it wakes it, so this app NEVER pings Strapi in the background. It
only wakes Strapi when you ask (Wake / Open Admin / a deploy), and waits for
it to be healthy before triggering a Vercel build. If it didn't, the build's
prebuild step could time out against a sleeping server.

Config lives in frontend/.env.railway (git-ignored). It never reads or writes
the tunnel settings (.publish-manager.json) or the Vercel env vars. Missing
VERCEL_* keys fall back to frontend/.env.local (read only).

Run with:
    tools\\venv\\Scripts\\pythonw.exe tools\\tds_tray.py   <- no console
    tools\\venv\\Scripts\\python.exe  tools\\tds_tray.py   <- with console (debugging)
or double-click tools\\start_tds_tray.bat
"""

import ctypes
import json
import shutil
import subprocess
import sys
import threading
import time
import webbrowser
import winreg
from datetime import datetime, timezone
from pathlib import Path

import pystray
import requests
from PIL import Image, ImageDraw

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

TOOLS_DIR    = Path(__file__).parent.resolve()
FRONTEND_DIR = TOOLS_DIR.parent
BACKEND_DIR  = FRONTEND_DIR.parent / "backend"   # linked to the Railway project via `railway link`
CONFIG_FILE  = FRONTEND_DIR / ".env.railway"
FALLBACK_ENV = FRONTEND_DIR / ".env.local"
LOG_FILE     = TOOLS_DIR / "tds-tray.log"
ICON_FILE    = FRONTEND_DIR / "src" / "app" / "favicon.ico"
LAUNCHER     = TOOLS_DIR / "start_tds_tray.bat"

NO_WINDOW = subprocess.CREATE_NO_WINDOW

CONFIG_TEMPLATE = """\
# TDS Railway tray config. Git-ignored (frontend/.gitignore has .env*).
# Missing VERCEL_* keys are read from .env.local instead.

# Railway Strapi public URL, no trailing slash, e.g. https://tds-strapi.up.railway.app
RAILWAY_STRAPI_URL=

# Railway project dashboard (for the "Railway Dashboard" menu item)
RAILWAY_DASHBOARD_URL=https://railway.com/dashboard

# Vercel branch whose builds read from Railway (branch-scoped env vars in Vercel)
PREVIEW_BRANCH=railway-preview
# Vercel -> Settings -> Git -> Deploy Hooks, hook for PREVIEW_BRANCH
VERCEL_DEPLOY_HOOK_RAILWAY_PREVIEW=
# URL of that branch's preview site
PREVIEW_SITE_URL=

# Leave false until the live site's NEXT_PUBLIC_STRAPI_URL points at Railway.
# While false, "Publish Live" is disabled so this app can't touch production.
LIVE_ON_RAILWAY=false
LIVE_SITE_URL=https://www.tysondrawsstuff.com
"""

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


def _read_env(path: Path) -> dict:
    env: dict = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def load_config() -> dict:
    if not CONFIG_FILE.exists():
        CONFIG_FILE.write_text(CONFIG_TEMPLATE, encoding="utf-8")
    fallback = _read_env(FALLBACK_ENV)
    cfg = _read_env(CONFIG_FILE)
    # Only borrow Vercel API access + the production hook from .env.local, never the Strapi URL/token
    for key in ("VERCEL_TOKEN", "VERCEL_PROJECT_ID", "VERCEL_TEAM_ID", "VERCEL_DEPLOY_HOOK_PRODUCTION"):
        if not cfg.get(key) and fallback.get(key):
            cfg[key] = fallback[key]
    cfg["RAILWAY_STRAPI_URL"] = cfg.get("RAILWAY_STRAPI_URL", "").rstrip("/")
    cfg.setdefault("PREVIEW_BRANCH", "railway-preview")
    cfg.setdefault("LIVE_SITE_URL", "https://www.tysondrawsstuff.com")
    return cfg


CFG = load_config()


def live_enabled() -> bool:
    return CFG.get("LIVE_ON_RAILWAY", "false").lower() == "true"


# ---------------------------------------------------------------------------
# Logging + dialogs
# ---------------------------------------------------------------------------


def log(msg: str) -> None:
    line = f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {msg}"
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass
    if sys.stdout:
        print(line)


MB_YESNO, MB_ICONWARNING, MB_ICONINFO, MB_TOPMOST, IDYES = 0x04, 0x30, 0x40, 0x40000, 6


def confirm(title: str, text: str) -> bool:
    return ctypes.windll.user32.MessageBoxW(0, text, title, MB_YESNO | MB_ICONWARNING | MB_TOPMOST) == IDYES


def info_box(title: str, text: str) -> None:
    ctypes.windll.user32.MessageBoxW(0, text, title, MB_ICONINFO | MB_TOPMOST)


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

_state = {
    "strapi": "not checked",   # not checked | waking… | awake | unreachable | not configured
    "strapi_checked": None,    # datetime of last successful health check
    "deploy": "idle",          # short text for the last deploy
    "busy": False,             # a wake/deploy is in progress
    "railway": None,           # instance status from Railway's API (RUNNING, SLEEPING, …) or None if unknown
}
_lock = threading.Lock()
_icon: pystray.Icon = None  # set in main()


def _set(**kw) -> None:
    _state.update(kw)
    _refresh()


# ---------------------------------------------------------------------------
# Strapi on Railway
# ---------------------------------------------------------------------------


def strapi_healthy(timeout: float = 10) -> bool:
    url = CFG["RAILWAY_STRAPI_URL"]
    if not url:
        return False
    try:
        r = requests.get(f"{url}/_health", timeout=timeout)
        return r.status_code in (200, 204)
    except Exception:
        return False


def wake_strapi(max_wait: int = 240) -> bool:
    """Wake Strapi and wait until /_health passes. Returns True when it's up."""
    if not CFG["RAILWAY_STRAPI_URL"]:
        _set(strapi="not configured")
        notify("Set RAILWAY_STRAPI_URL in frontend/.env.railway first.")
        return False
    _set(strapi="waking…")
    log("Waking Railway Strapi…")
    deadline = time.time() + max_wait
    while time.time() < deadline:
        if strapi_healthy(timeout=30):
            _set(strapi="awake", strapi_checked=datetime.now())
            log("Strapi is awake.")
            return True
        time.sleep(5)
    _set(strapi="unreachable")
    log(f"Strapi did not come up within {max_wait}s.")
    return False


def railway_instance_status() -> str | None:
    """Ask Railway's API (via the CLI) whether the service is running or asleep.
    This never touches Strapi itself, so it doesn't wake it."""
    exe = shutil.which("railway")
    if not exe or not BACKEND_DIR.exists():
        return None
    try:
        out = subprocess.run(
            [exe, "status", "--json"], cwd=str(BACKEND_DIR), capture_output=True,
            text=True, timeout=30, creationflags=NO_WINDOW,
        ).stdout
        data = json.loads(out[out.index("{"):])
        for env in data["environments"]["edges"]:
            for si in env["node"]["serviceInstances"]["edges"]:
                instances = (si["node"].get("latestDeployment") or {}).get("instances") or []
                return instances[0]["status"] if instances else "SLEEPING"
    except Exception as e:
        log(f"Railway status check failed: {e}")
    return None


def _railway_poll_loop() -> None:
    while True:
        status = railway_instance_status()
        if status != _state["railway"]:
            if status:
                log(f"Railway reports Strapi {status.lower()}.")
            _state["railway"] = status
            if status and status != "RUNNING" and _state["strapi"] == "awake":
                _state["strapi"] = "asleep"
            _refresh()
        time.sleep(60)


# ---------------------------------------------------------------------------
# Vercel
# ---------------------------------------------------------------------------


def _vercel_get(path: str, params: dict) -> dict:
    if CFG.get("VERCEL_TEAM_ID"):
        params["teamId"] = CFG["VERCEL_TEAM_ID"]
    r = requests.get(
        f"https://api.vercel.com{path}",
        params=params,
        headers={"Authorization": f"Bearer {CFG['VERCEL_TOKEN']}"},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


def watch_deployment(branch: str, started_ms: int, label: str) -> None:
    """Poll Vercel until the build for `branch` started after `started_ms` finishes."""
    if not (CFG.get("VERCEL_TOKEN") and CFG.get("VERCEL_PROJECT_ID")):
        _set(deploy=f"{label}: triggered (no VERCEL_TOKEN to watch it)")
        return
    deadline = time.time() + 20 * 60
    seen = None
    while time.time() < deadline:
        time.sleep(15)
        try:
            data = _vercel_get("/v6/deployments", {"projectId": CFG["VERCEL_PROJECT_ID"], "limit": 10})
        except Exception as e:
            log(f"Vercel poll failed: {e}")
            continue
        for d in data.get("deployments", []):
            if d.get("meta", {}).get("githubCommitRef") != branch or d.get("created", 0) < started_ms - 5000:
                continue
            seen = d
            state = d.get("state") or d.get("readyState")
            if state == "READY":
                _set(deploy=f"{label}: ready {datetime.now():%H:%M}")
                notify(f"{label} build is ready.")
                log(f"{label} READY: https://{d.get('url')}")
                return
            if state in ("ERROR", "CANCELED"):
                _set(deploy=f"{label}: {state.lower()} {datetime.now():%H:%M}")
                notify(f"{label} build {state.lower()}. Check Vercel.")
                log(f"{label} {state}: https://{d.get('url')}")
                return
            _set(deploy=f"{label}: building…")
            break
    _set(deploy=f"{label}: {'still building' if seen else 'not seen'} after 20 min")


def run_deploy(hook_key: str, branch: str, label: str) -> None:
    hook = CFG.get(hook_key)
    if not hook:
        notify(f"Set {hook_key} in frontend/.env.railway first.")
        return
    with _lock:
        if _state["busy"]:
            notify("Something is already running.")
            return
        _state["busy"] = True
    try:
        _set(deploy=f"{label}: waking Strapi…")
        if not wake_strapi():
            _set(deploy=f"{label}: cancelled (Strapi down)")
            notify("Strapi didn't wake up, so nothing was deployed.")
            return
        started_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        r = requests.post(hook, timeout=15)
        if r.status_code not in (200, 201, 202):
            _set(deploy=f"{label}: hook failed ({r.status_code})")
            log(f"{label} hook HTTP {r.status_code}: {r.text[:300]}")
            notify(f"{label} hook failed: HTTP {r.status_code}")
            return
        log(f"{label} build triggered for branch {branch}.")
        _set(deploy=f"{label}: building…")
        notify(f"{label} build started.")
        watch_deployment(branch, started_ms, label)
    except Exception as e:
        _set(deploy=f"{label}: error")
        log(f"{label} error: {e}")
        notify(f"{label} error: {e}")
    finally:
        _state["busy"] = False
        _refresh()


# ---------------------------------------------------------------------------
# Icon
# ---------------------------------------------------------------------------


def _load_icon(dot: tuple) -> Image.Image:
    """The site logo with a big status dot in the bottom-right corner.
    (The favicon is opaque, so a background colour wouldn't show.)"""
    size = 64
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if ICON_FILE.exists():
        logo = Image.open(ICON_FILE).convert("RGBA").resize((size, size), Image.LANCZOS)
        canvas.paste(logo, (0, 0), mask=logo.split()[3])
    d = ImageDraw.Draw(canvas)
    r0 = 30  # dot covers the lower-right ~half so it reads at 16px tray size
    d.ellipse((r0 - 3, r0 - 3, size - 1, size - 1), fill=(0, 0, 0, 255))   # dark ring for contrast
    d.ellipse((r0, r0, size - 4, size - 4), fill=dot + (255,))
    return canvas


_ICONS = {
    "idle":  _load_icon((140, 140, 140)),  # grey  — asleep / not checked
    "awake": _load_icon((40, 200, 80)),    # green — Strapi awake
    "busy":  _load_icon((245, 170, 30)),   # amber — waking / building
    "error": _load_icon((220, 40, 40)),    # red   — unreachable / failed
}


def _current_icon() -> Image.Image:
    s, d = _state["strapi"], _state["deploy"]
    if s == "unreachable" or "fail" in d or "error" in d:
        return _ICONS["error"]
    if _state["busy"] or s == "waking…" or "building" in d:
        return _ICONS["busy"]
    if s == "awake" or _state["railway"] == "RUNNING":
        return _ICONS["awake"]
    return _ICONS["idle"]


def _strapi_label() -> str:
    s, r = _state["strapi"], _state["railway"]
    if s in ("waking…", "unreachable", "not configured"):
        return s
    if r == "RUNNING":
        return "awake (sleeps after ~10 min idle)"
    if r:
        return "asleep (wakes automatically when used)" if r == "SLEEPING" else r.lower()
    if s == "awake" and _state["strapi_checked"]:
        return f"awake at {_state['strapi_checked']:%H:%M}"
    return s


def _refresh() -> None:
    if _icon is None:
        return
    _icon.icon = _current_icon()
    _icon.title = f"TDS Railway | Strapi: {_strapi_label()} | {_state['deploy']}"[:127]
    _icon.update_menu()


def notify(msg: str) -> None:
    log(msg)
    try:
        if _icon is not None:
            _icon.notify(msg, "TysonDrawsStuff")
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Start at login
# ---------------------------------------------------------------------------

_REG_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
_REG_NAME = "TDSRailwayTray"


def is_startup_enabled() -> bool:
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, _REG_KEY)
        winreg.QueryValueEx(key, _REG_NAME)
        winreg.CloseKey(key)
        return True
    except FileNotFoundError:
        return False


def _set_startup(enabled: bool) -> None:
    key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, _REG_KEY, 0, winreg.KEY_SET_VALUE)
    if enabled:
        winreg.SetValueEx(key, _REG_NAME, 0, winreg.REG_SZ, f'"{LAUNCHER}"')
    else:
        try:
            winreg.DeleteValue(key, _REG_NAME)
        except FileNotFoundError:
            pass
    winreg.CloseKey(key)


# ---------------------------------------------------------------------------
# Menu actions
# ---------------------------------------------------------------------------


def _bg(fn, *args):
    threading.Thread(target=fn, args=args, daemon=True).start()


def action_wake(icon, item):
    def go():
        if wake_strapi():
            notify("Strapi is awake.")
        else:
            notify("Strapi didn't respond. Check the Railway dashboard.")
    _bg(go)


def action_open_admin(icon, item):
    url = CFG["RAILWAY_STRAPI_URL"]
    if not url:
        notify("Set RAILWAY_STRAPI_URL in frontend/.env.railway first.")
        return
    webbrowser.open(f"{url}/admin")  # Railway holds the request while it wakes
    _bg(wake_strapi)


def action_deploy_preview(icon, item):
    _bg(run_deploy, "VERCEL_DEPLOY_HOOK_RAILWAY_PREVIEW", CFG["PREVIEW_BRANCH"], "Preview")


def action_publish_live(icon, item):
    if not live_enabled():
        info_box(
            "Publish Live is off",
            "The live site still reads from the local Strapi tunnel.\n\n"
            "Use the old Publish Manager for live deploys until the switch-over, "
            "then set LIVE_ON_RAILWAY=true in frontend/.env.railway.",
        )
        return
    if not confirm(
        "Publish to LIVE site",
        "This rebuilds tysondrawsstuff.com from the current Railway content "
        "(main branch).\n\nDid the preview look right?",
    ):
        return
    _bg(run_deploy, "VERCEL_DEPLOY_HOOK_PRODUCTION", "main", "Live")


def action_open_preview(icon, item):
    url = CFG.get("PREVIEW_SITE_URL")
    if url:
        webbrowser.open(url)
    else:
        notify("Set PREVIEW_SITE_URL in frontend/.env.railway first.")


def action_open_live(icon, item):
    webbrowser.open(CFG["LIVE_SITE_URL"])


def action_open_vercel(icon, item):
    webbrowser.open("https://vercel.com/dashboard")


def action_open_railway(icon, item):
    webbrowser.open(CFG.get("RAILWAY_DASHBOARD_URL") or "https://railway.com/dashboard")


def action_edit_config(icon, item):
    subprocess.Popen(["notepad.exe", str(CONFIG_FILE)], creationflags=NO_WINDOW)


def action_view_log(icon, item):
    npp = Path(r"C:\Program Files\Notepad++\notepad++.exe")
    LOG_FILE.touch(exist_ok=True)
    subprocess.Popen([str(npp) if npp.exists() else "notepad.exe", str(LOG_FILE)], creationflags=NO_WINDOW)


def action_toggle_startup(icon, item):
    _set_startup(not is_startup_enabled())
    _refresh()


def action_quit(icon, item):
    icon.stop()


def _fresh(action):
    """Re-read .env.railway before every click, so edits apply without a restart."""
    def wrapped(icon, item):
        global CFG
        try:
            CFG = load_config()
        except Exception as e:
            log(f"Config read failed, keeping the previous one: {e}")
        return action(icon, item)
    return wrapped


def build_menu() -> pystray.Menu:
    S = pystray.Menu.SEPARATOR

    def M(text, action=None, **kw):
        if action is not None and not isinstance(action, pystray.Menu):
            action = _fresh(action)
        return pystray.MenuItem(text, action, **kw)

    return pystray.Menu(
        M(lambda i: f"  Strapi   {_strapi_label()}", None, enabled=False),
        M(lambda i: f"  Deploy   {_state['deploy']}", None, enabled=False),
        S,
        M("✏️  Open Strapi Admin", action_open_admin, default=True),
        M("⏰  Wake Strapi", action_wake, enabled=lambda i: not _state["busy"]),
        S,
        M("🔍  Deploy Preview", action_deploy_preview, enabled=lambda i: not _state["busy"]),
        M("👀  Open Preview Site", action_open_preview),
        S,
        M(lambda i: "🚀  Publish Live" if live_enabled() else "🚀  Publish Live (off until switch-over)",
          action_publish_live, enabled=lambda i: not _state["busy"]),
        M("🌐  Open Live Site", action_open_live),
        S,
        M("More", pystray.Menu(
            M("Vercel Dashboard", action_open_vercel),
            M("Railway Dashboard", action_open_railway),
            S,
            M("Edit Config (.env.railway)", action_edit_config),
            M("View Log", action_view_log),
        )),
        M(lambda i: f"{'☑' if is_startup_enabled() else '☐'}  Start at Login", action_toggle_startup),
        S,
        M("✖  Quit", action_quit),
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def _single_instance() -> bool:
    """Named mutex so a second launch doesn't add a second tray icon."""
    ctypes.windll.kernel32.CreateMutexW(None, False, "TDSRailwayTrayMutex")
    return ctypes.windll.kernel32.GetLastError() != 183  # ERROR_ALREADY_EXISTS


def main():
    global _icon
    if not _single_instance():
        return
    if not CFG["RAILWAY_STRAPI_URL"]:
        _state["strapi"] = "not configured"
    _icon = pystray.Icon("TDSRailway", _current_icon(), "TDS Railway", build_menu())
    log("Tray started.")
    threading.Thread(target=_railway_poll_loop, daemon=True, name="railway-status").start()
    _icon.run(setup=lambda icon: (setattr(icon, "visible", True), _refresh()))


if __name__ == "__main__":
    main()
