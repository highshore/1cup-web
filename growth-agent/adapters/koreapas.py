"""Koreapas (코리아패스) free-ad board adapter.

Refactored from the original daily Selenium script: credentials come from the
environment (never hardcoded), the proven copy is templated, and only the
LLM-authored hook varies at the top. The main CTA + image link use the tracked
URL so signups can be attributed to the post.
"""

import os
import time

import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains

LOGIN_URL = "https://www.koreapas.com/m/fast_menu_index.php"
BOARD_URL = "https://www.koreapas.com/bbs/zboard.php?id=freead"
WRITE_URL = "https://www.koreapas.com/bbs/write.php?id=freead&category="

# Fixed, proven structural copy. The LLM hook is inserted above this; nothing
# here is model-generated, so price/schedule/links can't drift. {tracked} is the
# attribution link.
FOOTER_TEMPLATE = """
<br><br>
🎯 모집 대상
- 토익 900 / 오픽 AL / 토플 105 / 영미권 거주 1년 이상에 준하는 실력 선호
- 위보다 조금 부족해도, 열심히 할 의지가 있으신지 여부를 더 중요하게 봄
- 스몰토크만 반복하는 것을 넘어, 지적인 주제로 토의하고 싶은 분
- 유학, 이민, 글로벌 커리어가 목표이신 분
- 국제 정세 / 경제 / IT / 의학 토픽에 관심 많은 분

🤔 진행 방식
- 경력 통역사가 직접 스터디 리딩 (리딩을 도와주시는 다른 분들도 계심)
- 아티클 2개로 2시간 집중 토론 (아티클 당 1시간)
- 아티클 및 질문 목록은 웹사이트로 전달 (WSJ, FT 적극 이용 중)
- 스피킹 시간을 보장하기 위해 테이블 인원은 5인 이하로 유지
- 웹사이트에서 결제 및 신청

☕️ 시간 및 장소
- 매주 일요일 오전 11시 15분, 2시간 진행
- 카페 안암동 (https://naver.me/FbONl0Hl), 상황에 따라 변동 가능

💳 참가 비용
- '영어 한잔' 웹사이트에서 결제 및 밋업 신청 필수 (저렴한 월 구독, 7일 내 전체 환불 가능)
- 결제는 수익이 아니라, 멤버의 책임감 있는 참여와 모임 퀄리티를 보장하기 위한 장치입니다.

📌 유의사항
- 지각·노쇼 ❌ => 무관용 정책 적용 중
- 아티클 미리 읽기 필수!
- 모임 장소에서 음료는 각자 시키셔야 합니다

🔥 궁금한 점은 아래 카톡으로 연락주세요 (모임장과 일대일 오픈챗)
https://open.kakao.com/o/s8f84nvh

✅ 신청/결제: <a href="{tracked}">{tracked}</a>
"""


class KoreapasAdapter:
    channel = "koreapas"

    def build_body(self, subject: str, hook_html: str, tracked_url: str) -> str:
        image = (
            f'<a href="{tracked_url}">'
            '<img src="https://i.ibb.co/7JmSmDc2/meetup.jpg" alt="meetup" width="500"></a>'
        )
        footer = FOOTER_TEMPLATE.replace("{tracked}", tracked_url)
        return f"{image}<br><br>{hook_html}{footer}"

    def already_posted(self, subject: str) -> bool:
        """Avoid an exact-duplicate subject already on the board."""
        try:
            resp = requests.get(BOARD_URL, timeout=15)
            if resp.status_code != 200:
                return False
            soup = BeautifulSoup(resp.content, "html.parser")
            titles = [t.get_text() for t in soup.find_all("span", class_="list_title")]
            return any(subject.strip() and subject.strip() in t for t in titles)
        except Exception:
            return False

    def _chrome(self):
        opts = webdriver.ChromeOptions()
        opts.add_argument("--headless=new")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument("--window-size=1280,1696")
        binary = os.environ.get("CHROME_BIN")
        if binary:
            opts.binary_location = binary
        driver_path = os.environ.get("CHROMEDRIVER", "/usr/bin/chromedriver")
        service = Service(executable_path=driver_path) if os.path.exists(driver_path) else None
        return webdriver.Chrome(options=opts, service=service)

    def post(self, subject: str, body: str) -> str:
        user_id = os.environ["KOREAPAS_USER_ID"]
        password = os.environ["KOREAPAS_PASSWORD"]
        browser = self._chrome()
        try:
            def send(text):
                ActionChains(browser).send_keys(text).perform()
                time.sleep(0.5)

            browser.get(LOGIN_URL)
            time.sleep(1)
            browser.find_element(By.NAME, "user_id").click()
            send(user_id)
            browser.find_element(By.NAME, "password").click()
            send(password)
            browser.find_element(By.CSS_SELECTOR, 'input.input[type="submit"]').click()
            time.sleep(2)

            browser.get(WRITE_URL)
            time.sleep(3)
            browser.find_element(By.NAME, "subject").click()
            send(subject)
            browser.find_element(By.NAME, "use_html").click()
            time.sleep(0.5)
            browser.find_element(By.NAME, "memo").click()
            send(body)
            browser.find_element(By.NAME, "agreement").click()
            time.sleep(0.5)
            browser.find_element(By.ID, "submm").click()
            time.sleep(2)

            return BOARD_URL
        finally:
            time.sleep(2)
            browser.quit()
