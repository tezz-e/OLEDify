#!/usr/bin/env python3
"""
E2E Test Runner CLI for OLED Visual Animation Engine & Converter.
Supports filtering by Tier (1..4) or Feature (F01..F27), verbose output,
JSON and JUnit XML test reporting, and synthetic media fixture generation.
"""

import sys
import os
import argparse
import time
import json
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Optional

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

TIER_MODULES = {
    1: [
        "test.e2e.tier1.test_f01_f05_ingestion",
        "test.e2e.tier1.test_f06_f10_dithering",
        "test.e2e.tier1.test_f11_f13_canvas",
        "test.e2e.tier1.test_f14_f17_procedural",
        "test.e2e.tier1.test_f18_f20_exporter",
        "test.e2e.tier1.test_f21_f25_hardware",
        "test.e2e.tier1.test_f26_f27_e2e_audit",
    ],
    2: [
        "test.e2e.tier2.test_t2_f01_f05",
        "test.e2e.tier2.test_t2_f06_f10",
        "test.e2e.tier2.test_t2_f11_f13",
        "test.e2e.tier2.test_t2_f14_f17",
        "test.e2e.tier2.test_t2_f18_f20",
        "test.e2e.tier2.test_t2_f21_f25",
        "test.e2e.tier2.test_t2_f26_f27",
    ],
    3: [
        "test.e2e.tier3.test_combinations",
    ],
    4: [
        "test.e2e.tier4.test_scenarios",
    ],
}


class DetailedTestResult(unittest.TextTestResult):
    def __init__(self, stream, descriptions, verbosity):
        super().__init__(stream, descriptions, verbosity)
        self.test_records = []
        self._start_time = 0.0

    def startTest(self, test):
        self._start_time = time.perf_counter()
        super().startTest(test)

    def addSuccess(self, test):
        elapsed = time.perf_counter() - self._start_time
        self.test_records.append({
            "id": test.id(),
            "name": test._testMethodName,
            "class": test.__class__.__name__,
            "description": test.shortDescription() or "",
            "status": "PASSED",
            "duration": elapsed,
            "error": None
        })
        super().addSuccess(test)

    def addFailure(self, test, err):
        elapsed = time.perf_counter() - self._start_time
        err_msg = self._exc_info_to_string(err, test)
        self.test_records.append({
            "id": test.id(),
            "name": test._testMethodName,
            "class": test.__class__.__name__,
            "description": test.shortDescription() or "",
            "status": "FAILED",
            "duration": elapsed,
            "error": err_msg
        })
        super().addFailure(test, err)

    def addError(self, test, err):
        elapsed = time.perf_counter() - self._start_time
        err_msg = self._exc_info_to_string(err, test)
        self.test_records.append({
            "id": test.id(),
            "name": test._testMethodName,
            "class": test.__class__.__name__,
            "description": test.shortDescription() or "",
            "status": "ERROR",
            "duration": elapsed,
            "error": err_msg
        })
        super().addError(test, err)

    def addSkip(self, test, reason):
        elapsed = time.perf_counter() - self._start_time
        self.test_records.append({
            "id": test.id(),
            "name": test._testMethodName,
            "class": test.__class__.__name__,
            "description": test.shortDescription() or "",
            "status": "SKIPPED",
            "duration": elapsed,
            "error": reason
        })
        super().addSkip(test, reason)


def matches_feature(test_case: unittest.TestCase, feature_code: str) -> bool:
    """Checks whether a test case relates to a given feature ID (e.g. F07)."""
    target = feature_code.upper()
    test_id = test_case.id().upper()
    doc = (getattr(test_case, "_testMethodDoc", "") or "").upper()
    cls_feature = getattr(test_case.__class__, "feature", "").upper()
    method_feature = getattr(test_case, "feature", "").upper()

    if target in test_id or target in cls_feature or target in method_feature or target in doc:
        return True
    return False


def collect_tests(suite: unittest.TestSuite) -> List[unittest.TestCase]:
    """Recursively flattens a TestSuite into a list of individual TestCases."""
    tests = []
    for item in suite:
        if isinstance(item, unittest.TestSuite):
            tests.extend(collect_tests(item))
        elif isinstance(item, unittest.TestCase):
            tests.append(item)
    return tests


def build_test_suite(
    selected_tiers: Optional[List[int]] = None,
    feature_filter: Optional[str] = None
) -> unittest.TestSuite:
    """Builds a filtered unittest.TestSuite according to tier and feature options."""
    loader = unittest.defaultTestLoader
    full_suite = unittest.TestSuite()

    if not selected_tiers:
        selected_tiers = [1, 2, 3, 4]

    for tier in sorted(selected_tiers):
        if tier not in TIER_MODULES:
            continue
        for mod_name in TIER_MODULES[tier]:
            try:
                mod_suite = loader.loadTestsFromName(mod_name)
                full_suite.addTest(mod_suite)
            except Exception as e:
                print(f"[ERROR] Failed to load module {mod_name}: {e}", file=sys.stderr)

    if not feature_filter:
        return full_suite

    # Filter individual test cases by feature
    all_tests = collect_tests(full_suite)
    filtered_suite = unittest.TestSuite()
    for test in all_tests:
        if matches_feature(test, feature_filter):
            filtered_suite.addTest(test)

    return filtered_suite


def export_json_report(result: DetailedTestResult, total_duration: float, out_path: str):
    """Exports test run metrics to structured JSON."""
    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_tests": result.testsRun,
        "passed": result.testsRun - len(result.failures) - len(result.errors) - len(result.skipped),
        "failed": len(result.failures),
        "errors": len(result.errors),
        "skipped": len(result.skipped),
        "duration_seconds": round(total_duration, 4),
        "tests": result.test_records
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"[INFO] JSON report written to {out_path}")


def export_junit_report(result: DetailedTestResult, total_duration: float, out_path: str):
    """Exports test run metrics to standard JUnit XML format."""
    root = ET.Element("testsuites", {
        "time": f"{total_duration:.4f}",
        "tests": str(result.testsRun),
        "failures": str(len(result.failures)),
        "errors": str(len(result.errors)),
        "skipped": str(len(result.skipped))
    })

    suite_el = ET.SubElement(root, "testsuite", {
        "name": "OLED-E2E-Suite",
        "time": f"{total_duration:.4f}",
        "tests": str(result.testsRun),
        "failures": str(len(result.failures)),
        "errors": str(len(result.errors)),
        "skipped": str(len(result.skipped))
    })

    for rec in result.test_records:
        case_el = ET.SubElement(suite_el, "testcase", {
            "classname": rec["class"],
            "name": rec["name"],
            "time": f"{rec['duration']:.4f}"
        })
        if rec["status"] == "FAILED":
            fail_el = ET.SubElement(case_el, "failure", {"message": "Assertion Failed"})
            fail_el.text = rec["error"] or ""
        elif rec["status"] == "ERROR":
            err_el = ET.SubElement(case_el, "error", {"message": "Unhandled Exception"})
            err_el.text = rec["error"] or ""
        elif rec["status"] == "SKIPPED":
            skip_el = ET.SubElement(case_el, "skipped", {"message": rec["error"] or ""})

    tree = ET.ElementTree(root)
    tree.write(out_path, encoding="utf-8", xml_declaration=True)
    print(f"[INFO] JUnit XML report written to {out_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="OLED Visual Animation Engine & Converter E2E Test Runner"
    )
    parser.add_argument(
        "--tier", "-t",
        type=str,
        default="all",
        help="Filter tests by tier (1, 2, 3, 4, comma-separated e.g. '1,2', or 'all')"
    )
    parser.add_argument(
        "--feature", "-f",
        type=str,
        default=None,
        help="Filter tests by feature code (F01..F27)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Run in verbose mode with detailed test outputs"
    )
    parser.add_argument(
        "--failfast", "-x",
        action="store_true",
        help="Stop on first failure or error"
    )
    parser.add_argument(
        "--json", "-j",
        type=str,
        default=None,
        help="Path to write JSON test report"
    )
    parser.add_argument(
        "--junit",
        type=str,
        default=None,
        help="Path to write JUnit XML test report"
    )
    parser.add_argument(
        "--generate-fixtures",
        action="store_true",
        help="Force regeneration of synthetic media fixtures before test run"
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    # Fixture generation if requested
    if args.generate_fixtures:
        print("[INFO] Generating synthetic test media fixtures...")
        try:
            from test.e2e.fixtures.media_generator import generate_all_sample_fixtures
            generate_all_sample_fixtures()
            print("[INFO] Fixtures generated successfully.")
        except Exception as e:
            print(f"[ERROR] Fixture generation failed: {e}", file=sys.stderr)
            return 2

    # Parse tier selection
    selected_tiers = []
    if args.tier.lower() in ("all", "*"):
        selected_tiers = [1, 2, 3, 4]
    else:
        try:
            for part in args.tier.split(","):
                t = int(part.strip())
                if t not in (1, 2, 3, 4):
                    raise ValueError(f"Invalid tier {t}. Must be 1, 2, 3, or 4.")
                selected_tiers.append(t)
        except ValueError as e:
            print(f"[ERROR] Invalid --tier specification: {e}", file=sys.stderr)
            return 2

    # Build suite
    suite = build_test_suite(selected_tiers=selected_tiers, feature_filter=args.feature)
    test_count = suite.countTestCases()

    print("=" * 70)
    print(" OLED Visual Animation Engine & Converter - E2E Test Suite")
    print(f" Tiers: {selected_tiers} | Feature Filter: {args.feature or 'None'} | Tests Selected: {test_count}")
    print("=" * 70)

    if test_count == 0:
        print("[WARNING] No test cases matched the specified criteria.")
        return 0

    # Execute tests
    verbosity = 2 if args.verbose else 1
    runner = unittest.TextTestRunner(
        verbosity=verbosity,
        failfast=args.failfast,
        resultclass=DetailedTestResult
    )

    t_start = time.perf_counter()
    result = runner.run(suite)
    t_end = time.perf_counter()
    total_duration = t_end - t_start

    # Export reports if requested
    if args.json:
        export_json_report(result, total_duration, args.json)
    if args.junit:
        export_junit_report(result, total_duration, args.junit)

    print("-" * 70)
    print(f" Ran {result.testsRun} tests in {total_duration:.3f}s")
    passed_count = result.testsRun - len(result.failures) - len(result.errors) - len(result.skipped)
    print(f" Passed: {passed_count} | Failed: {len(result.failures)} | Errors: {len(result.errors)} | Skipped: {len(result.skipped)}")
    print("=" * 70)

    if result.wasSuccessful():
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
