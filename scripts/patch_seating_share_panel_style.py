from pathlib import Path

path = Path("app/meetup/[id]/EventDetailClient.tsx")
text = path.read_text(encoding="utf-8")

# Restore masked name + phone suffix in both panel display formatters.
old_fallback = 'if (!validName) return "익명";'
old_result = 'return maskedName;'
new_fallback = 'if (!validName) return `익명 (${user.phoneLast4 || "****"})`;'
new_result = 'return `${maskedName} (${user.phoneLast4 || "****"})`;'

if text.count(old_fallback) < 2:
    raise SystemExit(f"Expected at least 2 plain 익명 fallbacks, found {text.count(old_fallback)}")
if text.count(old_result) < 2:
    raise SystemExit(f"Expected at least 2 plain maskedName returns, found {text.count(old_result)}")

text = text.replace(old_fallback, new_fallback, 2)
text = text.replace(old_result, new_result, 2)

old_image_formatter = '''  const formatSeatingImageParticipant = (user: UserWithDetails): string => {
    const validName = isValidDisplayName(user.displayName);
    return validName ? maskName(user.displayName!) : "익명";
  };
'''
new_image_formatter = '''  const formatSeatingImageParticipant = (user: UserWithDetails): string => {
    const validName = isValidDisplayName(user.displayName);
    if (!validName) return `익명 (${user.phoneLast4 || "****"})`;
    return `${maskName(user.displayName!)} (${user.phoneLast4 || "****"})`;
  };
'''
if old_image_formatter not in text:
    raise SystemExit("Expected seating image formatter not found")
text = text.replace(old_image_formatter, new_image_formatter, 1)

start = text.index('  const createSeatingImageBlob = async (): Promise<Blob> => {')
end = text.index('\n  const handleShareSeatingImage = async () => {', start)

new_renderer = r'''  const createSeatingImageBlob = async (): Promise<Blob> => {
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
    const columnGap = 40;
    const headerHeight = 172;
    const columnWidth = (width - margin * 2 - columnGap) / 2;
    const groupGap = 24;
    const cardPadding = 28;
    const leaderAvatarSize = 44;
    const participantAvatarSize = 34;
    const leaderRowHeight = 74;
    const participantRowHeight = 54;
    const sessionHeaderHeight = 62;

    const sessionAssignments = [1, 2].map((sessionNumber) =>
      seatingAssignments.filter(
        (assignment) => assignment.sessionNumber === sessionNumber
      )
    );

    const getGroupHeight = (assignment: SeatingAssignment) =>
      cardPadding * 2 +
      leaderRowHeight +
      18 +
      Math.max(assignment.participants.length, 1) * participantRowHeight;

    const getSessionHeight = (assignments: SeatingAssignment[]) => {
      const groupsHeight = assignments.reduce(
        (sum, assignment) => sum + getGroupHeight(assignment),
        0
      );
      return (
        sessionHeaderHeight +
        groupsHeight +
        Math.max(assignments.length - 1, 0) * groupGap
      );
    };

    const contentHeight = Math.max(
      260,
      ...sessionAssignments.map(getSessionHeight)
    );
    const height = headerHeight + contentHeight + 58;

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

    const allUsers = new Map<string, UserWithDetails>();
    seatingAssignments.forEach((assignment) => {
      allUsers.set(assignment.leaderDetails.uid, assignment.leaderDetails);
      assignment.participants.forEach((participant) =>
        allUsers.set(participant.uid, participant)
      );
    });

    const avatarImages = new Map<string, HTMLImageElement>();
    await Promise.all(
      Array.from(allUsers.values()).map(async (user) => {
        if (!user.photoURL) return;
        try {
          const response = await fetch(user.photoURL, { mode: "cors" });
          if (!response.ok) return;
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          try {
            const image = new Image();
            await new Promise<void>((resolve, reject) => {
              image.onload = () => resolve();
              image.onerror = () => reject(new Error("avatar load failed"));
              image.src = objectUrl;
            });
            avatarImages.set(user.uid, image);
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        } catch (error) {
          console.warn("Could not load avatar for seating share image:", error);
        }
      })
    );

    const drawAvatar = (
      user: UserWithDetails,
      centerX: number,
      centerY: number,
      size: number
    ) => {
      const radius = size / 2;
      const image = avatarImages.get(user.uid);

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      if (image) {
        const scale = Math.max(size / image.width, size / image.height);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        ctx.drawImage(
          image,
          centerX - drawWidth / 2,
          centerY - drawHeight / 2,
          drawWidth,
          drawHeight
        );
      } else {
        ctx.fillStyle = "#8bc5df";
        ctx.fillRect(centerX - radius, centerY - radius, size, size);
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.beginPath();
        ctx.arc(centerX, centerY - size * 0.12, size * 0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX, centerY + size * 0.24, size * 0.27, Math.PI, 0);
        ctx.lineTo(centerX + size * 0.27, centerY + size * 0.44);
        ctx.lineTo(centerX - size * 0.27, centerY + size * 0.44);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    };

    const drawLeaderBadge = (x: number, y: number) => {
      const badgeWidth = 58;
      const badgeHeight = 30;
      ctx.fillStyle = "#333333";
      drawRoundedRect(x, y, badgeWidth, badgeHeight, 15);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = '700 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("리더", x + badgeWidth / 2, y + badgeHeight / 2 + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    };

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#111827";
    ctx.font = '700 40px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText("영어한잔 좌석 배치", margin, 66);

    ctx.fillStyle = "#374151";
    ctx.font = '600 23px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(event.title, margin, 106);

    const eventMeta = [event.date, event.location_name].filter(Boolean).join(" · ");
    ctx.fillStyle = "#6b7280";
    ctx.font = '400 19px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(eventMeta, margin, 140);

    sessionAssignments.forEach((assignments, sessionIndex) => {
      const x = margin + sessionIndex * (columnWidth + columnGap);
      const sessionTop = headerHeight;

      ctx.fillStyle = "#333333";
      ctx.font = '700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(
        `세션 ${sessionIndex + 1}`,
        x + columnWidth / 2,
        sessionTop + 28
      );
      ctx.strokeStyle = "#333333";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, sessionTop + 48);
      ctx.lineTo(x + columnWidth, sessionTop + 48);
      ctx.stroke();
      ctx.textAlign = "left";

      let currentY = sessionTop + sessionHeaderHeight;

      assignments.forEach((assignment) => {
        const groupHeight = getGroupHeight(assignment);
        const cardX = x;
        const cardWidth = columnWidth;

        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(cardX, currentY, cardWidth, groupHeight, 25);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = "#e0e0e0";
        ctx.lineWidth = 2;
        drawRoundedRect(cardX, currentY, cardWidth, groupHeight, 25);
        ctx.stroke();

        const contentX = cardX + cardPadding;
        const leaderCenterY = currentY + cardPadding + leaderAvatarSize / 2;
        drawAvatar(
          assignment.leaderDetails,
          contentX + leaderAvatarSize / 2,
          leaderCenterY,
          leaderAvatarSize
        );

        const leaderNameX = contentX + leaderAvatarSize + 16;
        const leaderName = formatLeaderDisplay(assignment.leaderDetails);
        ctx.fillStyle = "#333333";
        ctx.font = '700 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textBaseline = "middle";
        ctx.fillText(leaderName, leaderNameX, leaderCenterY + 1);
        const leaderNameWidth = ctx.measureText(leaderName).width;
        drawLeaderBadge(leaderNameX + leaderNameWidth + 14, leaderCenterY - 15);
        ctx.textBaseline = "alphabetic";

        const dividerY = currentY + cardPadding + leaderRowHeight;
        ctx.strokeStyle = "#eeeeee";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(contentX, dividerY);
        ctx.lineTo(cardX + cardWidth - cardPadding, dividerY);
        ctx.stroke();

        const participantStartY = dividerY + 18;
        if (assignment.participants.length === 0) {
          ctx.fillStyle = "#9ca3af";
          ctx.font = '500 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
          ctx.fillText("참가자 없음", contentX, participantStartY + 31);
        } else {
          assignment.participants.forEach((participant, participantIndex) => {
            const rowTop = participantStartY + participantIndex * participantRowHeight;
            const centerY = rowTop + participantRowHeight / 2;
            drawAvatar(
              participant,
              contentX + participantAvatarSize / 2,
              centerY,
              participantAvatarSize
            );
            ctx.fillStyle = "#333333";
            ctx.font = '600 19px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textBaseline = "middle";
            ctx.fillText(
              formatSeatingImageParticipant(participant),
              contentX + participantAvatarSize + 14,
              centerY + 1
            );
            ctx.textBaseline = "alphabetic";
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
'''

text = text[:start] + new_renderer + text[end:]
path.write_text(text, encoding="utf-8")
