from pathlib import Path

path = Path("app/meetup/[id]/EventDetailClient.tsx")
text = path.read_text(encoding="utf-8")

replacements = [
    (
        '''const ParticipantItemWrapper = styled.div`
  /* Wrapper for dnd-kit sortable */
`;

const DragOverlayCard = styled.div`''',
        '''const ParticipantItemWrapper = styled.div`
  /* Wrapper for dnd-kit sortable */
`;

const ParticipantDragHandle = styled.button`
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;

  &:active {
    cursor: grabbing;
    background: #e5e7eb;
  }

  @media (max-width: 768px) {
    width: 36px;
    height: 36px;
    font-size: 20px;
  }
`;

const DragOverlayCard = styled.div`''',
    ),
    (
        '''      <UserName>{formatParticipantDisplay(participant)}</UserName>
      {isLeader && <LeaderBadge>리더</LeaderBadge>}
    </ParticipantItem>''',
        '''      <UserName>{formatParticipantDisplay(participant)}</UserName>
      {isLeader ? (
        <LeaderBadge>리더</LeaderBadge>
      ) : (
        <ParticipantDragHandle
          type="button"
          aria-label={`${formatParticipantDisplay(participant)} 이동`}
          title="드래그해서 좌석 이동"
          {...attributes}
          {...listeners}
          onClick={(event) => event.stopPropagation()}
        >
          ⋮⋮
        </ParticipantDragHandle>
      )}
    </ParticipantItem>''',
    ),
    (
        '''    <ParticipantItemWrapper
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >''',
        '''    <ParticipantItemWrapper ref={setNodeRef} style={style}>''',
    ),
    (
        '''              <AdminButton onClick={handleSendReminderToParticipants}>
                <MegaphoneIcon />
                <span>Send Reminder</span>
              </AdminButton>''',
        '''              <AdminButton
                onClick={handleShareSeatingImage}
                disabled={
                  seatingShareLoading || seatingAssignments.length === 0
                }
              >
                <PhotoIcon />
                <span>
                  {seatingShareLoading ? "Creating Image..." : "Share Seating Image"}
                </span>
              </AdminButton>
              <AdminButton onClick={handleSendReminderToParticipants}>
                <MegaphoneIcon />
                <span>Send Reminder</span>
              </AdminButton>''',
    ),
    (
        '''              autoScroll
              onDragStart={handleDragStart}''',
        '''              autoScroll={{
                layoutShiftCompensation: false,
                threshold: { x: 0.08, y: 0.08 },
                acceleration: 3,
                interval: 10,
              }}
              onDragStart={handleDragStart}''',
    ),
    (
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
                  </SeatingButton>''',
        '''                  <div
                    style={{
                      width: "100%",
                      fontSize: "12px",
                      color: "#6b7280",
                      lineHeight: 1.5,
                    }}
                  >
                    모바일에서는 참가자 오른쪽의 ⋮⋮ 핸들을 잡고 이동하세요.
                  </div>''',
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f"Expected source block not found:\n{old[:240]}")
    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
