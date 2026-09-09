import json
import unittest
from scripts.extract_data import ROOT, extract, variable, normalize_bonus


class ExtractionTests(unittest.TestCase):
    def test_reproduces_catalogue(self):
        expected = json.loads((ROOT / "data/capharnaum.json").read_text(encoding="utf-8"))
        self.assertEqual(extract(ROOT / "data/source"), expected)
        self.assertEqual(len(expected["origines"]), 18)
        self.assertEqual(len(expected["paroles"]), 19)
        self.assertEqual(len(expected["competences"]), 32)
        self.assertEqual((ROOT / "public/javascripts/caph.js").read_bytes(),
                         (ROOT / "data/source/caph.js").read_bytes())

    def test_literals_only(self):
        self.assertEqual(variable("var x = {cle: 'été', bonus: ['a+1',],};", "x"), {"cle": "été", "bonus": ["a+1"]})
        for text in ["var x = run();", "var x = [run()];", "var x = [1] + run();", "var x = {a: 1, a: 2};"]:
            with self.assertRaises(ValueError):
                variable(text, "x")

    def test_choice_bonus(self):
        self.assertEqual(normalize_bonus("coordination|puissance+1"), {
            "type": "choix", "cibles": ["coordination", "puissance"], "valeur": 1,
            "source": "coordination|puissance+1"})


if __name__ == "__main__":
    unittest.main()
