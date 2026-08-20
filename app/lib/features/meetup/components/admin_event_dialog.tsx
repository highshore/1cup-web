import React, { useState, useEffect, useRef, useCallback } from "react";
import styled from "styled-components";
import { MeetupEvent, Article } from "../types/meetup_types";
import {
  createMeetupEvent,
  updateMeetupEvent,
  fetchRecentArticles,
  MeetupPageCursor,
} from "../services/meetup_service";
import {
  uploadMeetupImages,
  validateImageFiles,
  deleteMeetupImage,
} from "../services/image_upload_service";
import { invokeFunction } from "../../../supabase/client";

interface AdminEventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  templateEvent?: MeetupEvent | null;
  editEvent?: MeetupEvent | null;
  creatorUid: string;
  onEventCreated?: (eventId: string) => void;
  onEventUpdated?: () => void;
}

// Naver search result interface
interface NaverSearchResult {
  title: string;
  address: string;
  mapx: string; // longitude in Naver coordinate system
  mapy: string; // latitude in Naver coordinate system
  link: string;
}

// Location search component
interface LocationSearchProps {
  onLocationSelected: (
    title: string,
    address: string,
    latitude: number,
    longitude: number,
    mapUrl: string
  ) => void;
  isOpen: boolean;
  onClose: () => void;
}

// Styled components
const DialogOverlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: ${(props) => (props.$isOpen ? "flex" : "none")};
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;

  @media (max-width: 768px) {
    padding: 0.75rem;
    align-items: flex-start;
    padding-top: 2rem;
  }
`;

const DialogContent = styled.div`
  background-color: white;
  border-radius: 20px;
  padding: 2rem;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);

  @media (max-width: 768px) {
    padding: 1.5rem;
    border-radius: 16px;
    max-height: 95vh;
  }
`;

const DialogHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;

  @media (max-width: 768px) {
    margin-bottom: 1rem;
  }
`;

const DialogTitle = styled.h2`
  color: #333;
  font-size: 20px;
  font-weight: 700;
  margin: 0;

  @media (max-width: 768px) {
    font-size: 18px;
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0.5rem;
  border-radius: 50%;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f0f0f0;
  }

  @media (max-width: 768px) {
    font-size: 20px;
    padding: 0.375rem;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;

  @media (max-width: 768px) {
    gap: 0.875rem;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  color: #333;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 0.5rem;

  @media (max-width: 768px) {
    font-size: 13px;
    margin-bottom: 0.375rem;
  }
`;

const Input = styled.input`
  padding: 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: #2196f3;
    box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
  }

  @media (max-width: 768px) {
    padding: 0.625rem;
    font-size: 16px; // Prevents zoom on iOS
    border-radius: 8px;
  }
`;

const TextArea = styled.textarea`
  padding: 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  font-size: 14px;
  min-height: 100px;
  resize: vertical;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #2196f3;
    box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
  }

  @media (max-width: 768px) {
    padding: 0.625rem;
    font-size: 16px; // Prevents zoom on iOS
    border-radius: 8px;
    min-height: 80px;
  }
`;

const LocationRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const NumberRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.75rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ImageUploadContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const FileInput = styled.input`
  padding: 0.75rem;
  border: 2px dashed #e0e0e0;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
  background-color: #fafafa;
  transition: all 0.2s;

  &:hover {
    border-color: #2196f3;
    background-color: #f5f5f5;
  }

  &:focus {
    outline: none;
    border-color: #2196f3;
    box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
  }
`;

const ImagePreviewContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1rem;
  margin-top: 1rem;

  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.75rem;
    margin-top: 0.75rem;
  }
`;

const ImagePreview = styled.div`
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  background-color: #f5f5f5;
  aspect-ratio: 1;

  @media (max-width: 768px) {
    border-radius: 8px;
  }
`;

const PreviewImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const RemoveImageButton = styled.button`
  position: absolute;
  top: 5px;
  right: 5px;
  background-color: rgba(244, 67, 54, 0.8);
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;

  &:hover {
    background-color: rgba(244, 67, 54, 1);
  }

  @media (max-width: 768px) {
    width: 28px;
    height: 28px;
    font-size: 16px;
    top: 3px;
    right: 3px;
  }
`;

const ErrorMessage = styled.div`
  color: #d32f2f;
  font-size: 12px;
  margin-top: 0.25rem;
`;

const ArticleSelection = styled.div`
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 0.75rem;
  background-color: #fafafa;

  @media (max-width: 768px) {
    padding: 0.625rem;
    border-radius: 8px;
  }
`;

const ArticleList = styled.div<{ $loadingMoreArticles?: boolean }>`
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: white;

  @media (max-width: 768px) {
    max-height: 250px;
    border-radius: 6px;
  }

  ${({ $loadingMoreArticles }) =>
    $loadingMoreArticles &&
    `
    &::after {
      content: "";
      display: block;
      padding-bottom: 1rem;
    }
  `}
`;

const ArticleItem = styled.div<{ $selected: boolean }>`
  padding: 0.75rem;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background-color 0.2s;
  background-color: ${(props) => (props.$selected ? "#e3f2fd" : "white")};

  &:hover {
    background-color: ${(props) => (props.$selected ? "#bbdefb" : "#f5f5f5")};
  }

  &:last-child {
    border-bottom: none;
  }

  @media (max-width: 768px) {
    padding: 0.625rem;
  }
`;

const ArticleTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.25rem;

  @media (max-width: 768px) {
    font-size: 13px;
  }
`;

const ArticleId = styled.div`
  font-size: 12px;
  color: #666;
  font-family: monospace;

  @media (max-width: 768px) {
    font-size: 11px;
  }
`;

const SelectedArticlesDisplay = styled.div`
  margin-top: 0.5rem;

  @media (max-width: 768px) {
    margin-top: 0.375rem;
  }
`;

const SelectedArticleTag = styled.span`
  display: inline-block;
  background-color: #2196f3;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 12px;
  margin-right: 0.5rem;
  margin-bottom: 0.25rem;
  cursor: pointer;

  &:hover {
    background-color: #1976d2;
  }

  @media (max-width: 768px) {
    font-size: 11px;
    padding: 0.2rem 0.4rem;
    margin-right: 0.375rem;
  }
`;

const LoadingText = styled.div`
  text-align: center;
  color: #666;
  font-size: 14px;
  padding: 1rem;

  @media (max-width: 768px) {
    font-size: 13px;
    padding: 0.75rem;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;

  @media (max-width: 768px) {
    gap: 0.75rem;
    margin-top: 1rem;
  }
`;

const ActionButton = styled.button<{ $variant: "primary" | "secondary" }>`
  flex: 1;
  padding: 1rem;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  background-color: ${(props) =>
    props.$variant === "primary" ? "#181818" : "#f5f5f5"};
  color: ${(props) => (props.$variant === "primary" ? "white" : "#666")};

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  @media (max-width: 768px) {
    padding: 0.875rem;
    font-size: 16px; // Prevents zoom on iOS
    border-radius: 16px;

    &:hover {
      transform: translateY(-1px);
    }
  }
`;

const LocationSearchModal = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: ${(props) => (props.$isOpen ? "flex" : "none")};
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: 1rem;

  @media (max-width: 768px) {
    padding: 0.75rem;
    align-items: flex-start;
    padding-top: 2rem;
  }
`;

const LocationSearchContent = styled.div`
  background-color: white;
  border-radius: 20px;
  padding: 1.5rem;
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);

  @media (max-width: 768px) {
    padding: 1.25rem;
    border-radius: 16px;
    max-height: 90vh;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  font-size: 14px;
  margin-bottom: 1rem;

  &:focus {
    outline: none;
    border-color: #2196f3;
    box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
  }

  @media (max-width: 768px) {
    padding: 0.625rem;
    font-size: 16px; // Prevents zoom on iOS
    border-radius: 8px;
    margin-bottom: 0.75rem;
  }
`;

const SearchResults = styled.div`
  max-height: 300px;
  overflow-y: auto;

  @media (max-width: 768px) {
    max-height: 250px;
  }
`;

const SearchResultItem = styled.div`
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: #f5f5f5;
    border-color: #2196f3;
  }

  @media (max-width: 768px) {
    padding: 0.875rem;
    border-radius: 8px;
    margin-bottom: 0.375rem;
  }
`;

const ResultTitle = styled.div`
  font-weight: 600;
  color: #333;
  margin-bottom: 0.25rem;

  @media (max-width: 768px) {
    font-size: 14px;
  }
`;

const ResultAddress = styled.div`
  color: #666;
  font-size: 12px;

  @media (max-width: 768px) {
    font-size: 11px;
  }
`;

const SearchButton = styled.button`
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: 0.5rem;

  &:hover {
    background-color: #1976d2;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  @media (max-width: 768px) {
    padding: 0.625rem 0.875rem;
    font-size: 16px; // Prevents zoom on iOS
    border-radius: 8px;
    margin-left: 0.375rem;
  }
`;

const LocationInputRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  margin-bottom: 0.5rem;

  @media (max-width: 768px) {
    gap: 0.375rem;
    margin-bottom: 0.375rem;
  }
`;

const LocationSearch: React.FC<LocationSearchProps> = ({
  isOpen,
  onClose,
  onLocationSelected,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<NaverSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const removeHtmlTags = (htmlText: string): string => {
    return htmlText.replace(/<[^>]*>/g, "");
  };

  // Naver Local Search through the Supabase Edge proxy.
  const performSearchWithNaver = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setErrorMessage("Please enter a search term."); // User feedback
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const data = await invokeFunction<{ items?: unknown[] }>("proxy", {
        target: "naver",
        query,
        display: "5",
        start: "1",
        sort: "random",
      });

      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        const mappedResults = data.items.map((item: any) => ({
          title: removeHtmlTags(item.title || ""),
          address: removeHtmlTags(item.roadAddress || item.address || ""),
          link: item.link || "",
          mapx: item.mapx?.toString() || "0",
          mapy: item.mapy?.toString() || "0",
        }));

        setResults(mappedResults);
        setErrorMessage("");
      } else {
        setResults([]);
        setErrorMessage("No results found for your search.");
      }
    } catch (error) {
      setErrorMessage(
        "Network error - please check your connection and try again"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const convertNaverCoordinates = (
    mapx: string,
    mapy: string
  ): { latitude: number; longitude: number } => {
    const longitude = parseFloat(mapx) / 10000000;
    const latitude = parseFloat(mapy) / 10000000;
    return { latitude, longitude };
  };

  // Updates searchQuery state as user types
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handles the click of the new search button
  const handleSearchButtonClick = () => {
    performSearchWithNaver(searchQuery);
  };

  // Handles pressing Enter in the input field
  const handleSearchInputKeyPress = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      performSearchWithNaver(searchQuery);
    }
  };

  const handleResultClick = (result: NaverSearchResult) => {
    const coordinates = convertNaverCoordinates(result.mapx, result.mapy);
    const mapUrl =
      result.link ||
      `https://map.naver.com/v5/search/${encodeURIComponent(result.title)}`;

    console.log("Selected location:", {
      title: result.title,
      address: result.address,
      coordinates,
      mapUrl,
    });

    onLocationSelected(
      result.title,
      result.address,
      coordinates.latitude,
      coordinates.longitude,
      mapUrl
    );
    onClose();
  };

  // Initialize when opened
  React.useEffect(() => {
    if (isOpen) {
      setSearchQuery(""); // Clear search query on open
      setResults([]);
      setErrorMessage("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <LocationSearchModal $isOpen={isOpen} onClick={onClose}>
      <LocationSearchContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Location Search (Naver API)</DialogTitle>
          <CloseButton onClick={onClose}>×</CloseButton>
        </DialogHeader>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <SearchInput
            type="text"
            placeholder="Search locations: e.g., 강남역 카페"
            value={searchQuery}
            onChange={handleSearchInputChange}
            onKeyPress={handleSearchInputKeyPress} // Added Enter key press handler
            style={{ flexGrow: 1 }}
          />
          <SearchButton
            type="button"
            onClick={handleSearchButtonClick}
            disabled={isLoading || !searchQuery.trim()} // Disable if loading or query is empty
          >
            {isLoading ? "Searching..." : "Search"}
          </SearchButton>
        </div>

        <SearchResults>
          {isLoading && !results.length ? ( // Show loading only if there are no current results
            <LoadingText>Searching locations...</LoadingText>
          ) : results.length > 0 ? (
            results.map((result, index) => (
              <SearchResultItem
                key={index}
                onClick={() => handleResultClick(result)}
              >
                <ResultTitle>{result.title}</ResultTitle>
                <ResultAddress>{result.address}</ResultAddress>
              </SearchResultItem>
            ))
          ) : !isLoading && searchQuery.trim() && !errorMessage ? ( // Show if not loading, query exists, and no error yet
            <LoadingText>
              Click "Search" or press Enter to find locations.
            </LoadingText>
          ) : !isLoading && !searchQuery.trim() && !errorMessage ? (
            <LoadingText>Enter location name and click "Search".</LoadingText>
          ) : null}
        </SearchResults>

        {errorMessage && (
          <div
            style={{
              color: "#f44336",
              fontSize: "12px",
              marginTop: "1rem",
              padding: "0.5rem",
              backgroundColor: "#ffebee",
              borderRadius: "8px",
              textAlign: "center", // Center error message
            }}
          >
            {errorMessage}
          </div>
        )}
      </LocationSearchContent>
    </LocationSearchModal>
  );
};

const AdminEventDialog: React.FC<AdminEventDialogProps> = ({
  isOpen,
  onClose,
  templateEvent,
  editEvent,
  creatorUid,
  onEventCreated,
  onEventUpdated,
}) => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    duration_minutes: 60,
    location_name: "",
    location_address: "",
    location_map_url: "",
    location_extra_info: "",
    lockdown_minutes: 10,
    max_participants: 20,
    image_urls: [] as string[],
    topics: [] as { topic_id: string }[],
    articles: [] as string[],
    latitude: 0,
    longitude: 0,
  });
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [availableArticles, setAvailableArticles] = useState<Article[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [loadingMoreArticles, setLoadingMoreArticles] = useState(false);
  const [hasMoreArticles, setHasMoreArticles] = useState(true);
  const [lastArticleDoc, setLastArticleDoc] =
    useState<MeetupPageCursor | null>(null);
  const articleListRef = useRef<HTMLDivElement>(null);

  // Initialize form data when template event or edit event changes
  useEffect(() => {
    if (editEvent) {
      // Editing existing event - populate with current data
      setFormData({
        title: editEvent.title,
        description: editEvent.description,
        date: editEvent.date,
        time: editEvent.time,
        duration_minutes: editEvent.duration_minutes,
        location_name: editEvent.location_name,
        location_address: editEvent.location_address,
        location_map_url: editEvent.location_map_url,
        location_extra_info: editEvent.location_extra_info,
        latitude: editEvent.latitude || 0,
        longitude: editEvent.longitude || 0,
        lockdown_minutes: editEvent.lockdown_minutes,
        max_participants: editEvent.max_participants,
        image_urls: editEvent.image_urls || [],
        topics: editEvent.topics,
        articles: editEvent.articles || [],
      });
    } else if (templateEvent) {
      // Duplicating existing event - populate with template data but use current date/time
      const now = new Date();
      const currentDate = now.toISOString().split("T")[0]; // YYYY-MM-DD format
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

      setFormData({
        title: templateEvent.title,
        description: templateEvent.description,
        date: currentDate, // Use current date for duplicated event
        time: currentTime, // Use current time for duplicated event
        duration_minutes: templateEvent.duration_minutes,
        location_name: templateEvent.location_name,
        location_address: templateEvent.location_address,
        location_map_url: templateEvent.location_map_url,
        location_extra_info: templateEvent.location_extra_info,
        latitude: templateEvent.latitude || 0,
        longitude: templateEvent.longitude || 0,
        lockdown_minutes: templateEvent.lockdown_minutes,
        max_participants: templateEvent.max_participants,
        image_urls: templateEvent.image_urls || [],
        topics: templateEvent.topics,
        articles: templateEvent.articles || [],
      });
    } else {
      // Creating new event - reset to default values with current date/time
      const now = new Date();
      const currentDate = now.toISOString().split("T")[0]; // YYYY-MM-DD format
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

      setFormData({
        title: "",
        description: "",
        date: currentDate,
        time: currentTime,
        duration_minutes: 60,
        location_name: "",
        location_address: "",
        location_map_url: "",
        location_extra_info: "",
        latitude: 0,
        longitude: 0,
        lockdown_minutes: 10,
        max_participants: 20,
        image_urls: [],
        topics: [],
        articles: [],
      });
    }
  }, [templateEvent, editEvent]);

  // Fetch available articles when dialog opens
  useEffect(() => {
    const fetchAvailableArticles = async () => {
      if (isOpen) {
        setLoadingArticles(true);
        setAvailableArticles([]); // Reset articles when dialog opens
        setLastArticleDoc(null);
        setHasMoreArticles(true);
        try {
          const result = await fetchRecentArticles(10);
          setAvailableArticles(result.articles);
          setLastArticleDoc(result.lastDoc);
          setHasMoreArticles(result.hasMore);
        } catch (error) {
          console.error("Error fetching articles:", error);
          setAvailableArticles([]);
          setHasMoreArticles(false);
        } finally {
          setLoadingArticles(false);
        }
      }
    };

    fetchAvailableArticles();
  }, [isOpen]);

  // Load more articles for infinite scroll
  const loadMoreArticles = useCallback(async () => {
    if (loadingMoreArticles || !hasMoreArticles || !lastArticleDoc) return;

    setLoadingMoreArticles(true);
    try {
      const result = await fetchRecentArticles(10, lastArticleDoc);
      setAvailableArticles((prev) => [...prev, ...result.articles]);
      setLastArticleDoc(result.lastDoc);
      setHasMoreArticles(result.hasMore);
    } catch (error) {
      console.error("Error loading more articles:", error);
      setHasMoreArticles(false);
    } finally {
      setLoadingMoreArticles(false);
    }
  }, [loadingMoreArticles, hasMoreArticles, lastArticleDoc]);

  // Handle scroll event for infinite scroll
  const handleArticleListScroll = useCallback(() => {
    if (!articleListRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = articleListRef.current;
    const threshold = 50; // Load more when 50px from bottom

    if (scrollHeight - scrollTop - clientHeight < threshold) {
      loadMoreArticles();
    }
  }, [loadMoreArticles]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLocationSelected = (
    title: string,
    address: string,
    latitude: number,
    longitude: number,
    mapUrl: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      location_name: title,
      location_address: address,
      location_map_url: mapUrl,
      latitude: latitude,
      longitude: longitude,
    }));

    // Note: We don't set coordinates here since they're handled by the geocoding service
    // The coordinates will be automatically resolved when the event is created/updated
  };

  const handleArticleToggle = (articleId: string) => {
    setFormData((prev) => ({
      ...prev,
      articles: prev.articles.includes(articleId)
        ? prev.articles.filter((id) => id !== articleId)
        : [...prev.articles, articleId],
    }));
  };

  const handleRemoveArticle = (articleId: string) => {
    setFormData((prev) => ({
      ...prev,
      articles: prev.articles.filter((id) => id !== articleId),
    }));
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Validate files
    const { valid, errors } = validateImageFiles(files);
    setUploadErrors(errors);

    if (valid.length === 0) return;

    setUploadingImages(true);

    try {
      const uploadedUrls = await uploadMeetupImages(valid);

      // Add uploaded URLs to existing images
      setFormData((prev) => ({
        ...prev,
        image_urls: [...prev.image_urls, ...uploadedUrls],
      }));

      // Clear file input
      event.target.value = "";
    } catch (error) {
      console.error("Error uploading images:", error);
      setUploadErrors((prev) => [
        ...prev,
        `Upload failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      ]);
    } finally {
      setUploadingImages(false);
    }
  };

  const handleRemoveImage = async (index: number) => {
    const imageUrl = formData.image_urls[index];

    try {
      // Delete from Supabase Storage
      await deleteMeetupImage(imageUrl);

      // Remove from form data
      const newImageUrls = formData.image_urls.filter((_, i) => i !== index);
      setFormData((prev) => ({
        ...prev,
        image_urls: newImageUrls,
      }));
    } catch (error) {
      console.error("Error removing image:", error);
      // Still remove from UI even if deletion fails
      const newImageUrls = formData.image_urls.filter((_, i) => i !== index);
      setFormData((prev) => ({
        ...prev,
        image_urls: newImageUrls,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Convert form data to the meetups-table shape
      const firestoreEventData = {
        title: formData.title,
        description: formData.description,
        date_time: new Date(`${formData.date}T${formData.time}`).toISOString(),
        duration_minutes: formData.duration_minutes,
        image_urls: formData.image_urls,
        location_name: formData.location_name,
        location_address: formData.location_address,
        location_map_url: formData.location_map_url,
        latitude: formData.latitude,
        longitude: formData.longitude,
        location_extra_info: formData.location_extra_info,
        lockdown_minutes: formData.lockdown_minutes,
        max_participants: formData.max_participants,
        topics: formData.topics,
        articles: formData.articles,
      };

      if (editEvent) {
        await updateMeetupEvent(editEvent.id, firestoreEventData);
        if (onEventUpdated) {
          onEventUpdated();
        }
      } else {
        const eventId = await createMeetupEvent(firestoreEventData, creatorUid);
        if (onEventCreated) {
          onEventCreated(eventId);
        }
      }

      onClose();
    } catch (error) {
      console.error("Error creating event:", error);
      alert("Failed to create event. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <DialogOverlay $isOpen={isOpen} onClick={onClose}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>
            {editEvent
              ? `Edit Event: ${editEvent.title}`
              : templateEvent
              ? `Duplicate Event: ${templateEvent.title}`
              : "Create New Event"}
          </DialogTitle>
          <CloseButton onClick={onClose}>×</CloseButton>
        </DialogHeader>

        <Form onSubmit={handleSubmit}>
          <FormGroup>
            <Label>Title</Label>
            <Input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              required
            />
          </FormGroup>

          <FormGroup>
            <Label>Description</Label>
            <TextArea
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              required
            />
          </FormGroup>

          <LocationRow>
            <FormGroup>
              <Label>Event Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange("date", e.target.value)}
                required
              />
            </FormGroup>
            <FormGroup>
              <Label>Event Time</Label>
              <Input
                type="time"
                value={formData.time}
                onChange={(e) => handleInputChange("time", e.target.value)}
                required
              />
            </FormGroup>
          </LocationRow>

          <FormGroup>
            <Label>Location</Label>
            <LocationInputRow>
              <div style={{ flex: 1 }}>
                <LocationRow>
                  <Input
                    type="text"
                    placeholder="Location Name"
                    value={formData.location_name}
                    onChange={(e) =>
                      handleInputChange("location_name", e.target.value)
                    }
                    required
                  />
                  <Input
                    type="text"
                    placeholder="Location Address"
                    value={formData.location_address}
                    onChange={(e) =>
                      handleInputChange("location_address", e.target.value)
                    }
                  />
                </LocationRow>
              </div>
              <SearchButton
                type="button"
                onClick={() => setShowLocationSearch(true)}
              >
                Search
              </SearchButton>
            </LocationInputRow>
            <LocationRow style={{ marginTop: "0.5rem" }}>
              <Input
                type="url"
                placeholder="Map URL (optional)"
                value={formData.location_map_url}
                onChange={(e) =>
                  handleInputChange("location_map_url", e.target.value)
                }
              />
              <Input
                type="text"
                placeholder="Extra Info"
                value={formData.location_extra_info}
                onChange={(e) =>
                  handleInputChange("location_extra_info", e.target.value)
                }
              />
            </LocationRow>
            <div
              style={{ fontSize: "12px", color: "#666", marginTop: "0.5rem" }}
            >
              Use the search button to find locations with automatic
              coordinates, or coordinates will be automatically resolved from
              the location name/address.
            </div>
          </FormGroup>

          <NumberRow>
            <FormGroup>
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) =>
                  handleInputChange(
                    "duration_minutes",
                    parseInt(e.target.value) || 60
                  )
                }
                required
              />
            </FormGroup>
            <FormGroup>
              <Label>Max Participants</Label>
              <Input
                type="number"
                value={formData.max_participants}
                onChange={(e) =>
                  handleInputChange(
                    "max_participants",
                    parseInt(e.target.value) || 20
                  )
                }
                required
              />
            </FormGroup>
            <FormGroup>
              <Label>Lockdown (minutes)</Label>
              <Input
                type="number"
                value={formData.lockdown_minutes}
                onChange={(e) =>
                  handleInputChange(
                    "lockdown_minutes",
                    parseInt(e.target.value) || 10
                  )
                }
                required
              />
            </FormGroup>
          </NumberRow>

          <FormGroup>
            <Label>Event Images</Label>
            <ImageUploadContainer>
              <FileInput
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                multiple
                onChange={handleImageUpload}
                disabled={uploadingImages}
              />

              {uploadErrors.length > 0 && (
                <div>
                  {uploadErrors.map((error, index) => (
                    <ErrorMessage key={index}>{error}</ErrorMessage>
                  ))}
                </div>
              )}

              {formData.image_urls.length > 0 && (
                <ImagePreviewContainer>
                  {formData.image_urls.map((url, index) => (
                    <ImagePreview key={index}>
                      <PreviewImage
                        src={url}
                        alt={`Event image ${index + 1}`}
                      />
                      <RemoveImageButton
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                      >
                        ×
                      </RemoveImageButton>
                    </ImagePreview>
                  ))}
                </ImagePreviewContainer>
              )}

              <div style={{ fontSize: "12px", color: "#666" }}>
                📸 Upload JPEG, PNG, or WebP images (max 5MB each)
              </div>
            </ImageUploadContainer>
          </FormGroup>

          <FormGroup>
            <Label>Discussion Topics (Select up to 2 articles)</Label>
            <ArticleSelection>
              {loadingArticles ? (
                <LoadingText>Loading articles...</LoadingText>
              ) : (
                <>
                  <ArticleList
                    ref={articleListRef}
                    onScroll={handleArticleListScroll}
                  >
                    {availableArticles.map((article) => (
                      <ArticleItem
                        key={article.id}
                        $selected={formData.articles.includes(article.id)}
                        onClick={() => handleArticleToggle(article.id)}
                      >
                        <ArticleTitle>{article.title.english}</ArticleTitle>
                        <ArticleId>ID: {article.id}</ArticleId>
                      </ArticleItem>
                    ))}
                    {loadingMoreArticles && (
                      <LoadingText>Loading more articles...</LoadingText>
                    )}
                    {!hasMoreArticles && availableArticles.length > 0 && (
                      <LoadingText
                        style={{
                          fontSize: "12px",
                          padding: "0.5rem",
                          color: "#999",
                        }}
                      >
                        No more articles to load
                      </LoadingText>
                    )}
                  </ArticleList>

                  {formData.articles.length > 0 && (
                    <SelectedArticlesDisplay>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#666",
                          marginBottom: "0.5rem",
                        }}
                      >
                        Selected Topics ({formData.articles.length}/2):
                      </div>
                      {formData.articles.map((articleId) => {
                        const article = availableArticles.find(
                          (a) => a.id === articleId
                        );
                        return article ? (
                          <SelectedArticleTag
                            key={articleId}
                            onClick={() => handleRemoveArticle(articleId)}
                          >
                            {article.title.english} ✕
                          </SelectedArticleTag>
                        ) : null;
                      })}
                    </SelectedArticlesDisplay>
                  )}

                  <div
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      marginTop: "0.5rem",
                    }}
                  >
                    Click articles to select them as discussion topics. Max 2
                    articles recommended.
                  </div>
                </>
              )}
            </ArticleSelection>
          </FormGroup>

          <FormGroup>
            <Label>GDG Topic (Optional, selects 3rd article)</Label>
            <ArticleSelection>
              {loadingArticles ? (
                <LoadingText>Loading articles...</LoadingText>
              ) : (
                <>
                  <ArticleList
                    ref={articleListRef}
                    onScroll={handleArticleListScroll}
                  >
                    {availableArticles.map((article) => (
                      <ArticleItem
                        key={article.id}
                        $selected={formData.articles[2] === article.id}
                        onClick={() => {
                          const next = [...formData.articles];
                          next[2] = article.id;
                          setFormData((prev) => ({ ...prev, articles: next }));
                        }}
                      >
                        <ArticleTitle>{article.title.english}</ArticleTitle>
                        <ArticleId>ID: {article.id}</ArticleId>
                      </ArticleItem>
                    ))}
                    {loadingMoreArticles && (
                      <LoadingText>Loading more articles...</LoadingText>
                    )}
                    {!hasMoreArticles && availableArticles.length > 0 && (
                      <LoadingText
                        style={{
                          fontSize: "12px",
                          padding: "0.5rem",
                          color: "#999",
                        }}
                      >
                        No more articles to load
                      </LoadingText>
                    )}
                  </ArticleList>

                  {formData.articles[2] && (
                    <SelectedArticlesDisplay>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#666",
                          marginBottom: "0.5rem",
                        }}
                      >
                        Selected GDG Topic:
                      </div>
                      {(() => {
                        const article = availableArticles.find(
                          (a) => a.id === formData.articles[2]
                        );
                        return article ? (
                          <SelectedArticleTag
                            onClick={() => {
                              const next = [...formData.articles];
                              next[2] = undefined as any;
                              setFormData((prev) => ({
                                ...prev,
                                articles: next.filter(Boolean),
                              }));
                            }}
                          >
                            {article.title.english} ✕
                          </SelectedArticleTag>
                        ) : null;
                      })()}
                    </SelectedArticlesDisplay>
                  )}
                </>
              )}
            </ArticleSelection>
          </FormGroup>

          <ButtonRow>
            <ActionButton type="button" $variant="secondary" onClick={onClose}>
              Cancel
            </ActionButton>
            <ActionButton
              type="submit"
              $variant="primary"
              disabled={loading || uploadingImages}
            >
              {loading
                ? editEvent
                  ? "Updating..."
                  : "Creating..."
                : uploadingImages
                ? "Uploading Images..."
                : editEvent
                ? "Update Event"
                : "Create Event"}
            </ActionButton>
          </ButtonRow>
        </Form>
      </DialogContent>

      <LocationSearch
        isOpen={showLocationSearch}
        onClose={() => setShowLocationSearch(false)}
        onLocationSelected={handleLocationSelected}
      />
    </DialogOverlay>
  );
};

export default AdminEventDialog;
