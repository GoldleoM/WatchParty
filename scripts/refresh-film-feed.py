"""Match popularity rankings to Movies4u listings and collect its latest film releases."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys
import subprocess
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
import requests


OUTPUT = Path(__file__).resolve().parents[1] / "public" / "daily-films.json"
OLA = "https://v6.olamovies.mov"
MOVIES = "https://new8.movies4u.garden"


def get(url):
    response = requests.get(url, timeout=(10, 25))
    response.raise_for_status()
    return response.content


def movie(display, url, image):
    match = re.search(r"\(((?:19|20)\d{2})\)", display)
    if not match or re.search(r"\b(?:season|S\d{1,2}E\d{1,2}|complete series)\b", display, re.I):
        return None
    title = re.sub(r"^Download\s+", "", display[:match.start()], flags=re.I).strip()
    if not title or len(title) > 160 or not url.startswith(MOVIES + "/"):
        return None
    return {"title": title, "year": match[1], "source": "Movies4u", "page": url,
            "image": image if urlparse(image).scheme == "https" else ""}


def normalized(title):
    return re.sub(r"[\W_]+", " ", title.casefold()).strip()


def find_listing(label, hits):
    parts = re.match(r"^(.+?)\s*\(((?:19|20)\d{2})\)", label)
    if not parts:
        return None
    title, year = parts.groups()
    for hit in hits:
        item = movie(hit["title"], hit["url"], hit["image"])
        if item and item["year"] == year and normalized(item["title"]) == normalized(title):
            return item
    return None


def trending():
    soup = BeautifulSoup(get(OLA + "/?sort=trending"), "html.parser")
    labels = [text for a in soup.select('a[href^="/movies/"]') if a.img
              for text in a.stripped_strings if re.search(r"\((?:19|20)\d{2}\)", text)]
    labels = list(dict.fromkeys(labels))[:12]
    searches = [label.split(" (")[0] for label in labels]
    script = Path(__file__).with_name("movies4u-search.mjs")
    run = subprocess.run(["node", str(script)], input=json.dumps(searches), capture_output=True,
                         encoding="utf-8", check=True, timeout=135)
    matches = [find_listing(label, hits) for label, hits in zip(labels, json.loads(run.stdout))]
    return [item for item in matches if item][:6]


def recent():
    soup = BeautifulSoup(get(MOVIES + "/"), "html.parser")
    results = []
    for a in soup.select("article.post a.post-thumbnail[aria-label]"):
        img = a.find("img", src=True)
        item = movie(a["aria-label"], urljoin(MOVIES, a["href"]), img["src"] if img else "")
        if item and item not in results:
            results.append(item)
    return results[:6]


def download_options(item):
    # Keep the publisher's persistent quality chooser. Generated storage URLs expire within hours.
    try:
        soup = BeautifulSoup(get(item["page"]), "html.parser")
        for a in soup.select("a[href]"):
            if "download" in a.get_text(" ", strip=True).lower() and re.fullmatch(
                    r"https://m4ulinks\.xyz/number/\d+/?", a["href"]):
                item["downloadOptions"] = a["href"]
                break
    except requests.RequestException:
        pass
    return item


if __name__ == "__main__":
    data = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {}
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    failed = []
    for key, load in (("trending", trending), ("recent", recent)):
        try:
            items = load()
            if not items:
                raise ValueError("no movie entries")
            with ThreadPoolExecutor(max_workers=3) as pool:
                items = list(pool.map(download_options, items))
            data[key] = {"checkedAt": stamp, "items": items}
            print(f"{key}: {len(items)} movies")
        except (requests.RequestException, subprocess.SubprocessError, KeyError, ValueError) as error:
            print(f"{key}: {error}", file=sys.stderr)
            failed.append(key)
    if set(data) == {"trending", "recent"}:
        OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sys.exit(bool(failed))
