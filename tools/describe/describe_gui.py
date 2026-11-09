"""
Description editor for Tyson Draws Stuff products (Strapi on Railway).

Pick a product on the left: see its photo, the current description, and a proposed one built from simple
fields (your story line, a plain "Pictured:" sentence, medium, size, framing, year). Edit anything, then
Save to Strapi. The site changes after a rebuild (tray: Deploy Preview, then Publish Live).

    tools\\venv\\Scripts\\pythonw tools\\describe\\describe_gui.py      (or double-click start_describe.bat)

Proposed "Pictured:" lines and typo suggestions come from proposals.json (written by Claude with /describe,
after looking at each photo). Year hints come from ig_hints.json (made by ig_years.py from your Instagram
data download). Neither is required.
"""
from __future__ import annotations

import difflib
import json
import queue
import re
import sys
import threading
import time
import tkinter as tk
import webbrowser
from pathlib import Path
from tkinter import messagebox, ttk

from PIL import Image, ImageTk

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import strapi_desc as sd  # noqa: E402

PROPOSALS = HERE / "proposals.json"
HINTS = HERE / "ig_hints.json"
PROGRESS = HERE / "progress.json"
SITE = "https://www.tysondrawsstuff.com/shop/"

# ---------------------------------------------------------------------------- parsing (mirrors src/lib/display.ts)

SIZE = re.compile(r"(\d+(?:\.\d+)?)\s*[\"”″']?\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*[\"”″'])?", re.I)
YEAR = re.compile(r"^\(?(?:year\s*:?\s*|(?:made|painted|drawn|created)\s+(?:in\s+)?|c\.?\s*|circa\s+|~\s*)?"
                  r"((?:19|20)\d{2})\)?\.?$", re.I)
SPEC = re.compile(r"\d+\s*[\"”″]?\s*[x×]\s*\d+|acrylic|ink\b|watercolou?r|canvas|paper|mixed media|multi media|"
                  r"pastel|\boil\b|gouache|frame|painting|pigment|^(?:(?:made|painted|drawn)\s+(?:in\s+)?)?"
                  r"(?:19|20)\d{2}$", re.I)
PICTURED = re.compile(r"^pictured\s*:\s*", re.I)


def clean(t: str) -> str:
    return re.sub(r"[ \t]+", " ", t.replace("&nbsp;", " ").replace("**Bold**", "")).strip()


def pretty_size(t: str) -> str:
    return re.sub(r"″(?=\w)", "″ ", SIZE.sub(lambda m: f"{m.group(1)} × {m.group(2)}″", t)).strip()


def tidy_medium(t: str) -> str:
    t = re.sub(r"^this is\s+", "", t.strip().rstrip("."), flags=re.I)
    t = re.sub(r"\bacrylic paint(ing)?\b", "Acrylic", t, flags=re.I)
    t = re.sub(r"\bmulti[- ]?media\b", "Mixed media", t, flags=re.I)
    t = t.lower()
    t = t[:1].upper() + t[1:]
    return t.replace("watercolor", "watercolour")


def parse(desc: str) -> dict:
    """Current description -> fields. Unrecognised spec lines go to `extra`."""
    f = {"story": "", "pictured": "", "medium": "", "size": "", "framing": "", "year": "", "extra": ""}
    story, extra = [], []
    lines = [clean(l) for l in (desc or "").replace("\r", "").split("\n")]
    lines = [l for l in lines if l]
    for i, line in enumerate(lines):
        if i > 0 and YEAR.match(line):
            f["year"] = YEAR.match(line).group(1)
        elif PICTURED.match(line):
            f["pictured"] = PICTURED.sub("", line)
        elif i > 0 and SPEC.search(line):
            # "This is acrylic paint on canvas. 30x40" -> two parts
            for part in re.split(r"\.\s+(?=\d)", line):
                part = part.strip().rstrip(".")
                if not part:
                    continue
                y = YEAR.match(part)
                if y:
                    f["year"] = y.group(1)
                    continue
                if re.search(r"frame", part, re.I):
                    part = pretty_size(part)
                    if not f["framing"]:
                        f["framing"] = part[:1].upper() + part[1:]
                    else:
                        extra.append(part)
                    continue
                sizes = [f"{a} × {b}″" for a, b in SIZE.findall(part)]
                rest = SIZE.sub(" ", part).strip(" .,-")
                if sizes and " / ".join(sizes) not in f["size"]:  # same size repeated on another line
                    f["size"] = " / ".join(([f["size"]] if f["size"] else []) + sizes)
                if not rest:
                    continue
                med = tidy_medium(rest)
                if not f["medium"]:
                    f["medium"] = med
                elif med.lower() != f["medium"].lower():
                    extra.append(rest)
        else:
            story.append(line)
    f["story"] = " ".join(story)
    f["extra"] = "\n".join(extra)
    return f


def build(f: dict) -> str:
    out = [f["story"].strip()]
    if f["pictured"].strip():
        out += ["", "Pictured: " + f["pictured"].strip()]
    specs = [f["medium"], f["size"].replace(" / ", "\n"), f["extra"], f["framing"],
             "" if f["year"].strip().lower() == "skip" else f["year"]]
    specs = [l.strip() for s in specs for l in s.split("\n") if l.strip()]
    if specs:
        out += [""] + specs
    return "\n".join(out).strip()


def missing(f: dict) -> list[str]:
    need = []
    if not f["pictured"].strip():
        need.append("Pictured line")
    if not f["framing"].strip():
        need.append("framing")
    if not f["year"].strip():
        need.append("year (or 'skip')")
    if not f["medium"].strip():
        need.append("medium")
    if not f["size"].strip():
        need.append("size")
    return need


BANNED = re.compile(r"\b(stunning|striking|evocative|haunting|captivating|masterful|masterpiece|vibrant|bold|"
                    r"whimsical|mesmeri[sz]ing|explores?|exploration|invites? the viewer|celebrates?|journey|vision|"
                    r"unique|one[- ]of[- ]a[- ]kind|talented|genius|breathtaking|beautiful|gorgeous|evokes?|"
                    r"masterfully|expertly|exquisite|ominous|eerie|moody|dreamy|enchanting|mysterious)\b", re.I)
# Names that get fan art flagged on Etsy/Meta. Describe what's visible instead.
FRANCHISE = re.compile(r"\b(batman|joker|harley|quinn|gotham|catwoman|robin|mandalorian|grogu|star wars|jedi|"
                       r"sith|marvel|spider-?man|disney|pok[eé]mon|ghostbusters|alien|xenomorph|nostromo|"
                       r"dungeon crawler|carl|princess donut|lovecraft|cthulhu|vw|volkswagen)\b", re.I)


def check(f: dict, original_story: str) -> list[str]:
    """Problems a person has to decide on (formatting is fixed by parse/build instead)."""
    issues = []
    pic = f["pictured"].strip()
    if pic:
        n = len(pic.split())
        if n > 25:
            issues.append(f"Pictured is {n} words (aim for 25 or fewer)")
        hits = sorted({m.group(0).lower() for m in BANNED.finditer(pic)})
        if hits:
            issues.append("Pictured has praise/mood words: " + ", ".join(hits))
        hits = sorted({m.group(0) for m in FRANCHISE.finditer(pic)})
        if hits:
            issues.append("Pictured names a franchise/brand (Etsy/IP risk): " + ", ".join(hits))
    for key in ("medium", "size", "framing", "extra"):
        hits = sorted({m.group(0).lower() for m in BANNED.finditer(f[key])})
        if hits:
            issues.append(f"{key.capitalize()} has praise words: " + ", ".join(hits))
    y = f["year"].strip()
    if y and y.lower() != "skip" and not re.fullmatch(r"(19|20)\d{2}", y):
        issues.append(f"Year “{y}” isn't a 4-digit year (or 'skip')")
    if f["size"].strip() and re.search(r"\d\s*[x\"]", f["size"].replace("×", "")):
        issues.append("Size still has an x or \" in it; use W × H″")
    if re.search(r"(^|\s)(pictured|story)\s*:", f["story"], re.I):
        issues.append("Story contains a label; check line breaks")
    a, b = original_story.split(), f["story"].split()
    if original_story.strip() and a != b:
        changes = []
        for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b).get_opcodes():
            if op != "equal":
                changes.append(f"“{' '.join(a[i1:i2]) or '+'}” → “{' '.join(b[j1:j2]) or '(removed)'}”")
        issues.append("Story changed (typo fixes only): " + "; ".join(changes[:4])
                      + (" …" if len(changes) > 4 else ""))
    return issues


def load_json(p: Path) -> dict:
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


# ---------------------------------------------------------------------------- window

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("TDS Descriptions")
        self.geometry("1280x860")
        self.minsize(1100, 720)
        self.products: list[dict] = []
        self.shown: list[dict] = []
        self.cur: dict | None = None
        self.manual = False  # proposed text edited by hand
        self.proposals = load_json(PROPOSALS)
        self.hints = load_json(HINTS)
        self.progress = load_json(PROGRESS)
        self.photo = None
        self._q: queue.Queue = queue.Queue()  # background threads hand work to the Tk thread through this
        self._build_ui()
        self._poll()
        self.status("Loading products from Strapi…")
        threading.Thread(target=self._load, daemon=True).start()

    # ---- layout
    def _build_ui(self):
        style = ttk.Style(self)
        style.configure("Big.TButton", font=("Segoe UI", 11, "bold"), padding=6)
        left = ttk.Frame(self, padding=8)
        left.pack(side="left", fill="y")
        self.filter = tk.StringVar(value="Originals needing work")
        cb = ttk.Combobox(left, textvariable=self.filter, state="readonly", width=34,
                          values=["Originals needing work", "Instagram date found", "Needs year, Instagram has one",
                                  "All originals", "Everything live", "Hidden too"])
        cb.pack(fill="x")
        cb.bind("<<ComboboxSelected>>", lambda e: self._fill_list())
        self.search = tk.StringVar()
        ent = ttk.Entry(left, textvariable=self.search)
        ent.pack(fill="x", pady=(6, 6))
        self.search.trace_add("write", lambda *a: self._fill_list())
        self.lb = tk.Listbox(left, width=40, activestyle="none", font=("Segoe UI", 10), exportselection=False)
        self.lb.pack(fill="y", expand=True)
        self.lb.bind("<<ListboxSelect>>", lambda e: self._select())
        self.count = ttk.Label(left, text="")
        self.count.pack(anchor="w", pady=(4, 0))

        right = ttk.Frame(self, padding=8)
        right.pack(side="left", fill="both", expand=True)
        top = ttk.Frame(right)
        top.pack(fill="x")
        self.img = ttk.Label(top)
        self.img.pack(side="left", padx=(0, 12))
        info = ttk.Frame(top)
        info.pack(side="left", fill="both", expand=True)
        self.title_lbl = ttk.Label(info, text="", font=("Segoe UI", 15, "bold"))
        self.title_lbl.pack(anchor="w")
        self.meta_lbl = ttk.Label(info, text="", foreground="#666")
        self.meta_lbl.pack(anchor="w")
        ttk.Button(info, text="Open on site", command=self._open_site).pack(anchor="w", pady=(4, 8))
        self.notes_lbl = ttk.Label(info, text="", foreground="#a05a00", wraplength=620, justify="left")
        self.notes_lbl.pack(anchor="w")
        self.hint_lbl = ttk.Label(info, text="", foreground="#2d6a2d", wraplength=620, justify="left")
        self.hint_lbl.pack(anchor="w", pady=(4, 0))
        self.need_lbl = ttk.Label(info, text="", foreground="#b00020", wraplength=620, justify="left")
        self.need_lbl.pack(anchor="w", pady=(4, 0))

        form = ttk.Frame(right)
        form.pack(fill="x", pady=(10, 6))
        self.vars: dict[str, tk.StringVar] = {}
        rows = [("story", "Story (yours)"), ("pictured", "Pictured:"), ("medium", "Medium on surface"),
                ("size", "Size  (a / b for several)"), ("framing", "Framing"), ("year", "Year")]
        for r, (key, label) in enumerate(rows):
            ttk.Label(form, text=label).grid(row=r, column=0, sticky="w", padx=(0, 8), pady=2)
            v = tk.StringVar()
            self.vars[key] = v
            if key == "framing":
                w = ttk.Combobox(form, textvariable=v, values=["Unframed", "Framed", "Framed in black wood",
                                                                "Framed in natural wood", "Framed in an ornate gold frame"])
            else:
                w = ttk.Entry(form, textvariable=v)
            w.grid(row=r, column=1, sticky="ew", pady=2)
            v.trace_add("write", lambda *a: self._rebuild())
        self.fix_btn = ttk.Button(form, text="Apply typo fix", command=self._apply_fix)
        self.fix_btn.grid(row=0, column=2, padx=(8, 0))
        ttk.Label(form, text="Year: type the year, or 'skip' to leave it out", foreground="#666").grid(
            row=5, column=2, sticky="w", padx=(8, 0))
        form.columnconfigure(1, weight=1)

        texts = ttk.Frame(right)
        texts.pack(fill="both", expand=True)
        lf = ttk.LabelFrame(texts, text="Current (in Strapi)", padding=4)
        lf.pack(side="left", fill="both", expand=True, padx=(0, 6))
        self.cur_txt = tk.Text(lf, wrap="word", height=12, font=("Segoe UI", 10), background="#f4f4f4")
        self.cur_txt.pack(fill="both", expand=True)
        rf = ttk.LabelFrame(texts, text="Proposed (editable)", padding=4)
        rf.pack(side="left", fill="both", expand=True)
        self.new_txt = tk.Text(rf, wrap="word", height=12, font=("Segoe UI", 10), undo=True)
        self.new_txt.pack(fill="both", expand=True)
        self.new_txt.bind("<<Modified>>", self._typed)

        bar = ttk.Frame(right)
        bar.pack(fill="x", pady=(8, 0))
        ttk.Button(bar, text="Save to Strapi", style="Big.TButton", command=self._save).pack(side="left")
        ttk.Button(bar, text="Recheck", command=self._recheck).pack(side="left", padx=(8, 0))
        self.undo_btn = ttk.Button(bar, text="Undo recheck", command=self._undo_recheck, state="disabled")
        self.undo_btn.pack(side="left", padx=(4, 0))
        ttk.Button(bar, text="Rebuild from fields", command=self._reset_manual).pack(side="left", padx=8)
        ttk.Button(bar, text="Next ›", command=self._next).pack(side="left")
        ttk.Button(bar, text="Reload", command=self._reload).pack(side="right")
        self.stat = ttk.Label(self, text="", anchor="w", relief="sunken", padding=4)
        self.stat.pack(side="bottom", fill="x")

    def _poll(self):
        while not self._q.empty():
            self._q.get_nowait()()
        self.after(100, self._poll)

    def status(self, msg: str):
        self.stat.config(text=msg)

    # ---- data
    def _load(self):
        try:
            self.products = sd.products()
        except Exception as e:  # noqa: BLE001
            err = str(e)
            self._q.put(lambda: messagebox.showerror("Strapi", f"Couldn't load products:\n{err}"))
            return
        self._q.put(self._fill_list)
        self._q.put(lambda: self.status(f"{len(self.products)} products loaded."))

    def _reload(self):
        self.proposals, self.hints = load_json(PROPOSALS), load_json(HINTS)
        self.status("Reloading…")
        threading.Thread(target=self._load, daemon=True).start()

    def _fields_for(self, p: dict) -> dict:
        f = parse(p.get("description") or "")
        prop = self.proposals.get(p["slug"], {})
        if not f["pictured"] and prop.get("pictured"):
            f["pictured"] = prop["pictured"]
        return f

    def _fill_list(self):
        mode, q = self.filter.get(), self.search.get().strip().lower()
        out = []
        for p in self.products:
            orig = (p.get("category") or {}).get("name") == "Original Art"
            if mode != "Hidden too" and not p["live"]:
                continue
            if mode in ("Originals needing work", "All originals") and not orig:
                continue
            f = parse(p.get("description") or "")
            if mode == "Originals needing work" and not missing(f) and p["slug"] not in self.progress:
                continue
            if mode == "Originals needing work" and p["slug"] in self.progress:
                continue
            ig = p["slug"] in self.hints
            if mode.startswith(("Instagram", "Needs year")) and not ig:
                continue
            if mode.startswith("Needs year") and f["year"].strip():
                continue
            if q and q not in p["title"].lower() and q not in p["slug"]:
                continue
            out.append(p)
        self.shown = out
        self.lb.delete(0, "end")
        for p in out:
            mark = "✓ " if p["slug"] in self.progress else ("◆ " if p["slug"] in self.proposals else "• ")
            hidden = "" if p["live"] else "  (hidden)"
            h = self.hints.get(p["slug"])
            ig = f"   IG {h['date'][:4]}" if h else ""
            self.lb.insert("end", mark + re.sub(r"\s*-\s*Original Art$", "", p["title"]) + hidden + ig)
        self.count.config(text=f"{len(out)} shown   ✓ saved  ◆ draft ready  • needs a draft   IG = year first "
                               f"posted ({len(self.hints)} found)")

    def _select(self):
        sel = self.lb.curselection()
        if not sel:
            return
        p = self.shown[sel[0]]
        self.cur = p
        self.undo_btn.state(["disabled"])
        self.manual = False
        f = self._fields_for(p)
        self._loading = True
        for k, v in self.vars.items():
            v.set(f[k])
        self._extra = f["extra"]
        self._loading = False
        self.cur_txt.config(state="normal")
        self.cur_txt.delete("1.0", "end")
        self.cur_txt.insert("1.0", p.get("description") or "(empty)")
        self.cur_txt.config(state="disabled")
        self._rebuild(force=True)
        cat = (p.get("category") or {}).get("name", "?")
        sold = "sold" if p.get("sold") else "available"
        self.title_lbl.config(text=re.sub(r"\s*-\s*Original Art$", "", p["title"]))
        self.meta_lbl.config(text=f"{cat} · ${p.get('price')} · {sold} · {'live' if p['live'] else 'HIDDEN'}"
                                  f" · added to site {p.get('createdAt', '')[:7]}")
        prop = self.proposals.get(p["slug"], {})
        self.notes_lbl.config(text=prop.get("notes", "") if prop else
                              "No Claude draft yet for the Pictured line: type one, or ask Claude to /describe this.")
        self.fix_btn.state(["!disabled"] if prop.get("story_fix") else ["disabled"])
        h = self.hints.get(p["slug"])
        self.hint_lbl.config(text=(f"Instagram: first posted {h['date']}"
                                   + (f"  ·  “{h['caption'][:90]}”" if h.get("caption") else "")
                                   + (f"  (match {h['score']})" if h.get("score") else "")) if h else
                             ("No Instagram match yet." if self.hints else ""))
        self.img.config(image="", text="loading photo…")
        threading.Thread(target=self._load_photo, args=(p,), daemon=True).start()

    def _load_photo(self, p):
        try:
            path = sd.photo_path(p)
            im = Image.open(path) if path else None
        except Exception:  # noqa: BLE001
            im = None
        if im is None:
            self._q.put(lambda: self.img.config(text="(no photo)"))
            return
        im.thumbnail((300, 300))

        def show():
            if self.cur is p:
                self.photo = ImageTk.PhotoImage(im)
                self.img.config(image=self.photo, text="")
        self._q.put(show)

    def _fields(self) -> dict:
        f = {k: v.get() for k, v in self.vars.items()}
        f["extra"] = getattr(self, "_extra", "")
        return f

    def _rebuild(self, force=False):
        if getattr(self, "_loading", False) or not self.cur:
            return
        f = self._fields()
        self._show_checks(f)
        if self.manual and not force:
            return
        self._built = build(f)
        self.new_txt.delete("1.0", "end")
        self.new_txt.insert("1.0", self._built)
        self.new_txt.edit_modified(False)
        self.new_txt.edit_reset()

    def _typed(self, _e=None):
        if self.new_txt.edit_modified():
            self.new_txt.edit_modified(False)
            now = self.new_txt.get("1.0", "end").strip()
            self.manual = now != getattr(self, "_built", "").strip()

    def _show_checks(self, f: dict) -> list[str]:
        need = missing(f)
        issues = check(f, parse(self.cur.get("description") or "")["story"])
        lines = (["Still needed: " + ", ".join(need)] if need else []) + ["⚠ " + i for i in issues]
        self.need_lbl.config(text="\n".join(lines) if lines else "✓ Ready to save.",
                             foreground="#b00020" if lines else "#2d6a2d")
        return lines

    def _recheck(self):
        """Read the Proposed box (including hand edits) back into the fields, tidy it, and flag problems."""
        if not self.cur:
            return
        before = self.new_txt.get("1.0", "end").strip()
        f = parse(before)
        self._loading = True
        for k, v in self.vars.items():
            v.set(f[k])
        self._extra = f["extra"]
        self._loading = False
        self.manual = False
        self._rebuild(force=True)
        lines = self._show_checks(f)
        changed = self._built != before
        if changed:
            self._undo = (self.cur, before)
            self.undo_btn.state(["!disabled"])
        tidied = "Tidied the formatting (Undo recheck puts your text back). " if changed else ""
        self.status(tidied + (f"{len(lines)} thing(s) flagged above." if lines else "All good."))

    def _undo_recheck(self):
        cur, text = getattr(self, "_undo", (None, ""))
        if cur is self.cur and text:
            self.new_txt.delete("1.0", "end")
            self.new_txt.insert("1.0", text)
            self.manual = True
            self.status("Put your text back. Edit it, or Recheck again.")
        self.undo_btn.state(["disabled"])

    def _reset_manual(self):
        self.manual = False
        self._rebuild(force=True)

    def _apply_fix(self):
        if self.cur:
            fix = self.proposals.get(self.cur["slug"], {}).get("story_fix")
            if fix:
                self.vars["story"].set(fix)

    def _open_site(self):
        if self.cur:
            webbrowser.open(SITE + self.cur["slug"] + "/")

    def _next(self):
        sel = self.lb.curselection()
        i = (sel[0] + 1) if sel else 0
        if i < self.lb.size():
            self.lb.selection_clear(0, "end")
            self.lb.selection_set(i)
            self.lb.see(i)
            self._select()

    def _save(self):
        p = self.cur
        if not p:
            return
        text = self.new_txt.get("1.0", "end").strip()
        need = missing(self._fields())
        if need and not self.manual and not messagebox.askyesno(
                "Save anyway?", "Still missing: " + ", ".join(need) + ".\n\nSave this text anyway?"):
            return
        if not messagebox.askyesno("Save to Strapi",
                                   f"Save this description to “{p['title']}”"
                                   f"{'' if p['live'] else ' (hidden product, stays hidden)'}?\n\n{text}"):
            return
        self.status("Saving…")
        try:
            saved = sd.update_description(p, text)
        except Exception as e:  # noqa: BLE001
            messagebox.showerror("Save failed", str(e))
            self.status("Save failed.")
            return
        p["description"] = saved
        self.progress[p["slug"]] = time.strftime("%Y-%m-%d %H:%M")
        PROGRESS.write_text(json.dumps(self.progress, indent=2), encoding="utf-8")
        self.status(f"Saved “{p['title']}”. The site updates after Deploy Preview → Publish Live.")
        idx = self.lb.curselection()
        self._fill_list()
        if idx and self.lb.size():
            i = min(idx[0], self.lb.size() - 1)
            self.lb.selection_set(i)
            self.lb.see(i)
            self._select()


if __name__ == "__main__":
    App().mainloop()
