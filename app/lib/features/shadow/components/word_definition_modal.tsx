import React from "react";
import { WordDefinitionModalState } from "../types/shadow";
import { colors } from "../styles/shadow_styles";

interface WordDefinitionModalProps {
  modalState: WordDefinitionModalState;
  onClose: () => void;
}

function WordDefinitionContent({
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`text-[#3c2e26] [font-family:'Apple_SD_Gothic_Neo','Noto_Sans_KR',sans-serif] leading-[1.6] whitespace-pre-line text-[1rem] ${className}`}
      {...rest}
    />
  );
}

function LoadingDefinitionContent({
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`text-[#8d6e63] italic py-4 px-0 flex items-center justify-center min-h-[100px] ${className}`}
      {...rest}
    />
  );
}

function DefinitionSection({
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`mb-6 ${className}`} {...rest} />;
}

function DefinitionLabel({
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`text-[1rem] font-semibold text-[#3c2e26] mb-2 ${className}`}
      {...rest}
    />
  );
}

const WordDefinitionModal: React.FC<WordDefinitionModalProps> = ({
  modalState,
  onClose,
}) => {
  return (
    <div
      onClick={onClose}
      className={`fixed top-0 left-0 right-0 bottom-0 bg-[rgba(0,0,0,0.7)] flex justify-center items-center z-[1000] [transition:opacity_0.3s_ease,visibility_0.3s_ease] ${
        modalState.isOpen ? "opacity-100 visible" : "opacity-0 invisible"
      }`}
    >
      <div
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className="bg-[#faf8f6] rounded-xl shadow-[0_5px_20px_rgba(0,0,0,0.2)] p-[1.8rem] max-w-[90%] w-[450px] relative [transform:scale(1)] [transition:transform_0.3s_ease] border border-solid border-line overflow-y-auto max-h-[90vh] max-[768px]:p-6 max-[768px]:w-[80%] max-[768px]:max-h-[80vh] max-[480px]:p-[1.2rem] max-[480px]:w-[90%] max-[480px]:max-h-[75vh]"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-transparent border-none text-[1.5rem] text-[#8d6e63] cursor-pointer w-[2.1rem] h-[2.1rem] p-0 leading-none rounded-full flex items-center justify-center [transition:all_0.2s_ease] hover:text-[#3c2e26] hover:bg-[#e8ddd4] max-[768px]:top-[0.8rem] max-[768px]:right-[0.8rem] max-[768px]:w-8 max-[768px]:h-8"
        >
          ×
        </button>
        <div className="font-bold text-[#3c2e26] mb-4 text-[1.5rem] pb-[0.7rem] border-b border-solid border-line">
          {modalState.word}
        </div>
        {/* Combined loading state for initial fetch */}
        {modalState.isLoading &&
        !modalState.apiData &&
        !modalState.gptDefinition ? (
          <LoadingDefinitionContent>
            뜻풀이 및 영어 정의 검색 중...
          </LoadingDefinitionContent>
        ) : (
          <>
            {/* Korean Definition (GPT) Section */}
            <DefinitionSection>
              {modalState.isLoading && !modalState.gptDefinition ? (
                <LoadingDefinitionContent>
                  GPT 뜻풀이 검색 중...
                </LoadingDefinitionContent>
              ) : modalState.gptDefinition ? (
                <WordDefinitionContent>
                  {modalState.gptDefinition}
                </WordDefinitionContent>
              ) : (
                <WordDefinitionContent>
                  한국어 뜻풀이를 가져오지 못했습니다.
                </WordDefinitionContent>
              )}
            </DefinitionSection>

            {/* English Definitions (Dictionary API) Section */}
            {modalState.isLoading && !modalState.apiData ? (
              <LoadingDefinitionContent>
                Loading English definitions from API...
              </LoadingDefinitionContent>
            ) : modalState.apiData &&
              Array.isArray(modalState.apiData) &&
              modalState.apiData.length > 0 ? (
              <details className="mt-4 [&_summary]:text-[0.95rem] [&_summary]:font-semibold [&_summary]:cursor-pointer [&_summary]:list-none [&_summary]:m-0 [&_summary]:p-0 [&_summary:hover]:text-[#2c1810] [&_ul]:pl-[1.2rem] [&_ul]:my-2 [&_ul]:mx-0 [&_ul]:list-disc [&_ul]:text-[0.9rem] [&_ul]:text-[#3c2e26]">
                <summary>📖 영어 사전 확인하기</summary>

                {modalState.apiData.map((entry: any, entryIdx: number) => (
                  <div
                    key={`entry-${entryIdx}`}
                    style={{
                      marginTop: "1rem",
                      borderBottom:
                        entryIdx < modalState.apiData.length - 1
                          ? "1px solid #eee"
                          : "none",
                      paddingBottom:
                        entryIdx < modalState.apiData.length - 1 ? "1rem" : "0",
                    }}
                  >
                    {/* All Phonetics with Audio */}
                    {entry.phonetics &&
                      entry.phonetics.filter((p: any) => p.text).length > 0 && (
                        <DefinitionSection>
                          <DefinitionLabel style={{ fontSize: "0.9rem" }}>
                            Pronunciation
                          </DefinitionLabel>
                          {entry.phonetics.map(
                            (p: any, pIdx: number) =>
                              p.text && (
                                <div
                                  key={`phonetic-${pIdx}`}
                                  style={{
                                    marginBottom: "0.3rem",
                                    display: "flex",
                                    alignItems: "center",
                                  }}
                                >
                                  {p.audio && (
                                    <audio
                                      controls
                                      src={p.audio}
                                      style={{
                                        height: "30px",
                                        minWidth: "100%",
                                      }}
                                    />
                                  )}
                                </div>
                              )
                          )}
                        </DefinitionSection>
                      )}

                    {/* Meanings */}
                    {entry.meanings && entry.meanings.length > 0 && (
                      <DefinitionSection>
                        <DefinitionLabel style={{ fontSize: "0.9rem" }}>
                          Meanings
                        </DefinitionLabel>
                        {entry.meanings.map((meaning: any, mIdx: number) => (
                          <div
                            key={`meaning-${mIdx}`}
                            style={{ marginBottom: "0.8rem" }}
                          >
                            <WordDefinitionContent
                              style={{
                                fontWeight: "bold",
                                color: colors.primaryDark,
                              }}
                            >
                              {meaning.partOfSpeech}
                            </WordDefinitionContent>

                            {meaning.definitions &&
                              meaning.definitions.length > 0 && (
                                <ul
                                  style={{
                                    marginTop: "0.3rem",
                                    paddingLeft: "0px",
                                    listStyleType: "disc",
                                  }}
                                >
                                  {meaning.definitions.map(
                                    (def: any, dIdx: number) => (
                                      <li
                                        key={`def-${dIdx}`}
                                        style={{ marginBottom: "0.4rem" }}
                                      >
                                        {def.definition}
                                        {def.example && (
                                          <div
                                            style={{
                                              fontStyle: "italic",
                                              color: colors.text.muted,
                                              fontSize: "0.9em",
                                              marginLeft: "0px",
                                              overflowWrap: "break-word",
                                              wordBreak: "break-word",
                                            }}
                                          >
                                            e.g. "{def.example}"
                                          </div>
                                        )}
                                        {def.synonyms &&
                                          def.synonyms.length > 0 && (
                                            <div
                                              style={{
                                                fontSize: "0.85em",
                                                color: colors.text.secondary,
                                                marginTop: "0.2rem",
                                                overflowWrap: "break-word",
                                                wordBreak: "break-word",
                                              }}
                                            >
                                              <strong>Synonyms:</strong>{" "}
                                              {def.synonyms.join(", ")}
                                            </div>
                                          )}
                                        {def.antonyms &&
                                          def.antonyms.length > 0 && (
                                            <div
                                              style={{
                                                fontSize: "0.85em",
                                                color: colors.text.secondary,
                                                marginTop: "0.2rem",
                                                overflowWrap: "break-word",
                                                wordBreak: "break-word",
                                              }}
                                            >
                                              <strong>Antonyms:</strong>{" "}
                                              {def.antonyms.join(", ")}
                                            </div>
                                          )}
                                      </li>
                                    )
                                  )}
                                </ul>
                              )}
                            {/* Display meaning-level synonyms */}
                            {meaning.synonyms &&
                              meaning.synonyms.length > 0 && (
                                <div
                                  style={{
                                    fontSize: "0.85em",
                                    color: colors.text.secondary,
                                    marginTop: "0.3rem",
                                    paddingLeft: "0px",
                                    overflowWrap: "break-word",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  <strong>Synonyms:</strong>{" "}
                                  {meaning.synonyms.join(", ")}
                                </div>
                              )}

                            {/* Display meaning-level antonyms */}
                            {meaning.antonyms &&
                              meaning.antonyms.length > 0 && (
                                <div
                                  style={{
                                    fontSize: "0.85em",
                                    color: colors.text.secondary,
                                    marginTop: "0.3rem",
                                    paddingLeft: "0px",
                                    overflowWrap: "break-word",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  <strong>Antonyms:</strong>{" "}
                                  {meaning.antonyms.join(", ")}
                                </div>
                              )}
                          </div>
                        ))}
                      </DefinitionSection>
                    )}
                    {/* Source URLs */}
                    {entry.sourceUrls && entry.sourceUrls.length > 0 && (
                      <DefinitionSection>
                        <DefinitionLabel style={{ fontSize: "0.9rem" }}>
                          Source: Wikitionary
                        </DefinitionLabel>
                      </DefinitionSection>
                    )}
                  </div>
                ))}
              </details>
            ) : modalState.apiData &&
              modalState.apiData.title === "No Definitions Found" ? (
              <LoadingDefinitionContent>
                No English definitions found for "{modalState.word}" via API.
              </LoadingDefinitionContent>
            ) : (
              !modalState.isLoading && (
                <LoadingDefinitionContent>
                  Could not load English definitions for "{modalState.word}".
                </LoadingDefinitionContent>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WordDefinitionModal;
