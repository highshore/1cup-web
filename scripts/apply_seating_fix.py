from pathlib import Path

PATH = Path("app/meetup/[id]/EventDetailClient.tsx")
text = PATH.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
'''import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";''',
'''import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";''',
"add useDroppable import",
)

replace_once(
'''interface SavedSeatingArrangement {
  assignments: SeatingAssignment[];
  generatedAt: Date;
  generatedBy: string;
}
''',
'''interface SavedSeatingArrangement {
  assignments: SeatingAssignment[];
  generatedAt: Date;
  generatedBy: string;
}

type SeatingDndTargetType = "participant" | "group";

interface SeatingDndTarget {
  type: SeatingDndTargetType;
  sessionNumber: number;
  uid: string;
}

const makeParticipantDndId = (sessionNumber: number, uid: string) =>
  `participant:${sessionNumber}:${uid}`;

const makeGroupDndId = (sessionNumber: number, leaderUid: string) =>
  `group:${sessionNumber}:${leaderUid}`;

const parseSeatingDndId = (id: string): SeatingDndTarget | null => {
  const [type, sessionNumberRaw, ...uidParts] = id.split(":");
  const sessionNumber = Number(sessionNumberRaw);
  const uid = uidParts.join(":");

  if (
    (type !== "participant" && type !== "group") ||
    !Number.isInteger(sessionNumber) ||
    !uid
  ) {
    return null;
  }

  return {
    type,
    sessionNumber,
    uid,
  };
};
''',
"add UUID-safe dnd ids",
)

replace_once(
'''const ParticipantItemWrapper = styled.div`
  /* Wrapper for dnd-kit sortable */
`;

// Draggable Participant Component''',
'''const ParticipantItemWrapper = styled.div`
  /* Wrapper for dnd-kit sortable */
`;

const DragOverlayCard = styled.div`
  min-width: 220px;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.18);
  pointer-events: none;
`;

const DroppableGroupCard: React.FC<{
  assignment: SeatingAssignment;
  children: React.ReactNode;
  onClick: () => void;
}> = ({ assignment, children, onClick }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: makeGroupDndId(assignment.sessionNumber, assignment.leaderUid),
  });

  return (
    <GroupCard
      ref={setNodeRef}
      $hasTranscript={!!assignment.transcriptId}
      onClick={onClick}
      style={
        isOver
          ? {
              outline: "3px solid #2563eb",
              outlineOffset: "2px",
            }
          : undefined
      }
    >
      {children}
    </GroupCard>
  );
};

// Draggable Participant Component''',
"add droppable group and plain overlay",
)

replace_once(
'''  const uniqueId = `${sessionNumber}-${participant.uid}`;''',
'''  const uniqueId = makeParticipantDndId(sessionNumber, participant.uid);''',
"use UUID-safe participant dnd id",
)

replace_once(
'''  const [seatingLoading, setSeatingLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);''',
'''  const [seatingLoading, setSeatingLoading] = useState(false);
  const [seatingShareLoading, setSeatingShareLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);''',
"add seating share loading state",
)

replace_once(
'''  const formatLeaderDisplay = (user: UserWithDetails): string => {
    const validName = isValidDisplayName(user.displayName);
    return validName ? user.displayName! : "익명";
  };

  // useEffect hooks''',
'''  const formatLeaderDisplay = (user: UserWithDetails): string => {
    const validName = isValidDisplayName(user.displayName);
    return validName ? user.displayName! : "익명";
  };

  const formatSeatingImageParticipant = (user: UserWithDetails): string => {
    const validName = isValidDisplayName(user.displayName);
    return validName ? maskName(user.displayName!) : "익명";
  };

  const createSeatingImageBlob = async (): Promise<Blob> => {
    if (!event || seatingAssignments.length === 0) {
      throw new Error("좌석 배치가 없습니다.");
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("이미지를 생성할 수 없습니다.");
    }

    const width = 1200;
    const margin = 56;
    const columnGap = 32;
    const headerHeight = 190;
    const columnWidth = (width - margin * 2 - columnGap) / 2;
    const rowHeight = 38;
    const groupGap = 20;
    const groupHeaderHeight = 78;
    const groupPadding = 24;

    const sessionAssignments = [1, 2].map((sessionNumber) =>
      seatingAssignments.filter(
        (assignment) => assignment.sessionNumber === sessionNumber
      )
    );

    const getGroupHeight = (assignment: SeatingAssignment) =>
      groupPadding * 2 +
      groupHeaderHeight +
      Math.max(assignment.participants.length, 1) * rowHeight;

    const getSessionHeight = (assignments: SeatingAssignment[]) => {
      const groupsHeight = assignments.reduce(
        (sum, assignment) => sum + getGroupHeight(assignment),
        0
      );
      const gaps = Math.max(assignments.length - 1, 0) * groupGap;
      return 74 + groupsHeight + gaps + 28;
    };

    const contentHeight = Math.max(
      220,
      ...sessionAssignments.map(getSessionHeight)
    );
    const height = headerHeight + contentHeight + margin;

    canvas.width = width;
    canvas.height = height;

    const drawRoundedRect = (
      x: number,
      y: number,
      rectWidth: number,
      rectHeight: number,
      radius: number
    ) => {
      const r = Math.min(radius, rectWidth / 2, rectHeight / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + rectWidth - r, y);
      ctx.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + r);
      ctx.lineTo(x + rectWidth, y + rectHeight - r);
      ctx.quadraticCurveTo(
        x + rectWidth,
        y + rectHeight,
        x + rectWidth - r,
        y + rectHeight
      );
      ctx.lineTo(x + r, y + rectHeight);
      ctx.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#111827";
    ctx.font = '700 42px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText("영어한잔 좌석 배치", margin, 72);

    ctx.fillStyle = "#374151";
    ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(event.title, margin, 112);

    const eventMeta = [event.date, event.location_name].filter(Boolean).join(" · ");
    ctx.fillStyle = "#6b7280";
    ctx.font = '400 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(eventMeta, margin, 148);

    sessionAssignments.forEach((assignments, sessionIndex) => {
      const x = margin + sessionIndex * (columnWidth + columnGap);
      const y = headerHeight;
      const sessionHeight = getSessionHeight(assignments);

      ctx.fillStyle = "#f8fafc";
      drawRoundedRect(x, y, columnWidth, sessionHeight, 24);
      ctx.fill();
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#111827";
      ctx.font = '700 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(`세션 ${sessionIndex + 1}`, x + 28, y + 46);

      let currentY = y + 74;

      assignments.forEach((assignment, tableIndex) => {
        const groupHeight = getGroupHeight(assignment);

        ctx.fillStyle = "#ffffff";
        drawRoundedRect(
          x + 20,
          currentY,
          columnWidth - 40,
          groupHeight,
          18
        );
        ctx.fill();
        ctx.strokeStyle = "#e5e7eb";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#6b7280";
        ctx.font = '700 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(`TABLE ${tableIndex + 1}`, x + 44, currentY + 32);

        ctx.fillStyle = "#111827";
        ctx.font = '700 21px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(
          `리더 · ${formatLeaderDisplay(assignment.leaderDetails)}`,
          x + 44,
          currentY + 64
        );

        const participantStartY = currentY + groupPadding + groupHeaderHeight;
        if (assignment.participants.length === 0) {
          ctx.fillStyle = "#9ca3af";
          ctx.font = '400 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
          ctx.fillText("참가자 없음", x + 44, participantStartY + 10);
        } else {
          assignment.participants.forEach((participant, participantIndex) => {
            const rowY = participantStartY + participantIndex * rowHeight;
            ctx.fillStyle = "#111827";
            ctx.font = '500 19px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText(
              `• ${formatSeatingImageParticipant(participant)}`,
              x + 44,
              rowY + 12
            );
          });
        }

        currentY += groupHeight + groupGap;
      });
    });

    ctx.fillStyle = "#9ca3af";
    ctx.font = '500 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = "right";
    ctx.fillText("1Cup English", width - margin, height - 24);
    ctx.textAlign = "left";

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("PNG 생성에 실패했습니다."));
      }, "image/png");
    });
  };

  const handleShareSeatingImage = async () => {
    if (!event || seatingAssignments.length === 0) {
      alert("공유할 좌석 배치가 없습니다.");
      return;
    }

    setSeatingShareLoading(true);
    try {
      const blob = await createSeatingImageBlob();
      const safeDate = event.date || new Date().toISOString().slice(0, 10);
      const file = new File([blob], `1cup-seating-${safeDate}.png`, {
        type: "image/png",
      });
      const shareData: ShareData = {
        title: "영어한잔 좌석 배치",
        text: `${event.title} 좌석 배치`,
        files: [file],
      };
      const canShareFiles =
        typeof navigator.share === "function" &&
        (typeof navigator.canShare !== "function" || navigator.canShare(shareData));
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      if (isMobile && canShareFiles) {
        await navigator.share(shareData);
        return;
      }

      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          alert("좌석 이미지를 클립보드에 복사했습니다. 단체 채팅방에 바로 붙여넣을 수 있습니다.");
          return;
        } catch (clipboardError) {
          console.warn("Could not copy seating image to clipboard:", clipboardError);
        }
      }

      if (canShareFiles) {
        await navigator.share(shareData);
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = file.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      alert("좌석 이미지를 PNG 파일로 저장했습니다.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error("Error sharing seating image:", error);
      alert(
        "좌석 이미지 공유 중 오류가 발생했습니다: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setSeatingShareLoading(false);
    }
  };

  // useEffect hooks''',
"add clean seating PNG share/copy",
)

replace_once(
'''  const handleDragStart = (event: DragEndEvent) => {
    setActiveId(event.active.id as string);
  };

  // dnd-kit drag end handler
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) {
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Do nothing if dropped in the same place
    if (activeId === overId) {
      return;
    }

    const [activeSessionStr, activeUid] = activeId.split("-");
    const [overSessionStr, _] = overId.split("-");

    const activeSession = parseInt(activeSessionStr, 10);
    const overSession = parseInt(overSessionStr, 10);

    // Prevent dragging between sessions
    if (activeSession !== overSession) {
      return;
    }

    setSeatingAssignments((prevAssignments) => {
      let sourceGroupIndex = -1;
      let draggedItemIndex = -1;
      let draggedItem: UserWithDetails | undefined;

      // Find the source group and the dragged participant within the correct session
      prevAssignments.forEach((group, groupIndex) => {
        if (group.sessionNumber === activeSession) {
          const itemIndex = group.participants.findIndex(
            (p) => p.uid === activeUid
          );
          if (itemIndex !== -1) {
            sourceGroupIndex = groupIndex;
            draggedItemIndex = itemIndex;
            draggedItem = group.participants[itemIndex];
          }
        }
      });

      // If we didn't find the dragged item, something is wrong.
      if (sourceGroupIndex === -1 || !draggedItem) {
        return prevAssignments;
      }

      // Find the destination group within the same session
      let destGroupIndex = -1;

      // The `over.id` can be a participant's unique ID or a leader's unique ID
      const [__, overUid] = overId.split("-");
      prevAssignments.forEach((group, groupIndex) => {
        if (group.sessionNumber === overSession) {
          if (
            group.leaderUid === overUid ||
            group.participants.some((p) => p.uid === overUid)
          ) {
            destGroupIndex = groupIndex;
          }
        }
      });

      if (destGroupIndex === -1) {
        return prevAssignments;
      }

      const newAssignments = [...prevAssignments];

      // Remove from source group
      const sourceGroup = { ...newAssignments[sourceGroupIndex] };
      sourceGroup.participants = [...sourceGroup.participants];
      sourceGroup.participants.splice(draggedItemIndex, 1);
      newAssignments[sourceGroupIndex] = sourceGroup;

      // Add to destination group
      const destGroup = { ...newAssignments[destGroupIndex] };
      destGroup.participants = [...destGroup.participants];

      // Find drop position
      const overItemIndex = destGroup.participants.findIndex(
        (p) => p.uid === overUid
      );

      if (overItemIndex !== -1) {
        // Insert before the "over" item
        destGroup.participants.splice(overItemIndex, 0, draggedItem);
      } else {
        // Dropped on the group card (leader) or an empty list
        destGroup.participants.push(draggedItem);
      }
      newAssignments[destGroupIndex] = destGroup;

      // Save the updated arrangement to Supabase
      saveSeatingArrangement(newAssignments);

      return newAssignments;
    });
  };

  const activeParticipantData = useMemo(() => {
    if (!activeId) return null;
    const [sessionStr, uid] = activeId.split("-");
    const session = parseInt(sessionStr, 10);

    for (const assignment of seatingAssignments) {
      if (assignment.sessionNumber === session) {
        if (assignment.leaderDetails.uid === uid) {
          return {
            participant: assignment.leaderDetails,
            isLeader: true,
            session,
          };
        }
        const participant = assignment.participants.find((p) => p.uid === uid);
        if (participant) {
          return { participant, isLeader: false, session };
        }
      }
    }
    return null;
  }, [activeId, seatingAssignments]);''',
'''  const handleDragStart = (event: DragEndEvent) => {
    setActiveId(String(event.active.id));
  };

  // dnd-kit drag end handler
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) {
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeTarget = parseSeatingDndId(activeId);
    const overTarget = parseSeatingDndId(overId);

    if (
      !activeTarget ||
      activeTarget.type !== "participant" ||
      !overTarget ||
      activeTarget.sessionNumber !== overTarget.sessionNumber ||
      activeId === overId
    ) {
      return;
    }

    const activeSession = activeTarget.sessionNumber;
    const activeUid = activeTarget.uid;

    setSeatingAssignments((prevAssignments) => {
      let sourceGroupIndex = -1;
      let draggedItemIndex = -1;
      let draggedItem: UserWithDetails | undefined;

      prevAssignments.forEach((group, groupIndex) => {
        if (group.sessionNumber === activeSession) {
          const itemIndex = group.participants.findIndex(
            (participant) => participant.uid === activeUid
          );
          if (itemIndex !== -1) {
            sourceGroupIndex = groupIndex;
            draggedItemIndex = itemIndex;
            draggedItem = group.participants[itemIndex];
          }
        }
      });

      if (sourceGroupIndex === -1 || !draggedItem) {
        return prevAssignments;
      }

      let destGroupIndex = -1;
      prevAssignments.forEach((group, groupIndex) => {
        if (group.sessionNumber !== overTarget.sessionNumber) return;

        const isDestination =
          overTarget.type === "group"
            ? group.leaderUid === overTarget.uid
            : group.participants.some(
                (participant) => participant.uid === overTarget.uid
              );

        if (isDestination) {
          destGroupIndex = groupIndex;
        }
      });

      if (destGroupIndex === -1) {
        return prevAssignments;
      }

      const newAssignments = [...prevAssignments];

      const sourceGroup = { ...newAssignments[sourceGroupIndex] };
      sourceGroup.participants = [...sourceGroup.participants];
      sourceGroup.participants.splice(draggedItemIndex, 1);
      newAssignments[sourceGroupIndex] = sourceGroup;

      const destGroup = { ...newAssignments[destGroupIndex] };
      destGroup.participants = [...destGroup.participants];

      const overUid =
        overTarget.type === "participant" ? overTarget.uid : null;
      const overItemIndex = overUid
        ? destGroup.participants.findIndex(
            (participant) => participant.uid === overUid
          )
        : -1;

      if (overItemIndex !== -1) {
        destGroup.participants.splice(overItemIndex, 0, draggedItem);
      } else {
        destGroup.participants.push(draggedItem);
      }
      newAssignments[destGroupIndex] = destGroup;

      saveSeatingArrangement(newAssignments);
      return newAssignments;
    });
  };

  const activeParticipantData = useMemo(() => {
    if (!activeId) return null;
    const activeTarget = parseSeatingDndId(activeId);
    if (!activeTarget || activeTarget.type !== "participant") return null;

    for (const assignment of seatingAssignments) {
      if (assignment.sessionNumber !== activeTarget.sessionNumber) continue;

      const participant = assignment.participants.find(
        (candidate) => candidate.uid === activeTarget.uid
      );
      if (participant) {
        return {
          participant,
          isLeader: false,
          session: activeTarget.sessionNumber,
        };
      }
    }
    return null;
  }, [activeId, seatingAssignments]);''',
"replace dnd parsing and group targeting",
)

replace_once(
'''            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >''',
'''            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              autoScroll
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >''',
"enable explicit auto scroll",
)

replace_once(
'''                  <SeatingButton onClick={() => setShowSeatingTable(false)}>
                    닫기
                  </SeatingButton>''',
'''                  <SeatingButton
                    onClick={handleShareSeatingImage}
                    disabled={
                      seatingShareLoading || seatingAssignments.length === 0
                    }
                  >
                    <PhotoIcon style={{ width: "18px", height: "18px" }} />
                    {seatingShareLoading
                      ? "이미지 생성 중..."
                      : "좌석 이미지 공유"}
                  </SeatingButton>
                  <SeatingButton onClick={() => setShowSeatingTable(false)}>
                    닫기
                  </SeatingButton>''',
"add share seating button",
)

replace_once(
'''                              items={assignment.participants.map(
                                (p) => `${sessionNumber}-${p.uid}`
                              )}''',
'''                              items={assignment.participants.map((p) =>
                                makeParticipantDndId(sessionNumber, p.uid)
                              )}''',
"use UUID-safe sortable ids",
)

replace_once(
'''                              <GroupCard
                                key={`${sessionNumber}-${assignment.leaderUid}`}
                                $hasTranscript={!!assignment.transcriptId}
                                onClick={() =>
                                  handleSeatingGroupClick(assignment)
                                }
                              >''',
'''                              <DroppableGroupCard
                                assignment={assignment}
                                onClick={() =>
                                  handleSeatingGroupClick(assignment)
                                }
                              >''',
"make group card droppable",
)

replace_once(
'''                              </GroupCard>
                            </SortableContext>''',
'''                              </DroppableGroupCard>
                            </SortableContext>''',
"close droppable group card",
)

replace_once(
'''              <DragOverlay>
                {activeId && activeParticipantData ? (
                  <DraggableParticipant
                    participant={activeParticipantData.participant}
                    onAvatarClick={() => {}} // No action on overlay
                    onAvatarLongPress={undefined}
                    isLeader={activeParticipantData.isLeader}
                    sessionNumber={activeParticipantData.session}
                  />
                ) : null}
              </DragOverlay>''',
'''              <DragOverlay>
                {activeId && activeParticipantData ? (
                  <DragOverlayCard>
                    <ParticipantItem>
                      <UserName>
                        {formatParticipantDisplay(
                          activeParticipantData.participant
                        )}
                      </UserName>
                    </ParticipantItem>
                  </DragOverlayCard>
                ) : null}
              </DragOverlay>''',
"remove duplicate sortable from drag overlay",
)

PATH.write_text(text, encoding="utf-8")
print("Applied seating drag-and-share fix successfully")
