import os
import json
import hashlib
import time
import random
import re
import socket
import ssl
from pathlib import Path
from datetime import datetime, timedelta
import urllib.request
import urllib.error
import certifi
from dotenv import load_dotenv

# Load project-root .env regardless of process working directory.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env", override=True)


def _gemini_ssl_context() -> ssl.SSLContext:
    """Use certifi CA bundle — macOS Python often lacks system certs for urllib."""
    return ssl.create_default_context(cafile=certifi.where())


def _gemini_list_timeout() -> int:
    raw = os.getenv("GEMINI_LIST_TIMEOUT_SECONDS", "30")
    try:
        return max(5, int(raw))
    except ValueError:
        return 30


def _gemini_generate_timeout() -> int:
    raw = os.getenv("GEMINI_REQUEST_TIMEOUT_SECONDS", "180")
    try:
        return max(30, int(raw))
    except ValueError:
        return 180


def _is_gemini_timeout_error(exc: BaseException) -> bool:
    if isinstance(exc, (TimeoutError, socket.timeout)):
        return True
    if isinstance(exc, urllib.error.URLError):
        reason = getattr(exc, "reason", None)
        return isinstance(reason, (TimeoutError, socket.timeout))
    return False


def _gemini_timeout_error_text(exc: BaseException) -> str:
    return f"Gemini request timed out: {exc}"

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Use a valid model name. Can be overridden for resilience in different environments.
MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-2.5-flash")

ALL_MATCHING_SKILL_KEYS = [
    "coding",
    "written_reports",
    "presentation_public_speaking",
    "mathematical_literacy",
    "understanding_abstract_complex_content",
    "conflict_resolution",
]

MATCHING_SKILL_LABELS = {
    "coding": "Coding",
    "written_reports": "Written reports",
    "presentation_public_speaking": "Presentation / public speaking",
    "mathematical_literacy": "Mathematical literacy",
    "understanding_abstract_complex_content": "Understanding abstract / complex content",
    "conflict_resolution": "Conflict resolution",
}


def _configured_model_candidates():
    """
    Resolve ordered Gemini model candidates for failover.
    Priority:
      1) GEMINI_MODEL_CANDIDATES (comma-separated)
      2) GEMINI_MODEL_NAME
      3) sensible defaults
    """
    defaults = [
        MODEL_NAME,
        "gemini-2.5-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-2.0-flash-lite-001",
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash",
        "gemini-2.5-flash",
        "gemini-flash-latest",
    ]
    raw_candidates = os.getenv("GEMINI_MODEL_CANDIDATES", "")

    candidates = []
    if raw_candidates.strip():
        candidates.extend([item.strip() for item in raw_candidates.split(",") if item.strip()])
    else:
        candidates.extend(defaults)

    # Ensure primary model is present and preserve order with de-duplication.
    if MODEL_NAME not in candidates:
        candidates.insert(0, MODEL_NAME)

    deduped = []
    seen = set()
    for model in candidates:
        if model in seen:
            continue
        seen.add(model)
        deduped.append(model)

    return deduped


def _normalize_model_name(name):
    """
    Normalize model resource names to short form, e.g. models/gemini-2.5-flash -> gemini-2.5-flash
    """
    n = (name or "").strip()
    if n.startswith("models/"):
        return n.split("/", 1)[1]
    return n


def _list_generate_content_models(active_key):
    """
    Return Gemini model names that support generateContent for this API key.
    """
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models?key={active_key}"
    request = urllib.request.Request(endpoint, method="GET")

    with urllib.request.urlopen(
        request, timeout=_gemini_list_timeout(), context=_gemini_ssl_context()
    ) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    models = payload.get("models") or []
    supported = []
    for model in models:
        methods = model.get("supportedGenerationMethods") or []
        if "generateContent" not in methods:
            continue
        short_name = _normalize_model_name(model.get("name", ""))
        if short_name:
            supported.append(short_name)

    return supported


def _effective_model_candidates(active_key):
    """
    Choose candidates by intersecting configured models with available generateContent models.
    Falls back to available flash models if configured ones are not available.
    """
    configured = [_normalize_model_name(m) for m in _configured_model_candidates()]

    try:
        available = _list_generate_content_models(active_key)
    except Exception as e:
        # If model listing fails, keep configured order to avoid blocking matching.
        print(f"Gemini model listing failed; using configured candidates. Error: {e}")
        return configured

    available_set = set(available)
    filtered = [m for m in configured if m in available_set]

    if filtered:
        return filtered

    # No configured models were available; prefer flash variants as fallback.
    flash_candidates = [m for m in available if "flash" in m]
    return flash_candidates or available or configured


def _parse_retry_delay_seconds(error_body):
    """
    Read retry delay from Gemini error payload when provided.
    """
    if not error_body:
        return None

    try:
        payload = json.loads(error_body)
    except Exception:
        payload = None

    if isinstance(payload, dict):
        details = ((payload.get("error") or {}).get("details") or [])
        for detail in details:
            if not isinstance(detail, dict):
                continue
            retry_delay = detail.get("retryDelay")
            if isinstance(retry_delay, str) and retry_delay.endswith("s"):
                try:
                    return float(retry_delay[:-1])
                except ValueError:
                    pass

    m = re.search(r"retry in\s+([0-9]+(?:\.[0-9]+)?)s", error_body, flags=re.IGNORECASE)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            return None

    return None


def _is_hard_quota_exhausted(error_body):
    """
    Detect non-transient quota exhaustion (e.g. free-tier daily limit set to 0).
    """
    if not error_body:
        return False
    lowered = error_body.lower()
    return "quota exceeded" in lowered and "limit: 0" in lowered


def _extract_json_text(raw_text):
    """
    Extract JSON from model text that may include markdown fences or extra prose.
    """
    if not raw_text:
        return ""

    text = raw_text.strip()
    if not text:
        return ""

    # Remove common markdown wrappers first.
    text = text.replace("```json", "").replace("```", "").strip()

    # Fast path: already valid object/array boundaries.
    if (text.startswith("{") and text.endswith("}")) or (text.startswith("[") and text.endswith("]")):
        return text

    # Fallback: extract first JSON object span.
    obj_start = text.find("{")
    obj_end = text.rfind("}")
    if obj_start != -1 and obj_end != -1 and obj_end > obj_start:
        return text[obj_start:obj_end + 1]

    # Fallback: extract first JSON array span.
    arr_start = text.find("[")
    arr_end = text.rfind("]")
    if arr_start != -1 and arr_end != -1 and arr_end > arr_start:
        return text[arr_start:arr_end + 1]

    return ""


def _parse_model_json_response(response_json):
    """
    Parse Gemini response into JSON payload with diagnostics for malformed output.
    """
    candidates = response_json.get("candidates") or []
    if not candidates:
        raise ValueError(f"Unexpected Gemini response: missing candidates: {response_json}")

    parts = ((candidates[0].get("content") or {}).get("parts") or [])
    text_fragments = []
    for part in parts:
        maybe_text = part.get("text")
        if isinstance(maybe_text, str) and maybe_text.strip():
            text_fragments.append(maybe_text)

    raw_text = "\n".join(text_fragments).strip()
    json_text = _extract_json_text(raw_text)

    if not json_text:
        finish_reason = candidates[0].get("finishReason", "unknown")
        raise ValueError(
            "Gemini returned no JSON text for matching output "
            f"(finishReason={finish_reason}). Raw preview: {raw_text[:240]}"
        )

    try:
        return json.loads(json_text)
    except json.JSONDecodeError as e:
        raise ValueError(
            "Gemini returned malformed JSON for matching output: "
            f"{e}. JSON preview: {json_text[:240]}"
        ) from e


def _normalize_weights(raw_weights):
    """
    Normalize a dict of factor weights so they sum to 1.0.
    """
    defaults = {
        "previous_experience": 0.18,
        "skills": 0.22,
        "working_style": 0.22,
        "availability": 0.10,
        "diversity": 0.18,
        "external_analytics": 0.10,
    }

    if not isinstance(raw_weights, dict):
        return defaults

    cleaned = {}
    for key, value in raw_weights.items():
        if key not in defaults:
            continue
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            continue
        cleaned[key] = max(0.0, numeric)

    if not cleaned:
        return defaults

    total = sum(cleaned.values())
    if total <= 0:
        return defaults

    return {k: v / total for k, v in cleaned.items()}


def _resolve_wanted_skills(ai_preferences):
    """
    Resolve educator-selected wanted skills, with legacy focus_skills fallback.
    """
    if not isinstance(ai_preferences, dict):
        ai_preferences = {}

    raw_wanted = ai_preferences.get("wanted_skills")
    if isinstance(raw_wanted, list):
        valid_keys = set(ALL_MATCHING_SKILL_KEYS)
        resolved = []
        seen = set()
        for item in raw_wanted:
            if not isinstance(item, str) or item not in valid_keys or item in seen:
                continue
            seen.add(item)
            resolved.append(item)
        return resolved

    if bool(ai_preferences.get("focus_skills", True)):
        return list(ALL_MATCHING_SKILL_KEYS)

    return []


def _weights_from_preferences(ai_preferences):
    """
    Build explainable factor weights from boolean AI preferences.
    """
    wanted_skills = _resolve_wanted_skills(ai_preferences)
    toggles = {
        "previous_experience": True,
        "skills": len(wanted_skills) > 0,
        "working_style": bool(ai_preferences.get("focus_working_style", True)),
        "availability": bool(ai_preferences.get("focus_availability", True)),
        "diversity": bool(ai_preferences.get("balance_diversity", True)),
        "external_analytics": True,
    }

    base = {
        "previous_experience": 0.18,
        "skills": 0.22,
        "working_style": 0.22,
        "availability": 0.10,
        "diversity": 0.18,
        "external_analytics": 0.10,
    }

    active = {key: weight for key, weight in base.items() if toggles.get(key, False)}
    return _normalize_weights(active)


def _fallback_trace(reason, weights):
    """
    Create a fallback trace when the model does not return structured trace data.
    """
    factor_labels = {
        "previous_experience": "Previous subject experience",
        "skills": "Skill complementarity",
        "working_style": "Working style alignment",
        "availability": "Availability overlap",
        "diversity": "Strength diversity",
        "external_analytics": "External learning analytics",
    }

    reason_text = (reason or "Balanced match based on the available learner profile signals.").strip()
    ranked = sorted(weights.items(), key=lambda item: item[1], reverse=True)[:3]

    return [
        {
            "factor": factor,
            "label": factor_labels.get(factor, factor.replace("_", " ").title()),
            "weight": round(weight, 4),
            "evidence": reason_text,
        }
        for factor, weight in ranked
    ]


def _normalize_matches(parsed, ai_preferences):
    """
    Ensure model output has deterministic explainability fields.
    """
    groups = parsed.get("groups") if isinstance(parsed, dict) else None
    if not isinstance(groups, list):
        return {"groups": []}

    default_weights = _weights_from_preferences(ai_preferences)
    normalized_weights = _normalize_weights(parsed.get("factor_weights", default_weights))

    normalized_groups = []
    for group in groups:
        if not isinstance(group, dict):
            continue

        members = group.get("members", [])
        reason = group.get("reason", "")
        trace = group.get("match_trace", [])

        if not isinstance(trace, list) or len(trace) == 0:
            trace = _fallback_trace(reason, normalized_weights)
        else:
            # Humanize any raw preference keys the model may have returned as labels.
            preference_label_map = {
                "deadline_preference": "Deadline management",
                "discussion_preference": "Discussion style",
                "critical_feedback_preference": "Comfort with critical feedback",
                "disagreement_preference": "Conflict handling",
                "new_concepts_preference": "Openness to new concepts",
                "teammate_work_preference": "Preferred work distribution",
                "deadline_working_pattern": "Deadline work rhythm",
            }

            cleaned_trace = []
            for entry in trace:
                if not isinstance(entry, dict):
                    continue

                factor = str(entry.get("factor", "")).strip()
                evidence = str(entry.get("evidence", "")).strip()
                if not factor:
                    continue

                label = str(entry.get("label", factor.replace("_", " ").title()))
                if label in preference_label_map:
                    label = preference_label_map[label]
                elif factor in preference_label_map:
                    label = preference_label_map[factor]

                cleaned_trace.append(
                    {
                        "factor": factor,
                        "label": label,
                        "weight": round(float(normalized_weights.get(factor, 0.0)), 4),
                        "evidence": evidence or reason,
                    }
                )

            trace = cleaned_trace if cleaned_trace else _fallback_trace(reason, normalized_weights)

        normalized_groups.append(
            {
                "members": members,
                "reason": reason,
                "match_trace": trace,
            }
        )

    return {
        "factor_weights": normalized_weights,
        "groups": normalized_groups,
    }


def _chunk_students_for_ideal_size(student_ids, ideal_team_size):
    """Partition students into teams of ideal_team_size with minimal remainder deviation."""
    ids = [sid for sid in student_ids if isinstance(sid, str) and len(sid) == 36]
    n = len(ids)
    if n == 0 or ideal_team_size < 2:
        return []

    teams = []
    idx = 0
    while idx < n:
        remaining = n - idx
        if remaining <= ideal_team_size:
            teams.append(ids[idx:])
            break
        if remaining == ideal_team_size + 1:
            teams.append(ids[idx : idx + ideal_team_size + 1])
            break
        teams.append(ids[idx : idx + ideal_team_size])
        idx += ideal_team_size
    return teams


def _valid_member_id(student_id):
    return isinstance(student_id, str) and len(student_id) == 36


def _source_group_for_members(members, original_groups):
    """Pick the pre-rebalance AI group with the largest member overlap."""
    member_set = {member for member in members if _valid_member_id(member)}
    if not member_set:
        return None

    best_group = None
    best_overlap = 0
    for group in original_groups:
        if not isinstance(group, dict):
            continue
        group_members = {
            member for member in group.get("members", []) if _valid_member_id(member)
        }
        overlap = len(member_set & group_members)
        if overlap > best_overlap:
            best_overlap = overlap
            best_group = group

    return best_group if best_overlap > 0 else None


def _rebalanced_group_payload(
    chunk,
    chunk_index,
    original_groups,
    *,
    template_reason,
    group_reasons,
    factor_weights,
):
    """Preserve per-team explainability when re-chunking to the ideal team size."""
    source = _source_group_for_members(chunk, original_groups)
    reason = (
        (source.get("reason") if source else None)
        or (group_reasons[chunk_index] if chunk_index < len(group_reasons) else None)
        or template_reason
    )

    trace = None
    if source and isinstance(source.get("match_trace"), list) and source.get("match_trace"):
        trace = [dict(entry) for entry in source["match_trace"] if isinstance(entry, dict)]

    if not trace:
        trace = _fallback_trace(reason, factor_weights or {})

    return {
        "members": chunk,
        "reason": reason,
        "match_trace": trace,
    }


def _enforce_ideal_team_sizes(matches, ideal_team_size, all_student_ids=None):
    """Rebalance AI groups so every known student is assigned once at the ideal team size."""
    if not isinstance(matches, dict) or not ideal_team_size or ideal_team_size < 2:
        return matches

    groups = matches.get("groups")
    if not isinstance(groups, list) or not groups:
        return matches

    factor_weights = matches.get("factor_weights", {})

    known_ids = [
        student_id
        for student_id in (all_student_ids or [])
        if _valid_member_id(student_id)
    ]
    known_set = set(known_ids)

    template_reason = "Grouped to match the configured ideal team size."
    group_reasons = []

    for group in groups:
        if not isinstance(group, dict):
            continue
        if group.get("reason"):
            group_reasons.append(group["reason"])
            if template_reason == "Grouped to match the configured ideal team size.":
                template_reason = group["reason"]

    if known_ids:
        ai_ordered = []
        for group in groups:
            if not isinstance(group, dict):
                continue
            for member in group.get("members", []):
                if member in known_set and member not in ai_ordered:
                    ai_ordered.append(member)
        missing = [student_id for student_id in known_ids if student_id not in ai_ordered]
        all_members = ai_ordered + missing
    else:
        all_members = []
        for group in groups:
            if not isinstance(group, dict):
                continue
            for member in group.get("members", []):
                if _valid_member_id(member) and member not in all_members:
                    all_members.append(member)

    if not all_members:
        return matches

    if known_ids:
        chunks = _chunk_students_for_ideal_size(all_members, ideal_team_size)
        matches["groups"] = [
            _rebalanced_group_payload(
                chunk,
                index,
                groups,
                template_reason=template_reason,
                group_reasons=group_reasons,
                factor_weights=factor_weights,
            )
            for index, chunk in enumerate(chunks)
        ]
        return matches

    current_sizes = [
        len([member for member in group.get("members", []) if _valid_member_id(member)])
        for group in groups
        if isinstance(group, dict)
    ]
    if (
        current_sizes
        and sum(current_sizes) == len(all_members)
        and all(size == ideal_team_size for size in current_sizes)
    ):
        return matches

    chunks = _chunk_students_for_ideal_size(all_members, ideal_team_size)
    matches["groups"] = [
        _rebalanced_group_payload(
            chunk,
            index,
            groups,
            template_reason=template_reason,
            group_reasons=group_reasons,
            factor_weights=factor_weights,
        )
        for index, chunk in enumerate(chunks)
    ]
    return matches


def _call_gemini_with_retries(prompt, active_key, model_name, max_attempts=4):
    """
    Call Gemini with retry/backoff for transient overload and gateway failures.
    """
    retryable_statuses = {429, 500, 502, 503, 504}
    last_error_text = ""
    request_timeout = _gemini_generate_timeout()

    for attempt in range(1, max_attempts + 1):
        try:
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={active_key}"
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": prompt}
                        ]
                    }
                ]
            }
            request = urllib.request.Request(
                endpoint,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )

            with urllib.request.urlopen(
                request, timeout=request_timeout, context=_gemini_ssl_context()
            ) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except TimeoutError as e:
            last_error_text = _gemini_timeout_error_text(e)
            if attempt == max_attempts:
                raise RuntimeError(last_error_text) from e
            sleep_seconds = (2 ** (attempt - 1)) + random.uniform(0, 0.75)
            print(
                f"Gemini model '{model_name}' timed out after {request_timeout}s; "
                f"retrying in {sleep_seconds:.2f}s (attempt {attempt}/{max_attempts})"
            )
            time.sleep(sleep_seconds)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="ignore")
            last_error_text = f"Gemini HTTP {e.code}: {body}"

            if e.code == 404:
                # Model not available for this API/version; fail over immediately.
                raise RuntimeError(last_error_text) from e

            if e.code == 429 and _is_hard_quota_exhausted(body):
                # Permanent for this key/model until quota/billing changes.
                raise RuntimeError(last_error_text) from e

            if e.code not in retryable_statuses or attempt == max_attempts:
                raise RuntimeError(last_error_text) from e

            # Exponential backoff with jitter to reduce synchronized retry bursts.
            retry_hint = _parse_retry_delay_seconds(body)
            computed = (2 ** (attempt - 1)) + random.uniform(0, 0.75)
            sleep_seconds = max(retry_hint, computed) if retry_hint else computed
            print(
                f"Gemini model '{model_name}' transient HTTP {e.code}; "
                f"retrying in {sleep_seconds:.2f}s (attempt {attempt}/{max_attempts})"
            )
            time.sleep(sleep_seconds)
        except urllib.error.URLError as e:
            if _is_gemini_timeout_error(e):
                last_error_text = _gemini_timeout_error_text(e)
            else:
                last_error_text = f"Gemini network error: {e}"
            if attempt == max_attempts:
                raise RuntimeError(last_error_text) from e
            sleep_seconds = (2 ** (attempt - 1)) + random.uniform(0, 0.75)
            print(
                f"Gemini model '{model_name}' network issue; "
                f"retrying in {sleep_seconds:.2f}s (attempt {attempt}/{max_attempts})"
            )
            time.sleep(sleep_seconds)

    raise RuntimeError(last_error_text or "Gemini request failed after retries")


def _call_gemini_with_model_failover(prompt, active_key):
    """
    Try multiple Gemini models in sequence. Keeps matching AI-only by failing
    only after all configured models are exhausted.
    """
    models = _effective_model_candidates(active_key)
    failures = []

    for model_name in models:
        try:
            response_json = _call_gemini_with_retries(prompt, active_key, model_name)
            return response_json, model_name
        except RuntimeError as e:
            failures.append(f"{model_name}: {e}")
            print(f"Gemini model failover: '{model_name}' failed, trying next model.")
        except (TimeoutError, socket.timeout) as e:
            failures.append(f"{model_name}: {_gemini_timeout_error_text(e)}")
            print(f"Gemini model failover: '{model_name}' timed out, trying next model.")

    raise RuntimeError(
        "All configured Gemini models failed. "
        f"Tried: {', '.join(models)}. "
        f"Last errors: {' | '.join(failures)}"
    )

def get_recent_feedback_patterns():
    """
    Fetch recent feedback patterns from the database to inform AI matching.
    """
    try:
        # Import here to avoid circular imports
        from database import supabase

        if not supabase:
            return None

        # Get feedback from the last 30 days
        thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()

        response = supabase.table("feedback").select("""
            team_id,
            skill_match,
            style_match,
            overall_satisfaction,
            teams(name)
        """).gte("created_at", thirty_days_ago).execute()

        if not response.data:
            return None

        # Group by team and calculate averages
        team_feedback = {}
        for feedback in response.data:
            team_id = feedback["team_id"]
            team_name = feedback.get("teams", {}).get("name", f"Team {team_id[:8]}")

            if team_id not in team_feedback:
                team_feedback[team_id] = {
                    "name": team_name,
                    "skill_match": [],
                    "style_match": [],
                    "overall": []
                }

            team_feedback[team_id]["skill_match"].append(feedback["skill_match"])
            team_feedback[team_id]["style_match"].append(feedback["style_match"])
            team_feedback[team_id]["overall"].append(feedback["overall_satisfaction"])

        # Build feedback summary
        patterns = []
        for team_id, data in team_feedback.items():
            avg_skill = sum(data["skill_match"]) / len(data["skill_match"])
            avg_style = sum(data["style_match"]) / len(data["style_match"])
            avg_overall = sum(data["overall"]) / len(data["overall"])

            if avg_overall < 3:
                patterns.append(f"- The last time we paired students in '{data['name']}', the satisfaction was {avg_overall:.1f}/5")
            elif avg_skill < 3:
                patterns.append(f"- Students in '{data['name']}' reported low skill match ({avg_skill:.1f}/5)")
            elif avg_style < 3:
                patterns.append(f"- Students in '{data['name']}' reported low style match ({avg_style:.1f}/5)")

        return "\n".join(patterns) if patterns else None

    except Exception as e:
        print(f"Error fetching feedback patterns: {e}")
        return None

def match_students(students, ai_preferences=None, class_context=None):
    """
    Match students into teams using AI, with customizable preferences.
    ai_preferences: dict with keys like focus_skills, focus_working_style, etc.
    """
    if ai_preferences is None:
        ai_preferences = {
            "wanted_skills": [],
            "focus_skills": False,
            "focus_working_style": True,
            "focus_availability": True,
            "balance_diversity": True
        }

    if class_context is None:
        class_context = {}

    wanted_skills = _resolve_wanted_skills(ai_preferences)

    active_key = (os.getenv("GEMINI_API_KEY") or GEMINI_API_KEY or "").strip()
    if not active_key:
        return {"error": "AI Matching failed: GEMINI_API_KEY is missing in environment."}
    print(f"Gemini runtime key fingerprint: len={len(active_key)} sha16={hashlib.sha256(active_key.encode()).hexdigest()[:16]}")

    def _scale(value, default=3):
        try:
            n = int(value)
        except (TypeError, ValueError):
            n = default
        return max(1, min(5, n))

    def _subject_list(value):
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        if isinstance(value, str):
            text = value.strip()
            if not text:
                return []
            try:
                parsed = json.loads(text)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
            except Exception:
                pass
            return [part.strip() for part in text.split(",") if part.strip()]
        return []

    # Extract the full matching criteria payload for explainable matching.
    cleaned_students = []
    for s in students:
        alevel_subjects = _subject_list(s.get("survey_alevel_or_equivalent_titles"))
        degree_title = (s.get("survey_degree_title") or "").strip()
        ancillary_module = (s.get("survey_ancillary_module") or "").strip()

        cleaned = {
            "id": s.get("id"),
            "name": s.get("survey_name", "Unknown"),
            "previous_subject_experience": {
                "alevel_or_equivalent_subjects": alevel_subjects,
                "ancillary_module": ancillary_module,
            },
            "relevant_skills_confidence_1_to_5": {
                "coding": _scale(s.get("survey_confidence_coding")),
                "written_reports": _scale(s.get("survey_confidence_written_reports")),
                "presentation_public_speaking": _scale(s.get("survey_confidence_presentation_public_speaking")),
                "mathematical_literacy": _scale(s.get("survey_confidence_mathematical_literacy")),
                "understanding_abstract_complex_content": _scale(s.get("survey_confidence_abstract_complex_content")),
                "conflict_resolution": _scale(s.get("survey_confidence_conflict_resolution")),
            },
            "approach_to_work_1_to_5": {
                "deadline_preference": _scale(s.get("survey_approach_deadline")),
                "discussion_preference": _scale(s.get("survey_approach_discussion")),
                "disagreement_preference": _scale(s.get("survey_approach_disagreement")),
                "new_concepts_preference": _scale(s.get("survey_approach_new_concepts")),
                "communication_preference": _scale(s.get("survey_approach_communication")),
                "teammate_work_preference": _scale(s.get("survey_approach_teammate_work")),
                "heavy_workload_preference": _scale(s.get("survey_approach_heavy_workload")),
                "group_project_role_preference": _scale(s.get("survey_approach_group_project_role")),
                "critical_feedback_preference": _scale(s.get("survey_approach_critical_feedback")),
            },
            "scheduling_context": {
                "coursework_deadline": class_context.get("coursework_deadline"),
                "deadline_working_pattern": _scale(s.get("survey_approach_deadline")),
                "communication_style_for_coordination": _scale(s.get("survey_approach_communication")),
            },
        }
        external = s.get("external_learning_analytics")
        if external:
            cleaned["external_learning_analytics"] = external
        if wanted_skills:
            cleaned["relevant_skills_confidence_1_to_5"] = {
                key: cleaned["relevant_skills_confidence_1_to_5"][key]
                for key in wanted_skills
            }
        cleaned_students.append(cleaned)

    # Compact JSON to reduce token usage under free-tier quotas.
    profiles_json = json.dumps(cleaned_students, separators=(",", ":"))

    # Build dynamic prompt based on preferences
    prompt_parts = ["Form student groups for project work."]
    prompt_parts.append(
        "Do not ask for additional information. Use only the provided JSON fields and class context to make the grouping decision."
    )
    prompt_parts.append(
        "Use ALL of these matching criteria for every grouping decision: "
        "(1) previous subject experience (A-Level/equivalent subjects + ancillary module), "
        "(2) relevant skills confidence (coding, written reports, presentation/public speaking, mathematical literacy, abstract/complex content, conflict resolution), "
        "(3) approach to work preferences across all 9 sliders, "
        "(4) scheduling_context, "
        "(5) external_learning_analytics when present (LMS login patterns, module marks, video engagement trends)."
    )
    if wanted_skills:
        skill_labels = ", ".join(
            MATCHING_SKILL_LABELS.get(skill, skill.replace("_", " ").title())
            for skill in wanted_skills
        )
        prompt_parts.append(
            "Use ALL of these matching criteria for every grouping decision: "
            "(1) previous subject experience (A-Level/equivalent subjects + ancillary module), "
            f"(2) relevant skills confidence for these educator-selected skills only: {skill_labels}, "
            "(3) approach to work preferences across all 9 sliders, "
            "(4) scheduling_context."
        )
    else:
        prompt_parts.append(
            "Use ALL of these matching criteria for every grouping decision: "
            "(1) previous subject experience (A-Level/equivalent subjects + ancillary module), "
            "(3) approach to work preferences across all 9 sliders, "
            "(4) scheduling_context."
        )
    prompt_parts.append(
        "Important rule: For discussion_preference, avoid creating groups where everyone is the same extreme; "
        "prefer balance so each team has complementary discussion dynamics."
    )

    prompt_parts.append(
        "When external_learning_analytics is available for a student, use those trends alongside survey data "
        "to improve team balance (e.g. complementary login times, mixed academic strengths). "
        "Students without external data should still be matched fairly using survey fields only."
    )

    if ai_preferences.get("focus_skills", True):
        prompt_parts.append("Prioritize complementary skills within each group.")
    if wanted_skills:
        skill_labels = ", ".join(
            MATCHING_SKILL_LABELS.get(skill, skill.replace("_", " ").title())
            for skill in wanted_skills
        )
        prompt_parts.append(
            "Prioritize complementary skills within each group for these skills only: "
            f"{skill_labels}. Ensure each team has a mix of strengths across those dimensions."
        )

    if ai_preferences.get("focus_working_style", True):
        prompt_parts.append("Consider working styles and communication preferences.")

    if ai_preferences.get("balance_diversity", True):
        prompt_parts.append("Create diverse groups with different strengths.")

    if ai_preferences.get("focus_availability", True):
        prompt_parts.append("Consider scheduling compatibility using scheduling_context.")

    ideal_team_size = class_context.get("ideal_team_size") or class_context.get("max_team_size", 3)
    student_count = class_context.get("student_count", len(cleaned_students))
    remainder = student_count % ideal_team_size if ideal_team_size else 0
    prompt_parts.append(
        f"\n🚨 TEAM SIZE CONSTRAINT: There are {student_count} students. "
        f"The ideal team size is {ideal_team_size} — every group should have exactly {ideal_team_size} members."
    )
    if remainder == 0:
        prompt_parts.append(
            f"All groups must have exactly {ideal_team_size} members "
            f"({student_count // ideal_team_size} teams of {ideal_team_size})."
        )
    else:
        prompt_parts.append(
            f"Student count does not divide evenly by {ideal_team_size} (remainder {remainder}). "
            f"Minimize deviations: create as many teams of exactly {ideal_team_size} as possible. "
            f"At most one team may differ; prefer a single team of {ideal_team_size + 1} "
            f"over teams smaller than {ideal_team_size} or singleton groups."
        )
    prompt_parts.append(f"\n\nStudent data (JSON format):\n{profiles_json}\n\n")
    prompt_parts.append(
        "Create balanced groups and return ONLY valid JSON with this schema: "
        "{"
        "\"factor_weights\": {"
        "\"previous_experience\": number,"
        "\"skills\": number,"
        "\"working_style\": number,"
        "\"availability\": number,"
        "\"diversity\": number,"
        "\"external_analytics\": number"
        "},"
        "\"groups\": [{"
        "\"members\": [\"id1\", \"id2\"],"
        "\"reason\": \"short summary of why this group works\","
        "\"match_trace\": [{"
        "\"factor\": \"previous_experience\","
        "\"label\": \"Previous subject experience\","
        "\"evidence\": \"specific reason using the input profile data\""
        "}]"
        "}]"
        "}."
    )

    prompt = "\n".join(prompt_parts)

    # Keep the prompt compact and deterministic for API reliability.

    try:
        # AI-only matching with per-model retries and cross-model failover.
        response_json, model_used = _call_gemini_with_model_failover(prompt, active_key)
        print(f"Gemini matching succeeded using model: {model_used}")

        parsed = _parse_model_json_response(response_json)
        normalized = _normalize_matches(parsed, ai_preferences)
        ideal_team_size = class_context.get("ideal_team_size") or class_context.get("max_team_size")
        roster_ids = [student.get("id") for student in students if student.get("id")]
        enforced = _enforce_ideal_team_sizes(
            normalized,
            ideal_team_size,
            all_student_ids=roster_ids,
        )
        return enforced
    except RuntimeError as e:
        return {"error": f"AI Matching failed: {e}"}
    except Exception as e:
        # Catch quota/rate limit/invalid key errors or parsing errors gracefully
        key_suffix = (active_key[-4:] if active_key else "none")
        print(f"Gemini generate_content failed (key_suffix={key_suffix}): {e}")
        return {"error": f"AI Matching failed: {str(e)}"}