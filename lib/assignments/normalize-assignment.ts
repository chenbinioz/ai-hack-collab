/** Normalize assignment rows across max_team_size / ideal_team_size schema variants. */
export function normalizeAssignmentRow<T extends Record<string, unknown>>(row: T) {
  const idealTeamSize =
    typeof row.ideal_team_size === "number"
      ? row.ideal_team_size
      : typeof row.max_team_size === "number"
        ? row.max_team_size
        : 3;

  return {
    ...row,
    ideal_team_size: idealTeamSize,
  };
}

export function assignmentUpdatesFromBody(body: {
  ideal_team_size?: number;
  max_team_size?: number;
  [key: string]: unknown;
}): Record<string, unknown> {
  const rawSize = body.ideal_team_size ?? body.max_team_size;
  if (rawSize === undefined) {
    return {};
  }

  return {
    ideal_team_size: Math.max(2, Math.min(10, Number(rawSize))),
  };
}
