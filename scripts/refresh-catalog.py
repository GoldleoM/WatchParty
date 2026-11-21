"""Index Movies4u's public catalog pages and the publisher's stable release choices."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys
from urllib.parse import urljoin

from bs4 import BeautifulSoup, SoupStrainer
import requests

ROOT = "https://new8.movies4u.garden/"
PUBLIC = Path(__file__).resolve().parents[1] / "public"
INDEX = PUBLIC / "movie-catalog.json"
RELEASES = PUBLIC / "movie-releases.json"
NUMBER = re.compile(r"https://m4ulinks\.xyz/number/\d+/?$")
DRIVE = re.compile(r"https://hubcloud\.(?:mov|one|lol|foo|art)/drive/[\w-]+/?$")
QUALITY = re.compile(r"\b(?:2160p|1080p|720p|540p|480p|360p|4K)\b", re.I)
SERIES = re.compile(r"\b(?:season|series|episodes?|S\d{1,2}E\d{1,3})\b", re.I)
HEADINGS = ["h2", "h3", "h4", "h5", "h6"]


def soup(url, only=None):
    response = requests.get(url, timeout=(6, 14))
    response.raise_for_status()
    return BeautifulSoup(response.content, "html.parser", parse_only=only)


def page(number):
    doc = soup(ROOT if number == 1 else f"{ROOT}page/{number}/", SoupStrainer("article"))
    rows = {}
    for a in doc.select("a.post-thumbnail[aria-label][href]"):
        href = urljoin(ROOT, a["href"])
        slug = href.removeprefix(ROOT).strip("/")
        if not href.startswith(ROOT) or not re.fullmatch(r"[\w%-]+", slug):
            continue
        label = a["aria-label"].strip()
        year = re.search(r"\(((?:19|20)\d\d)\)", label)
        title = re.split(r"\s*[\[(](?:19\d\d|20\d\d|season\b|S\d|Ep\b)|\s+Season\s+\d", label, maxsplit=1, flags=re.I)[0]
        rows[slug] = {"id": slug, "title": title[:180], "year": year[1] if year else "",
                      "kind": "Series" if SERIES.search(label) else "Movie"}
    if not rows:
        raise ValueError(f"no catalog entries on page {number}")
    return rows


def choices(item):
    doc = soup(ROOT + item["id"] + "/")
    groups = {}
    editions = {}
    for a in doc.find_all("a", href=NUMBER):
        label = a.get_text(" ", strip=True)
        h = a.find_previous(HEADINGS)
        context = h.get_text(" ", strip=True) if h else ""
        if re.search(r"\b(?:zip|batch|pack)\b", label + " " + context, re.I):
            continue
        groups.setdefault(a["href"], context)
    for url, context in groups.items():
        season = re.search(r"\b(?:Season\s*|S)(\d+)\b", context, re.I)
        context_quality = QUALITY.search(context)
        for a in soup(url).find_all("a", href=DRIVE):
            if not re.search(r"Hub[-\s]*Cloud\s*\[DD\]", a.get_text(" ", strip=True), re.I):
                continue
            h = a.find_previous(HEADINGS)
            label = h.get_text(" ", strip=True) if h else ""
            episode = re.search(r"(?:Episodes?|\bEp|S\d+E)[\s.:#-]*(\d+)", label, re.I)
            if item["kind"] == "Series" and not episode:
                continue
            if re.search(r"\b(?:zip|batch|pack)\b", label, re.I):
                continue
            q = QUALITY.search(label)
            quality = label[q.start():] if q else context[context_quality.start():] if context_quality else ""
            editions[a["href"]] = {"quality": quality[:110] or "Original file", "hub": a["href"],
                                   "season": int(season[1]) if season and episode else None,
                                   "episode": int(episode[1]) if episode else None}
    return {"groups": list(groups), "editions": list(editions.values())}


def load(path):
    return json.loads(path.read_text(encoding="utf8")) if path.exists() else {}


def save(path, value):
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf8")
    temp.replace(path)


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pages", type=int, default=8)
    parser.add_argument("--details", type=int, default=24)
    parser.add_argument("--full", action="store_true")
    args = parser.parse_args()
    last_page = args.pages
    if args.full:
        nav = soup(ROOT, SoupStrainer("a"))
        last_page = max(int(m[1]) for a in nav.find_all("a", href=True)
                        if (m := re.fullmatch(re.escape(ROOT) + r"page/(\d+)/?", a["href"])))
    previous = load(INDEX)
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rows = {}
    errors = []

    def read_page(n):
        try:
            return page(n)
        except (requests.RequestException, ValueError) as exc:
            errors.append(n)
            print(f"Page {n}: {type(exc).__name__}", file=sys.stderr)
            return {}

    with ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(read_page, range(1, last_page + 1)):
            rows.update(result)
    if not rows:
        raise RuntimeError("No catalog pages received")
    older = previous.get("items", []) if errors or not args.full else []
    for item in older:
        rows.setdefault(item["id"], item)
    save(INDEX, {"updated": stamp, "items": list(rows.values())})
    print(f"Indexed {len(rows)} movies and series", flush=True)
    if not args.details:
        return
    releases = load(RELEASES).get("items", {})
    daily = load(PUBLIC / "daily-films.json")
    picks = [item["page"].removeprefix(ROOT).strip("/") for batch in daily.values() for item in batch["items"]]
    ids = list(dict.fromkeys(list(rows)[:12] + picks + [key for key in rows if key not in releases]))[:args.details]

    def read_choices(key):
        if key not in rows:
            return
        try:
            releases[key] = choices(rows[key])
        except (ValueError, requests.RequestException) as exc:
            print(f"Release {key}: {type(exc).__name__}", file=sys.stderr)

    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(read_choices, ids))
    save(RELEASES, {"updated": stamp, "items": {k: v for k, v in releases.items() if k in rows}})
    print(f"Release records: {len(releases)}")


if __name__ == "__main__":
    run()
