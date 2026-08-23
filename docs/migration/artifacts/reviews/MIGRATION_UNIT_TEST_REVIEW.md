# 단위테스트 review — main vs feat/supabase (2026-08-02)

Method: **code + live-DB review** (RLS map, `is_admin`/`current_uid`, 6 deployed edge
functions, data-consistency checks, this session's fixes) **+ real browser runs** of the
anon/render subset on the preview (`feat/supabase`) and prod (`main`).

Legend (feat/supabase): ✅ PASS · ⚠️ RISK/known-gap · ⛔ intentionally OFF (payment parked)
· 🔧 wired-correctly, needs runtime confirm (login/admin/sandbox/realtime/upload).
`main` = Firebase production baseline (assumed working); **N/A** = TC references a
Supabase-only mechanism that doesn't exist on main.

Browser-confirmed this session (preview): home, /meetup, /blog, /leaderboard (real names),
public profile+stats, avatars, and **no Firestore calls** (DATA_004). Prod confirmed using
Firestore (the Firebase baseline).

| TC | feat/supabase | main | Note |
|----|:---:|:---:|------|
| AUTH_001 /auth 화면 | ✅ | ✅ | both buttons present (browser) |
| AUTH_002 카카오 이동 | 🔧 | ✅ | `signInWithOAuth(kakao)` wired; provider=app 1243919 |
| AUTH_003 카카오 세션 | 🔧 | ✅ | needs a real Kakao login |
| AUTH_004 신규→트리거 생성 | ✅🔧 | N/A | `handle_new_user` exists; confirm on 1st login |
| AUTH_005 기존 연동/중복방지 | ✅🔧 | N/A | **trigger fixed this session** (provider_id + link-on-match); confirm |
| AUTH_006 redirect 복귀 | ✅ | ✅ | code handles returnUrl |
| AUTH_007 잘못된 번호 | ✅ | ✅ | client validation |
| AUTH_008 SMS 전송 | ⚠️ | ✅ | AlimTalk template `signin_otp` **pending approval**; works via OTP_DEV_ECHO |
| AUTH_009 코드→로그인 | ✅ | ✅ | **phone login tested working** |
| AUTH_010 로그아웃 | ✅ | ✅ | |
| AUTH_011 세션 유지 | ✅ | ✅ | browser: logged-in across pages |
| AUTH_012 /kakao_callback→/auth | 🔧 | N/A | route retired; confirm it redirects (not 404) |
| PROF_001 기본 정보 | ✅ | ✅ | |
| PROF_002 이름 저장 | ✅ | ✅ | own-row update |
| PROF_003 상세 저장 | ✅ | ✅ | |
| PROF_004 아바타 업로드 | 🔧 | ✅ | Supabase `assets` bucket; confirm write |
| PROF_005 아바타 삭제 | 🔧 | ✅ | |
| PROF_006 추천 코드 생성 | 🔧 | ✅ | `payment(generate-referral)` edge fn deployed |
| PROF_007 구독 상태 | ✅ | ✅ | |
| PROF_008 공개 프로필 | ✅ | ✅ | **browser confirmed** (Kyle) |
| PROF_009 통계 | ✅ | ✅ | **browser confirmed** (69/6.8/4) |
| PROF_010 이름 프롬프트 | 🔧 | ✅ | |
| HOME_001 렌더 | ✅ | ✅ | browser both branches |
| HOME_002 통계 카운트 | ✅🔧 | ✅ | `home_stats` view exists; confirm numbers |
| HOME_003 추천 아티클 | ✅🔧 | ✅ | (FEATURED_ARTICLE_IDS 6-vs-7 mismatch — cosmetic) |
| HOME_004 네비게이션 | ✅ | ✅ | browser |
| MEET_001 목록 | ✅ | ✅ | browser |
| MEET_002 상세 | ✅ | ✅ | roster names/avatars fixed |
| MEET_003 참여 insert | 🔧 | ✅ | join-self RLS ok |
| MEET_004 참여 취소 | 🔧 | ✅ | leave-self RLS ok |
| MEET_005 정원 제한 | 🔧 | ✅ | client capacity check |
| MEET_006 역할 표시 | ✅ | ✅ | |
| MEET_007 실시간 동기화 | 🔧 | ✅ | Realtime — needs 2 clients |
| MEET_008 관리자 생성 | 🔧 | ✅ | RLS admin-write ok |
| MEET_009 관리자 수정 | 🔧 | ✅ | |
| MEET_010 좌석 배치 | 🔧 | ✅ | jsonb write |
| MEET_011 리마인더 | 🔧 | ✅ | `messaging(meetup-reminder)` deployed |
| MEET_012 리더보드 | ✅ | ✅ | **browser confirmed** (real names + celebrations) |
| ART_001 렌더(jsonb) | ✅🔧 | ✅ | audit clean |
| ART_002 단어 의미 | ✅ | ✅ | `article_meanings` write allowed (⚠️ over-permissive) |
| ART_003 단어 저장 | ✅ | ✅ | own-row saved_words |
| ART_004 저장 해제 | ✅ | ✅ | |
| ART_005 오디오 | 🔧 | ✅ | audio on Firebase Storage (by design) |
| ART_006 키워드 | ✅ | ✅ | |
| ART_007 관리자 수정 | 🔧 | ✅ | RLS admin-write |
| TRAN_001 렌더 | 🔧 | ✅ | transcripts RLS = creator/admin/participant (verified) |
| TRAN_002 실시간 | 🔧 | ✅ | Realtime |
| TRAN_003 화자 매핑 | 🔧 | ✅ | |
| TRAN_004 리포트 생성 | 🔧 | ✅ | `speaking-reports` edge fn deployed |
| TRAN_005 저장 | 🔧 | ✅ | |
| REPT_001 사용자 집계 | 🔧 | ✅ | own-row |
| REPT_002 세션 상세 | 🔧 | ✅ | |
| REPT_003 이벤트 뷰 | 🔧 | ✅ | `meetup_report(_users)` views exist |
| REPT_004 참여자 이름 | 🔧 | ✅ | `messaging(user-names)` service-role deployed |
| PAY_001 결제창 | ⛔ | ✅ | **payment feature disabled (PAYMENT_ENABLED off)** for cutover |
| PAY_002 결제 진행 | ⛔ | ✅ | parked |
| PAY_003 검증 | ⛔ | ✅ | parked |
| PAY_004 추천코드 할인 | ⛔ | ✅ | parked |
| PAY_005 결과 페이지 | ⛔ | ✅ | /payment shows maintenance notice |
| PAY_006 구독 취소 | ⛔ | ✅ | parked |
| PAY_007 다음결제 중지 | ⛔ | ✅ | parked |
| PAY_008 중복 방지 | ⛔ | ✅ | parked |
| PAY_009 정기결제 크론 off | ⚠️ | ✅ | Supabase recurring cron not set up; Firebase cron still runs — verify at cutover |
| BLOG_001 목록 | ✅ | ✅ | browser (⚠️ excerpt shows raw `\n` — cosmetic) |
| BLOG_002 상세 | ✅🔧 | ✅ | published-read ok |
| BLOG_003 좋아요 | ✅🔧 | ✅ | `blog_post_likes` like-self policy exists (live) |
| BLOG_004 좋아요 취소 | ✅🔧 | ✅ | |
| BLOG_005 관리자 작성 | 🔧 | ✅ | RLS admin-write; slug dedup handled |
| BLOG_006 수정/삭제 | 🔧 | ✅ | |
| BLOG_007 이미지 업로드 | 🔧 | ✅ | Supabase `assets` bucket |
| CELE_001 목록 | ✅ | ✅ | **browser confirmed** |
| CELE_002 관리자 생성 | 🔧 | ✅ | RLS admin-write |
| CELE_003 순서 변경 | 🔧 | ✅ | |
| FDBK_001 설문 제출 | ✅🔧 | ✅ | **fixed this session** (server route `/api/feedback`) |
| FDBK_002 취소 사유 제출 | 🔧 | ✅ | |
| FDBK_003 필수값 검증 | ✅ | ✅ | client validation |
| CEFR_001 배치 시작 | 🔧 | ✅ | `cefr(start)` deployed (admin) |
| CEFR_002 진행 실시간 | ⚠️ | ✅ | `cefr_runs` has **no RLS policy → deny-all** for browser; verify admin read |
| CEFR_003 결과 | ✅ | ✅ | `cefr` public-read |
| SHAD_001 로드 | ✅🔧 | ✅ | shadow public-read |
| SHAD_002 재생 | 🔧 | ✅ | |
| ADMN_001 접근제어 | ✅🔧 | ✅ | gating + is_admin (verified correct) |
| ADMN_002 사용자 조회 | 🔧 | ✅ | is_admin RLS ✅ |
| ADMN_003 피드백 조회 | ✅🔧 | ✅ | **fixed** (kind filter — surveys excluded) |
| ADMN_004 아티클 관리 | 🔧 | ✅ | RLS admin |
| ADMN_005 GDG 조회 | 🔧 | ✅ | |
| ADMN_006 회원 연장 | 🔧 | ✅ | is_admin update ✅ |
| GRWTH_001 포스트 | 🔧 | ✅ | admin RLS; ⚠️ split-brain w/ Python agent (Firestore) |
| GRWTH_002 config | 🔧 | ✅ | ⚠️ split-brain — toggles don't reach the agent |
| DATA_001 RLS 본인한정 | ✅ | ✅ | payment_orders/users own-row (verified) |
| DATA_002 공개 조회 | ✅ | ✅ | browser: anon reads work |
| DATA_003 영속성 | ✅ | ✅ | verified via load + writes |
| DATA_004 Firebase 제거 | ✅ | N/A | browser: **preview no Firestore**; prod uses Firestore. (Firebase Storage for images = intentional) |
| STAT_001 정적 페이지 | 🔧 | ✅ | guide/policy/library |
| STAT_002 다국어 | 🔧 | ✅ | |

## Tallies (feat/supabase)
- ✅ Pass (incl. browser-confirmed): ~24
- 🔧 Wired-correctly, needs runtime confirm: ~52 (admin/login/sandbox/realtime/upload)
- ⚠️ Risk/known-gap: AUTH_008 (AlimTalk template), PAY_009 (recurring cron), CEFR_002 (`cefr_runs` deny-all), GRWTH_001/002 (split-brain), + cosmetics
- ⛔ Intentionally off: PAY_001–008 (payment parked for cutover)

## Real issues surfaced (beyond runtime-confirm)
1. **AUTH_008** — real AlimTalk delivery blocked until Kakao approves `signin_otp` (dev-echo bridges testing).
2. **CEFR_002** — `cefr_runs` has RLS enabled but **no policy** → browser can't read batch progress; needs an admin/read policy.
3. **PAY_009** — no Supabase recurring-billing cron yet; the Firebase one still runs (must be disabled at cutover).
4. **GRWTH_001/002** — growth split-brain (app=Supabase, agent=Firestore).
5. Cosmetic: blog excerpt raw `\n`; FEATURED_ARTICLE_IDS 6-vs-7.
