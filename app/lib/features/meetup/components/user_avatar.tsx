import React, { useState, useEffect, useRef } from "react";
import { fetchUserProfile, UserProfile } from "../services/user_service";
// Use the public directory image path
const DEFAULT_AVATAR_URL = "/images/default_user.jpg";

interface UserAvatarProps {
  uid: string;
  size?: number;
  isLeader?: boolean;
  className?: string;
  onClick?: () => void;
  onLongPress?: () => void;
  index?: number; // For stacking position
  isPast?: boolean; // For greyscale effect
  profile?: UserProfile | null; // Allow passing pre-fetched profile
}

interface AvatarContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  $size: number;
  $bgColor?: string;
  $index?: number;
  $isPast?: boolean;
  $isClickable: boolean;
  $isGdgMember?: boolean;
}

const AvatarContainer: React.FC<AvatarContainerProps> = ({
  $size,
  $bgColor,
  $index,
  $isPast,
  $isClickable,
  // GDG ring disabled: always render a plain avatar regardless of membership.
  $isGdgMember: _isGdgMember,
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`flex items-center justify-center overflow-hidden rounded-full border-2 border-solid border-white [touch-action:manipulation] [transition:transform_0.2s] ${
      $index !== undefined ? "absolute" : "relative"
    } ${
      $isClickable
        ? "cursor-pointer hover:[transform:scale(1.1)]"
        : "cursor-default"
    } ${$isPast ? "[filter:grayscale(50%)]" : ""} ${className}`}
    style={{
      width: `${$size}px`,
      height: `${$size}px`,
      backgroundColor: $bgColor || "#e0e0e0",
      left: `${$index !== undefined ? $index * ($size * 0.6) : 0}px`,
    }}
    {...rest}
  >
    {children}
  </div>
);

const AvatarImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = (
  props
) => (
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  <img
    className="h-full w-full select-none rounded-full object-cover [-webkit-touch-callout:none] [-webkit-user-drag:none]"
    {...props}
  />
);

const AvatarPlaceholder: React.FC<{
  $size: number;
  children: React.ReactNode;
}> = ({ $size, children }) => (
  <div
    className={`flex items-center justify-center font-semibold text-white ${
      $size > 30 ? "text-[16px]" : "text-[10px]"
    }`}
  >
    {children}
  </div>
);

const LoadingSpinner: React.FC<{ $size: number }> = ({ $size }) => (
  <div
    className="animate-spin rounded-full border-2 border-solid border-[#f3f3f3] border-t-[#666]"
    style={{
      width: `${Math.min($size * 0.5, 16)}px`,
      height: `${Math.min($size * 0.5, 16)}px`,
    }}
  />
);

export const UserAvatar: React.FC<UserAvatarProps> = ({
  uid,
  size = 40,
  isLeader = false,
  className,
  onClick,
  onLongPress,
  index,
  isPast = false,
  profile,
}) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(profile || null);
  const [loading, setLoading] = useState(!profile);
  const [imageError, setImageError] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const getAvatarColor = (uid: string, isLeader: boolean): string => {
    const colors = isLeader
      ? ["#9c27b0", "#673ab7", "#3f51b5"]
      : ["#2196f3", "#03a9f4", "#00bcd4", "#009688", "#4caf50"];
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
      hash = ((hash << 5) - hash + uid.charCodeAt(i)) & 0xffffffff;
    }
    const colorIndex = Math.abs(hash) % colors.length;
    return colors[colorIndex];
  };

  useEffect(() => {
    // If profile is provided prop, update state and skip fetch
    if (profile) {
      setUserProfile(profile);
      setLoading(false);
      return;
    }

    const loadUserProfile = async () => {
      try {
        setLoading(true);
        setImageError(false); // Reset image error state on UID change
        const fetchedProfile = await fetchUserProfile(uid);
        setUserProfile(fetchedProfile);
      } catch (error) {
        console.error(`Error loading user profile for ${uid}:`, error);
      } finally {
        setLoading(false);
      }
    };
    if (uid) loadUserProfile();
    else setLoading(false);
  }, [uid, profile]);

  useEffect(() => {
    return () => clearLongPressTimer();
  }, []);

  const handleImageError = () => {
    setImageError(true);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!onLongPress) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    didLongPressRef.current = false;
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      onLongPress();
    }, 550);
  };

  const handlePointerEnd = () => {
    clearLongPressTimer();
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (didLongPressRef.current) {
      event.preventDefault();
      event.stopPropagation();
      didLongPressRef.current = false;
      return;
    }

    if (!onClick) return;
    event.preventDefault();
    event.stopPropagation();
    onClick();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    onClick();
  };

  const displayName =
    userProfile?.displayName || `User ${uid ? uid.substring(0, 8) : ""}`;
  const avatarColor = getAvatarColor(uid || "", isLeader);
  const isGdgMember = userProfile?.gdg_member === true;

  // Determine the image source: use default if user's photoURL is empty, null, or if there was an error
  const hasValidPhotoURL =
    userProfile?.photoURL && userProfile.photoURL.trim() !== "";
  const imageSrc =
    hasValidPhotoURL && !imageError ? userProfile.photoURL : DEFAULT_AVATAR_URL;
  const isInteractive = !!onClick || !!onLongPress;

  return (
    <AvatarContainer
      $size={size}
      $bgColor={avatarColor}
      $index={index}
      $isPast={isPast}
      $isClickable={isInteractive}
      $isGdgMember={isGdgMember}
      className={className}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      onContextMenu={(e) => {
        if (onLongPress) e.preventDefault();
      }}
    >
      {loading ? (
        <LoadingSpinner $size={size} />
      ) : (
        <AvatarImage
          src={imageSrc}
          alt={displayName}
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          onError={
            hasValidPhotoURL && !imageError ? handleImageError : undefined
          }
        />
      )}
    </AvatarContainer>
  );
};

// Component for multiple avatars in a stack
interface UserAvatarStackProps {
  uids: string[];
  maxAvatars?: number;
  size?: number;
  isLeader?: boolean;
  isPast?: boolean;
  onAvatarClick?: (uid: string) => void;
  userProfilesMap?: Record<string, UserProfile>;
}

export const UserAvatarStack: React.FC<UserAvatarStackProps> = ({
  uids,
  maxAvatars = 5,
  size = 22,
  isLeader = false,
  isPast = false,
  onAvatarClick,
  userProfilesMap,
}) => {
  // Filter out duplicates and invalid UIDs to prevent React key errors
  const uniqueUids = Array.from(
    new Set(uids.filter((uid) => uid && uid.trim() !== ""))
  );
  const displayedUids = uniqueUids.slice(0, maxAvatars);
  const hasMore = uniqueUids.length > maxAvatars;
  const moreCount = uniqueUids.length - maxAvatars;

  // Calculate the width needed for the avatar stack
  const stackWidth = displayedUids.length > 0
    ? displayedUids.length * size * 0.6 + size * 0.4 + (hasMore ? size * 0.6 : 0)
    : size;

  return (
    <div
      className="relative min-w-0 max-w-full shrink overflow-hidden"
      style={{ height: `${size}px`, width: `${stackWidth}px` }}
    >
      {displayedUids.map((uid, index) => (
        <UserAvatar
          key={`${uid}-${index}`} // Use compound key to ensure uniqueness
          uid={uid}
          size={size}
          isLeader={isLeader}
          index={index}
          isPast={isPast}
          onClick={onAvatarClick ? () => onAvatarClick(uid) : undefined}
          profile={userProfilesMap?.[uid]}
        />
      ))}
      {hasMore && (
        <AvatarContainer
          key="more-count"
          $size={size}
          $bgColor="#f0f0f0"
          $index={displayedUids.length}
          $isPast={isPast}
          $isClickable={false}
        >
          <AvatarPlaceholder $size={size}>+{moreCount}</AvatarPlaceholder>
        </AvatarContainer>
      )}
    </div>
  );
};

export default UserAvatar;
