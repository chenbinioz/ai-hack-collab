"""Unit tests for external_data module using synthetic data only (no example dataset rows)."""

import unittest

from external_data import (
    compute_all_insights,
    merge_layered_rows,
    parse_csv_text,
    validate_csv_headers,
)


class TestExternalData(unittest.TestCase):
    def test_validate_person_dim_headers(self):
        validate_csv_headers("person_dim", "P_ID")

    def test_validate_rejects_wrong_headers(self):
        with self.assertRaises(ValueError):
            validate_csv_headers("person_dim", "WRONG")

    def test_merge_dedupes_by_pk_newest_layer_wins(self):
        layer1 = [
            ("person_dim", parse_csv_text("person_dim", "P_ID\nP00000001\n")),
        ]
        layer2 = [
            ("person_dim", parse_csv_text("person_dim", "P_ID\nP00000002\n")),
        ]
        merged = merge_layered_rows([(1, ft, rows) for ft, rows in layer1] + [(2, ft, rows) for ft, rows in layer2])
        p_ids = {r["P_ID"] for r in merged["person_dim"]}
        self.assertEqual(p_ids, {"P00000001", "P00000002"})

    def test_compute_insights_minimal(self):
        person_csv = "P_ID\nP00000099\n"
        lms_csv = (
            "PIT_ID,DATE,P_ID,LMS_ITEM_ID,TIMESTAMP,LOGIN_ID,INTERACTION_COUNT,TOTAL_SECONDS_BEFORE_NEXT_INTERACTION\n"
            "PIT0000000001,2024-01-05,P00000099,2057826836,2024-01-05T12:29:56.871Z,L02038516,2,5\n"
        )
        merged = merge_layered_rows([
            (1, "person_dim", parse_csv_text("person_dim", person_csv)),
            (1, "lms_item_activity_by_session_fact", parse_csv_text("lms_item_activity_by_session_fact", lms_csv)),
        ])
        insights = compute_all_insights(merged)
        self.assertIn("P00000099", insights)
        self.assertEqual(insights["P00000099"]["engagement"]["typical_login_period"], "afternoon")


if __name__ == "__main__":
    unittest.main()
