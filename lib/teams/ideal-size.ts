export interface TeamSizeEntry {
  teamId: string;
  teamName: string;
  size: number;
  isIdeal: boolean;
  delta: number;
}

export interface TeamSizeReport {
  idealTeamSize: number;
  allIdeal: boolean;
  teams: TeamSizeEntry[];
  nonIdealTeams: TeamSizeEntry[];
  summaryText: string;
}

export function countMembersPerTeam(
  teamMemberMap: Map<string, string>,
  teams: Array<{ id: string; name: string }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const team of teams) {
    counts.set(team.id, 0);
  }
  for (const teamId of teamMemberMap.values()) {
    counts.set(teamId, (counts.get(teamId) ?? 0) + 1);
  }
  return counts;
}

export function buildTeamSizeReport(
  teams: Array<{ id: string; name: string }>,
  memberCounts: Map<string, number>,
  idealTeamSize: number,
): TeamSizeReport {
  const teamEntries: TeamSizeEntry[] = teams.map((team, index) => {
    const size = memberCounts.get(team.id) ?? 0;
    const delta = size - idealTeamSize;
    return {
      teamId: team.id,
      teamName: team.name || `Team ${index + 1}`,
      size,
      isIdeal: size === idealTeamSize,
      delta,
    };
  });

  const nonIdealTeams = teamEntries.filter((entry) => !entry.isIdeal);
  const allIdeal = nonIdealTeams.length === 0 && teamEntries.length > 0;

  let summaryText: string;
  if (teamEntries.length === 0) {
    summaryText = "";
  } else if (allIdeal) {
    summaryText = `All ${teamEntries.length} team${teamEntries.length === 1 ? "" : "s"} are at the ideal size (${idealTeamSize}).`;
  } else {
    const deviationDetails = nonIdealTeams
      .map((entry) => `${entry.teamName} (${entry.size} member${entry.size === 1 ? "" : "s"})`)
      .join(", ");
    summaryText = `${nonIdealTeams.length} of ${teamEntries.length} team${teamEntries.length === 1 ? "" : "s"} are not the ideal size (${idealTeamSize}): ${deviationDetails}.`;
  }

  return {
    idealTeamSize,
    allIdeal,
    teams: teamEntries,
    nonIdealTeams,
    summaryText,
  };
}
