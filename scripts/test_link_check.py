import unittest

from scripts.link_check import extract_urls


class ExtractUrlsTests(unittest.TestCase):
    def test_markdown_link_keeps_balanced_parentheses(self):
        url = "https://doi.org/10.1016/0010-0277(85)90022-8"
        self.assertEqual(extract_urls(f"[Paper]({url})"), [(url, 1)])

    def test_angle_bracket_markdown_link_keeps_parentheses(self):
        url = "https://doi.org/10.1016/0010-0277(85)90022-8"
        self.assertEqual(extract_urls(f"[Paper](<{url}>)"), [(url, 1)])

    def test_bare_url_in_parentheses_keeps_balanced_parentheses(self):
        url = "https://doi.org/10.1016/0010-0277(85)90022-8"
        self.assertEqual(extract_urls(f"See ({url})."), [(url, 1)])

    def test_unmatched_sentence_parenthesis_is_removed(self):
        url = "https://example.test/path"
        self.assertEqual(extract_urls(f"See {url})."), [(url, 1)])

    def test_punctuation_after_unmatched_parenthesis_is_removed(self):
        url = "https://example.test/path"
        self.assertEqual(extract_urls(f"See ({url}.)"), [(url, 1)])

    def test_url_in_markdown_link_text_is_not_scanned(self):
        destination = "https://example.test/actual"
        self.assertEqual(
            extract_urls(
                f"[visit https://not-a-link.test/label]({destination})"
            ),
            [(destination, 1)],
        )

    def test_same_url_in_markdown_and_bare_text_is_deduplicated(self):
        url = "https://doi.org/10.1016/0010-0277(85)90022-8"
        self.assertEqual(extract_urls(f"[Paper]({url}) and {url}"), [(url, 1)])


if __name__ == "__main__":
    unittest.main()
