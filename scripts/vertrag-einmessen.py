"""Vertragsvorlage einmessen: zeigt, wo im PDF die Luecken (Unterstriche)
und Beispielwerte stehen - als Grundlage fuer die Positionen in
nextjs/src/lib/esska/vertragslayouts.ts.

Aufruf (pypdf noetig):
    python3 scripts/vertrag-einmessen.py Vorlage.pdf

Ausgabe je Zeile: y = Grundlinie in PDF-Punkten (Ursprung unten links),
x = Anfang der Textzeile. Die x-Position einer Luecke innerhalb einer Zeile
ergibt sich aus dem gerenderten Bild (Seitenbreite in Punkten / Bildbreite).
Danach eine Probe mit Testdaten erzeugen und als Bild pruefen.
"""
import re
import sys

from pypdf import PdfReader

r = PdfReader(sys.argv[1])
for i, page in enumerate(r.pages):
    mb = page.mediabox
    print(f"=== Seite {i} (im Layout: seite: {i})  {float(mb.width):.0f} x {float(mb.height):.0f} pt")
    stuecke = []

    def v(text, cm, tm, fd, fs):
        if text and text.strip():
            x = tm[4] * cm[0] + tm[5] * cm[2] + cm[4]
            y = tm[4] * cm[1] + tm[5] * cm[3] + cm[5]
            stuecke.append((round(y, 1), round(x, 1), text))

    page.extract_text(visitor_text=v)
    for y, x, t in sorted(stuecke, key=lambda s: (-s[0], s[1])):
        if "_" in t or re.search(r"\d", t):
            print(f"y={y:6.1f} x={x:6.1f} | {t[:110]!r}")
