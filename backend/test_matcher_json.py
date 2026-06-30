import json
import unittest
from unittest.mock import patch

import matcher


class MatcherJsonTests(unittest.TestCase):
    def test_parse_valid_json_response(self):
        payload = {
            "candidates": [
                {
                    "finishReason": "STOP",
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps(
                                    {
                                        "factor_weights": {"skills": 1.0},
                                        "groups": [{"members": ["a"], "reason": "Balanced skills"}],
                                    }
                                )
                            }
                        ]
                    },
                }
            ]
        }

        parsed = matcher._parse_model_json_response(payload)
        self.assertEqual(parsed["groups"][0]["reason"], "Balanced skills")

    def test_parse_truncated_response_raises_retryable_error(self):
        payload = {
            "candidates": [
                {
                    "finishReason": "MAX_TOKENS",
                    "content": {
                        "parts": [
                            {
                                "text": '{"groups":[{"members":["266'
                            }
                        ]
                    },
                }
            ]
        }

        with self.assertRaisesRegex(ValueError, "MAX_TOKENS"):
            matcher._parse_model_json_response(payload)

    def test_retryable_json_error_detection(self):
        self.assertTrue(matcher._is_retryable_matching_json_error("Gemini returned malformed JSON for matching output"))
        self.assertTrue(matcher._is_retryable_matching_json_error("Gemini output truncated (finishReason=MAX_TOKENS)"))
        self.assertFalse(matcher._is_retryable_matching_json_error("Unexpected Gemini response: missing candidates"))

    @patch("matcher._effective_model_candidates", return_value=["gemini-test"])
    @patch("matcher._call_gemini_with_retries")
    def test_matching_json_retries_before_failing(self, mock_retries, _mock_candidates):
        mock_retries.side_effect = [
            {
                "candidates": [
                    {
                        "finishReason": "MAX_TOKENS",
                        "content": {"parts": [{"text": '{"groups":[{"members":["266'}]},
                    }
                ]
            },
            {
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {
                                            "factor_weights": {"skills": 1.0},
                                            "groups": [{"members": ["a"], "reason": "Retry worked"}],
                                        }
                                    )
                                }
                            ]
                        },
                    }
                ]
            },
        ]

        parsed, model = matcher._call_gemini_for_matching_json("prompt", "fake-key", max_parse_attempts=2)

        self.assertEqual(model, "gemini-test")
        self.assertEqual(parsed["groups"][0]["reason"], "Retry worked")
        self.assertEqual(mock_retries.call_count, 2)


if __name__ == "__main__":
    unittest.main()
