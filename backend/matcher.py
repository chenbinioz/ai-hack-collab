import os
import json
import hashlib
import time
import random
import re
from pathlib import Path
from datetime import datetime, timedelta
import urllib.request
import urllib.error
from dotenv import load_dotenv

# Load project-root .env regardless of process working directory.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env", override=True)

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Use a valid model name. Can be overridden for resilience in different environments.
MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-2.5-flash")


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

    with urllib.request.urlopen(request, timeout=30) as resp:
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


def _weights_from_preferences(ai_preferences):
    """
    Build explainable factor weights from boolean AI preferences.
    """
    toggles = {
        "previous_experience": True,
        "skills": bool(ai_preferences.get("focus_skills", True)),
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


def _call_gemini_with_retries(prompt, active_key, model_name, max_attempts=4):
    """
    Call Gemini with retry/backoff for transient overload and gateway failures.
    """
    retryable_statuses = {429, 500, 502, 503, 504}
    last_error_text = ""

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

            with urllib.request.urlopen(request, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8"))
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
            "focus_skills": True,
            "focus_working_style": True,
            "focus_availability": True,
            "balance_diversity": True
        }

    if class_context is None:
        class_context = {}

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

    if ai_preferences.get("focus_working_style", True):
        prompt_parts.append("Consider working styles and communication preferences.")

    if ai_preferences.get("balance_diversity", True):
        prompt_parts.append("Create diverse groups with different strengths.")

    if ai_preferences.get("focus_availability", True):
        prompt_parts.append("Consider scheduling compatibility using scheduling_context.")

    max_team_size = class_context.get("max_team_size", 3)
    prompt_parts.append(f"\n🚨 HARD CONSTRAINT: Each group must have AT MOST {max_team_size} members. Do not exceed {max_team_size} students per group.")
    prompt_parts.append(f"\nTarget: Create groups with 2 to {max_team_size} students each, never more than {max_team_size}.")
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
        return _normalize_matches(parsed, ai_preferences)
    except RuntimeError as e:
        return {"error": f"AI Matching failed: {e}"}
    except Exception as e:
        # Catch quota/rate limit/invalid key errors or parsing errors gracefully
        key_suffix = (active_key[-4:] if active_key else "none")
        print(f"Gemini generate_content failed (key_suffix={key_suffix}): {e}")
        return {"error": f"AI Matching failed: {str(e)}"}