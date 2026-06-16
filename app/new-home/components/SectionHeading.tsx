import styled from "styled-components";

export const SectionTitle = styled.h2`
  font-size: clamp(1.85rem, 3vw, 2.4rem);
  font-weight: 900;
  color: #0f172a;
  margin-bottom: 1.5rem;
  line-height: 1.2;
  font-family: "Noto Sans KR", sans-serif;
  text-align: left;

  @media (max-width: 768px) {
    text-align: center;
  }
`;

export const Highlight = styled.span`
  color: rgb(128, 0, 33);
`;
