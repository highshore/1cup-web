import { ReactNode } from "react";
import LegalServiceSwitch, { LegalDocType } from "../../../components/LegalServiceSwitch";

// Frame for /daily/terms and /daily/privacy: the same 720px column as the landing page.
// The switch leads to the 영어 한잔 membership documents for the same type.
export default function DailyLegalPage({
  type,
  title,
  children,
}: {
  type: LegalDocType;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="daily-page bg-white px-4 pb-20 pt-12 text-[#050505] [word-break:keep-all] min-[900px]:pt-16">
      <div className="mx-auto w-full max-w-[720px]">
        <p className="text-[0.85rem] font-bold text-[#d95f2d]">영어 한잔 Daily</p>
        <h1 className="mt-2 text-[1.9rem] font-black leading-tight">{title}</h1>
        <LegalServiceSwitch type={type} current="daily" from="daily" className="mt-5" />
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
