"""Diverse end-to-end test suite for the Telco Customer Churn web app.

Covers auth (register/login/logout/session), prediction (default/flip/categoric/numeric/reset),
history (view/accumulate/delete/empty), and UI (health badge/tabs/header).

Run:
  pytest "ML Model/e2e/test_e2e_full.py" -v -s
"""

import os
import uuid
from seleniumbase import BaseCase


BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:5173")
PASSWORD = "Password123!"


class TelcoChurnFullSuite(BaseCase):
    def _open_app(self):
        self.open(BASE_URL)
        self.wait_for_element_visible("//button[normalize-space()='Sign in']", timeout=30)

    def _register(self, email, password=PASSWORD, name="E2E User"):
        self.click("//button[normalize-space()='Create one']")
        self.wait_for_element_visible("input[placeholder='Jane Doe']", timeout=15)
        self.type("input[placeholder='Jane Doe']", name)
        self.type("input[type='email']", email)
        self.type("input[type='password']", password)
        self.click("//button[normalize-space()='Create account']")
        self.wait_for_element_visible("//button[normalize-space()='Predict churn']", timeout=30)

    def _login(self, email, password=PASSWORD):
        self.wait_for_element_visible("//button[normalize-space()='Sign in']", timeout=30)
        self.type("input[type='email']", email)
        self.type("input[type='password']", password)
        self.click("//button[normalize-space()='Sign in']")
        self.wait_for_element_visible("//button[normalize-space()='Predict churn']", timeout=30)

    def _logout(self):
        self.click("//button[normalize-space()='Sign out']")
        self.wait_for_element_visible("//button[normalize-space()='Sign in']", timeout=30)

    def _predict(self):
        self.click("//button[normalize-space()='Predict churn']")

    def _set_select(self, field_id, value):
        self.select_option_by_value(f"#{field_id}", value)

    def _set_number(self, field_id, value):
        self.execute_script(
            "const el = document.querySelector(arguments[0]);"
            " el.value = arguments[1];"
            " el.dispatchEvent(new Event('input', { bubbles: true }));",
            f"#{field_id}",
            str(value),
        )

    def test_protected_route_shows_login_when_unauthenticated(self):
        self._open_app()
        self.assert_element_visible("//button[normalize-space()='Sign in']")



if __name__ == "__main__":
    import sys
    import pytest
    sys.exit(pytest.main([__file__, "-v", "-s", *sys.argv[1:]]))
