"use client";

import { useParams } from "next/navigation";
import styled from "styled-components";
import { colors } from "../../lib/constants/colors";

const PolicyContainer = styled.div`
  max-width: 880px;
  margin: 60px auto 0;
  padding: 2rem 1.5rem 5rem;
  min-height: 100vh;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;

  @media (max-width: 768px) {
    padding: 1.5rem 1rem 4rem;
  }
`;

const Title = styled.h1`
  font-size: 2rem;
  color: ${colors.text.dark};
  margin-bottom: 0.75rem;
  text-align: center;

  @media (max-width: 768px) {
    font-size: 1.8rem;
  }
`;

const EffectiveDate = styled.p`
  margin: 0 0 2.5rem;
  text-align: center;
  color: ${colors.text.medium};
  font-size: 0.92rem;
`;

const Content = styled.div`
  color: ${colors.text.medium};
  line-height: 1.8;
  font-size: 1rem;

  ul,
  ol {
    margin: 0.5rem 0 1rem 1.35rem;
    padding: 0;
  }

  li {
    margin-bottom: 0.4rem;
  }

  strong {
    color: ${colors.text.dark};
  }

  @media (max-width: 768px) {
    font-size: 0.95rem;
  }
`;

const Section = styled.section`
  margin-bottom: 2.25rem;
`;

const SectionTitle = styled.h2`
  color: ${colors.primary};
  font-size: 1.35rem;
  margin-bottom: 1rem;

  @media (max-width: 768px) {
    font-size: 1.18rem;
  }
`;

const Paragraph = styled.p`
  margin: 0 0 1rem;
`;

const Note = styled.div`
  margin: 1rem 0;
  padding: 1rem 1.1rem;
  border: 1px solid ${colors.border};
  border-radius: 10px;
  background: ${colors.background?.light || "transparent"};
`;

const Divider = styled.hr`
  border: 0;
  border-top: 1px solid ${colors.border};
  margin: 2rem 0;
`;

const EFFECTIVE_DATE = "2026년 8월 31일";

function PrivacyPolicy() {
  return (
    <Content>
      <Paragraph>
        네이티브피티(이하 “회사”)는 “영어 한잔(1 Cup English)” 서비스를 운영함에
        있어 이용자의 개인정보를 중요하게 생각하며, 「개인정보 보호법」 등 관계
        법령에 따라 개인정보를 적법하고 안전하게 처리합니다. 본 개인정보처리방침은
        회사가 처리하는 개인정보의 항목, 목적, 보유기간, 위탁 및 국외이전, 이용자의
        권리 등을 안내합니다.
      </Paragraph>

      <Section>
        <SectionTitle>1. 개인정보의 처리 목적</SectionTitle>
        <Paragraph>회사는 다음 목적을 위하여 필요한 범위에서 개인정보를 처리합니다.</Paragraph>
        <ul>
          <li><strong>회원가입 및 인증:</strong> 회원 식별, 휴대전화·이메일·카카오 로그인 인증, 중복 계정 확인 및 계정 통합, 부정 이용 방지</li>
          <li><strong>프로필 및 커뮤니티:</strong> 프로필 표시, 회원 간 메시지·좋아요·차단, 네트워킹 및 커뮤니티 기능 제공</li>
          <li><strong>멤버십 및 결제:</strong> 멤버십 가입·갱신·해지, 정기결제, 결제취소·환불, 할인·추천인 제도 운영, 거래내역 확인</li>
          <li><strong>밋업 운영:</strong> 밋업 신청, 참가자 및 정원 관리, 일정 안내, 운영상 필요한 연락</li>
          <li><strong>영어 학습 서비스:</strong> 학습 기록, 저장 단어, 말하기 기록·전사·분석 및 AI 기반 피드백 제공</li>
          <li><strong>고객지원:</strong> 문의, 민원, 분쟁 및 서비스 장애 대응</li>
          <li><strong>보안 및 서비스 개선:</strong> 접속기록 관리, 비정상 이용 탐지, 오류 분석, 서비스 안정성 및 품질 개선</li>
        </ul>
      </Section>

      <Section>
        <SectionTitle>2. 처리하는 개인정보의 항목 및 수집 방법</SectionTitle>
        <Paragraph><strong>회원가입·인증</strong></Paragraph>
        <ul>
          <li>휴대전화 가입: 휴대전화번호, 회원 식별자, 인증·로그인 기록</li>
          <li>이메일 가입: 이메일 주소, 회원 식별자, 인증·로그인 기록</li>
          <li>카카오 로그인: 카카오 회원번호, 이메일, 휴대전화번호, 닉네임, 프로필 이미지 중 이용자가 카카오에서 제공에 동의한 항목</li>
        </ul>
        <Paragraph><strong>프로필·커뮤니티</strong></Paragraph>
        <ul>
          <li>표시 이름, 프로필 이미지, 자기소개, 직장·업무 정보, 학교, 활동지역, 관심사, 프로필 공개 여부</li>
          <li>좋아요·차단 정보, 대화 및 메시지 내용, 피드백·설문 응답</li>
        </ul>
        <Paragraph><strong>멤버십·결제</strong></Paragraph>
        <ul>
          <li>회원 식별자, 주문번호, 실제 결제금액, 결제상태·수단·일시, 정기결제용 빌링키, 멤버십 시작·종료일, 결제·중단·취소·환불 내역, 할인·추천인 정보</li>
          <li>회사는 카드번호 전체 또는 카드 보안코드(CVC)를 직접 저장하지 않으며 카드 결제정보는 결제대행사를 통해 처리합니다.</li>
        </ul>
        <Paragraph><strong>밋업·영어 학습·말하기 분석</strong></Paragraph>
        <ul>
          <li>밋업 신청·참가 내역, 참가자 역할 등 운영에 필요한 정보</li>
          <li>저장 단어, 학습·복습 기록, 말하기 테스트 응답, 발화 전사문, 말하기 시간·발화량·속도·어휘 다양성 등 분석 지표, AI 평가·피드백</li>
        </ul>
        <Paragraph><strong>기타 신청 및 자동 생성 정보</strong></Paragraph>
        <ul>
          <li>특정 프로그램 신청 시 이메일, 국적, LinkedIn 주소, 신청·문의 내용 등 해당 화면에서 안내하는 정보</li>
          <li>서비스 이용 과정에서 IP 주소, 접속·로그인 일시, 브라우저·기기 정보, 세션·인증기록, 오류·보안 로그 등이 자동 생성될 수 있습니다.</li>
        </ul>
      </Section>

      <Section>
        <SectionTitle>3. 개인정보의 처리 및 보유기간</SectionTitle>
        <Paragraph>
          회사는 개인정보가 필요한 기간 동안만 보유하고, 처리 목적이 달성되면 지체
          없이 삭제·익명화합니다. 다만 관계 법령에 따라 보존할 의무가 있는 기록은
          해당 기간 동안 서비스 제공 목적과 분리하여 보관합니다.
        </Paragraph>
        <ul>
          <li>회원 기본정보·프로필·학습기록: 회원탈퇴 시까지</li>
          <li>회원과 연결된 메시지·좋아요·차단 등 커뮤니티 정보: 회원탈퇴 시 삭제 또는 회원과의 연결 제거</li>
          <li>회원과 연결된 말하기 전사문 및 분석 결과: 회원탈퇴 시까지. 다만 제8조에 따라 적법하게 가명처리된 연구용 데이터는 별도로 보관할 수 있습니다.</li>
          <li>표시·광고에 관한 기록: 6개월</li>
          <li>계약 또는 청약철회 등에 관한 기록: 5년</li>
          <li>대금결제 및 서비스 공급에 관한 기록: 5년</li>
          <li>소비자 불만 또는 분쟁처리에 관한 기록: 3년</li>
          <li>보안·부정이용 방지를 위한 접속기록: 목적 달성 시까지 또는 관계 법령상 필요한 기간</li>
        </ul>
      </Section>

      <Section>
        <SectionTitle>4. 개인정보의 제3자 제공</SectionTitle>
        <Paragraph>
          회사는 원칙적으로 이용자의 개인정보를 본 개인정보처리방침에서 정한 목적
          범위를 넘어 독립적인 제3자에게 제공하지 않습니다. 다만 이용자가 사전에
          동의한 경우, 법률에 특별한 규정이 있는 경우 또는 관계 법령상 허용되는
          경우에는 예외로 합니다.
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>5. 개인정보 처리업무의 위탁</SectionTitle>
        <Paragraph>회사는 서비스 제공을 위해 다음 업체에 개인정보 처리업무의 일부를 위탁합니다.</Paragraph>
        <ul>
          <li><strong>Supabase, Inc.</strong> — 회원 인증, 데이터베이스, 파일 저장, 백엔드 인프라</li>
          <li><strong>주식회사 페이플</strong> — 카드결제, 정기결제, 결제취소 및 환불 처리</li>
          <li><strong>엔에이치엔클라우드 주식회사(NHN Cloud)</strong> — 휴대전화 인증번호, 카카오 알림톡 및 SMS 발송</li>
          <li><strong>OpenAI OpCo, LLC</strong> — AI 기반 영어 말하기 분석 및 피드백 생성</li>
        </ul>
        <Paragraph>
          회사는 위탁업체를 선정할 때 개인정보 보호 역량을 고려하며, 관련 계약과
          관리·감독을 통해 개인정보가 안전하게 처리되도록 합니다.
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>6. 개인정보의 국외 이전</SectionTitle>
        <Paragraph><strong>Supabase, Inc.</strong></Paragraph>
        <ul>
          <li>이전 국가: 싱가포르</li>
          <li>이전 항목: Supabase 인프라에 저장·처리되는 회원, 인증, 프로필, 멤버십, 밋업, 커뮤니티, 학습 및 서비스 이용정보</li>
          <li>목적: 회원 인증, 데이터베이스·스토리지 및 백엔드 서비스 제공</li>
          <li>시점·방법: 서비스 이용 시 암호화된 통신망을 통해 전송·저장</li>
          <li>보유기간: 회원탈퇴 또는 처리 목적 달성 시까지. 법정 보존정보는 해당 보존기간까지</li>
        </ul>
        <Paragraph><strong>OpenAI OpCo, LLC</strong></Paragraph>
        <ul>
          <li>이전 국가: 미국 등 OpenAI의 서비스 처리 지역</li>
          <li>이전 항목: AI 말하기 분석 기능 이용 시 전사문과 분석에 필요한 말하기 정보</li>
          <li>목적: AI 기반 말하기 분석 및 피드백 생성</li>
          <li>시점·방법: 이용자가 해당 기능을 이용할 때 암호화된 통신망을 통해 전송</li>
          <li>보유기간: 회사와 OpenAI 간 API 계약 및 적용되는 데이터 보유정책에 따른 기간</li>
        </ul>
        <Paragraph>
          이용자는 AI 말하기 분석 기능을 사용하지 않음으로써 해당 기능과 관련한
          OpenAI로의 국외이전을 피할 수 있으며, 이 경우 해당 AI 분석·피드백 기능은
          이용할 수 없습니다.
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>7. 개인정보의 파기</SectionTitle>
        <ul>
          <li>전자적 파일은 복구 또는 재생이 어렵도록 삭제합니다.</li>
          <li>회원탈퇴 시 로그인 계정, 인증정보, 연락처, 프로필 등 직접 식별정보를 삭제하거나 복구하기 어려운 방법으로 익명화합니다.</li>
          <li>법령에 따라 보존해야 하는 거래기록은 해당 보존기간 동안 별도로 보관한 후 파기합니다.</li>
          <li>통계·연구 등으로 계속 활용할 정보는 제8조의 가명처리 절차와 보호조치를 적용합니다.</li>
        </ul>
      </Section>

      <Section>
        <SectionTitle>8. 가명정보의 처리</SectionTitle>
        <Paragraph>
          회사는 「개인정보 보호법」이 허용하는 범위에서 통계작성 및 영어 학습·말하기
          분석 기술에 관한 과학적 연구를 위하여 개인정보를 특정 개인을 알아볼 수
          없도록 가명처리하여 이용할 수 있습니다. 여기에는 AI 기반 말하기 분석의
          정확도·품질을 개선하기 위한 연구, 개발 및 검증이 포함될 수 있습니다.
        </Paragraph>
        <ul>
          <li><strong>처리 목적:</strong> 영어 학습·말하기 관련 통계, 분석 알고리즘 및 AI 평가 기술의 연구·개발·검증, 서비스 품질과 정확도 개선을 위한 과학적 연구</li>
          <li><strong>처리 항목:</strong> 가명처리된 발화 전사문, 말하기 시간·발화량·속도·어휘 다양성 등 지표, 평가 점수 및 분석 결과</li>
          <li><strong>보유기간:</strong> 해당 통계·연구·개발·검증 목적 달성 시까지. 회사는 보유 필요성을 주기적으로 검토합니다.</li>
          <li><strong>보호조치:</strong> 이름·이메일·휴대전화번호·소셜 계정 식별정보 등 직접 식별정보 제거 또는 대체, 추가정보의 분리 보관, 접근권한 제한, 재식별 금지</li>
        </ul>
        <Paragraph>
          회사는 가명정보를 특정 개인을 알아보기 위한 목적으로 처리하지 않으며,
          처리 과정에서 특정 개인을 알아볼 수 있는 정보가 생성된 경우 관계 법령에
          따라 처리를 중지하고 필요한 조치를 합니다.
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>9. 이용자의 권리와 행사 방법</SectionTitle>
        <Paragraph>
          이용자는 관계 법령이 정하는 범위에서 개인정보 열람, 정정·삭제, 처리정지,
          동의 철회 및 회원탈퇴를 요구할 수 있습니다. 서비스 내 계정·프로필 설정을
          이용하거나 아래 개인정보 보호 문의처로 연락하여 권리를 행사할 수 있습니다.
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>10. 개인정보의 안전성 확보조치</SectionTitle>
        <ul>
          <li>개인정보 접근권한 최소화 및 관리자 권한 통제</li>
          <li>암호화된 통신을 통한 개인정보 전송</li>
          <li>인증정보와 중요 비밀정보의 안전한 보관</li>
          <li>데이터베이스 접근제어, 권한관리 및 보안 로그 관리</li>
          <li>위탁업체의 개인정보 보호조치에 대한 관리·감독</li>
        </ul>
      </Section>

      <Section>
        <SectionTitle>11. 개인정보 보호책임자 및 문의처</SectionTitle>
        <ul>
          <li>개인정보 보호책임자: 김수겸</li>
          <li>사업자: 네이티브피티</li>
          <li>이메일: hello@nativept.kr</li>
          <li>서비스 문의: hello@1cupenglish.com</li>
          <li>전화: 010-6858-4123</li>
        </ul>
        <Paragraph>
          이용자는 개인정보 처리와 관련한 문의, 불만 및 피해구제에 대해 위 연락처로
          문의할 수 있으며, 필요한 경우 개인정보침해신고센터 또는
          개인정보분쟁조정위원회 등 관계기관을 통해 상담·분쟁조정을 신청할 수 있습니다.
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>12. 개인정보처리방침의 변경</SectionTitle>
        <Paragraph>
          회사는 법령, 서비스 또는 개인정보 처리방식의 변경에 따라 본 방침을 수정할
          수 있습니다. 중요한 변경은 서비스 내 공지 등 합리적인 방법으로 변경 내용과
          시행일을 안내합니다.
        </Paragraph>
        <Paragraph>공고일: {EFFECTIVE_DATE}<br />시행일: {EFFECTIVE_DATE}</Paragraph>
      </Section>
    </Content>
  );
}

function TermsOfService() {
  return (
    <Content>
      <Section>
        <SectionTitle>제1조 (목적)</SectionTitle>
        <Paragraph>
          본 약관은 네이티브피티(이하 “회사”)가 운영하는 영어 학습 및 커뮤니티
          서비스 “영어 한잔(1 Cup English)”(이하 “서비스”)의 이용과 관련하여 회사와
          이용자 간의 권리·의무, 책임사항 및 서비스 이용조건을 정하는 것을 목적으로 합니다.
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>제2조 (정의)</SectionTitle>
        <ol>
          <li>“서비스”란 영어 학습 콘텐츠, 밋업·커뮤니티, 회원 프로필·메시지, 영어 말하기 전사·분석·피드백 등 회사가 제공하는 관련 기능을 말합니다.</li>
          <li>“회원”이란 본 약관에 동의하고 회원가입을 완료하여 서비스를 이용하는 자를 말합니다.</li>
          <li>“멤버십”이란 회원이 이용요금을 결제하고 일정 기간 동안 회사가 정한 유료 서비스와 밋업 등에 접근할 수 있는 이용권을 말합니다.</li>
          <li>“멤버십 기간”은 별도 안내가 없는 한 각 결제 완료 시점부터 정확히 30일(720시간)입니다. 회사가 프로모션, 장애 보상 또는 밋업 취소 보상 등으로 기간을 추가한 경우 그 추가 기간도 포함됩니다.</li>
          <li>“밋업”이란 회사가 회원을 대상으로 운영하는 오프라인 또는 온라인 영어 토론·네트워킹·커뮤니티 프로그램을 말합니다.</li>
          <li>“콘텐츠”란 회사가 서비스 내에서 제공하는 글, 이미지, 음원, 영상, 학습자료, 질문, 전사문, 분석 결과 등을 말합니다.</li>
          <li>“자동결제”란 회원이 등록한 결제수단을 통해 멤버십을 반복적으로 갱신하는 결제방식을 말합니다.</li>
        </ol>
      </Section>

      <Section>
        <SectionTitle>제3조 (약관의 게시 및 변경)</SectionTitle>
        <ol>
          <li>회사는 본 약관을 회원이 쉽게 확인할 수 있도록 서비스 내에 게시합니다.</li>
          <li>회사는 관계 법령을 위반하지 않는 범위에서 약관을 변경할 수 있습니다.</li>
          <li>일반적인 변경은 적용일 7일 전부터 안내하며, 회원에게 불리하거나 중요한 변경은 원칙적으로 적용일 30일 전부터 서비스 내 공지, 이메일, 문자 또는 카카오 알림톡 등 합리적인 방법으로 안내합니다.</li>
          <li>관계 법령상 별도의 동의 또는 고지 절차가 필요한 경우 해당 절차를 따릅니다.</li>
        </ol>
      </Section>

      <Section>
        <SectionTitle>제4조 (회원가입 및 계정)</SectionTitle>
        <ol>
          <li>이용자는 회사가 제공하는 휴대전화·이메일 인증, 카카오 로그인 등의 방법으로 회원가입할 수 있습니다.</li>
          <li>회원은 정확한 정보를 제공해야 하며 타인의 정보를 도용하거나 허위 정보를 등록해서는 안 됩니다.</li>
          <li>회원은 자신의 계정과 인증수단을 안전하게 관리할 책임이 있습니다.</li>
          <li>타인 정보 도용, 서비스 운영 방해, 반복적인 약관 위반 등 합리적인 사유가 있는 경우 회사는 가입 또는 이용을 제한할 수 있습니다.</li>
        </ol>
      </Section>

      <Section>
        <SectionTitle>제5조 (서비스 및 멤버십의 제공)</SectionTitle>
        <ol>
          <li>회사는 결제 당시 안내된 범위의 유료 서비스를 멤버십 회원에게 제공합니다.</li>
          <li>밋업 이용 권한이 포함된 경우 회원은 멤버십 기간 동안 회사가 개설한 밋업에 신청할 수 있습니다.</li>
          <li>정원이 있는 밋업은 신청·예약 완료 순서 등 사전에 안내한 기준에 따라 참가가 제한될 수 있으며, 멤버십만으로 모든 밋업 좌석이 보장되지는 않습니다.</li>
          <li>밋업의 일정, 장소, 진행자, 주제 및 정원은 운영상 필요에 따라 변경될 수 있으며 중요한 변경은 가능한 범위에서 미리 안내합니다.</li>
          <li>회사의 사정으로 예정된 밋업이 취소되는 경우 원칙적으로 해당 회원의 멤버십 기간을 2주 연장합니다. 회사가 회원에게 더 유리한 대체 보상 또는 환불을 제공하는 경우에는 그에 따를 수 있습니다.</li>
          <li>천재지변, 정부 명령, 시설의 갑작스러운 이용 불가 등 회사가 합리적으로 통제하기 어려운 사유가 있는 경우 일정 변경, 기간 연장 또는 이에 상응하는 조치를 할 수 있습니다.</li>
        </ol>
      </Section>

      <Section>
        <SectionTitle>제6조 (밋업 및 커뮤니티 이용수칙)</SectionTitle>
        <Paragraph>회원은 다른 참가자의 안전과 권리를 존중해야 하며 다음 행위를 해서는 안 됩니다.</Paragraph>
        <ul>
          <li>폭언, 위협, 괴롭힘 또는 반복적인 원치 않는 접근</li>
          <li>성적 괴롭힘 또는 상대방이 명확히 거부한 사적 접촉</li>
          <li>다른 회원의 개인정보를 동의 없이 수집·공개하는 행위</li>
          <li>다른 참가자를 동의 없이 촬영·녹음하거나 그 내용을 외부에 공개하는 행위</li>
          <li>영업, 다단계, 종교 권유 등 반복적인 홍보·권유로 다른 참가자에게 현저한 불편을 주는 행위</li>
          <li>밋업 진행을 고의로 방해하거나 관계 법령·타인의 권리를 침해하는 행위</li>
        </ul>
        <Paragraph>
          회사는 위 행위가 확인되거나 긴급한 안전 문제가 있는 경우 밋업 참가 또는
          서비스 이용을 제한할 수 있습니다. 회원 개인 사정으로 특정 밋업에 참석하지
          못한 경우 그 불참만을 이유로 개별 환불이나 기간 연장을 제공하지 않습니다.
          다만 멤버십 전체의 해지·환불 권리는 제9조에 따릅니다.
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>제7조 (이용요금 및 결제)</SectionTitle>
        <ol>
          <li>멤버십 이용요금, 할인 및 결제주기는 결제 화면에 표시된 내용을 따릅니다.</li>
          <li>회사는 신용카드 등 서비스에서 제공하는 결제수단으로 결제를 받고, 결제업무의 일부를 전자지급결제대행업자에게 위탁할 수 있습니다.</li>
          <li>카드 매출전표 등 결제증빙은 해당 결제수단 또는 결제사업자를 통해 제공될 수 있으며, 현금영수증은 관계 법령과 해당 결제수단의 적용 대상인 경우 발급합니다.</li>
          <li>할인·추천인 코드·프로모션을 이용한 경우 실제 결제금액과 조건은 결제 시 표시된 내용을 따릅니다.</li>
        </ol>
      </Section>

      <Section>
        <SectionTitle>제8조 (자동결제 및 다음 결제 중단)</SectionTitle>
        <ol>
          <li>자동결제 멤버십은 회원이 다음 결제를 중단하지 않는 한 각 결제주기마다 갱신될 수 있습니다.</li>
          <li>성공적인 각 결제는 해당 결제 완료 시점부터 새로운 30일 멤버십 기간을 제공합니다.</li>
          <li>회사가 정기결제 금액을 인상하거나 무료 이용을 유료로 전환하는 경우 관계 법령이 요구하는 사전 고지·동의 절차를 따릅니다.</li>
          <li>회원은 서비스 내 제공되는 기능을 통해 다음 자동결제를 중단할 수 있습니다.</li>
          <li>다음 자동결제를 중단해도 이미 결제한 현재 멤버십은 예정된 종료 시점까지 이용할 수 있으며, 이는 현재 멤버십의 즉시 해지·환불과 구분됩니다.</li>
        </ol>
      </Section>

      <Section>
        <SectionTitle>제9조 (멤버십 해지, 청약철회 및 환불)</SectionTitle>
        <ol>
          <li>회원은 다음 자동결제만 중단하거나 현재 이용 중인 멤버십을 즉시 해지하고 환불을 요청할 수 있습니다.</li>
          <li><strong>전액 환불:</strong> 신규 결제와 반복 결제 모두 결제 완료 시점부터 7일(168시간) 이내에 즉시 해지하는 경우 실제 결제금액 전액을 환불합니다.</li>
          <li><strong>7일 이후 부분 환불:</strong> 전액 환불 기간이 지난 경우 경과 일수는 결제 완료 시점부터 경과한 시간을 24시간 단위로 올림하여 계산합니다. 환불액은 <strong>실제 결제금액 × max(30 - 경과 일수, 0) ÷ 30</strong>으로 계산하고 원 단위에서 반올림합니다.</li>
          <li>예를 들어 경과 일수가 20일인 경우 실제 결제금액의 10/30에 해당하는 금액을 환불합니다.</li>
          <li>회사 귀책으로 약정된 서비스를 제공하지 못했거나 관계 법령이 회원에게 더 유리한 청약철회·환불 권리를 인정하는 경우에는 관계 법령이 우선합니다.</li>
          <li>환불은 원칙적으로 회원이 이용한 결제수단을 통해 처리하며, 결제사업자·금융기관의 처리기간에 따라 실제 승인취소 또는 환급 반영 시점이 달라질 수 있습니다.</li>
        </ol>
      </Section>

      <Section>
        <SectionTitle>제10조 (회원탈퇴)</SectionTitle>
        <ol>
          <li>회원은 서비스 내 계정 삭제 기능 또는 회사가 안내하는 방법을 통해 회원탈퇴를 요청할 수 있습니다.</li>
          <li>자동결제가 활성화된 회원은 계정 삭제 전 다음 자동결제를 먼저 중단해야 할 수 있습니다. 현재 멤버십의 환불을 원하는 경우에는 계정 삭제 전에 멤버십 해지·환불 절차를 먼저 진행하는 것이 필요합니다.</li>
          <li>회원탈퇴와 자동결제 중단, 멤버십 해지·환불은 서로 다른 절차이며, 회원탈퇴 자체가 관계 법령상 인정되는 정당한 환불권을 소멸시키지는 않습니다.</li>
          <li>회원탈퇴 시 회사는 법령상 보존의무가 있는 거래기록 등을 제외한 계정 및 개인정보를 삭제·익명화하고, 통계·과학적 연구 목적으로 적법하게 가명처리한 정보는 개인정보처리방침에 따라 별도로 처리할 수 있습니다.</li>
        </ol>
      </Section>

      <Section>
        <SectionTitle>제11조 (서비스 이용 제한 및 계약 해지)</SectionTitle>
        <Paragraph>
          회원이 본 약관 또는 관계 법령을 중대하게 위반하거나 다른 회원의 권리·안전을
          침해하거나, 서비스 시스템을 고의로 악용·방해하거나, 결제수단을 부정하게
          이용한 경우 회사는 위반 정도에 비례하여 이용을 제한하거나 계약을 해지할 수
          있습니다. 긴급한 안전 문제를 제외하고 가능한 범위에서 사전에 또는 조치 후
          지체 없이 사유를 안내합니다. 유료 계약 종료에 따른 환불은 제9조와 관계
          법령에 따릅니다.
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>제12조 (콘텐츠 및 지식재산권)</SectionTitle>
        <ol>
          <li>회사가 제작하거나 적법하게 권리를 보유한 콘텐츠의 저작권 및 기타 지식재산권은 회사 또는 해당 권리자에게 있습니다.</li>
          <li>회원은 개인 학습 목적의 범위에서 콘텐츠를 이용할 수 있으며 회사의 사전 허락 없이 대량 복제·재배포·판매하거나 별도 상품·서비스에 이용해서는 안 됩니다.</li>
          <li>회원이 직접 작성하거나 업로드한 콘텐츠의 권리는 원칙적으로 해당 회원에게 있으며, 회사는 서비스 제공·운영에 필요한 범위에서만 이를 이용합니다.</li>
        </ol>
      </Section>

      <Section>
        <SectionTitle>제13조 (녹음, 전사 및 AI 분석)</SectionTitle>
        <ol>
          <li>회사가 말하기·밋업 관련 기능에서 음성 녹음, 전사 또는 AI 분석을 제공하는 경우 해당 기능과 처리 목적을 이용자가 알 수 있도록 안내합니다.</li>
          <li>영어 말하기 분석을 위해 발화 내용을 전사·분석하고 외부 AI 처리업체를 이용할 수 있으며 구체적인 개인정보 처리는 개인정보처리방침에 따릅니다.</li>
          <li>회사는 회원과 연결된 발화기록을 본래의 서비스 제공 목적과 무관한 광고 목적으로 이용하지 않습니다. 통계·과학적 연구를 위해 가명처리하는 경우에는 개인정보처리방침과 관계 법령을 따릅니다.</li>
        </ol>
      </Section>

      <Section>
        <SectionTitle>제14조 (서비스의 변경 및 중단)</SectionTitle>
        <ol>
          <li>회사는 서비스 개선, 시스템 점검, 운영상 필요 등을 위해 서비스의 일부를 변경할 수 있습니다.</li>
          <li>시스템 장애, 천재지변, 법령 또는 정부기관의 명령 등으로 서비스 제공이 일시 중단될 수 있습니다.</li>
          <li>회사의 책임 있는 사유로 유료 서비스를 상당 기간 이용할 수 없게 된 경우 이용기간 연장, 대체 서비스 또는 합리적인 환불 등의 조치를 제공합니다.</li>
          <li>본 약관은 회사의 고의 또는 중대한 과실이나 법령상 면제할 수 없는 책임을 제한하지 않습니다.</li>
        </ol>
      </Section>

      <Section>
        <SectionTitle>제15조 (개인정보 보호)</SectionTitle>
        <Paragraph>회사는 회원의 개인정보를 「개인정보 보호법」 등 관계 법령과 회사의 개인정보처리방침에 따라 처리합니다.</Paragraph>
      </Section>

      <Section>
        <SectionTitle>제16조 (회원에 대한 통지)</SectionTitle>
        <Paragraph>
          회사는 서비스 운영, 결제, 밋업 일정, 보안 및 계약과 관련한 정보를 서비스
          내 알림, 이메일, SMS, 카카오 알림톡 등 합리적인 방법으로 안내할 수 있습니다.
          다수 회원에게 공통되는 사항은 서비스 내 공지로 안내할 수 있습니다.
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>제17조 (책임의 범위)</SectionTitle>
        <Paragraph>
          회사는 천재지변이나 합리적으로 통제할 수 없는 사유로 서비스를 제공할 수
          없는 경우 그 범위에서 책임을 지지 않을 수 있습니다. 또한 회원 상호 간의
          자발적인 교류·네트워킹·개인적 관계의 결과를 보증하지 않습니다. 다만 회사의
          고의 또는 중대한 과실과 관계 법령상 면제할 수 없는 책임은 제한하지 않습니다.
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>제18조 (준거법 및 분쟁해결)</SectionTitle>
        <ol>
          <li>본 약관은 대한민국 법률에 따라 해석되고 적용됩니다.</li>
          <li>서비스 이용과 관련한 분쟁은 회사와 회원이 성실하게 협의하여 해결하도록 노력합니다.</li>
          <li>협의로 해결되지 않는 경우 관할법원은 「민사소송법」 등 관계 법령에서 정하는 바에 따릅니다.</li>
        </ol>
      </Section>

      <Divider />
      <Section>
        <SectionTitle>사업자 정보</SectionTitle>
        <ul>
          <li>상호: 네이티브피티</li>
          <li>서비스명: 영어 한잔(1 Cup English)</li>
          <li>대표자: 김수겸</li>
          <li>사업자등록번호: 549-04-02156</li>
          <li>통신판매업 신고번호: 제2022-서울종로-1744호</li>
          <li>주소: 서울특별시 성북구 안암로9가길 9-8, 303호</li>
          <li>이메일: hello@1cupenglish.com</li>
          <li>전화: 010-6858-4123</li>
        </ul>
        <Paragraph>공고일: {EFFECTIVE_DATE}<br />시행일: {EFFECTIVE_DATE}</Paragraph>
      </Section>
    </Content>
  );
}

function RefundPolicy() {
  return (
    <Content>
      <Section>
        <SectionTitle>멤버십 기간</SectionTitle>
        <Paragraph>
          성공적인 각 결제는 결제 완료 시점부터 정확히 30일(720시간)의 멤버십을
          제공합니다. 프로모션 또는 보상으로 별도 기간이 추가된 경우에는 그 기간도
          함께 적용됩니다.
        </Paragraph>
      </Section>
      <Section>
        <SectionTitle>전액 환불</SectionTitle>
        <Paragraph>
          신규 결제와 반복 결제 모두 결제 완료 시점부터 <strong>7일(168시간) 이내</strong>에
          현재 멤버십을 즉시 해지하는 경우 실제 결제금액 전액을 환불합니다.
        </Paragraph>
      </Section>
      <Section>
        <SectionTitle>7일 이후 부분 환불</SectionTitle>
        <Paragraph>
          전액 환불 기간이 지난 경우 경과 일수는 결제 완료 시점부터 경과한 시간을
          24시간 단위로 올림하여 계산합니다.
        </Paragraph>
        <Note>
          <strong>환불 금액 = 실제 결제금액 × max(30 - 경과 일수, 0) ÷ 30</strong>
        </Note>
        <Paragraph>
          예를 들어 경과 일수가 20일이면 실제 결제금액의 10/30을 환불합니다.
          계산 결과는 원 단위에서 반올림합니다.
        </Paragraph>
      </Section>
      <Section>
        <SectionTitle>자동결제 중단과 즉시 해지의 차이</SectionTitle>
        <ul>
          <li><strong>다음 자동결제 중단:</strong> 현재 멤버십은 예정된 종료 시점까지 유지되며 다음 결제만 진행되지 않습니다.</li>
          <li><strong>현재 멤버십 즉시 해지:</strong> 현재 이용권이 종료되고 위 기준에 따라 환불이 처리됩니다.</li>
        </ul>
      </Section>
      <Section>
        <SectionTitle>밋업 관련</SectionTitle>
        <Paragraph>
          회원 개인 사정으로 특정 밋업에 참석하지 못한 경우 그 불참만을 이유로
          별도 환불 또는 기간 연장을 제공하지 않습니다. 회사 사정으로 밋업이
          취소되는 경우에는 원칙적으로 해당 회원의 멤버십 기간을 2주 연장합니다.
          관계 법령이 회원에게 더 유리한 권리를 인정하는 경우에는 해당 법령이 우선합니다.
        </Paragraph>
      </Section>
      <Section>
        <SectionTitle>신청 방법 및 환급</SectionTitle>
        <Paragraph>
          멤버십 즉시 해지·환불과 다음 결제 중단은 서비스 내 계정 또는 프로필에서
          제공하는 기능을 통해 신청할 수 있습니다. 환불은 원칙적으로 기존 결제수단을
          통해 처리되며 실제 카드 승인취소·환급 반영 시점은 결제사업자 또는 금융기관의
          처리기간에 따라 달라질 수 있습니다.
        </Paragraph>
        <Paragraph>시행일: {EFFECTIVE_DATE}</Paragraph>
      </Section>
    </Content>
  );
}

export function PolicyClient() {
  const { type } = useParams() as { type: string };

  const policy =
    type === "terms"
      ? { title: "이용약관", content: <TermsOfService /> }
      : type === "refund"
        ? { title: "환불 및 멤버십 해지 정책", content: <RefundPolicy /> }
        : { title: "개인정보처리방침", content: <PrivacyPolicy /> };

  return (
    <PolicyContainer>
      <Title>{policy.title}</Title>
      <EffectiveDate>시행일 {EFFECTIVE_DATE}</EffectiveDate>
      {policy.content}
    </PolicyContainer>
  );
}
