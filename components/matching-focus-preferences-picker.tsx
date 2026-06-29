"use client";

import { ChipPreferencesPicker } from "@/components/chip-preferences-picker";
import {
  ALL_MATCHING_FOCUS_KEYS,
  MATCHING_FOCUS_OPTIONS,
  applyMatchingFocusKeys,
  getSelectedMatchingFocusKeys,
  type AiPreferences,
  type MatchingFocusKey,
} from "@/lib/matching/skill-preferences";

interface MatchingFocusPreferencesPickerProps {
  preferences: AiPreferences;
  onChange: (preferences: AiPreferences) => void;
}

export function MatchingFocusPreferencesPicker({
  preferences,
  onChange,
}: MatchingFocusPreferencesPickerProps) {
  const selected = getSelectedMatchingFocusKeys(preferences);

  const handleChange = (keys: MatchingFocusKey[]) => {
    onChange(applyMatchingFocusKeys(preferences, keys));
  };

  return (
    <ChipPreferencesPicker
      title="Matching factors"
      description="Choose what else the AI should focus on when creating teams."
      selected={selected}
      options={MATCHING_FOCUS_OPTIONS}
      onChange={handleChange}
      orderedKeys={ALL_MATCHING_FOCUS_KEYS}
      emptyMessage="Selected factors will appear here."
      addLabel="Add factor"
      allSelectedMessage="All factors have been added."
    />
  );
}
