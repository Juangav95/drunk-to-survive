#!/usr/bin/env python3
"""
Drunk to Survive — results fetcher.

Pulls 2026 F1 race + sprint results from the Jolpica-F1 API, computes each
contender's points for the TWO independent contests (Drivers + Teams), and
writes data/results.json for the website to read.

Standard library only — no pip installs needed (runs as-is in GitHub Actions).
"""

import json
import os
import sys
import time
import datetime
import urllib.request
import urllib.error

API_BASE = "https://api.jolpi.ca/ergast/f1"
PAGE_LIMIT = 100  # Jolpica caps page size at 100, so we paginate.

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(ROOT, "data", "config.json")
OUTPUT_PATH = os.path.join(ROOT, "data", "results.json")

# Nicer 3-letter codes for the chart X-axis (keyed by first word of the GP name).
SHORT_OVERRIDES = {
    "Australian": "AUS", "Chinese": "CHN", "Japanese": "JPN", "Bahrain": "BHR",
    "Saudi": "SAU", "Miami": "MIA", "Emilia": "IMO", "Monaco": "MON",
    "Spanish": "ESP", "Canadian": "CAN", "Austrian": "AUT", "British": "GBR",
    "Hungarian": "HUN", "Belgian": "BEL", "Dutch": "NED", "Italian": "ITA",
    "Azerbaijan": "AZE", "Singapore": "SGP", "United": "USA", "Mexico": "MEX",
    "Mexican": "MEX", "Brazilian": "BRA", "Sao": "BRA", "São": "BRA",
    "Las": "LAS", "Qatar": "QAT", "Abu": "ABU",
}


def fetch_json(url, retries=3):
    """GET a URL and parse JSON, with a couple of polite retries."""
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "drunk-to-survive/1.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            last_err = e
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Failed to fetch {url}: {last_err}")


def fetch_all_races(season, kind):
    """
    Fetch every race for a season from a results endpoint, merging the nested
    result rows across paginated responses. `kind` is "results" (Grand Prix) or
    "sprint". Returns an ordered list of race dicts keyed by round.
    """
    races_by_round = {}
    offset = 0
    while True:
        url = f"{API_BASE}/{season}/{kind}/?format=json&limit={PAGE_LIMIT}&offset={offset}"
        data = fetch_json(url)
        mr = data["MRData"]
        page_races = mr["RaceTable"]["Races"]
        result_key = "Results" if kind == "results" else "SprintResults"
        for race in page_races:
            rnd = int(race["round"])
            if rnd not in races_by_round:
                base = {k: v for k, v in race.items() if k != result_key}
                base[result_key] = []
                races_by_round[rnd] = base
            races_by_round[rnd][result_key].extend(race.get(result_key, []))
        total = int(mr["total"])
        offset += PAGE_LIMIT
        if offset >= total:
            break
    return [races_by_round[r] for r in sorted(races_by_round)]


def short_code(race_name):
    first = race_name.split()[0]
    return SHORT_OVERRIDES.get(first, first[:3].upper())


def fetch_total_rounds(season):
    """Total number of rounds scheduled this season (for progress display)."""
    try:
        data = fetch_json(f"{API_BASE}/{season}/races/?format=json&limit=1")
        return int(data["MRData"]["total"])
    except Exception:
        return 0


def points_maps(race, sprint):
    """
    Build {driverId: points} and {constructorId: points} for one weekend,
    summing Grand Prix + Sprint points. Constructor points = sum of that team's
    rows, which equals official constructor scoring.
    """
    drivers, teams = {}, {}

    def add(rows):
        for row in rows:
            did = row["Driver"]["driverId"]
            cid = row["Constructor"]["constructorId"]
            pts = float(row.get("points", 0) or 0)
            drivers[did] = drivers.get(did, 0) + pts
            teams[cid] = teams.get(cid, 0) + pts

    if race:
        add(race.get("Results", []))
    if sprint:
        add(sprint.get("SprintResults", []))
    return drivers, teams


def as_int(x):
    """Points are whole numbers in F1; keep them clean ints."""
    return int(round(x))


def main():
    with open(CONFIG_PATH, encoding="utf-8") as f:
        config = json.load(f)
    season = config["season"]
    contenders = config["contenders"]

    print(f"Fetching {season} race results...")
    race_list = fetch_all_races(season, "results")
    print(f"  {len(race_list)} round(s) with race results.")

    print(f"Fetching {season} sprint results...")
    sprint_list = fetch_all_races(season, "sprint")
    sprint_by_round = {int(s["round"]): s for s in sprint_list}
    print(f"  {len(sprint_list)} sprint round(s).")

    # running cumulative per contender per contest
    cum = {c["id"]: {"drivers": 0, "teams": 0} for c in contenders}
    out_rounds = []

    for race in race_list:
        rnd = int(race["round"])
        if not race.get("Results"):
            continue  # not actually run yet
        sprint = sprint_by_round.get(rnd)
        dmap, tmap = points_maps(race, sprint)

        scores = {}
        for c in contenders:
            d_detail = {p["id"]: as_int(dmap.get(p["id"], 0)) for p in c["drivers"]}
            t_detail = {p["id"]: as_int(tmap.get(p["id"], 0)) for p in c["teams"]}
            d_round = sum(d_detail.values())
            t_round = sum(t_detail.values())
            cum[c["id"]]["drivers"] += d_round
            cum[c["id"]]["teams"] += t_round
            scores[c["id"]] = {
                "drivers": {"round": d_round, "cumulative": cum[c["id"]]["drivers"], "detail": d_detail},
                "teams": {"round": t_round, "cumulative": cum[c["id"]]["teams"], "detail": t_detail},
            }

        out_rounds.append({
            "round": rnd,
            "name": race["raceName"],
            "short": short_code(race["raceName"]),
            "date": race.get("date", ""),
            "sprint": bool(sprint and sprint.get("SprintResults")),
            "completed": True,
            "scores": scores,
        })
        print(f"  R{rnd} {race['raceName']}: "
              + ", ".join(f"{c['name']} D={scores[c['id']]['drivers']['round']}/T={scores[c['id']]['teams']['round']}" for c in contenders))

    total_rounds = fetch_total_rounds(season)

    output = {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "season": season,
        "source": "Jolpica-F1 API (api.jolpi.ca)",
        "total_rounds": total_rounds,
        "rounds": out_rounds,
    }

    if not out_rounds:
        print("WARNING: no completed rounds found — leaving existing results.json untouched.")
        return 1

    # Only rewrite the file if the actual results changed (ignore the timestamp),
    # so scheduled runs don't create empty commits when nothing has happened.
    if os.path.exists(OUTPUT_PATH):
        try:
            with open(OUTPUT_PATH, encoding="utf-8") as f:
                existing = json.load(f)
            if existing.get("rounds") == out_rounds and existing.get("total_rounds") == total_rounds:
                print("\nNo result changes since last run — results.json left untouched.")
                return 0
        except (json.JSONDecodeError, OSError):
            pass  # unreadable/missing — fall through and write fresh

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"\nWrote {OUTPUT_PATH} with {len(out_rounds)} round(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
