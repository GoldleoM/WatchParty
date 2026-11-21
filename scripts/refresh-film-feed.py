"""Build daily movie listings from the public OlaMovies rankings and UHDMovies RSS."""
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys
from urllib.parse import urljoin, urlparse, parse_qs
import xml.etree.ElementTree as ET

from bs4 import BeautifulSoup
import requests


OUTPUT = Path(__file__).resolve().parents[1] / "public" / "daily-films.json"
OLA = "https://v6.olamovies.mov"
UHD = "https://uhdmovies.ceo"


def get(url):
    response = requests.get(url, timeout=(10, 25))
    response.raise_for_status()
    return response.content


def movie(display, source, url, image):
    match = re.search(r"\(((?:19|20)\d{2})\)", display)
    if not match or re.search(r"\b(?:season|S\d{1,2}E\d{1,2}|complete series)\b", display, re.I):
        return None
    title = re.sub(r"^Download\s+", "", display[:match.start()], flags=re.I).strip()
    if not title or len(title) > 160 or urlparse(url).scheme != "https":
        return None
    return {"title": title, "year": match[1], "source": source, "page": url,
            "image": image if urlparse(image).scheme == "https" else ""}


def trending():
    soup = BeautifulSoup(get(OLA + "/?sort=trending"), "html.parser")
    results = []
    for anchor in soup.select('a[href^="/movies/"]'):
        img = anchor.find("img")
        if not img:
            continue
        label = next((text for text in anchor.stripped_strings if re.search(r"\((?:19|20)\d{2}\)", text)), "")
        src = urljoin(OLA, img.get("src", ""))
        image = parse_qs(urlparse(src).query).get("url", [src])[0]
        item = movie(label, "OlaMovies", urljoin(OLA, anchor["href"]), image)
        if item and item not in results:
            results.append(item)
    return results[:6]


def recent():
    root = ET.fromstring(get(UHD + "/feed/"))
    results = []
    for node in root.findall("channel/item"):
        categories = [c.text or "" for c in node.findall("category")]
        if any(re.search(r"\b(series|TV shows)\b", c, re.I) for c in categories):
            continue
        content = node.findtext("{http://purl.org/rss/1.0/modules/content/}encoded") or ""
        img = BeautifulSoup(content, "html.parser").find("img", src=True)
        link = node.findtext("link") or ""
        if urlparse(link).hostname != urlparse(UHD).hostname:
            continue
        item = movie(node.findtext("title") or "", "UHDMovies", link, img["src"] if img else "")
        if item and item not in results:
            results.append(item)
    return results[:6]


if __name__ == "__main__":
    data = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {}
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    failed = []
    for key, load in (("trending", trending), ("recent", recent)):
        try:
            items = load()
            if not items:
                raise ValueError("no movie entries")
            data[key] = {"checkedAt": stamp, "items": items}
            print(f"{key}: {len(items)} movies")
        except (requests.RequestException, ET.ParseError, ValueError) as error:
            print(f"{key}: {error}", file=sys.stderr)
            failed.append(key)
    if set(data) == {"trending", "recent"}:
        OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sys.exit(bool(failed))
