import React, { useState, useEffect, useRef, useCallback } from "react";
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

// Presentational components (Tailwind)
type DivProps = React.ComponentPropsWithRef<"div">;
type ButtonProps = React.ComponentPropsWithRef<"button">;
type InputProps = React.ComponentPropsWithRef<"input">;

const DialogOverlay: React.FC<DivProps & { $isOpen: boolean }> = ({
  $isOpen,
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`fixed inset-0 z-[1000] items-center justify-center bg-[rgba(0,0,0,0.5)] p-4 max-[768px]:items-start max-[768px]:p-3 max-[768px]:pt-8 ${
      $isOpen ? "flex" : "hidden"
    } ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const DialogContent: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`w-full max-w-[600px] max-h-[90vh] overflow-y-auto rounded-[20px] bg-white p-8 shadow-[0_20px_40px_rgba(0,0,0,0.2)] max-[768px]:max-h-[95vh] max-[768px]:rounded-[16px] max-[768px]:p-6 ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const DialogHeader: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`mb-6 flex items-center justify-between max-[768px]:mb-4 ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const DialogTitle: React.FC<React.ComponentPropsWithRef<"h2">> = ({
  className = "",
  children,
  ...rest
}) => (
  <h2
    className={`m-0 text-[20px] font-bold text-[#333] max-[768px]:text-[18px] ${className}`}
    {...rest}
  >
    {children}
  </h2>
);

const CloseButton: React.FC<ButtonProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <button
    className={`cursor-pointer rounded-full border-0 bg-transparent p-2 text-[24px] text-[#666] [transition:background-color_0.2s] hover:bg-[#f0f0f0] max-[768px]:p-1.5 max-[768px]:text-[20px] ${className}`}
    {...rest}
  >
    {children}
  </button>
);

const FormGroup: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div className={`flex flex-col ${className}`} {...rest}>
    {children}
  </div>
);

const Label: React.FC<React.ComponentPropsWithRef<"label">> = ({
  className = "",
  children,
  ...rest
}) => (
  <label
    className={`mb-2 text-[14px] font-semibold text-[#333] max-[768px]:mb-1.5 max-[768px]:text-[13px] ${className}`}
    {...rest}
  >
    {children}
  </label>
);

const inputClass =
  "p-3 border border-solid border-[#e0e0e0] rounded-[10px] text-[14px] focus:outline-none focus:border-[#2196f3] focus:shadow-[0_0_0_2px_rgba(33,150,243,0.1)] max-[768px]:p-2.5 max-[768px]:text-[16px] max-[768px]:rounded-[8px]";

const Input: React.FC<InputProps> = ({ className = "", ...rest }) => (
  <input className={`${inputClass} ${className}`} {...rest} />
);

const TextArea: React.FC<React.ComponentPropsWithRef<"textarea">> = ({
  className = "",
  ...rest
}) => (
  <textarea
    className={`${inputClass} min-h-[100px] resize-y max-[768px]:min-h-[80px] ${className}`}
    {...rest}
  />
);

const LocationRow: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`grid grid-cols-[1fr_1fr] gap-3 max-[768px]:grid-cols-[1fr] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const NumberRow: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`grid grid-cols-[1fr_1fr_1fr] gap-3 max-[768px]:grid-cols-[1fr] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const ImageUploadContainer: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div className={`flex flex-col gap-4 ${className}`} {...rest}>
    {children}
  </div>
);

const FileInput: React.FC<InputProps> = ({ className = "", ...rest }) => (
  <input
    className={`cursor-pointer rounded-[10px] border-2 border-dashed border-[#e0e0e0] bg-[#fafafa] p-3 text-[14px] [transition:all_0.2s] hover:border-[#2196f3] hover:bg-[#f5f5f5] focus:border-[#2196f3] focus:shadow-[0_0_0_2px_rgba(33,150,243,0.1)] focus:outline-none ${className}`}
    {...rest}
  />
);

const ImagePreviewContainer: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`mt-4 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4 max-[768px]:mt-3 max-[768px]:grid-cols-[repeat(auto-fill,minmax(100px,1fr))] max-[768px]:gap-3 ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const ImagePreview: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`relative aspect-square overflow-hidden rounded-[10px] bg-[#f5f5f5] max-[768px]:rounded-[8px] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const PreviewImage: React.FC<React.ComponentPropsWithRef<"img">> = ({
  className = "",
  ...rest
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
}) => <img className={`h-full w-full object-cover ${className}`} {...rest} />;

const RemoveImageButton: React.FC<ButtonProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <button
    className={`absolute top-[5px] right-[5px] flex h-[24px] w-[24px] cursor-pointer items-center justify-center rounded-full border-0 bg-[rgba(244,67,54,0.8)] text-[14px] text-white hover:bg-[rgba(244,67,54,1)] max-[768px]:top-[3px] max-[768px]:right-[3px] max-[768px]:h-[28px] max-[768px]:w-[28px] max-[768px]:text-[16px] ${className}`}
    {...rest}
  >
    {children}
  </button>
);

const ErrorMessage: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div className={`mt-1 text-[12px] text-[#d32f2f] ${className}`} {...rest}>
    {children}
  </div>
);

const ArticleSelection: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`rounded-[10px] border border-solid border-[#e0e0e0] bg-[#fafafa] p-3 max-[768px]:rounded-[8px] max-[768px]:p-2.5 ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const ArticleList: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`max-h-[300px] overflow-y-auto rounded-[8px] border border-solid border-[#e0e0e0] bg-white max-[768px]:max-h-[250px] max-[768px]:rounded-[6px] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const ArticleItem: React.FC<DivProps & { $selected: boolean }> = ({
  $selected,
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`cursor-pointer border-b border-solid border-[#f0f0f0] p-3 [transition:background-color_0.2s] last:border-b-0 max-[768px]:p-2.5 ${
      $selected
        ? "bg-[#e3f2fd] hover:bg-[#bbdefb]"
        : "bg-white hover:bg-[#f5f5f5]"
    } ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const ArticleTitle: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`mb-1 text-[14px] font-semibold text-[#333] max-[768px]:text-[13px] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const ArticleId: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`text-[12px] text-[#666] [font-family:monospace] max-[768px]:text-[11px] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const SelectedArticlesDisplay: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div className={`mt-2 max-[768px]:mt-1.5 ${className}`} {...rest}>
    {children}
  </div>
);

const SelectedArticleTag: React.FC<React.ComponentPropsWithRef<"span">> = ({
  className = "",
  children,
  ...rest
}) => (
  <span
    className={`mr-2 mb-1 inline-block cursor-pointer rounded-[12px] bg-[#2196f3] px-2 py-1 text-[12px] text-white hover:bg-[#1976d2] max-[768px]:mr-1.5 max-[768px]:px-[0.4rem] max-[768px]:py-[0.2rem] max-[768px]:text-[11px] ${className}`}
    {...rest}
  >
    {children}
  </span>
);

const LoadingText: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`p-4 text-center text-[14px] text-[#666] max-[768px]:p-3 max-[768px]:text-[13px] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const ButtonRow: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`mt-6 flex gap-4 max-[768px]:mt-4 max-[768px]:gap-3 ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const ActionButton: React.FC<
  ButtonProps & { $variant: "primary" | "secondary" }
> = ({ $variant, className = "", children, ...rest }) => (
  <button
    className={`flex-1 cursor-pointer rounded-[20px] border-0 p-4 text-[14px] font-semibold [transition:all_0.2s] hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] enabled:hover:[transform:translateY(-2px)] disabled:cursor-not-allowed disabled:opacity-50 max-[768px]:rounded-[16px] max-[768px]:p-3.5 max-[768px]:text-[16px] max-[768px]:enabled:hover:[transform:translateY(-1px)] ${
      $variant === "primary" ? "bg-[#181818] text-white" : "bg-[#f5f5f5] text-[#666]"
    } ${className}`}
    {...rest}
  >
    {children}
  </button>
);

const LocationSearchModal: React.FC<DivProps & { $isOpen: boolean }> = ({
  $isOpen,
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`fixed inset-0 z-[1100] items-center justify-center bg-[rgba(0,0,0,0.5)] p-4 max-[768px]:items-start max-[768px]:p-3 max-[768px]:pt-8 ${
      $isOpen ? "flex" : "hidden"
    } ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const LocationSearchContent: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`w-full max-w-[500px] max-h-[80vh] overflow-y-auto rounded-[20px] bg-white p-6 shadow-[0_20px_40px_rgba(0,0,0,0.2)] max-[768px]:max-h-[90vh] max-[768px]:rounded-[16px] max-[768px]:p-5 ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const SearchInput: React.FC<InputProps> = ({ className = "", ...rest }) => (
  <input
    className={`mb-4 w-full rounded-[10px] border border-solid border-[#e0e0e0] p-3 text-[14px] focus:border-[#2196f3] focus:shadow-[0_0_0_2px_rgba(33,150,243,0.1)] focus:outline-none max-[768px]:mb-3 max-[768px]:rounded-[8px] max-[768px]:p-2.5 max-[768px]:text-[16px] ${className}`}
    {...rest}
  />
);

const SearchResults: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`max-h-[300px] overflow-y-auto max-[768px]:max-h-[250px] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const SearchResultItem: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`mb-2 cursor-pointer rounded-[10px] border border-solid border-[#e0e0e0] p-4 [transition:all_0.2s] hover:border-[#2196f3] hover:bg-[#f5f5f5] max-[768px]:mb-1.5 max-[768px]:rounded-[8px] max-[768px]:p-3.5 ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const ResultTitle: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`mb-1 font-semibold text-[#333] max-[768px]:text-[14px] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const ResultAddress: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`text-[12px] text-[#666] max-[768px]:text-[11px] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const SearchButton: React.FC<ButtonProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <button
    className={`ml-2 cursor-pointer rounded-[10px] border-0 bg-[#2196f3] px-4 py-3 text-[14px] font-semibold text-white [transition:all_0.2s] hover:bg-[#1976d2] hover:[transform:translateY(-1px)] active:[transform:translateY(0)] max-[768px]:ml-1.5 max-[768px]:rounded-[8px] max-[768px]:px-3.5 max-[768px]:py-2.5 max-[768px]:text-[16px] ${className}`}
    {...rest}
  >
    {children}
  </button>
);

const LocationInputRow: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`mb-2 flex items-end gap-2 max-[768px]:mb-1.5 max-[768px]:gap-1.5 ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const Form: React.FC<React.ComponentPropsWithRef<"form">> = ({
  className = "",
  children,
  ...rest
}) => (
  <form
    className={`flex flex-col gap-4 max-[768px]:gap-3.5 ${className}`}
    {...rest}
  >
    {children}
  </form>
);

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
