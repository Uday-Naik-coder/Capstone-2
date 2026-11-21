"""Phase 6 end-to-end test (Selenium, headless Chrome).

Proves the full MERN chain in a real browser:
  React SPA (Vite) -> Express /api/predict -> pinned ML service (3b1a4122)

Flow:
  1. Load app (unauthenticated -> login page shown).
  2. Register a fresh account (email/password) -> auto-login -> protected form.
  3. Predict with the default payload (SeniorCitizen = 0) -> "Not likely to churn".
  4. Flip SeniorCitizen to 1 -> "Likely to churn" (fixture row 6576, SC flip).

Run:  .venv\Scripts\python.exe "ML Model\e2e\test_e2e.py"   (from repo root)
Env:  E2E_BASE_URL (default http://localhost:5174)
"""

import os
import sys
import uuid

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:5174")
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
TIMEOUT = 30


def build_driver():
    opts = Options()
    if os.path.exists(CHROME_PATH):
        opts.binary_location = CHROME_PATH
    opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1400,1000")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--log-level=3")
    return webdriver.Chrome(options=opts)


def wait_visible(driver, text, timeout=TIMEOUT):
    WebDriverWait(driver, timeout).until(
        EC.visibility_of_element_located(
            (By.XPATH, f"//*[normalize-space(text())='{text}']")
        )
    )


def click_predict(driver):
    btn = WebDriverWait(driver, TIMEOUT).until(
        EC.element_to_be_clickable((By.XPATH, "//button[text()='Predict churn']"))
    )
    btn.click()


def main():
    driver = build_driver()
    try:
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        password = "Password123!"

        # 1. Login page (unauthenticated)
        driver.get(BASE_URL)
        WebDriverWait(driver, TIMEOUT).until(
            EC.element_to_be_clickable((By.XPATH, "//button[text()='Sign in']"))
        )
        print("[1] Login page rendered for unauthenticated user")

        # 2. Register a fresh account -> auto-login -> protected form
        driver.find_element(By.XPATH, "//button[text()='Create one']").click()
        driver.find_element(By.CSS_SELECTOR, "input[placeholder='Jane Doe']").send_keys("E2E Tester")
        driver.find_element(By.CSS_SELECTOR, "input[type='email']").send_keys(email)
        driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys(password)
        driver.find_element(By.XPATH, "//button[text()='Create account']").click()
        WebDriverWait(driver, TIMEOUT).until(
            EC.element_to_be_clickable((By.XPATH, "//button[text()='Predict churn']"))
        )
        print(f"[2] Registered + logged in ({email}); protected form visible")

        # 3. Default payload (SeniorCitizen = 0)
        click_predict(driver)
        wait_visible(driver, "Not likely to churn")
        print("[3] SeniorCitizen=0 -> 'Not likely to churn'")

        # 4. Flip SeniorCitizen to 1
        Select(driver.find_element(By.ID, "SeniorCitizen")).select_by_value("1")
        click_predict(driver)
        wait_visible(driver, "Likely to churn")
        print("[4] SeniorCitizen=1 -> 'Likely to churn'")

        print("E2E PASS")
        return 0
    except Exception:
        import traceback

        traceback.print_exc()
        try:
            os.makedirs("e2e", exist_ok=True)
            shot = os.path.join("e2e", "failure.png")
            driver.save_screenshot(shot)
            print(f"Screenshot saved: {shot}")
            print("PAGE SOURCE (truncated):\n", driver.page_source[:4000])
        except Exception:
            pass
        return 1
    finally:
        driver.quit()


if __name__ == "__main__":
    sys.exit(main())