"""Phase 6 end-to-end test using SeleniumBase with Live Dashboard.

Proves the full MERN chain in a real browser:
  React SPA (Vite) -> Express /api/predict -> pinned ML service (3b1a4122)

Flow:
  1. Load app (unauthenticated -> login page shown).
  2. Register a fresh account (email/password) -> auto-login -> protected form.
  3. Predict with default payload (SeniorCitizen = 0) -> "Not likely to churn".
  4. Flip SeniorCitizen to 1 -> "Likely to churn" (fixture row 6576, SC flip).

Features:
  - Live Dashboard support with `--dashboard`
  - Visual Demo mode with `--demo`
  - Automated assertions, waits, and failure screenshot capture
  - Can be run via pytest or directly with python

Manual run commands:
  pytest "ML Model/e2e/test_e2e.py" --dashboard
  python "ML Model/e2e/test_e2e.py"
"""

import os
import sys
import uuid
from seleniumbase import BaseCase


class TelcoChurnE2ETest(BaseCase):
    def test_churn_prediction_full_flow(self):
        base_url = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        password = "Password123!"

        # 1. Open app (unauthenticated -> login page shown)
        self.open(base_url)
        self.wait_for_element_visible("//button[normalize-space()='Sign in']", timeout=30)
        print(f"\n[1] App loaded at {base_url}; login page displayed")

        # 2. Register a fresh account -> auto-login -> protected form
        self.click("//button[normalize-space()='Create one']")
        self.wait_for_element_visible("input[placeholder='Jane Doe']", timeout=15)
        self.type("input[placeholder='Jane Doe']", "E2E Tester")
        self.type("input[type='email']", email)
        self.type("input[type='password']", password)
        self.click("//button[normalize-space()='Create account']")

        # Wait until authenticated and churn form is visible
        self.wait_for_element_visible("//button[normalize-space()='Predict churn']", timeout=30)
        print(f"[2] Registered + logged in ({email}); protected form visible")

        # 3. Default payload (SeniorCitizen = 0)
        self.click("//button[normalize-space()='Predict churn']")
        self.wait_for_text("Not likely to churn", timeout=30)
        print("[3] Default payload (SeniorCitizen=0) -> 'Not likely to churn'")

        # 4. Flip SeniorCitizen to 1
        self.select_option_by_value("#SeniorCitizen", "1")
        self.click("//button[normalize-space()='Predict churn']")
        self.wait_for_text("Likely to churn", timeout=30)
        print("[4] Flipped SeniorCitizen=1 -> 'Likely to churn'")

        print("\nAll E2E checks passed successfully!")


if __name__ == "__main__":
    import pytest
    args = sys.argv[1:]
    # Default to enabling live dashboard if not specified
    if not any("--dashboard" in arg for arg in args):
        args = ["--dashboard", "-v", "-s", *args]
    sys.exit(pytest.main([__file__, *args]))
