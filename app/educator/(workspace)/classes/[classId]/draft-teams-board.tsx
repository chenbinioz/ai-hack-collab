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
  onSwap: (studentId: string, fromDraftId: string, toDraftId: string, reason: string) => Promise<void>;
  onPublish: () => Promise<void>;
}

export function DraftTeamsBoard({ classId, drafts, studentsMap, onSwap, onPublish }: DraftTeamsBoardProps) {
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-brand/10 p-4 rounded-xl border border-brand/20">
        <div>
          <h3 className="font-semibold text-brand">Draft Teams Ready</h3>
          <p className="text-sm text-brand/80">
            Review AI matches. Drag and drop to adjust.
          </p>
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
      className="flex-shrink-0 w-80 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 p-4 snap-center flex flex-col"
    >
      <div className="mb-4 flex justify-between items-start">
        <div>
          <h4 className="font-semibold text-foreground">{draft.name}</h4>
          <p className="text-xs text-muted mt-1 max-w-[200px] line-clamp-2" title={draft.reason}>
            {draft.reason}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs font-mono text-brand bg-brand/10 px-2 py-1 rounded">
            Avg Code: {avgCoding.toFixed(1)}
          </div>
        </div>
      </div>

      <SortableContext items={draft.members} strategy={rectSortingStrategy}>
        <div className="space-y-3 flex-grow min-h-[150px]">
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
