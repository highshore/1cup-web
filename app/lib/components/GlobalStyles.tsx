"use client";

import { createGlobalStyle } from "styled-components";
import { colors } from "../constants/colors";
import { appLayout } from "../constants/app_layout";
import reset from "styled-reset";

const GlobalStyles = createGlobalStyle`
  ${reset};
  * {
    box-sizing: border-box;
  }
  html {
    -webkit-text-size-adjust: 100%; /* Prevent font scaling in landscape */
  }
  body {
    background-color: ${colors.pageBg};
    color: ${colors.text.dark};
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    overflow-x: hidden; /* Prevent horizontal scrolling at the page level */
    position: relative; /* Establish a stacking context */
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Prefer Noto Sans KR for Korean text */
  :lang(ko) {
    font-family: 'Noto Sans KR', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
  
  #root {
    width: 100%;
    height: 100%;
    overflow-x: hidden;
  }
  
  /* Ensure buttons and interactive elements can escape parent bounds */
  button {
    position: relative;
    z-index: auto;
  }
  
  /* Heading styles */
  h1, h2, h3, h4, h5, h6 {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-weight: 600;
    color: ${colors.text.dark};
    letter-spacing: -0.02em;
  }
  
  /* Quick reading highlight style */
  .highlighted { color: ${colors.primaryDark}; font-weight: 800; }

  a { color: ${colors.primary}; text-decoration: none; }
  a:hover { color: ${colors.primaryDark}; text-decoration: underline; }

  /* Containers */
  .container {
    max-width: ${appLayout.pageMaxWidth};
    margin: 0 auto;
    padding: 0 ${appLayout.pageGutterDesktop};
  }
  @media (max-width: 768px) {
    .container { padding: 0 ${appLayout.pageGutterMobile}; }
  }
  
  /* Additional mobile optimizations */
  @media (max-width: 768px) {
    body {
      /* Remove fixed positioning that prevents scrolling */
      -webkit-overflow-scrolling: touch;
    }
  }
`;

export default GlobalStyles;
