"""
Parse, merge, and compute insights from class external learning analytics CSV layers.
No sample row data is embedded — only header schemas and aggregation logic.
"""

from __future__ import annotations

import csv
import io
import statistics
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any

EXTERNAL_DATA_HEADERS: dict[str, list[str]] = {
    "person_dim": ["P_ID"],
    "calendar_dim": ["DATE", "YEAR", "MONTH", "DAY", "WEEK_NUMBER", "ACADEMIC_YEAR", "TERM", "TERM_CODE"],
    "module_instance_dim": ["MODULE_INSTANCE_ID", "MODULE_LEVEL", "ACADEMIC_YEAR_START", "TERM", "DEPARTMENT_ID"],
    "lms_item_dim": ["LMS_ITEM_ID", "MODULE_INSTANCE_ID", "TYPE_LABEL", "GROUP_LABEL"],
    "video_dim": ["VIDEO_ID", "MODULE_INSTANCE_ID", "VIDEO_LENGTH_MINUTES"],
    "person_module_instance_fact": ["PMI_ID", "P_ID", "MODULE_INSTANCE_ID", "MODULE_REGISTRATION_STATUS"],
    "person_module_instance_outcome_fact": ["OUTCOME_ID", "P_ID", "MODULE_INSTANCE_ID", "MARK", "GRADE_MODE"],
    "lms_item_activity_by_session_fact": [
        "PIT_ID", "DATE", "P_ID", "LMS_ITEM_ID", "TIMESTAMP", "LOGIN_ID",
        "INTERACTION_COUNT", "TOTAL_SECONDS_BEFORE_NEXT_INTERACTION",
    ],
    "video_activity_by_view_fact": [
        "PVT_ID", "P_ID", "VIDEO_ID", "DATE", "TIMESTAMP", "TOTAL_MINUTES_DELIVERED", "VIEWING_TYPE",
    ],
}

PRIMARY_KEYS: dict[str, str] = {
    "person_dim": "P_ID",
    "calendar_dim": "DATE",
    "module_instance_dim": "MODULE_INSTANCE_ID",
    "lms_item_dim": "LMS_ITEM_ID",
    "video_dim": "VIDEO_ID",
    "person_module_instance_fact": "PMI_ID",
    "person_module_instance_outcome_fact": "OUTCOME_ID",
    "lms_item_activity_by_session_fact": "PIT_ID",
    "video_activity_by_view_fact": "PVT_ID",
}

REQUIRED_FILE_TYPE = "person_dim"


def validate_csv_headers(file_type: str, header_line: str) -> None:
    expected = EXTERNAL_DATA_HEADERS.get(file_type)
    if not expected:
        raise ValueError(f"Unknown file type: {file_type}")

    actual = [h.strip() for h in header_line.strip().lstrip("\ufeff").split(",")]
    if len(actual) < len(expected):
        raise ValueError(f"Expected columns: {', '.join(expected)}")

    for i, col in enumerate(expected):
        if actual[i].upper() != col:
            raise ValueError(f"Column {i + 1} should be {col}, got {actual[i]}")


def parse_csv_text(file_type: str, text: str) -> list[dict[str, str]]:
    validate_csv_headers(file_type, text.splitlines()[0] if text else "")
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for row in reader:
        normalized = {k.strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items() if k}
        rows.append(normalized)
    return rows


def merge_layered_rows(
    layered_files: list[tuple[int, str, list[dict[str, str]]]],
) -> dict[str, list[dict[str, str]]]:
    """
    layered_files: list of (layer_number, file_type, rows)
    Returns merged dict file_type -> deduplicated rows (newest layer wins per PK).
    """
    merged: dict[str, dict[str, tuple[int, dict[str, str]]]] = defaultdict(dict)

    for layer_number, file_type, rows in sorted(layered_files, key=lambda x: x[0]):
        pk_field = PRIMARY_KEYS.get(file_type)
        if not pk_field:
            continue
        for row in rows:
            pk = (row.get(pk_field) or "").strip()
            if not pk:
                continue
            existing = merged[file_type].get(pk)
            if existing is None or layer_number >= existing[0]:
                merged[file_type][pk] = (layer_number, row)

    return {ft: [item[1] for item in sorted(bucket.values(), key=lambda x: x[0])] for ft, bucket in merged.items()}


def _hour_bucket(hour: int) -> str:
    if 5 <= hour < 12:
        return "morning"
    if 12 <= hour < 17:
        return "afternoon"
    if 17 <= hour < 22:
        return "evening"
    return "night"


def _parse_timestamp(ts: str) -> datetime | None:
    if not ts:
        return None
    try:
        cleaned = ts.replace("Z", "+00:00")
        return datetime.fromisoformat(cleaned)
    except ValueError:
        return None


def _safe_float(value: str) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def compute_student_insights(p_id: str, merged: dict[str, list[dict[str, str]]]) -> dict[str, Any]:
    insights: dict[str, Any] = {"external_person_id": p_id}
    patterns: list[str] = []

    # LMS engagement
    lms_rows = [r for r in merged.get("lms_item_activity_by_session_fact", []) if r.get("P_ID") == p_id]
    hour_buckets: Counter[str] = Counter()
    interaction_counts: list[float] = []
    session_dates: set[str] = set()

    for row in lms_rows:
        ts = _parse_timestamp(row.get("TIMESTAMP", ""))
        if ts:
            hour_buckets[_hour_bucket(ts.hour)] += 1
        session_dates.add(row.get("DATE", ""))
        ic = _safe_float(row.get("INTERACTION_COUNT", ""))
        if ic is not None:
            interaction_counts.append(ic)

    typical_login_period = hour_buckets.most_common(1)[0][0] if hour_buckets else None
    avg_interactions = round(statistics.mean(interaction_counts), 2) if interaction_counts else None

    insights["engagement"] = {
        "lms_session_count": len(lms_rows),
        "distinct_active_days": len([d for d in session_dates if d]),
        "typical_login_period": typical_login_period,
        "avg_interaction_count": avg_interactions,
    }

    if typical_login_period:
        patterns.append(f"Most LMS activity occurs in the {typical_login_period}.")

    # Video engagement
    video_rows = [r for r in merged.get("video_activity_by_view_fact", []) if r.get("P_ID") == p_id]
    video_minutes = [
        m for m in (_safe_float(r.get("TOTAL_MINUTES_DELIVERED", "")) for r in video_rows) if m is not None
    ]
    viewing_types = Counter(r.get("VIEWING_TYPE", "") for r in video_rows if r.get("VIEWING_TYPE"))
    dominant_viewing = viewing_types.most_common(1)[0][0] if viewing_types else None

    insights["video"] = {
        "view_session_count": len(video_rows),
        "total_minutes_watched": round(sum(video_minutes), 2) if video_minutes else 0,
        "dominant_viewing_type": dominant_viewing,
    }

    if video_minutes and sum(video_minutes) > 0:
        patterns.append(
            f"Watched approximately {round(sum(video_minutes))} minutes of video content"
            + (f", mostly via {dominant_viewing}" if dominant_viewing else "")
            + "."
        )

    # Academic outcomes
    outcome_rows = [r for r in merged.get("person_module_instance_outcome_fact", []) if r.get("P_ID") == p_id]
    marks = [m for m in (_safe_float(r.get("MARK", "")) for r in outcome_rows) if m is not None]
    module_rows = [r for r in merged.get("person_module_instance_fact", []) if r.get("P_ID") == p_id]

    insights["academic"] = {
        "registered_module_count": len(module_rows),
        "modules_with_outcomes": len(outcome_rows),
        "average_mark": round(statistics.mean(marks), 2) if marks else None,
        "mark_range": [round(min(marks), 2), round(max(marks), 2)] if marks else None,
    }

    if marks:
        avg = statistics.mean(marks)
        if avg >= 70:
            patterns.append("Module marks trend toward strong academic performance.")
        elif avg < 50:
            patterns.append("Module marks suggest they may benefit from additional academic support.")
        else:
            patterns.append("Module marks are in a moderate range across recorded modules.")

    if len(module_rows) >= 4:
        patterns.append(f"Registered across {len(module_rows)} module instances in the dataset.")

    insights["patterns"] = patterns[:4]
    return insights


def compute_all_insights(merged: dict[str, list[dict[str, str]]]) -> dict[str, dict[str, Any]]:
    person_rows = merged.get("person_dim", [])
    if not person_rows:
        raise ValueError("person_dim is required to compute insights")

    result: dict[str, dict[str, Any]] = {}
    for row in person_rows:
        p_id = (row.get("P_ID") or "").strip()
        if not p_id:
            continue
        result[p_id] = compute_student_insights(p_id, merged)
    return result


def count_data_rows(text: str) -> int:
    lines = [ln for ln in text.splitlines() if ln.strip()]
    return max(0, len(lines) - 1)
