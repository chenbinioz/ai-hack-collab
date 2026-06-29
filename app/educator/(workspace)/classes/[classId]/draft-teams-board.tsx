"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface DraftTeam {
  id: string;
  name: string;
  reason: string;
  members: string[];
  assignment_id?: string | null;
  match_explanation?: {
    factor_weights?: Record<string, number>;
    match_trace?: Array<{
      factor?: string;
      label?: string;
      evidence?: string;
      weight?: number;
    }>;
  } | null;
}

export interface StudentStats {
  id: string;
  name: string;
  workload: number | null;
  coding: number | null;
  email: string | null;
}

interface DraftTeamsBoardProps {
  classId: string;
  drafts: DraftTeam[];
  studentsMap: Record<string, StudentStats>;
  expectedMemberCount?: number;
  onSwap: (studentId: string, fromDraftId: string, toDraftId: string, reason: string) => Promise<void>;
  onPublish: () => Promise<void>;
}

export function DraftTeamsBoard({ classId, drafts, studentsMap, expectedMemberCount, onSwap, onPublish }: DraftTeamsBoardProps) {
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [pendingSwap, setPendingSwap] = useState<{ studentId: string; fromDraftId: string; toDraftId: string } | null>(null);
  const [swapReason, setSwapReason] = useState("");
  const [isSwapping, setIsSwapping] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const studentId = active.id as string;
    const overId = over.id as string;

    // Find from and to teams
    const fromTeam = drafts.find((t) => t.members.includes(studentId));
    
    // The over item could be a team column OR another student
    let toTeamId = overId;
    const overTeam = drafts.find((t) => t.id === overId);
    if (!overTeam) {
      // Over another student, find that student's team
      const teamWithOverStudent = drafts.find((t) => t.members.includes(overId));
      if (teamWithOverStudent) {
        toTeamId = teamWithOverStudent.id;
      }
    }

    if (fromTeam && fromTeam.id !== toTeamId) {
      setPendingSwap({ studentId, fromDraftId: fromTeam.id, toDraftId: toTeamId });
      setSwapModalOpen(true);
    }
  };

  const submitSwap = async () => {
    if (!pendingSwap || !swapReason.trim()) return;
    setIsSwapping(true);
    try {
      await onSwap(pendingSwap.studentId, pendingSwap.fromDraftId, pendingSwap.toDraftId, swapReason);
      setSwapModalOpen(false);
      setSwapReason("");
      setPendingSwap(null);
    } catch (e) {
      console.error(e);
      alert("Failed to swap student");
    } finally {
      setIsSwapping(false);
    }
  };

  const publishTeams = async () => {
    setIsPublishing(true);
    try {
      await onPublish();
    } catch (e) {
      console.error(e);
      alert("Failed to publish teams");
    } finally {
      setIsPublishing(false);
    }
  };

  const totalAssigned = drafts.reduce((sum, draft) => sum + draft.members.length, 0);
  const totalStudents = expectedMemberCount ?? Object.keys(studentsMap).length;
  const hasUnassigned = totalAssigned < totalStudents;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-brand/10 p-4 rounded-xl border border-brand/20">
        <div>
          <h3 className="font-semibold text-brand">Draft Teams Ready</h3>
          <p className="text-sm text-brand/80">
            Review AI matches. Drag and drop to adjust.
          </p>
          <p className="text-xs text-brand/70 mt-1">
            {totalAssigned} of {totalStudents} students assigned across {drafts.length} teams
          </p>
          {hasUnassigned && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Some students are missing from drafts. Regenerate teams to reassign everyone.
            </p>
          )}
        </div>
        <button
          onClick={publishTeams}
          disabled={isPublishing}
          className="bg-brand text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-brand-deep transition shadow-sm"
        >
          {isPublishing ? "Publishing..." : "Publish Teams"}
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-4 snap-x">
          {drafts.map((draft) => (
            <TeamColumn key={draft.id} draft={draft} studentsMap={studentsMap} />
          ))}
        </div>
      </DndContext>

      {swapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-surface border border-black/10 dark:border-white/10 rounded-2xl p-6 shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold text-foreground mb-4">Manual Override Reason</h3>
            <p className="text-sm text-muted mb-4">
              Please provide a quick reason for swapping this student. This is kept for the administrative audit trail.
            </p>
            <textarea
              className="w-full rounded-xl border border-black/10 bg-background p-3 text-sm focus:border-brand focus:outline-none dark:border-white/15 min-h-[100px]"
              placeholder="e.g. Student requested to be with a friend, or balancing skills better."
              value={swapReason}
              onChange={(e) => setSwapReason(e.target.value)}
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setSwapModalOpen(false); setPendingSwap(null); }}
                className="px-4 py-2 text-sm font-medium text-foreground border border-black/10 dark:border-white/15 rounded-xl hover:bg-black/5"
              >
                Cancel
              </button>
              <button
                onClick={submitSwap}
                disabled={!swapReason.trim() || isSwapping}
                className="px-4 py-2 text-sm font-semibold text-white bg-brand rounded-xl hover:bg-brand-deep disabled:opacity-50"
              >
                {isSwapping ? "Swapping..." : "Confirm Swap"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatFactorLabel(factor: string) {
  const factorLabelMap: Record<string, string> = {
    deadline_preference: "Deadline management",
    discussion_preference: "Discussion style",
    critical_feedback_preference: "Comfort with critical feedback",
    disagreement_preference: "Conflict handling",
    new_concepts_preference: "Openness to new concepts",
    teammate_work_preference: "Preferred work distribution",
    deadline_working_pattern: "Deadline work rhythm",
    previous_experience: "Previous subject experience",
    skills: "Relevant skills",
    working_style: "Working style",
    availability: "Scheduling compatibility",
    diversity: "Team diversity",
  };

  return (
    factorLabelMap[factor] ??
    factor
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function sortedFactorWeights(weights?: Record<string, number>) {
  if (!weights) {
    return [] as Array<[string, number]>;
  }
  return Object.entries(weights).sort(([, a], [, b]) => b - a);
}

function DraftMatchExplanation({ draft }: { draft: DraftTeam }) {
  const hasTrace = (draft.match_explanation?.match_trace?.length ?? 0) > 0;
  const hasWeights = Boolean(draft.match_explanation?.factor_weights);

  if (!draft.reason && !hasTrace && !hasWeights) {
    return null;
  }

  return (
    <div className="mt-2 space-y-3 max-h-72 overflow-y-auto pr-1">
      {draft.reason ? (
        <div className="rounded-xl border border-black/5 bg-background/70 p-3 dark:border-white/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">AI summary</p>
          <p className="mt-2 text-xs leading-relaxed text-foreground whitespace-pre-wrap">{draft.reason}</p>
        </div>
      ) : null}

      {hasWeights ? (
        <div className="rounded-xl border border-black/5 bg-background/70 p-3 dark:border-white/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Factor weights</p>
          <div className="mt-3 space-y-2">
            {sortedFactorWeights(draft.match_explanation?.factor_weights).map(([factor, weight]) => {
              const percentage = Math.max(0, Math.min(100, Math.round(weight * 100)));
              return (
                <div key={factor}>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted">
                    <span>{formatFactorLabel(factor)}</span>
                    <span>{percentage}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {hasTrace ? (
        <div className="rounded-xl border border-black/5 bg-background/70 p-3 dark:border-white/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Why matched</p>
          <ul className="mt-2 space-y-2">
            {draft.match_explanation?.match_trace?.map((trace, index) => (
              <li
                key={`${draft.id}-trace-${index}`}
                className="rounded-lg bg-black/[0.03] px-2.5 py-2 text-xs text-foreground dark:bg-white/[0.05]"
              >
                <span className="font-semibold">
                  {trace.label
                    ? formatFactorLabel(trace.label)
                    : trace.factor
                      ? formatFactorLabel(trace.factor)
                      : `Signal ${index + 1}`}
                  :
                </span>{" "}
                <span className="leading-relaxed">{trace.evidence || "No detailed evidence provided."}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function TeamColumn({ draft, studentsMap }: { draft: DraftTeam, studentsMap: Record<string, StudentStats> }) {
  const { setNodeRef } = useSortable({ id: draft.id });

  // Calculate simple balance metric (e.g. avg coding confidence)
  const membersWithStats = draft.members.map(m => studentsMap[m]).filter(Boolean);
  const avgCoding = membersWithStats.length 
    ? membersWithStats.reduce((sum, s) => sum + (s.coding || 0), 0) / membersWithStats.length 
    : 0;

  return (
    <div
      ref={setNodeRef}
      className="flex-shrink-0 w-96 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 p-4 snap-center flex flex-col max-h-[85vh]"
    >
      <div className="mb-4 flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-foreground">{draft.name}</h4>
          <p className="text-xs text-muted mt-0.5">{draft.members.length} members</p>
          <DraftMatchExplanation draft={draft} />
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs font-mono text-brand bg-brand/10 px-2 py-1 rounded">
            Avg Code: {avgCoding.toFixed(1)}
          </div>
        </div>
      </div>

      <SortableContext items={draft.members} strategy={rectSortingStrategy}>
        <div className="space-y-3 flex-grow min-h-[150px] overflow-y-auto">
          {draft.members.map((memberId) => (
            <StudentCard key={memberId} id={memberId} student={studentsMap[memberId]} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function StudentCard({ id, student }: { id: string, student?: StudentStats }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-surface rounded-xl p-3 border border-black/10 dark:border-white/10 shadow-sm cursor-grab active:cursor-grabbing hover:border-brand/50 transition-colors"
    >
      <div className="font-medium text-sm text-foreground">{student?.name || "Unknown Student"}</div>
      <div className="text-xs text-muted mt-0.5">{student?.email || ""}</div>
      
      <div className="mt-2 flex gap-2">
        {student?.coding !== null && (
          <span className="text-[10px] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded text-muted">
            Code: {student?.coding}
          </span>
        )}
        {student?.workload !== null && (
          <span className="text-[10px] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded text-muted">
            Load: {student?.workload}
          </span>
        )}
      </div>
    </div>
  );
}
