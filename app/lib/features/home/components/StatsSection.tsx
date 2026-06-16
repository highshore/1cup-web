"use client";

import React from "react";
import styled from "styled-components";
import { useI18n } from "../../../i18n/I18nProvider";
import {
  GlobeAltIcon,
  UsersIcon,
  ArrowTrendingUpIcon,
  MicrophoneIcon,
  SparklesIcon,
  TrophyIcon,
  NewspaperIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";
import { HomeStats } from "../services/stats_service";

// Types
interface StatsSectionProps {
  stats?: HomeStats;
}

// Styled Components
const MOBILE_NAV_GUTTER = "1rem";

const SectionContainer = styled.section`
  padding: 5rem 0;
  background-color: #F3F3F1;
`;

const Container = styled.div`
  max-width: 960px;
  margin: 0 auto;
  padding: 0 20px;

  @media (max-width: 768px) {
    padding: 0 ${MOBILE_NAV_GUTTER};
  }
`;

const HeaderWrapper = styled.div`
  margin-bottom: 3rem;
  max-width: 48rem;

  @media (max-width: 768px) {
    margin: 0 auto 2.5rem;
    text-align: center;
  }
`;

const Title = styled.h2`
  font-size: clamp(1.85rem, 3vw, 2.4rem);
  font-weight: 900;
  color: #0f172a;
  margin-bottom: 1.5rem;
  line-height: 1.2;

  @media (max-width: 768px) {
    text-align: center;
  }
`;

const Highlight = styled.span`
  color: rgb(128, 0, 33);
`;

const Description = styled.p`
  font-size: clamp(1rem, 2vw, 1.125rem);
  color: #475569;
  line-height: 1.6;
  display: none; // Hidden as requested
  
  strong {
    font-weight: 700;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  
  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

// Card Styles
const CardBase = styled.div`
  border-radius: 2rem;
  padding: 2rem;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
`;

const Card2 = styled(CardBase)`
  background-color: #D2E823;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  
  @media (min-width: 768px) {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: flex-start;
  }
`;

const Card3 = styled(CardBase)`
  background-color: #E0E7FF;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  
  @media (min-width: 768px) {
      grid-column: span 1;
  }

  &:hover {
    background-color: #dbe4ff;
  }
`;

const Card4 = styled(CardBase)`
  background-color: #FF9B9B;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: #0f172a;
  
  @media (min-width: 768px) {
      grid-column: span 1;
  }
`;

const Card5 = styled(CardBase)`
  background-color: #0f172a;
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 4rem 2rem;
  
  @media (min-width: 768px) {
    grid-column: 1 / -1;
    flex-direction: row;
    gap: 3rem;
    text-align: left;
    align-items: center;
    justify-content: space-between;
    padding: 3rem 4rem;
  }
`;

// Icon Helper
const IconWrapper = styled.div<{ $bg?: string; $color?: string }>`
  width: 3rem;
  height: 3rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  background-color: ${props => props.$bg || 'rgba(255, 255, 255, 0.2)'};
  color: ${props => props.$color || 'inherit'};
  backdrop-filter: blur(12px);
`;

const CardTitle = styled.h3<{ $dark?: boolean }>`
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  line-height: 1.3;
  color: ${props => props.$dark ? '#0f172a' : 'inherit'};
`;

const CardText = styled.p<{ $dark?: boolean }>`
  color: ${props => props.$dark ? '#1e293b' : 'rgba(255, 255, 255, 0.8)'};
  line-height: 1.6;
  font-weight: 500;
  font-size: 0.95rem;
`;

// Specific Components
const BgIcon = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  padding: 2.5rem;
  opacity: 0.1;
  transition: opacity 0.3s ease;
  pointer-events: none;
`;

const PhotoStack = styled.div`
  position: relative;
  height: 60px;
  margin-top: 1rem;
`;

const Photo = styled.img<{ $index: number }>`
  position: absolute;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid white;
  object-fit: cover;
  left: ${props => props.$index * 32}px;
  z-index: ${props => props.$index};
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
`;

const ContentLeft = styled.div`
  flex: 1;
  z-index: 10;
`;

const ContentRight = styled.div`
  flex: 1;
  height: 100%;
  min-height: 200px;
  width: 100%;
  background-color: rgba(255, 255, 255, 0.4);
  border-radius: 0.75rem;
  padding: 1rem;
  transform: rotate(3deg);
  transition: transform 0.3s ease;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  
  ${Card2}:hover & {
    transform: rotate(0deg);
  }
`;

const DiscussionMock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const Line = styled.div<{ $w?: string; $h?: string }>`
  height: ${props => props.$h || '0.5rem'};
  width: ${props => props.$w || '100%'};
  background-color: rgba(15, 23, 42, 0.1);
  border-radius: 0.25rem;
`;

const Button = styled.button<{ $primary?: boolean }>`
  background-color: ${props => props.$primary ? '#0f172a' : 'white'};
  color: ${props => props.$primary ? 'white' : '#0f172a'};
  padding: 0.75rem 1.5rem;
  border-radius: 9999px;
  font-weight: 700;
  transition: background-color 0.2s;
  border: none;
  cursor: pointer;
  
  &:hover {
    background-color: ${props => props.$primary ? '#1e293b' : '#e5e7eb'};
  }

  @media (max-width: 768px) {
    width: 100%;
    margin-top: 1rem;
  }
`;

// Metric Styles
const MetricsContainer = styled.div`
  display: flex;
  gap: 3rem;
  align-items: flex-start;
  margin-top: 1.5rem;
  flex-wrap: wrap;
  justify-content: flex-start;
  width: 100%;
`;

const MetricItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
`;

const MetricValue = styled.span`
  font-size: 2.5rem;
  font-weight: 800;
  color: #D2E823; // High contrast
  line-height: 1;
`;

const MetricLabel = styled.span`
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
`;

// Leader Card Styles - Updated
const LeaderProfileWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-top: auto;
  padding-top: 1.5rem;
  width: 100%;
`;

const LeaderProfile = styled.a`
  display: block;
  position: relative;
  width: 100px;
  height: 100px;
  text-decoration: none;
  cursor: pointer;
  flex-shrink: 0;
  
  &:hover img {
    transform: scale(1.05);
    box-shadow: 0 25px 30px -5px rgba(0, 0, 0, 0.4);
  }
`;

const LeaderImage = styled.img`
  width: 100%;
  height: 100%;
  border-radius: 24px;
  object-fit: cover;
  border: 3px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
`;

const LinkedInBadge = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0077b5;
  color: white;
  width: 50px;
  height: 50px;
  border-radius: 14px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  
  &:hover {
    background: #006396;
    transform: scale(1.1);
  }

  svg {
    width: 28px;
    height: 28px;
    fill: currentColor;
  }
`;

// Insights Gallery Styles - Updated
const SingleGalleryImage = styled.div<{ $src: string }>`
  width: 100%;
  height: 100%;
  min-height: 250px;
  border-radius: 24px;
  background-image: url(${props => props.$src});
  background-size: cover;
  background-position: center;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;

  &:hover {
    transform: scale(1.02);
  }
`;

// Topic Card Visuals
const TopicTag = styled.div<{ $color: string; $rotate: string }>`
  background: white;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  font-weight: 800;
  color: ${props => props.$color};
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  transform: rotate(${props => props.$rotate});
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: transform 0.3s ease;
  border: 1px solid rgba(0,0,0,0.05);

  &:hover {
    transform: rotate(0deg) scale(1.05);
    z-index: 10;
  }
`;

const TopicVisual = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: auto;
  padding-top: 2rem;
  justify-content: center;
`;

const LeaderLinkButton = styled.a`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: #ffffff;
  padding: 0.8rem 1rem 0.8rem 1.2rem;
  border-radius: 16px;
  text-decoration: none;
  color: #0f172a;
  font-weight: 700;
  font-size: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  width: 100%;
  border: 1px solid rgba(0, 0, 0, 0.05);
  margin-top: auto;
  padding-top: 0.8rem;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04);
    border-color: rgba(0, 0, 0, 0.1);
  }
`;

const LeaderLinkImage = styled.img`
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #f1f5f9;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
`;

const LeaderLinkIcon = styled.div`
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0077b5;
  background: #f0f9ff; /* Light blue tint */
  border-radius: 50%;
  transition: all 0.2s ease;
  
  svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }
  
  ${LeaderLinkButton}:hover & {
    background: #0077b5;
    color: white;
  }
`;

// Atmosphere Visuals
const FloatingBubble = styled.div<{ $size: string; $top: string; $left: string; $delay: string }>`
  position: absolute;
  width: ${props => props.$size};
  height: ${props => props.$size};
  top: ${props => props.$top};
  left: ${props => props.$left};
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  backdrop-filter: blur(4px);
  animation: float 6s ease-in-out infinite;
  animation-delay: ${props => props.$delay};
  z-index: 1;

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-20px); }
  }
`;

export default function StatsSection({ stats }: StatsSectionProps) {
  const { t } = useI18n();
  const memberCount = stats?.totalMembers || 2000;
  
  const galleryImages = [
    "/assets/homepage/gallery1.JPG",
    "/assets/homepage/gallery2.JPG",
    "/assets/homepage/gallery3.JPG"
  ];

  return (
    <SectionContainer>
      <Container>
        <HeaderWrapper>
          <Title>
            {t.home.stats.header.title.split('\n')[0]}<br/>
            <Highlight>{t.home.stats.header.highlight}</Highlight>{t.home.stats.header.title.split('\n')[1].replace(t.home.stats.header.highlight, '')}
          </Title>
        </HeaderWrapper>

        <Grid>
          {/* Card 2: Insights (Replaces Curriculum card style, used to be wide) */}
          <Card2>
            <ContentLeft>
                <IconWrapper $bg="rgba(15, 23, 42, 0.1)">
                    <SparklesIcon width={24} color="#0f172a" />
                </IconWrapper>
                <CardTitle $dark>{t.home.stats.insights.title.split('\n').map((line: string, i: number) => <React.Fragment key={i}>{line}<br/></React.Fragment>)}</CardTitle>
                <CardText $dark>
                    {t.home.stats.insights.description}
                </CardText>
            </ContentLeft>
            
            <ContentRight style={{ background: 'transparent', padding: 0, boxShadow: 'none', transform: 'none' }}>
               <SingleGalleryImage $src={galleryImages[0]} />
            </ContentRight>
          </Card2>

          {/* Card 4: Atmosphere (Now Leader Section) */}
          <Card4 style={{ paddingBottom: '2rem' }}>
             <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                <FloatingBubble $size="150px" $top="-30px" $left="-30px" $delay="0s" />
                <FloatingBubble $size="100px" $top="40%" $left="80%" $delay="2s" />
                <FloatingBubble $size="80px" $top="80%" $left="10%" $delay="4s" />
                <FloatingBubble $size="120px" $top="90%" $left="60%" $delay="1s" />
             </div>
             <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <IconWrapper $bg="rgba(255, 255, 255, 0.2)">
                    <UsersIcon width={24} className="text-white" />
                </IconWrapper>
                <CardTitle $dark>{t.home.stats.leader.title.split('\n').map((line: string, i: number) => <React.Fragment key={i}>{line}<br/></React.Fragment>)}</CardTitle>
                <CardText $dark>
                   {t.home.stats.leader.description}
                </CardText>
                
                <LeaderProfileWrapper>
                  <LeaderLinkButton 
                      href="https://www.linkedin.com/in/sk-kyle-kim/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                  >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <LeaderLinkImage src="/assets/homepage/member1.JPG" alt="Kyle Kim" />
                        <span style={{ fontSize: '1.05rem' }}>{t.home.stats.leader.linkedin}</span>
                      </div>
                      <LeaderLinkIcon>
                        <svg viewBox="0 0 24 24">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                      </LeaderLinkIcon>
                  </LeaderLinkButton>
                </LeaderProfileWrapper>
             </div>
          </Card4>

          {/* Card 3: Global Elite Topics (Replaces Feedback card style) */}
          <Card3>
             <div>
                <IconWrapper $bg="rgba(37, 99, 235, 0.1)">
                    <NewspaperIcon width={24} color="#2563eb" />
                </IconWrapper>
                <CardTitle $dark>{t.home.stats.topics.title.split('\n').map((line: string, i: number) => <React.Fragment key={i}>{line}<br/></React.Fragment>)}</CardTitle>
                <CardText $dark>
                    {t.home.stats.topics.description}
                </CardText>
             </div>
             
             <TopicVisual>
                 <TopicTag $color="#000000" $rotate="-3deg">
                    <span style={{ fontFamily: 'serif' }}>The New York Times</span>
                 </TopicTag>
                 <TopicTag $color="#16a34a" $rotate="2deg">
                    <span>TechCrunch</span>
                 </TopicTag>
                 <TopicTag $color="#2c5282" $rotate="-2deg">
                    <span style={{ fontFamily: 'serif' }}>WSJ</span>
                 </TopicTag>
                 <TopicTag $color="#d69e2e" $rotate="4deg">
                    <span style={{ fontFamily: 'serif' }}>FT</span>
                 </TopicTag>
                 <TopicTag $color="#dc2626" $rotate="-1deg">
                    <span>HBR</span>
                 </TopicTag>
             </TopicVisual>
          </Card3>

          {/* Card 5: Growth Opportunity CTA */}
          <Card5>
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center', width: '100%', maxWidth: 'fit-content' }}>
               <TrophyIcon width={48} color="#D2E823" />
             </div>
             <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
               <CardTitle style={{ marginBottom: 0 }}>{t.home.stats.growth.title}</CardTitle>
               
               {/* Metrics Subtitle */}
               <MetricsContainer style={{ marginTop: '0.5rem' }}>
                  <MetricItem>
                      <MetricValue>30회</MetricValue>
                      <MetricLabel>{t.home.stats.growth.metrics.meetups}</MetricLabel>
                  </MetricItem>
                  <MetricItem>
                      <MetricValue>50명+</MetricValue>
                      <MetricLabel>{t.home.stats.growth.metrics.members}</MetricLabel>
                  </MetricItem>
                   <MetricItem>
                      <MetricValue>90%+</MetricValue>
                      <MetricLabel>{t.home.stats.growth.metrics.retention}</MetricLabel>
                  </MetricItem>
               </MetricsContainer>

             </div>
             <div style={{ marginTop: '1rem' }}>
               <Button>{t.home.stats.growth.cta}</Button>
             </div>
          </Card5>

        </Grid>
      </Container>
    </SectionContainer>
  );
}
