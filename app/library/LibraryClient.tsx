"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  FaChevronLeft,
  FaChevronRight,
  FaFilter,
  FaChevronDown,
  FaQuestionCircle,
} from "react-icons/fa";

// Define video item type
type VideoItem = {
  id: string;
  difficulty: "novice" | "intermediate" | "advanced";
};

// Define row data type
type RowData = {
  title: string;
  videos: VideoItem[];
};

// Tab arrow buttons on either side of the category tab slider.
const tabScrollButtonClass =
  "absolute top-1/2 z-[5] flex h-[30px] w-[30px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-[rgba(0,0,0,0.08)] bg-[rgba(255,255,255,0.8)] opacity-70 shadow-[0_2px_6px_rgba(0,0,0,0.1)] transition-all duration-200 ease-[ease] hover:bg-white hover:opacity-100 disabled:pointer-events-none disabled:opacity-0 [&_svg]:text-[0.8rem] [&_svg]:text-[#333]";

// Video row arrow buttons.
const videoScrollButtonClass =
  "absolute top-1/2 z-[100] flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-[rgba(255,255,255,0.9)] opacity-90 shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-all duration-[250ms] ease-[ease] hover:scale-105 hover:bg-white hover:opacity-100 disabled:pointer-events-none disabled:opacity-0 [&_svg]:text-[1.2rem] [&_svg]:text-[#333]";

// "사용법" / "난이도 필터" pill buttons.
const controlButtonClass =
  "flex cursor-pointer items-center gap-2 rounded-lg border-0 border-primary-pale bg-white px-4 py-3 font-semibold text-primary shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-all duration-200 ease-[ease] hover:-translate-y-px hover:border-accent hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)] [&_svg]:text-base";

const filterOptionClass =
  "flex w-full cursor-pointer items-center gap-2 border-none px-4 py-3 text-left text-primary transition-all duration-200 ease-[ease] first:rounded-t-md last:rounded-b-md hover:bg-primary-pale";

const usageGuideParagraphClass =
  "mb-2 text-[0.85rem] leading-[1.5] text-ink-medium last:mb-0";

const difficultyTagColors: Record<VideoItem["difficulty"], string> = {
  novice: "bg-[#e3f2fd] text-[#1976d2]",
  intermediate: "bg-[#e8f5e9] text-[#388e3c]",
  advanced: "bg-[#ffebee] text-[#d32f2f]",
};

const difficultyIndicatorColors: Record<VideoItem["difficulty"], string> = {
  novice: "bg-[#1976d2]",
  intermediate: "bg-[#388e3c]",
  advanced: "bg-[#d32f2f]",
};

const LibraryPage: React.FC = () => {
  const tabs = [
    "모든 영상",
    "비즈니스",
    "연설",
    "인터뷰",
    "발표",
    "IT",
    "영화",
    "드라마",
    "국제 정세",
    "금융",
    "의료",
  ]; // Added more tabs for testing
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isUsageGuideVisible, setIsUsageGuideVisible] = useState(false);

  const videoContainersRef = useRef<(HTMLDivElement | null)[]>([]);
  const [scrollStates, setScrollStates] = useState<
    Array<{ canScrollLeft: boolean; canScrollRight: boolean }>
  >([]);

  const tabContainerRef = useRef<HTMLDivElement | null>(null);
  const [tabScrollState, setTabScrollState] = useState<{
    canScrollLeft: boolean;
    canScrollRight: boolean;
  }>({ canScrollLeft: false, canScrollRight: false });

  const videosByRow: { [key: string]: RowData[] } = {
    "모든 영상": [
      {
        title: "젠슨 황처럼 말하기",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "lXLBTBBil2U", difficulty: "intermediate" as const },
          { id: "c-XAL2oYelI", difficulty: "advanced" as const },
          { id: "G6R7UOFx1bw", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
        ],
      },
      {
        title: "스티브 잡스처럼 말하기",
        videos: [
          { id: "UF8uR6Z6KLc", difficulty: "intermediate" as const },
          { id: "kYfNvmF0Bqw", difficulty: "advanced" as const },
          { id: "f60dheI4ARg", difficulty: "novice" as const },
          { id: "CeSAjK2CBEA", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
        ],
      },
    ],
    비즈니스: [
      {
        title: "Startup Insights",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
        ],
      },
      {
        title: "Marketing Strategies",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
        ],
      },
    ],
    연설: [
      {
        title: "Inspiring Talks",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
        ],
      },
      {
        title: "Famous Speeches",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
        ],
      },
    ],
    인터뷰: [
      {
        title: "Tech Leaders",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
        ],
      },
      {
        title: "Creator Chats",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
        ],
      },
    ],
    발표: [
      {
        title: "Product Demos",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
        ],
      },
      {
        title: "Conference Keynotes",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
        ],
      },
    ],
    IT: [
      {
        title: "Coding Tutorials",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
        ],
      },
      {
        title: "Software Reviews",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
        ],
      },
    ],
    영화: [
      {
        title: "Movie Clips",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
        ],
      },
      {
        title: "Trailers",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
        ],
      },
    ],
    드라마: [
      {
        title: "Popular Series",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
        ],
      },
      {
        title: "Classics",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
        ],
      },
    ],
    "국제 정세": [
      {
        title: "World News",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
        ],
      },
      {
        title: "Global Analysis",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
        ],
      },
    ],
    금융: [
      {
        title: "Investment Basics",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
        ],
      },
      {
        title: "Market Analysis",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
        ],
      },
    ],
    의료: [
      {
        title: "Medical Advances",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
        ],
      },
      {
        title: "Health Tips",
        videos: [
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
          { id: "vOvQSqY7Jgc", difficulty: "intermediate" as const },
          { id: "vOvQSqY7Jgc", difficulty: "advanced" as const },
          { id: "vOvQSqY7Jgc", difficulty: "novice" as const },
        ],
      },
    ],
  };

  const currentVideos = videosByRow[activeTab] || [];
  const filteredVideos = filterVideosByDifficulty(currentVideos);

  const updateVideoScrollState = (rowIndex: number) => {
    const container = videoContainersRef.current[rowIndex];
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const canScrollLeft = scrollLeft > 1;
      const canScrollRight = scrollLeft < scrollWidth - clientWidth - 1;

      setScrollStates((prev) => {
        const newStates = [...prev];
        newStates[rowIndex] = { canScrollLeft, canScrollRight };
        return newStates;
      });
    }
  };

  const updateTabScrollState = () => {
    const container = tabContainerRef.current;
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const canScrollLeft = scrollLeft > 1;
      const canScrollRight = scrollLeft < scrollWidth - clientWidth - 1;
      setTabScrollState({ canScrollLeft, canScrollRight });
    }
  };

  // Function to scroll videos horizontally
  const scrollVideos = (direction: "left" | "right", rowIndex: number) => {
    const container = videoContainersRef.current[rowIndex];
    if (container) {
      const scrollAmount = 320; // Width of video card + gap
      container.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const scrollTabs = (direction: "left" | "right") => {
    const container = tabContainerRef.current;
    if (container) {
      const scrollAmount = 200;
      container.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  function filterVideosByDifficulty(rows: RowData[]): RowData[] {
    if (difficultyFilter === "all") {
      return rows;
    }

    return rows
      .map((row) => ({
        ...row,
        videos: row.videos.filter(
          (video) => video.difficulty === difficultyFilter
        ),
      }))
      .filter((row) => row.videos.length > 0); // Only include rows that have videos after filtering
  }

  // Update scroll states when content changes
  useEffect(() => {
    setTimeout(() => {
      // Initialize video scroll states for current tab content
      setScrollStates(
        new Array(filteredVideos.length).fill({
          canScrollLeft: false,
          canScrollRight: true,
        })
      );

      filteredVideos.forEach((_, rowIndex) => {
        updateVideoScrollState(rowIndex);
      });
    }, 100);
    videoContainersRef.current = videoContainersRef.current.slice(
      0,
      filteredVideos.length
    );

    // Initialize tab scroll state
    setTimeout(() => updateTabScrollState(), 100);
  }, [activeTab, difficultyFilter, filteredVideos.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isFilterOpen &&
        !(event.target as Element).closest(".filter-wrapper-class")
      ) {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterOpen]);

  return (
    <div className="box-border w-full pt-8">
      <div className="relative mb-8 w-full">
        <button
          className={`${tabScrollButtonClass} left-[-15px]`}
          onClick={() => scrollTabs("left")}
          disabled={!tabScrollState.canScrollLeft}
          aria-label="Scroll tabs left"
        >
          <FaChevronLeft />
        </button>
        <div
          className="box-border flex w-full gap-2 overflow-x-hidden scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          ref={tabContainerRef}
          onScroll={updateTabScrollState}
        >
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`cursor-pointer whitespace-nowrap rounded-[2rem] border-none px-6 py-3 font-semibold transition-all duration-200 ease-[ease] hover:-translate-y-px ${
                tab === activeTab
                  ? "bg-primary text-white shadow-[0_4px_6px_rgba(0,0,0,0.1)] hover:bg-primary-dark"
                  : "bg-primary-pale text-primary hover:bg-[#e8d9d0]"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <button
          className={`${tabScrollButtonClass} right-[-15px]`}
          onClick={() => scrollTabs("right")}
          disabled={!tabScrollState.canScrollRight}
          aria-label="Scroll tabs right"
        >
          <FaChevronRight />
        </button>
      </div>

      <div className="relative mb-8 flex items-center justify-between">
        <div
          className="relative"
          onMouseEnter={() => setIsUsageGuideVisible(true)}
          onMouseLeave={() => setIsUsageGuideVisible(false)}
        >
          <button className={controlButtonClass}>
            <FaQuestionCircle /> 사용법
          </button>
          <div
            className={`absolute top-0 left-[calc(100%+1rem)] z-[1100] w-[350px] whitespace-normal rounded-lg border border-primary-pale bg-white p-4 shadow-[0_8px_16px_rgba(0,0,0,0.15)] transition-[opacity,transform] duration-200 ease-[ease] ${
              isUsageGuideVisible
                ? "pointer-events-auto translate-x-0 opacity-100"
                : "pointer-events-none -translate-x-[10px] opacity-0"
            }`}
          >
            <h4 className="mt-0 mb-3 text-base text-primary">사용 가이드</h4>
            <p className={usageGuideParagraphClass}>
              <strong>카테고리 탭:</strong> 원하는 영상 주제를 선택하세요. 좌우
              화살표로 더 많은 카테고리를 볼 수 있습니다.
            </p>
            <p className={usageGuideParagraphClass}>
              <strong>난이도 필터:</strong> 우측 상단 필터를 사용하여 영상의
              난이도(초급, 중급, 고급)별로 영상을 필터링할 수 있습니다.
            </p>
            <p className={usageGuideParagraphClass}>
              <strong>영상 슬라이더:</strong> 각 줄의 영상들을 좌우 화살표로
              스크롤하여 더 많은 영상을 탐색하세요.
            </p>
          </div>
        </div>

        <div className="filter-wrapper-class relative">
          <button
            className={controlButtonClass}
            onClick={() => setIsFilterOpen(!isFilterOpen)}
          >
            <FaFilter />
            난이도 필터
            <FaChevronDown
              className={`transition-transform duration-200 ease-[ease] ${
                isFilterOpen ? "rotate-180" : "rotate-0"
              }`}
            />
          </button>
          <div
            className={`absolute top-full right-0 z-[1000] mt-2 min-w-[180px] rounded-lg border-2 border-primary-pale bg-white shadow-[0_8px_16px_rgba(0,0,0,0.15)] transition-all duration-200 ease-[ease] ${
              isFilterOpen
                ? "pointer-events-auto translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-[10px] opacity-0"
            }`}
          >
            <button
              className={`${filterOptionClass} ${
                difficultyFilter === "all" ? "bg-primary-pale" : "bg-transparent"
              }`}
              onClick={() => {
                setDifficultyFilter("all");
                setIsFilterOpen(false);
              }}
            >
              All Levels
            </button>
            {(["novice", "intermediate", "advanced"] as const).map((level) => (
              <button
                key={level}
                className={`${filterOptionClass} ${
                  difficultyFilter === level
                    ? "bg-primary-pale"
                    : "bg-transparent"
                }`}
                onClick={() => {
                  setDifficultyFilter(level);
                  setIsFilterOpen(false);
                }}
              >
                <div
                  className={`h-3 w-3 rounded-full ${difficultyIndicatorColors[level]}`}
                ></div>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredVideos.map((rowData, rowIndex) => (
        <div
          className="mb-4 w-full"
          key={`${activeTab}-${difficultyFilter}-${rowData.title}-${rowIndex}`}
        >
          <h2 className="w-full text-[1.5rem] font-semibold text-primary">
            {rowData.title}
          </h2>
          <div className="relative w-full">
            <button
              className={`${videoScrollButtonClass} left-[calc(-40px+1rem)]`}
              onClick={() => scrollVideos("left", rowIndex)}
              disabled={!scrollStates[rowIndex]?.canScrollLeft}
              aria-label="Scroll left"
            >
              <FaChevronLeft />
            </button>
            <div
              className="relative box-border flex w-full gap-4 overflow-x-hidden scroll-smooth px-0 py-4"
              ref={(el) => {
                if (el) videoContainersRef.current[rowIndex] = el;
              }}
              onScroll={() => updateVideoScrollState(rowIndex)}
            >
              {rowData.videos.map((video: VideoItem) => (
                <Link
                  key={video.id}
                  href="/shadow"
                  className="group mb-4 block rounded-xl text-inherit no-underline hover:outline-none focus:outline-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                >
                  <div className="w-[280px] shrink-0 overflow-hidden rounded-xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all duration-300 ease-[ease] group-hover:-translate-y-1 group-hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)]">
                    <iframe
                      className="h-[157px] w-full border-none"
                      src={`https://www.youtube.com/embed/${video.id}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Embedded youtube"
                    />
                    <div className="bg-white p-3">
                      <h3 className="mb-1 overflow-hidden text-ellipsis whitespace-nowrap text-[0.9rem] font-semibold text-ink">
                        Jensen Huang on Pain and Suffering
                      </h3>
                      <p className="min-h-[calc(0.8rem*1.4*2)] text-[0.8rem] leading-[1.4] text-ink-medium line-clamp-2">
                        엔비디아 CEO 젠슨 황이 창업자들이 고통을 많이 겪어야
                        되는 이유에 대해서 설명합니다.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <span
                          className={`rounded-[1rem] px-2 py-1 text-[0.7rem] font-semibold ${
                            difficultyTagColors[video.difficulty]
                          }`}
                        >
                          {video.difficulty.charAt(0).toUpperCase() +
                            video.difficulty.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <button
              className={`${videoScrollButtonClass} right-[calc(-40px+1rem)]`}
              onClick={() => scrollVideos("right", rowIndex)}
              disabled={!scrollStates[rowIndex]?.canScrollRight}
              aria-label="Scroll right"
            >
              <FaChevronRight />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default LibraryPage;
