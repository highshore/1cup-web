import { ReactNode } from "react";
import Link from "next/link";
import {
  DAILY_MONTHLY_PRICE_KRW,
  DAILY_PASSES,
  DAILY_TERMS_VERSION,
  formatKrw,
} from "../constants";

// The Daily terms and the Daily privacy notice. Shown on /daily/terms and /daily/privacy
// and inside the consent dialog, so the text a person agrees to is the text published.
// Daily is a separate service from the 1cup membership and has its own terms; the 1cup
// privacy policy (/policy/privacy) still covers everything not stated here.
//
// Any change here that affects people's rights needs DAILY_TERMS_VERSION bumped (and the
// matching TERMS_VERSION in supabase/functions/daily/index.ts), so consent is re-asked.

export const DAILY_BUSINESS = {
  name: "네이티브피티",
  service: "영어 한잔 Daily",
  ceo: "김수겸",
  registration: "549-04-02156",
  mailOrder: "제2022-서울종로-1744호",
  address: "서울특별시 성북구 안암로9가길 9-8, 303호",
  email: "hello@1cupenglish.com",
  phone: "010-6858-4123",
};

function Article({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h3 className="text-[1.02rem] font-extrabold text-[#050505]">{title}</h3>
      <div className="mt-2 space-y-2 text-[0.92rem] leading-[1.75] text-[#334155]">{children}</div>
    </section>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ol className="m-0 list-decimal space-y-1.5 pl-5">{children}</ol>;
}

const effectiveDate = DAILY_TERMS_VERSION.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1년 $2월 $3일");

export function DailyTermsDocument() {
  const monthly = formatKrw(DAILY_MONTHLY_PRICE_KRW);
  return (
    <div>
      <p className="mb-6 text-[0.85rem] font-semibold text-[#64748b]">시행일: {effectiveDate}</p>

      <Article title="제1조 (목적)">
        <p>
          이 약관은 {DAILY_BUSINESS.name}(이하 &ldquo;회사&rdquo;)가 제공하는 {DAILY_BUSINESS.service}(이하
          &ldquo;서비스&rdquo;)의 이용 조건과 절차, 회사와 이용자의 권리·의무를 정합니다. 서비스는
          영어 한잔 멤버십·밋업과 별개의 서비스이며, 이 약관에 정하지 않은 사항은 영어 한잔
          이용약관과 관계 법령에 따릅니다.
        </p>
      </Article>

      <Article title="제2조 (서비스 내용)">
        <List>
          <li>
            회사는 이용자가 고른 트랙(비즈니스 영어, 테크 영어)의 레슨을 평일(월~금)에 이용자가 정한
            시간에 카카오 알림톡으로 보내고, 토요일에는 그 주에 받은 표현의 복습을 보냅니다.
            일요일에는 보내지 않습니다.
          </li>
          <li>레슨은 오늘의 표현, 뜻과 쓰임, 예문, 발음, 대화 예시, 퀴즈로 구성되며, 메시지의 버튼으로 레슨 페이지를 열어 볼 수 있습니다.</li>
          <li>알림톡을 보낼 수 없는 경우(카카오톡 미사용, 카카오 장애 등) 같은 내용을 문자(LMS)로 보낼 수 있습니다.</li>
          <li>받는 시간은 오전 6시부터 오후 10시 사이에서 30분 단위로 고르며, 언제든 바꿀 수 있습니다.</li>
        </List>
      </Article>

      <Article title="제3조 (이용 신청)">
        <List>
          <li>이용자는 휴대폰 번호를 인증번호로 확인한 뒤 이 약관과 개인정보 수집·이용에 동의하고 신청합니다. 영어 한잔 회원 가입은 필요 없으며, 서비스의 이용 정보는 영어 한잔 회원 정보와 따로 관리합니다.</li>
          <li>레슨은 인증한 휴대폰 번호로 보냅니다. 이용자는 본인이 사용하는 번호로 신청해야 하며, 타인의 번호로 신청할 수 없습니다.</li>
        </List>
      </Article>

      <Article title="제4조 (무료 체험)">
        <List>
          <li>무료 체험은 트랙별로 휴대폰 번호당 1회 제공되며, 레슨 1회를 신청 즉시 보냅니다.</li>
          <li>무료 체험에는 결제수단 등록이 필요 없고, 체험이 끝나도 유료로 자동 전환되지 않습니다.</li>
          <li>체험 레슨을 보낸 뒤 다음 발송 시간(신청 후 12시간 이후 첫 발송 시간)에 체험 종료 안내를 1회 보내며, 이후에는 구독하지 않는 한 메시지를 보내지 않습니다.</li>
        </List>
      </Article>

      <Article title="제5조 (요금과 결제)">
        <List>
          <li>
            <strong>30일 정기구독:</strong> {monthly}원. 최초 결제일부터 30일마다 등록한 카드로 자동 결제되며,
            해지하기 전까지 갱신됩니다.
          </li>
          <li>
            <strong>이용권:</strong>{" "}
            {DAILY_PASSES.map((pass) => `${pass.label} ${formatKrw(pass.priceKrw)}원(${pass.days}일)`).join(", ")}.
            결제 시 1회만 결제되며 자동 결제되지 않습니다. 이용 기간은 결제 완료 시점부터 계산합니다.
          </li>
          <li>결제는 주식회사 페이플을 통해 처리되며, 모든 요금은 부가가치세를 포함합니다.</li>
          <li>회사가 요금을 바꾸는 경우 적용 30일 전에 서비스 화면과 알림으로 알립니다. 이미 결제한 기간에는 바뀐 요금을 적용하지 않으며, 정기구독자는 바뀐 요금이 적용되기 전에 해지할 수 있습니다.</li>
        </List>
      </Article>

      <Article title="제5조의2 (친구 초대 혜택)">
        <List>
          <li>이용자는 자신의 초대 링크로 다른 사람을 서비스에 초대할 수 있습니다.</li>
          <li>초대받은 사람이 처음으로 정기구독 또는 이용권을 결제하면, 초대한 사람과 초대받은 사람 모두 이용 기간 7일을 추가로 받습니다. 정기구독은 다음 결제일이 7일 늦춰지고, 이용권은 끝나는 날이 7일 늘어납니다. 초대한 사람이 그때 이용 중이 아니면, 다음에 결제할 때 적용됩니다.</li>
          <li>혜택은 초대받은 사람 1명(휴대폰 번호 1개)당 한 번만 적용됩니다. 자기 자신을 초대하거나 부정한 방법으로 받은 혜택은 회수할 수 있습니다.</li>
          <li>추가로 받은 기간은 현금으로 돌려받을 수 없고, 제7조의 환불 금액 계산에 포함하지 않습니다.</li>
        </List>
      </Article>

      <Article title="제6조 (해지)">
        <List>
          <li>정기구독은 내 구독 페이지 또는 고객센터를 통해 언제든 해지할 수 있습니다. 해지하면 다음 자동 결제가 이루어지지 않으며, 이미 결제한 기간이 끝날 때까지 레슨을 받을 수 있습니다.</li>
          <li>이와 별개로 이용자는 현재 이용 중인 기간을 즉시 종료하고 제7조에 따라 환불을 요청할 수 있습니다.</li>
        </List>
      </Article>

      <Article title="제7조 (청약철회와 환불)">
        <List>
          <li>
            <strong>전액 환불:</strong> 정기구독의 각 회차 결제와 이용권 모두 결제 완료 시점부터
            7일(168시간) 이내에 요청하면 실제 결제금액 전액을 환불합니다.
          </li>
          <li>
            <strong>7일 이후 환불:</strong> 경과 일수는 결제 완료 시점부터 지난 시간을 24시간 단위로
            올림하여 계산하며, 환불액은 <strong>실제 결제금액 × max(이용 기간 일수 − 경과 일수, 0) ÷ 이용 기간 일수</strong>로
            계산하고 원 단위에서 반올림합니다. 이용 기간 일수는 정기구독 30일, 1개월 이용권 30일,
            3개월 이용권 90일, 6개월 이용권 180일입니다.
          </li>
          <li>예를 들어 3개월 이용권({formatKrw(13500)}원)을 결제하고 30일이 지나 환불을 요청하면 {formatKrw(13500)}원 × 60 ÷ 90 = {formatKrw(9000)}원을 환불합니다.</li>
          <li>회사의 사정으로 서비스를 제공하지 못했거나, 관계 법령이 이용자에게 더 유리한 청약철회·환불 권리를 인정하는 경우에는 그에 따릅니다.</li>
          <li>환불은 결제한 수단의 승인 취소로 처리하며, 카드사·결제대행사 사정에 따라 반영까지 영업일 기준 3~7일이 걸릴 수 있습니다.</li>
          <li>환불 요청: {DAILY_BUSINESS.email} 또는 {DAILY_BUSINESS.phone}</li>
        </List>
      </Article>

      <Article title="제8조 (발송 지연과 장애)">
        <List>
          <li>카카오·통신사·결제대행사 등의 장애나 시스템 점검으로 발송이 늦어질 수 있습니다. 예정 시간보다 2시간 넘게 늦어진 레슨은 한밤중 발송을 막기 위해 메시지를 보내지 않고 다음 발송으로 넘어갑니다.</li>
          <li>회사의 사정으로 보내지 못한 레슨이 있는 경우, 회사는 그 일수만큼 이용 기간을 연장합니다.</li>
        </List>
      </Article>

      <Article title="제9조 (콘텐츠의 권리)">
        <p>레슨의 문장, 해설, 음성 등 콘텐츠의 권리는 회사에 있습니다. 이용자는 개인 학습 목적으로만 이용할 수 있으며, 회사의 동의 없이 복제·배포·판매하거나 다른 서비스에 사용할 수 없습니다.</p>
      </Article>

      <Article title="제9조의2 (함께 쓰는 문장)">
        <List>
          <li>이용자가 레슨 페이지에 남긴 문장은 같은 트랙의 다른 이용자에게 표시 이름(또는 익명)과 함께 보입니다. 표시 이름과 익명 여부는 이용자가 정합니다.</li>
          <li>회사는 잘 쓴 문장을 &ldquo;통역사 PICK&rdquo;으로 골라 다음 날 레슨 페이지와 서비스 소개 페이지에 소개할 수 있으며, 이때도 이용자가 정한 표시 이름(또는 익명)을 따릅니다.</li>
          <li>이용자는 자신이 남긴 문장을 언제든 지울 수 있습니다. 개인정보, 욕설, 광고 등 다른 이용자에게 해가 되는 문장은 회사가 숨기거나 지울 수 있습니다.</li>
        </List>
      </Article>

      <Article title="제9조의3 (후기)">
        <List>
          <li>레슨을 받은 이용자는 휴대폰 번호 인증 후 별점과 후기를 남길 수 있으며, 1명당 하나의 후기를 남길 수 있습니다.</li>
          <li>후기는 회사의 확인을 거친 뒤 서비스 소개 페이지에 별점, 내용, 이용자가 정한 이름(또는 익명), 트랙, 받은 레슨 수와 함께 게시될 수 있습니다. 회사는 후기 내용을 고치지 않으며, 대가를 주고 후기를 받지 않습니다.</li>
          <li>이용자는 게시된 후기를 {DAILY_BUSINESS.email}로 요청해 언제든 내릴 수 있습니다. 개인정보나 다른 사람에게 해가 되는 내용이 담긴 후기는 게시하지 않습니다.</li>
        </List>
      </Article>

      <Article title="제10조 (이용 제한)">
        <p>타인의 휴대폰 번호로 신청하거나, 무료 체험을 반복해서 받기 위해 부정한 방법을 쓰거나, 콘텐츠를 무단으로 배포하는 경우 회사는 사전 안내 후 서비스 이용을 제한할 수 있습니다.</p>
      </Article>

      <Article title="제11조 (개인정보)">
        <p>회사는 서비스 제공에 필요한 개인정보를 영어 한잔 Daily 개인정보 수집·이용 안내와 영어 한잔 개인정보 처리방침에 따라 처리합니다.</p>
      </Article>

      <Article title="제12조 (약관의 변경)">
        <p>회사는 관계 법령을 위반하지 않는 범위에서 이 약관을 바꿀 수 있으며, 적용일 7일 전(이용자에게 불리한 변경은 30일 전)부터 서비스 화면에 알립니다. 바뀐 약관에 동의하지 않는 이용자는 해지할 수 있습니다.</p>
      </Article>

      <Article title="제13조 (분쟁 해결)">
        <p>이 약관은 대한민국 법에 따르며, 서비스 이용과 관련한 분쟁은 민사소송법에 따른 관할 법원에서 해결합니다. 이용자는 한국소비자원 등 분쟁조정기관에 조정을 신청할 수 있습니다.</p>
      </Article>

      <BusinessInfo />
    </div>
  );
}

export function DailyPrivacyDocument() {
  return (
    <div>
      <p className="mb-6 text-[0.85rem] font-semibold text-[#64748b]">시행일: {effectiveDate}</p>

      <Article title="1. 수집하는 항목">
        <p>휴대폰 번호(인증번호 또는 카카오 로그인으로 확인), 이름(선택), 선택한 트랙과 받는 시간, 동의 일시, 메시지 발송 기록, 로그인 기록, 함께 쓰는 문장에 남긴 문장과 표시 이름(선택), 1분 퀴즈 응답, 다른 문장에 보낸 ☕ 반응, 후기(별점·내용·표시 이름), 친구 초대 기록, 결제 시 결제 내역(카드번호는 회사가 보관하지 않음). 영어 한잔 Daily는 영어 한잔 회원 정보를 사용하지 않으며, 이 정보도 영어 한잔 회원 정보와 따로 보관합니다.</p>
        <p>카카오로 시작하면 주식회사 카카오로부터 카카오계정의 휴대폰 번호와 닉네임을 받습니다. 휴대폰 번호는 위와 같이 본인 확인과 레슨 발송에, 닉네임은 이름을 비워 둔 경우 카카오톡에서 부를 이름으로만 씁니다. 카카오계정의 다른 정보는 받지 않습니다.</p>
      </Article>

      <Article title="2. 이용 목적">
        <p>본인 확인과 로그인, 레슨·복습·체험 종료 안내 메시지 발송, 무료 체험 중복 확인, 함께 쓰는 문장의 공개와 통역사 PICK 소개, 후기 게시, 친구 초대 혜택 지급, 구독·이용권 및 결제 관리, 환불과 문의 응대</p>
      </Article>

      <Article title="3. 보유 기간">
        <List>
          <li>인증번호 기록: 1일. 로그인 기록: 로그인이 끝난 뒤 30일.</li>
          <li>구독 정보와 발송 기록: 체험 또는 구독이 끝난 날부터 1년.</li>
          <li>휴대폰 번호와 이름: 구독이 모두 끝나고 마지막 로그인 후 1년.</li>
          <li>무료 체험 이력(휴대폰 번호와 트랙): 중복 체험 방지를 위해 체험 신청일부터 1년.</li>
          <li>함께 쓰는 문장: 직접 지울 때까지. 구독 정보가 삭제될 때 함께 삭제합니다.</li>
          <li>1분 퀴즈 응답: 구독 정보가 삭제될 때 함께 삭제합니다. ☕ 반응과 친구 초대 기록: 계정을 삭제할 때까지.</li>
          <li>후기: 내려달라고 요청할 때까지. 휴대폰 번호와 이름이 삭제될 때 함께 삭제합니다.</li>
          <li>결제·환불 기록: 전자상거래 등에서의 소비자보호에 관한 법률에 따라 5년.</li>
          <li>내 계정에서 직접 계정을 삭제할 수 있습니다. 삭제하면 구독 정보와 발송 기록, 후기, 로그인 기록, 휴대폰 번호와 이름을 바로 삭제하고, 결제·환불 기록은 휴대폰 번호와 이름 없이 위 기간 동안 보관하며, 무료 체험 이력은 위 기간 동안 보관합니다.</li>
          <li>삭제를 원하면 {DAILY_BUSINESS.email}로도 요청할 수 있으며, 법령상 보관 의무가 없는 정보는 지체 없이 삭제합니다.</li>
        </List>
      </Article>

      <Article title="4. 처리 위탁과 국외 이전">
        <List>
          <li>엔에이치엔클라우드 주식회사(NHN Cloud): 인증번호, 카카오 알림톡과 문자 발송</li>
          <li>주식회사 페이플: 카드 결제와 환불 처리</li>
          <li>Supabase, Inc.: 데이터 저장과 서버 운영. 정보는 싱가포르에 있는 서버에 저장됩니다(국외 이전). 자세한 내용은 영어 한잔 개인정보 처리방침에 있습니다.</li>
        </List>
      </Article>

      <Article title="5. 동의를 거부할 권리">
        <p>개인정보 수집·이용에 동의하지 않을 수 있습니다. 다만 위 정보는 레슨을 보내는 데 꼭 필요하므로, 동의하지 않으면 영어 한잔 Daily를 이용할 수 없습니다.</p>
      </Article>

      <p className="mt-8 text-[0.85rem] leading-[1.7] text-[#64748b]">
        이 안내에 없는 사항은{" "}
        <Link href="/policy/privacy" className="underline underline-offset-2">
          영어 한잔 개인정보 처리방침
        </Link>
        을 따릅니다.
      </p>
    </div>
  );
}

function BusinessInfo() {
  return (
    <div className="mt-10 rounded-[16px] bg-[#f5f5f4] px-5 py-4 text-[0.82rem] leading-[1.7] text-[#475569]">
      <p className="font-bold text-[#050505]">
        {DAILY_BUSINESS.name} · {DAILY_BUSINESS.service}
      </p>
      <p>
        대표자 {DAILY_BUSINESS.ceo} · 사업자등록번호 {DAILY_BUSINESS.registration} · 통신판매업 신고번호 {DAILY_BUSINESS.mailOrder}
      </p>
      <p>{DAILY_BUSINESS.address}</p>
      <p>
        {DAILY_BUSINESS.email} · {DAILY_BUSINESS.phone}
      </p>
    </div>
  );
}
