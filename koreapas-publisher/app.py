"""Private Chromium publisher for the Supabase marketing Edge Function.

This service deliberately has no database access. Supabase sends an already
validated post and retains the run/post audit record; this process only logs in
to Koreapas and verifies that the submitted title appears on the Free Ads page.
"""

import hmac
import os
import time
from typing import Any
from urllib.parse import parse_qs, urljoin, urlparse

from bs4 import BeautifulSoup
from flask import Flask, jsonify, request
import requests
from selenium import webdriver
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

app = Flask(__name__)

LOGIN_URL = "https://www.koreapas.com/m/fast_menu_index.php"
BOARD_URL = "https://www.koreapas.com/bbs/zboard.php?id=freead"
WRITE_URL = "https://www.koreapas.com/bbs/write.php?id=freead&category="
WAIT_SECONDS = 20


def authorized() -> bool:
    expected = os.environ.get("PUBLISHER_TOKEN", "")
    supplied = request.headers.get("Authorization", "")
    return bool(expected) and hmac.compare_digest(supplied, f"Bearer {expected}")


def required_text(payload: dict[str, Any], key: str, limit: int) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} is required")
    if len(value) > limit:
        raise ValueError(f"{key} is too long")
    return value


def core_title(title: str) -> str:
    """Match the Edge Function's D-day-insensitive duplicate check."""
    stripped = title.strip()
    if stripped.startswith("[D-") and "]" in stripped:
        return stripped.split("]", 1)[1].strip()
    return stripped


def browser() -> webdriver.Chrome:
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1280,1696")
    options.add_argument("--disable-gpu")
    options.add_argument("--lang=ko-KR")
    options.binary_location = os.environ.get("CHROME_BIN", "/usr/bin/chromium")
    driver_path = os.environ.get("CHROMEDRIVER", "/usr/bin/chromedriver")
    service = Service(driver_path) if os.path.exists(driver_path) else None
    return webdriver.Chrome(options=options, service=service)


def present(driver: webdriver.Chrome, locator: tuple[str, str], label: str):
    try:
        return WebDriverWait(driver, WAIT_SECONDS).until(EC.presence_of_element_located(locator))
    except TimeoutException as error:
        raise RuntimeError(
            f"{label} was not available at {driver.current_url} (page title: {driver.title!r})"
        ) from error


def fill(driver: webdriver.Chrome, locator: tuple[str, str], label: str, value: str) -> None:
    field = present(driver, locator, label)
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", field)
    if any(ord(character) > 0xFFFF for character in value):
        # ChromeDriver's send_keys rejects surrogate-pair characters (for
        # example the 🇺🇸 flag in the default title). Set the native control
        # value inside Chromium instead, then emit the same events a typed
        # value produces. Korean itself remains ordinary Unicode text here.
        driver.execute_script(
            """
            const field = arguments[0];
            const value = arguments[1];
            const prototype = field.tagName === 'TEXTAREA'
              ? HTMLTextAreaElement.prototype
              : HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, value);
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            """,
            field,
            value,
        )
        return
    field.clear()
    field.send_keys(value)


def check(driver: webdriver.Chrome, locator: tuple[str, str], label: str) -> None:
    field = present(driver, locator, label)
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", field)
    if not field.is_selected():
        field.click()


def published_post_url(driver: webdriver.Chrome, title: str) -> str:
    target = core_title(title)
    if not target:
        return ""
    driver.get(BOARD_URL)
    WebDriverWait(driver, WAIT_SECONDS).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    for title_element in driver.find_elements(By.CSS_SELECTOR, "span.list_title"):
        if target not in title_element.text:
            continue
        href = title_element.find_element(By.XPATH, "..").get_attribute("href")
        if href:
            return urljoin(BOARD_URL, href)
    return ""


def publish(title: str, content: str) -> str:
    user_id = os.environ.get("KOREAPAS_USER_ID", "")
    password = os.environ.get("KOREAPAS_PASSWORD", "")
    if not user_id or not password:
        raise RuntimeError("Koreapas credentials are not configured")

    driver = browser()
    try:
        driver.get(LOGIN_URL)
        fill(driver, (By.NAME, "user_id"), "Koreapas user ID field", user_id)
        fill(driver, (By.NAME, "password"), "Koreapas password field", password)
        driver.find_element(By.CSS_SELECTOR, 'input.input[type="submit"]').click()
        # Do not navigate away while the login form is still submitting; doing
        # so can cancel the response before Chrome persists the session cookie.
        time.sleep(2)
        app.logger.info("Koreapas login submitted; current URL=%s", driver.current_url)

        # A successful browser login must expose the post form, rather than merely
        # returning an HTTP success page as the Edge Function experiment did.
        driver.get(WRITE_URL)
        app.logger.info("Koreapas write page loaded; current URL=%s", driver.current_url)
        # The modern write page keeps these legacy field names but overlays the
        # editor during layout. Presence + scroll is reliable; waiting for Selenium
        # "clickable" caused false failures even though the form was available.
        fill(driver, (By.NAME, "subject"), "Koreapas post subject field", title)
        check(driver, (By.NAME, "use_html"), "Koreapas HTML option")
        fill(driver, (By.NAME, "memo"), "Koreapas post body field", content)
        check(driver, (By.NAME, "agreement"), "Koreapas agreement")
        submit = present(driver, (By.ID, "submm"), "Koreapas post submit button")
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", submit)
        submit.click()

        # Koreapas may redirect through an acknowledgement page before the list
        # updates. Verify independently on the first Free Ads page.
        time.sleep(2)
        for attempt in range(3):
            post_url = published_post_url(driver, title)
            if post_url:
                return post_url
            if attempt < 2:
                time.sleep(2)
        raise RuntimeError("Koreapas did not show the submitted advert on the first Free Ads page")
    finally:
        driver.quit()


def post_number(post_url: str) -> str:
    parsed = urlparse(post_url)
    if parsed.scheme != "https" or parsed.hostname not in {"www.koreapas.com", "koreapas.com"}:
        return ""
    if parsed.path != "/bbs/view.php":
        return ""
    return parse_qs(parsed.query).get("no", [""])[0]


def first_page_view_counts() -> dict[str, int]:
    """Read the public list page only; opening a post would increase its count."""
    response = requests.get(
        BOARD_URL,
        headers={"User-Agent": "1CupEnglish marketing performance monitor"},
        timeout=20,
    )
    if response.status_code != 200:
        return {}
    html = response.content.decode("euc-kr", errors="replace")
    counts: dict[str, int] = {}
    for title in BeautifulSoup(html, "html.parser").select("span.list_title"):
        anchor = title.find_parent("a", href=True)
        row = title.find_parent("tr")
        if not anchor or not row:
            continue
        number = parse_qs(urlparse(urljoin(BOARD_URL, anchor["href"])).query).get("no", [""])[0]
        cells = row.find_all("td", recursive=False)
        title_cell = title.find_parent("td")
        if not number or title_cell not in cells:
            continue
        title_index = cells.index(title_cell)
        if title_index + 1 >= len(cells):
            continue
        raw_count = cells[title_index + 1].get_text(" ", strip=True).replace(",", "")
        if raw_count.isdigit():
            counts[number] = int(raw_count)
    return counts


@app.get("/")
def health():
    return jsonify({"ok": True, "service": "koreapas-publisher"})


@app.post("/")
def handle():
    if not authorized():
        return jsonify({"error": "unauthorized"}), 401
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid JSON"}), 400

    action = payload.get("action")
    if action == "performance":
        entries = payload.get("posts")
        if not isinstance(entries, list):
            return jsonify({"error": "posts must be an array"}), 400
        view_counts = first_page_view_counts()
        posts = []
        for entry in entries[:50]:
            if not isinstance(entry, dict):
                continue
            post_id = entry.get("id")
            post_url = entry.get("externalPostUrl")
            if not isinstance(post_id, str) or not isinstance(post_url, str):
                continue
            views = view_counts.get(post_number(post_url))
            if views is not None:
                posts.append({"id": post_id, "metrics": {"impressions": views}})
        return jsonify({"posts": posts})
    if action != "publish":
        return jsonify({"error": "invalid action"}), 400

    try:
        title = required_text(payload, "title", 200)
        content = required_text(payload, "content", 25_000)
        post_url = publish(title, content)
        return jsonify({"postUrl": post_url})
    except (RuntimeError, TimeoutException, ValueError, WebDriverException) as error:
        app.logger.warning("Koreapas publish failed: %s", error)
        return jsonify({"error": str(error)}), 502


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
