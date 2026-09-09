#!/usr/bin/env python3
"""Extract the saved website's literal data, without executing its JavaScript."""
import argparse
import ast
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://tut-tuuut.github.io/capharnaum-character-creator/"
REPOSITORY_COMMIT = "7add31f37fa9715876f44ffba6e2c3d5a9d51c6e"
REPOSITORY_RAW = "https://raw.githubusercontent.com/tut-tuuut/capharnaum-character-creator/" + REPOSITORY_COMMIT + "/"


class LiteralParser:
    """Small parser for JS objects/arrays containing strings and integers only."""

    token = re.compile(r'\s*(?:(//[^\n]*|/\*[\s\S]*?\*/)|("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')|(-?\d+)|([A-Za-z_]\w*)|([{}\[\]:,]))')

    def __init__(self, source):
        self.source = source
        self.pos = 0
        self.current = self.next_token()

    def next_token(self):
        while True:
            match = self.token.match(self.source, self.pos)
            if not match:
                return None
            self.pos = match.end()
            comment, string, number, identifier, punctuation = match.groups()
            if comment:
                continue
            if string is not None:
                return ("value", ast.literal_eval(string))
            if number is not None:
                return ("value", int(number))
            if identifier is not None:
                return ("identifier", identifier)
            return (punctuation, punctuation)

    def consume(self, kind):
        if self.current is None or self.current[0] != kind:
            raise ValueError("Unexpected JavaScript token: %r; expected %s" % (self.current, kind))
        value = self.current[1]
        self.current = self.next_token()
        return value

    def parse(self):
        if self.current is None:
            raise ValueError("Missing JavaScript literal")
        kind = self.current[0]
        if kind == "value":
            return self.consume("value")
        if kind not in ("{", "["):
            raise ValueError("Executable JavaScript is not supported")
        closing = "}" if kind == "{" else "]"
        result = {} if kind == "{" else []
        self.consume(kind)
        while self.current and self.current[0] != closing:
            if kind == "{":
                key = self.consume(self.current[0])
                if not isinstance(key, str) or key in result:
                    raise ValueError("Invalid or duplicate object key")
                self.consume(":")
                result[key] = self.parse()
            else:
                result.append(self.parse())
            if self.current and self.current[0] == closing:
                break
            self.consume(",")
        self.consume(closing)
        return result


def variable(js, name):
    match = re.search(r"\bvar\s+" + re.escape(name) + r"\s*=\s*", js)
    if not match:
        raise ValueError("Missing variable: " + name)
    parser = LiteralParser(js[match.end():])
    value = parser.parse()
    if parser.source[parser.pos:].lstrip()[:1] != ";":
        raise ValueError("Variable is not a standalone literal: " + name)
    return value


class Labels(HTMLParser):
    def __init__(self):
        super().__init__()
        self.labels = {}
        self.sangs = {}
        self.figures = {}
        self.select = None
        self.capture = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "select":
            self.select = attrs.get("id")
        if tag == "label" and attrs.get("for"):
            self.capture = (tag, self.labels, attrs["for"], [])
        elif tag == "option" and self.select == "sang" and attrs.get("value"):
            self.capture = (tag, self.sangs, attrs["value"], [])
        elif tag == "li" and attrs.get("id", "").startswith("fig_"):
            self.capture = (tag, self.figures, attrs["id"], [])

    def handle_data(self, data):
        if self.capture:
            self.capture[3].append(data)

    def handle_endtag(self, tag):
        if self.capture and self.capture[0] == tag:
            _, target, key, chunks = self.capture
            target[key] = "".join(chunks).strip()
            self.capture = None
        if tag == "select":
            self.select = None


def normalize_bonus(raw):
    match = re.fullmatch(r"([a-z_]+(?:\|[a-z_]+)*)\+(\d+)", raw)
    if not match:
        raise ValueError("Unknown bonus syntax: " + raw)
    targets = match[1].split("|")
    return {"type": "choix" if len(targets) > 1 else "fixe",
            "cibles": targets, "valeur": int(match[2]), "source": raw}


def extract(source_dir):
    js = (source_dir / "caph.js").read_text(encoding="utf-8")
    html = (source_dir / "index.html").read_text(encoding="utf-8")
    labels = Labels()
    labels.feed(html)
    sangs = variable(js, "arbo_sang")
    paroles = variable(js, "arbo_parole")
    caracs = variable(js, "keys_caracs")
    comps = variable(js, "keys_comps")
    figures = variable(js, "keys_figures")
    vertus = variable(js, "keys_vertus")
    if len(comps) != 4 * len(figures):
        raise ValueError("Unexpected figure/skill mapping")
    data = {
        "version_schema": "1.0.0",
        "sangs": [{"id": key, "nom": labels.sangs[key], "type_origine": value["libelle"]}
                  for key, value in sangs.items()],
        "origines": [{"id": origin["cle"], "nom": origin["libelle"], "sang_id": key,
                      "bonus": [normalize_bonus(b) for b in origin["bonus"]]}
                     for key, value in sangs.items() for origin in value["valeurs"]],
        "paroles": [{"id": p["cle"], "nom": p["libelle"], "sang_id": p["sang"],
                     "origine_id": p["tribu"], "bonus": [normalize_bonus(b) for b in p["bonus"]]}
                    for p in paroles],
        "caracteristiques": [{"id": key, "nom": labels.labels[key]} for key in caracs],
        "vertus": [{"id": key, "nom": labels.labels[key]} for key in vertus],
        "figures": [{"id": key, "nom": labels.figures["fig_%d" % i],
                     "competence_ids": comps[i * 4:i * 4 + 4]} for i, key in enumerate(figures)],
        "competences": [{"id": key, "nom": labels.labels[key], "figure_id": figures[i // 4]}
                        for i, key in enumerate(comps)],
    }
    known = set(caracs + comps)
    for entity in data["origines"] + data["paroles"]:
        for bonus in entity["bonus"]:
            if not set(bonus["cibles"]) <= known:
                raise ValueError("Unknown bonus target")
    origins = {o["id"]: o for o in data["origines"]}
    for parole in data["paroles"]:
        if origins[parole["origine_id"]]["sang_id"] != parole["sang_id"]:
            raise ValueError("Inconsistent origin reference")
    return data


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=ROOT / "data/source")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "data")
    args = parser.parse_args()
    data = extract(args.source_dir)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    write_json(args.output_dir / "capharnaum.json", data)
    files = []
    for name in ("index.html", "caph.js", "caph-gh-pages.js", "app.js", "bonus_figures.png", "repository-tree.json"):
        path = args.source_dir / name
        if path.exists():
            remote = {"index.html": "", "caph-gh-pages.js": "javascripts/caph.js", "app.js": "javascripts/app.js",
                      "bonus_figures.png": "images/bonus_figures.png"}.get(name)
            url = REPOSITORY_RAW + "javascripts/caph.js" if name == "caph.js" else (
                SOURCE_URL + remote if remote is not None else
                "https://api.github.com/repos/tut-tuuut/capharnaum-character-creator/git/trees/master?recursive=1")
            files.append({"fichier": "source/" + name,
                          "url": url,
                          "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    write_json(args.output_dir / "provenance.json", {
        "site": SOURCE_URL,
        "depot": "https://github.com/tut-tuuut/capharnaum-character-creator",
        "commit_javascript": REPOSITORY_COMMIT,
        "version_donnees": "JavaScript de master avec la correction 2018 de soupcon_traitres ; HTML du site publié.",
        "archive_site": "source/caph-gh-pages.js est conservé pour comparaison et n'est pas utilisé par l'extraction ni le frontend.",
        "fichiers": files,
        "methode": "Analyse des objets et tableaux littéraux JavaScript et des libellés HTML, sans exécution du code source.",
        "regles": "Transcription manuelle documentée séparément dans regles.json ; non extraite automatiquement.",
    })
    print(", ".join("%s: %d" % (key, len(value)) for key, value in data.items() if isinstance(value, list)))


if __name__ == "__main__":
    main()
