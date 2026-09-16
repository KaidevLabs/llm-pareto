"""Characterization tests for the update.py logo registry (plan 007, D8)."""

import unittest

import update


class TestLogoSlug(unittest.TestCase):
    def test_lowercases_org_name(self):
        self.assertEqual(update.logo_slug("OpenAI"), "openai")

    def test_maps_dots_to_hyphens(self):
        self.assertEqual(update.logo_slug("Z.ai"), "z-ai")

    def test_maps_spaces_to_hyphens(self):
        self.assertEqual(update.logo_slug("Inception AI"), "inception-ai")

    def test_keeps_existing_hyphens(self):
        self.assertEqual(update.logo_slug("arcee-ai"), "arcee-ai")


class TestSniffImage(unittest.TestCase):
    def test_detects_svg_with_xml_prolog(self):
        data = b'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="x">'
        self.assertEqual(update.sniff_image(data), "svg")

    def test_detects_bare_svg(self):
        self.assertEqual(update.sniff_image(b'<svg viewBox="0 0 24 24"/>'), "svg")

    def test_detects_png(self):
        self.assertEqual(
            update.sniff_image(b"\x89PNG\r\n\x1a\n" + b"\x00" * 8), "png"
        )

    def test_detects_jpeg(self):
        self.assertEqual(update.sniff_image(b"\xff\xd8\xff\xe0" + b"\x00" * 8), "jpg")

    def test_detects_avif(self):
        self.assertEqual(
            update.sniff_image(b"\x00\x00\x00\x20ftypavif" + b"\x00" * 8), "avif"
        )

    def test_detects_ico(self):
        self.assertEqual(
            update.sniff_image(b"\x00\x00\x01\x00\x01\x00" + b"\x00" * 8), "ico"
        )

    def test_unknown_content_is_none(self):
        self.assertIsNone(update.sniff_image(b"hello world, not an image"))


class TestPngSize(unittest.TestCase):
    def test_reads_ihdr_dimensions(self):
        # signature(8) + chunk length(4) + "IHDR"(4) + width(4BE) + height(4BE)
        data = (
            b"\x89PNG\r\n\x1a\n"
            + (13).to_bytes(4, "big")
            + b"IHDR"
            + (1024).to_bytes(4, "big")
            + (512).to_bytes(4, "big")
        )
        self.assertEqual(update.png_size(data), (1024, 512))

    def test_missing_ihdr_is_none(self):
        self.assertIsNone(update.png_size(b"\x89PNG\r\n\x1a\nIDAT\x00"))


class TestSvgViewBox(unittest.TestCase):
    def test_reads_viewbox(self):
        svg = b'<svg width="2500" height="319" viewBox="4.245 3.085 1013.926 129.245">'
        self.assertEqual(
            update.svg_viewbox(svg), (4.245, 3.085, 1013.926, 129.245)
        )

    def test_missing_viewbox_is_none(self):
        self.assertIsNone(update.svg_viewbox(b'<svg width="10" height="10">'))


def _vb(data):
    return update.svg_viewbox(data)


def _wh(data):
    import re as _re

    w = _re.search(rb'width="([^"]+)"', data)
    h = _re.search(rb'height="([^"]+)"', data)
    return (float(w.group(1)), float(h.group(1))) if w and h else None


class TestNormalizeSvg(unittest.TestCase):
    def test_adds_missing_width_height_on_square(self):
        out = update.normalize_svg(b'<svg viewBox="0 0 24 24"><path/></svg>')
        self.assertEqual(_vb(out), (0.0, 0.0, 24.0, 24.0))
        self.assertEqual(_wh(out), (24.0, 24.0))

    def test_wide_viewbox_expands_centered(self):
        # center (500, 200), side 1000 -> x = 0, y = 200 - 500 = -300
        out = update.normalize_svg(b'<svg viewBox="0 0 1000 400">x</svg>')
        self.assertEqual(_vb(out), (0.0, -300.0, 1000.0, 1000.0))
        self.assertEqual(_wh(out), (1000.0, 1000.0))

    def test_offset_viewbox_expands_centered(self):
        # center (511.208, 67.7075), side 1013.926 -> x stays 4.245,
        # y = 67.7075 - 506.963 = -439.2555
        import math

        out = update.normalize_svg(
            b'<svg viewBox="4.245 3.085 1013.926 129.245">x</svg>'
        )
        got, want = _vb(out), (4.245, -439.2555, 1013.926, 1013.926)
        self.assertTrue(
            all(math.isclose(g, w, rel_tol=1e-9) for g, w in zip(got, want))
        )
        self.assertEqual(_wh(out), (1013.926, 1013.926))

    def test_tall_viewbox_expands_centered(self):
        # center (20, 80.5), side 161 -> x = 20 - 80.5 = -60.5, y stays 0
        out = update.normalize_svg(b'<svg viewBox="0 0 40 161">x</svg>')
        self.assertEqual(_vb(out), (-60.5, 0.0, 161.0, 161.0))

    def test_replaces_existing_width_height(self):
        out = update.normalize_svg(
            b'<svg width="2500" height="319" viewBox="0 0 1000 400">x</svg>'
        )
        self.assertEqual(_wh(out), (1000.0, 1000.0))

    def test_is_idempotent(self):
        once = update.normalize_svg(b'<svg viewBox="0 0 1000 400">x</svg>')
        self.assertEqual(update.normalize_svg(once), once)

    def test_no_viewbox_is_none(self):
        self.assertIsNone(update.normalize_svg(b'<svg width="10" height="10">'))

    def test_leaves_surrounding_attributes_untouched(self):
        src = b'<svg role="img" viewBox="0 0 100 100" xmlns="x"><path/></svg>'
        out = update.normalize_svg(src)
        root = out[: out.index(b"><")]
        # no doubled space where the old viewBox was stripped
        self.assertNotIn(b"  ", root)
        self.assertIn(b'xmlns="x"', root)


def _ico(frames):
    """Build a minimal ICO container around raw frame payloads."""
    import struct as _struct

    out = _struct.pack("<HHH", 0, 1, len(frames))
    offset = 6 + 16 * len(frames)
    for i, payload in enumerate(frames):
        dim = 48 if i == len(frames) - 1 else 16
        out += _struct.pack(
            "<BBBBHHII", dim, dim, 0, 0, 1, 32, len(payload), offset
        )
        offset += len(payload)
    return out + b"".join(frames)


class TestIcoBestPngFrame(unittest.TestCase):
    def test_returns_largest_png_frame(self):
        small = b"\x89PNG\r\n\x1a\n" + b"a" * 40
        big = b"\x89PNG\r\n\x1a\n" + b"b" * 120
        self.assertEqual(update.ico_best_png_frame(_ico([small, big])), big)

    def test_no_png_frame_is_none(self):
        bmp = b"\x28\x00\x00\x00" + b"\x00" * 60  # BITMAPINFOHEADER frame
        self.assertIsNone(update.ico_best_png_frame(_ico([bmp])))

    def test_not_an_ico_is_none(self):
        self.assertIsNone(update.ico_best_png_frame(b"\x89PNG\r\n\x1a\n" + b"0" * 20))


def _png(w, h):
    import struct as _struct

    return (
        b"\x89PNG\r\n\x1a\n"
        + (13).to_bytes(4, "big")
        + b"IHDR"
        + _struct.pack(">II", w, h)
        + b"\x00" * 9
    )


class FakeFetch:
    def __init__(self, mapping):
        self.mapping = dict(mapping)
        self.calls = []

    def __call__(self, url):
        self.calls.append(url)
        return self.mapping.get(url)


class LogosSyncBase(unittest.TestCase):
    def setUp(self):
        import tempfile
        from pathlib import Path

        self.td = tempfile.TemporaryDirectory()
        self.addCleanup(self.td.cleanup)
        self.log_dir = Path(self.td.name) / "logos"
        self.log_dir.mkdir()
        self.log_path = Path(self.td.name) / "logos.json"

    def sync(self, orgs, manifest, mapping=None, today="2026-09-16"):
        fetch = FakeFetch(mapping or {})
        result = update.logos_sync(
            orgs, manifest, self.log_dir, self.log_path, fetch, today=today
        )
        return fetch, result

    def written(self, name):
        return (self.log_dir / name).read_bytes()


class TestLogosSyncNewOrg(LogosSyncBase):
    def test_new_org_without_url_gets_entry_and_candidate_report(self):
        fetch, (manifest, lines) = self.sync(["Foo"], {})
        self.assertEqual(manifest["Foo"], {"file": None, "url": None})
        self.assertIn(
            "https://cdn.simpleicons.org/foo", fetch.calls
        )
        self.assertIn(
            "https://cdn.worldvectorlogo.com/logos/foo.svg", fetch.calls
        )
        self.assertIn(
            "https://openrouter.ai/images/icons/Foo.svg", fetch.calls
        )
        self.assertTrue(any('new org "Foo"' in l for l in lines))
        self.assertTrue(self.log_path.exists())


class TestLogosSyncFetch(LogosSyncBase):
    def test_fetch_and_write_square_svg(self):
        url = "https://x/foo.svg"
        fetch, (manifest, lines) = self.sync(
            ["Foo"], {"Foo": {"url": url}}, {url: b'<svg viewBox="0 0 24 24"/>'}
        )
        self.assertEqual(manifest["Foo"]["file"], "foo.svg")
        self.assertEqual(manifest["Foo"]["fetched"], "2026-09-16")
        self.assertEqual(
            update.svg_viewbox(self.written("foo.svg")), (0.0, 0.0, 24.0, 24.0)
        )
        self.assertTrue(any('wrote foo.svg for "Foo"' in l for l in lines))

    def test_non_square_svg_normalized_on_write(self):
        url = "https://x/foo.svg"
        fetch, (manifest, lines) = self.sync(
            ["Foo"],
            {"Foo": {"url": url}},
            {url: b'<svg viewBox="0 0 1000 400">x</svg>'},
        )
        self.assertEqual(
            update.svg_viewbox(self.written("foo.svg")),
            (0.0, -300.0, 1000.0, 1000.0),
        )

    def test_non_square_png_written_and_flagged_manual(self):
        url = "https://x/foo.png"
        fetch, (manifest, lines) = self.sync(
            ["Foo"], {"Foo": {"url": url}}, {url: _png(100, 50)}
        )
        self.assertEqual(self.written("foo.png")[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual(manifest["Foo"]["file"], "foo.png")
        self.assertTrue(any("100x50" in l and "manual" in l for l in lines))
        self.assertEqual(
            update.logos_for_site(manifest, self.log_dir), {"Foo": "foo.png"}
        )

    def test_square_png_written_and_accepted(self):
        url = "https://x/foo.png"
        fetch, (manifest, lines) = self.sync(
            ["Foo"], {"Foo": {"url": url}}, {url: _png(100, 100)}
        )
        self.assertTrue(any('wrote foo.png for "Foo"' in l for l in lines))

    def test_ico_frame_extracted_and_written_as_png(self):
        url = "https://x/favicon.ico"
        frame = b"\x89PNG\r\n\x1a\n" + b"\x00" * 40
        fetch, (manifest, lines) = self.sync(
            ["Foo"], {"Foo": {"url": url}}, {url: _ico([frame])}
        )
        self.assertEqual(self.written("foo.png"), frame)
        self.assertEqual(manifest["Foo"]["file"], "foo.png")

    def test_jpeg_written_and_flagged_manual(self):
        url = "https://x/foo.jpg"
        fetch, (manifest, lines) = self.sync(
            ["Foo"], {"Foo": {"url": url}}, {url: b"\xff\xd8\xff\xe0" + b"\x00" * 20}
        )
        self.assertTrue((self.log_dir / "foo.jpg").exists())
        self.assertTrue(any("manual" in l for l in lines))

    def test_unknown_type_not_written(self):
        url = "https://x/foo.bin"
        fetch, (manifest, lines) = self.sync(
            ["Foo"], {"Foo": {"url": url}}, {url: b"hello, not an image"}
        )
        self.assertFalse(list(self.log_dir.iterdir()))
        self.assertEqual(manifest["Foo"]["file"], None)
        self.assertTrue(any("unknown image type" in l for l in lines))

    def test_fetch_failure_is_soft(self):
        url = "https://x/foo.svg"
        fetch, (manifest, lines) = self.sync(
            ["Foo"], {"Foo": {"url": url}}, {}
        )
        self.assertFalse(list(self.log_dir.iterdir()))
        self.assertEqual(manifest["Foo"]["url"], url)
        self.assertTrue(any("fetch failed" in l and "soft" in l for l in lines))

    def test_oversize_rejected(self):
        url = "https://x/foo.svg"
        old = update.LOGO_MAX_BYTES
        self.addCleanup(setattr, update, "LOGO_MAX_BYTES", old)
        update.LOGO_MAX_BYTES = 100
        fetch, (manifest, lines) = self.sync(
            ["Foo"], {"Foo": {"url": url}}, {url: b"x" * 150}
        )
        self.assertFalse(list(self.log_dir.iterdir()))
        self.assertTrue(any("oversize" in l for l in lines))


class TestLogosSyncExisting(LogosSyncBase):
    def test_existing_square_file_is_quiet_and_not_refetched(self):
        url = "https://x/foo.svg"
        (self.log_dir / "foo.svg").write_bytes(
            b'<svg viewBox="0 0 24 24" width="24" height="24"/>'
        )
        manifest = {"Foo": {"file": "foo.svg", "url": url}}
        fetch, (new_manifest, lines) = self.sync(["Foo"], manifest, {url: b"?"})
        self.assertEqual(fetch.calls, [])
        self.assertEqual(new_manifest, manifest)
        self.assertFalse([l for l in lines if '"Foo"' in l])

    def test_existing_non_square_file_flagged_each_run(self):
        (self.log_dir / "foo.png").write_bytes(_png(100, 50))
        manifest = {"Foo": {"file": "foo.png"}}
        fetch, (new_manifest, lines) = self.sync(["Foo"], manifest)
        self.assertTrue(any("100x50" in l and "manual" in l for l in lines))

    def test_file_missing_with_url_refetches(self):
        url = "https://x/foo.svg"
        manifest = {"Foo": {"file": "foo.svg", "url": url}}
        fetch, (new_manifest, lines) = self.sync(
            ["Foo"], manifest, {url: b'<svg viewBox="0 0 10 10"/>'}
        )
        self.assertEqual(len(fetch.calls), 1)
        self.assertTrue((self.log_dir / "foo.svg").exists())

    def test_file_present_without_url_kept(self):
        (self.log_dir / "foo.svg").write_bytes(
            b'<svg viewBox="0 0 24 24" width="24" height="24"/>'
        )
        manifest = {}
        fetch, (new_manifest, lines) = self.sync(["Foo"], manifest)
        self.assertEqual(new_manifest["Foo"]["file"], "foo.svg")
        self.assertTrue(any("without url" in l for l in lines))

    def test_stale_entry_kept_with_info_line(self):
        (self.log_dir / "gone.svg").write_bytes(
            b'<svg viewBox="0 0 24 24" width="24" height="24"/>'
        )
        manifest = {
            "Foo": {"file": "foo.svg"},
            "Gone": {"file": "gone.svg", "url": "https://x/gone.svg"},
        }
        (self.log_dir / "foo.svg").write_bytes(
            b'<svg viewBox="0 0 24 24" width="24" height="24"/>'
        )
        fetch, (new_manifest, lines) = self.sync(["Foo"], manifest)
        self.assertIn("Gone", new_manifest)
        self.assertTrue(any('stale "Gone"' in l for l in lines))


class TestLogosSyncCanonical(LogosSyncBase):
    def test_registry_written_sorted(self):
        url = "https://x/a.svg"
        (self.log_dir / "a.svg").write_bytes(
            b'<svg viewBox="0 0 24 24" width="24" height="24"/>'
        )
        manifest = {
            "Zed": {"file": "a.svg", "license": "x", "url": url},
            "Alfa": {"file": "a.svg", "url": url},
        }
        fetch, (new_manifest, lines) = self.sync(["Alfa", "Zed"], manifest)
        text = self.log_path.read_text()
        self.assertLess(text.index('"Alfa"'), text.index('"Zed"'))


class SlowFetch:
    def __init__(self):
        self.calls = []

    def __call__(self, url):
        import time

        self.calls.append(url)
        time.sleep(0.25)
        return b'<svg viewBox="0 0 10 10"/>'


class TestLogosSyncParallel(LogosSyncBase):
    def test_fetches_run_in_parallel(self):
        import time

        urls = [f"https://x/{i}.svg" for i in range(4)]
        orgs = [f"Org{i}" for i in range(4)]
        manifest = {o: {"url": u} for o, u in zip(orgs, urls)}
        fetch = SlowFetch()
        start = time.monotonic()
        update.logos_sync(
            orgs, manifest, self.log_dir, self.log_path, fetch, today="2026-09-16"
        )
        # sequential would take >= 1.0s for four 0.25s fetches
        self.assertLess(time.monotonic() - start, 0.9)

    def test_same_url_fetched_once(self):
        url = "https://x/shared.svg"
        manifest = {
            "Foo": {"url": url},
            "Bar": {"url": url},
        }
        fetch, _ = self.sync(
            ["Foo", "Bar"], manifest, {url: b'<svg viewBox="0 0 10 10"/>'}
        )
        self.assertEqual(fetch.calls.count(url), 1)

    def test_filenames_use_each_orgs_own_slug(self):
        url_a = "https://x/a.svg"
        url_b = "https://x/b.svg"
        fetch, (manifest, lines) = self.sync(
            ["Alpha", "Beta"],
            {
                "Alpha": {"url": url_a},
                "Beta": {"url": url_b},
            },
            {
                url_a: b'<svg viewBox="0 0 10 10"/>',
                url_b: b'<svg viewBox="0 0 10 10"/>',
            },
        )
        self.assertTrue((self.log_dir / "alpha.svg").exists())
        self.assertTrue((self.log_dir / "beta.svg").exists())
        self.assertEqual(manifest["Alpha"]["file"], "alpha.svg")
        self.assertEqual(manifest["Beta"]["file"], "beta.svg")

    def test_fetcher_exception_is_soft(self):
        class ExplodingFetch(FakeFetch):
            def __call__(self, url):
                self.calls.append(url)
                if url.endswith(".svg") and "boom" in url:
                    raise RuntimeError("network down")
                return self.mapping.get(url)

        good = "https://x/good.svg"
        bad = "https://x/boom.svg"
        fetch = ExplodingFetch({good: b'<svg viewBox="0 0 10 10"/>'})
        update.logos_sync(
            ["Foo", "Bar"],
            {"Foo": {"url": good}, "Bar": {"url": bad}},
            self.log_dir,
            self.log_path,
            fetch,
            today="2026-09-16",
        )
        self.assertTrue((self.log_dir / "foo.svg").exists())


class TestLogosForSite(LogosSyncBase):
    def test_maps_org_to_filename_when_file_exists(self):
        (self.log_dir / "foo.svg").write_bytes(b'<svg viewBox="0 0 1 1"/>')
        manifest = {"Foo": {"file": "foo.svg", "url": "u"}}
        self.assertEqual(
            update.logos_for_site(manifest, self.log_dir), {"Foo": "foo.svg"}
        )

    def test_omits_entries_without_a_file_on_disk(self):
        manifest = {"Foo": {"file": None, "url": None}}
        self.assertEqual(update.logos_for_site(manifest, self.log_dir), {})

    def test_omits_entries_whose_file_was_removed(self):
        (self.log_dir / "foo.svg").write_bytes(b"x")
        manifest = {"Foo": {"file": "foo.svg"}, "Gone": {"file": "gone.svg"}}
        self.assertEqual(
            update.logos_for_site(manifest, self.log_dir), {"Foo": "foo.svg"}
        )


class TestLoadLogos(LogosSyncBase):
    def test_missing_file_is_empty(self):
        self.assertEqual(update.load_logos(self.log_path), {})

    def test_bad_json_dies(self):
        self.log_path.write_text("{not json")
        with self.assertRaises(SystemExit):
            update.load_logos(self.log_path)


if __name__ == "__main__":
    unittest.main()
