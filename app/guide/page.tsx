"use client";

// Clean, minimal blog palette from BlogClient.tsx:
// text.dark #111111, text.medium #555555, text.light #8A8A8A,
// border #e5e7eb, shadow rgba(0,0,0,0.08)

// Shared class strings (styled-components migration).
const paragraphClass =
  "text-[1.05rem] leading-[1.8] text-[#555555] mb-6 whitespace-pre-wrap last:mb-0 [&_strong]:text-[#111111] [&_strong]:font-semibold";

const stepCardClass =
  "bg-[#f8f9fa] border border-[#e5e7eb] rounded-[12px] p-6 [transition:all_0.2s_ease] hover:[transform:translateY(-2px)] hover:border-[#d1d5db] hover:bg-white hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]";

const stepHeaderClass = "flex items-center gap-4 mb-3";

const stepNumberClass =
  "w-8 h-8 bg-[#1a1d22] text-white rounded-full flex items-center justify-center font-bold text-[0.9rem] shrink-0";

const stepTitleClass = "text-[1.15rem] font-semibold text-[#111111] m-0";

const stepContentClass =
  "text-[0.95rem] leading-[1.6] text-[#555555] m-0 pl-[calc(32px+1rem)] max-[768px]:pl-0 max-[768px]:mt-3";

const stepImageClass =
  "block w-full h-auto rounded-[8px] border border-[#e5e7eb] mt-4";

export default function GuidePage() {
  return (
    <div className="py-16 px-4 [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,sans-serif] bg-transparent min-h-screen max-w-[800px] mx-auto max-[768px]:py-8 max-[768px]:px-4">
      <header className="mb-12 text-center">
        <h1 className="text-[2.5rem] font-bold text-[#111111] mb-4 tracking-[-0.02em] max-[768px]:text-[2rem]">
          이용 가이드
        </h1>
        <p className="text-[1.1rem] text-[#555555] max-w-[600px] mx-auto leading-[1.6]">
          영어 한잔 밋업에 오신 것을 환영합니다
        </p>
      </header>

      <article className="bg-white border border-[#e5e7eb] rounded-[16px] p-12 mb-8 shadow-[0_4px_20px_rgba(0,0,0,0.08)] max-[768px]:p-6 max-[768px]:rounded-[12px]">
        <p className={paragraphClass}>
          안녕하세요. 영어 한잔 밋업을 운영하고 있는 카일입니다. 저희 밋업을 선택해주셔서 감사합니다.
        </p>
        <p className={paragraphClass}>
          저는 군 통역병으로 커리어를 시작해 IT 유니콘 기업과 대기업에서 통역사로 근무하며 수천 회의 비즈니스 미팅을 통역해왔습니다. 단순 계산만 해도 하루 2회, 연 300일, 5년 기준으로 약 3,000회 이상의 미팅 경험을 쌓았습니다. 이와 함께 주요 임원을 포함한 직장인들을 대상으로 비즈니스 영어 과외도 지속적으로 진행해왔습니다.
        </p>
        <p className={paragraphClass}>
          AI 시대가 오면서 모두가 영어를 배워야 하는 시대는 이미 지났다고 생각합니다. 하지만 중국이나 일본에 비해 내수시장이 작은 한국에서 세계 패권국의 언어를 자유롭게 구사하는 능력은 지금도, 앞으로도 분명한 경쟁력입니다. 저 역시 통역사로서의 커리어를 정리하고 엔지니어의 길을 걷고 있지만, 글로벌 커리어의 기회가 왔을 때 반드시 잡겠다는 마음으로 지금도 영어 실력을 꾸준히 갈고 있습니다.
        </p>
        <p className={paragraphClass}>
          이 밋업은 수익을 목적으로 만든 모임이 아닙니다. 저와 멤버 모두가 실제로 성장하기 위해 만든 공간입니다. 멤버십 비용은 참여에 대한 최소한의 책임감과 인센티브를 만들기 위한 장치일 뿐이며, 멤버십비가 타 모임에 비해 저렴한만큼 멤버 선정과 운영 기준은 엄격하게 유지하고 있습니다. 저희와 장기적으로 함께 성장하고 싶으시다면 아래 내용을 꼭 확인해주시기 바랍니다.
        </p>

        <div className="h-px bg-[#e5e7eb] my-8 w-full" />

        <div className="flex flex-col gap-6 my-10">
          <div className={stepCardClass}>
            <div className={stepHeaderClass}>
              <div className={stepNumberClass}>1</div>
              <h3 className={stepTitleClass}>밋업 신청</h3>
            </div>
            <div className={stepContentClass}>
              밋업 신청은 밋업 신청 페이지를 통해 가능합니다. 매주 안암과 광화문 등 주요 권역에서 주 1회 밋업을 진행하고 있으며, 멤버십이 유지되는 동안 참여 횟수 제한 없이 자유롭게 참석하실 수 있습니다.
              <img className={stepImageClass} src="/assets/guide/image1.png" alt="밋업 신청 화면" />
            </div>
          </div>

          <div className={stepCardClass}>
            <div className={stepHeaderClass}>
              <div className={stepNumberClass}>2</div>
              <h3 className={stepTitleClass}>밋업 상세 내용 확인</h3>
            </div>
            <div className={stepContentClass}>
              밋업에 대한 상세 정보는 모집 중인 밋업을 클릭하신 뒤 확인하실 수 있습니다. 여기에서 기사, 일정, 장소, 주의사항 등 밋업 참여에 필요한 모든 정보를 확인하실 수 있습니다.
              <img className={stepImageClass} src="/assets/guide/image2.png" alt="밋업 상세 내용 화면" />
            </div>
          </div>

          <div className={stepCardClass}>
            <div className={stepHeaderClass}>
              <div className={stepNumberClass}>3</div>
              <h3 className={stepTitleClass}>토픽 확인</h3>
            </div>
            <div className={stepContentClass}>
              밋업 페이지 상단의 토픽을 클릭하시면 해당 주차에 사용할 기사를 확인하실 수 있습니다. 주로 월스트리트저널과 파이낸셜타임스 기사를 활용하고 있으며, 토론에 집중할 수 있도록 구성되어 있습니다. 다만 저작권 문제로 인해 밋업에 직접 참여하시는 멤버 외에는 외부 공개를 허용하지 않고 있습니다. 기사 내용을 외부로 배포하거나 공유할 경우 즉시 강퇴 사유가 되니 반드시 유의해주시기 바랍니다.
              <img className={stepImageClass} src="/assets/guide/image3.png" alt="토픽 확인 화면" />
            </div>
          </div>
        </div>

        <p className={paragraphClass}>
          영어 한잔 밋업은 가볍게 영어를 경험해보는 모임이 아니라, 장기적으로 소프트 스킬을 갈고 쌓으며 서로가 성장하도록 장려하는 공간입니다. 이 방향성에 공감하신다면 밋업에서 뵙기를 고대하겠습니다.
        </p>
      </article>
    </div>
  );
}
