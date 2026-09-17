import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-[960px] items-center justify-center px-4 py-16 max-[768px]:px-5">
      <section className="w-full max-w-[680px] rounded-[20px] border-2 border-[#050505] bg-white p-10 text-center shadow-[7px_7px_0_#f47a4a] max-[768px]:rounded-[16px] max-[768px]:p-7 max-[768px]:shadow-[5px_5px_0_#f47a4a]">
        <p className="m-0 text-[clamp(4.5rem,14vw,8rem)] font-black leading-none tracking-[-0.06em] text-[#f47a4a]">
          404
        </p>
        <h1 className="mt-5 mb-3 text-[clamp(1.7rem,5vw,2.5rem)] font-black tracking-[-0.03em] text-[#050505]">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="mx-auto mb-8 max-w-[520px] text-[1rem] leading-7 text-[rgba(5,5,5,0.65)]">
          주소가 변경되었거나 삭제된 페이지일 수 있습니다. 아래에서 원하는
          페이지로 이동해 주세요.
        </p>

        <nav
          className="flex flex-wrap items-center justify-center gap-3"
          aria-label="404 page navigation"
        >
          <Link
            href="/"
            className="rounded-full border-2 border-[#050505] bg-[#f47a4a] px-6 py-3 text-sm font-black text-[#050505] shadow-[3px_3px_0_#050505] transition-transform hover:-translate-y-0.5"
          >
            홈으로
          </Link>
          <Link
            href="/meetup"
            className="rounded-full border-2 border-[#050505] bg-white px-6 py-3 text-sm font-black text-[#050505] shadow-[3px_3px_0_#050505] transition-transform hover:-translate-y-0.5"
          >
            Meetup 보기
          </Link>
          <Link
            href="/blog"
            className="rounded-full border-2 border-[#050505] bg-white px-6 py-3 text-sm font-black text-[#050505] shadow-[3px_3px_0_#050505] transition-transform hover:-translate-y-0.5"
          >
            블로그 보기
          </Link>
        </nav>
      </section>
    </main>
  );
}
