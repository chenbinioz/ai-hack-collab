import unittest

from matcher import _enforce_ideal_team_sizes


def _trace_evidence(group):
    return group["match_trace"][0]["evidence"]


class EnforceIdealTeamSizesTraceTests(unittest.TestCase):
    def test_rebalance_preserves_distinct_traces_per_team(self):
        student_ids = [f"{index:032x}" for index in range(1, 7)]
        matches = {
            "factor_weights": {"skills": 0.5, "working_style": 0.5},
            "groups": [
                {
                    "members": student_ids[:2],
                    "reason": "Team A reason",
                    "match_trace": [{"factor": "skills", "label": "Skills", "evidence": "Team A evidence"}],
                },
                {
                    "members": student_ids[2:4],
                    "reason": "Team B reason",
                    "match_trace": [{"factor": "skills", "label": "Skills", "evidence": "Team B evidence"}],
                },
                {
                    "members": student_ids[4:6],
                    "reason": "Team C reason",
                    "match_trace": [{"factor": "skills", "label": "Skills", "evidence": "Team C evidence"}],
                },
            ],
        }

        result = _enforce_ideal_team_sizes(matches, ideal_team_size=2, all_student_ids=student_ids)
        traces = [_trace_evidence(group) for group in result["groups"]]

        self.assertEqual(len(traces), 3)
        self.assertEqual(len(set(traces)), 3)
        self.assertIn("Team A evidence", traces)
        self.assertIn("Team B evidence", traces)
        self.assertIn("Team C evidence", traces)


if __name__ == "__main__":
    unittest.main()
