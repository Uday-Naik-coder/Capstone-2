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
    # ---------- helpers ----------
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

    # ---------- auth ----------
    def test_register_login_predict_default(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self._predict()
        self.wait_for_text("Not likely to churn", timeout=30)

    def test_logout_then_relogin_registered_account(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self._logout()
        self._login(email)
        self._predict()
        self.wait_for_text("Not likely to churn", timeout=30)

    def test_protected_route_shows_login_when_unauthenticated(self):
        self._open_app()
        self.assert_element_visible("//button[normalize-space()='Sign in']")

    def test_invalid_login_wrong_password_shows_error(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self._logout()
        self.wait_for_element_visible("//button[normalize-space()='Sign in']", timeout=30)
        self.type("input[type='email']", email)
        self.type("input[type='password']", "WrongPassword!")
        self.click("//button[normalize-space()='Sign in']")
        self.wait_for_element_visible("//p[contains(@class, 'text-red-700')]", timeout=15)

    def test_invalid_register_duplicate_email_shows_error(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self._logout()
        self.click("//button[normalize-space()='Create one']")
        self.wait_for_element_visible("input[placeholder='Jane Doe']", timeout=15)
        self.type("input[placeholder='Jane Doe']", "E2E User")
        self.type("input[type='email']", email)
        self.type("input[type='password']", PASSWORD)
        self.click("//button[normalize-space()='Create account']")
        self.wait_for_element_visible("//p[contains(@class, 'text-red-700')]", timeout=15)

    def test_toggle_between_login_and_register_modes(self):
        self._open_app()
        self.click("//button[normalize-space()='Create one']")
        self.wait_for_element_visible("input[placeholder='Jane Doe']", timeout=15)
        self.click("//button[normalize-space()='Sign in']")
        self.wait_for_element_visible("input[placeholder='you@example.com']", timeout=15)

    def test_session_persists_on_page_refresh(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self.refresh()
        self.wait_for_element_visible("//button[normalize-space()='Predict churn']", timeout=30)

    def test_user_email_shown_in_header_after_login(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self.wait_for_text(email, timeout=10)

    # ---------- prediction ----------
    def test_default_payload_senior_citizen_zero_not_churn(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self._predict()
        self.wait_for_text("Not likely to churn", timeout=30)

    def test_flip_senior_citizen_to_one_likely_churn(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self._predict()
        self.wait_for_text("Not likely to churn", timeout=30)
        self._set_select("SeniorCitizen", "1")
        self._predict()
        self.wait_for_text("Likely to churn", timeout=30)

    def test_two_year_contract_not_likely_churn(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self._set_select("Contract", "Two year")
        self._predict()
        self.wait_for_text("Not likely to churn", timeout=30)

    def test_fiber_optic_with_senior_citizen_likely_churn(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self._set_select("InternetService", "Fiber optic")
        self._set_select("SeniorCitizen", "1")
        self._predict()
        self.wait_for_text("Likely to churn", timeout=30)

    def test_month_to_month_with_senior_citizen_likely_churn(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self._set_select("Contract", "Month-to-month")
        self._set_select("SeniorCitizen", "1")
        self._predict()
        self.wait_for_text("Likely to churn", timeout=30)

    def test_fill_all_numeric_fields_produces_prediction(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self._set_number("tenure", "70")
        self._set_number("MonthlyCharges", "90.00")
        self._set_number("TotalCharges", "6300.00")
        self._predict()
        self.wait_for_text("Not likely to churn", timeout=30)

    def test_reset_button_restores_defaults(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self._set_select("SeniorCitizen", "1")
        self._set_select("Contract", "Two year")
        self.click("//button[normalize-space()='Reset']")
        self._predict()
        self.wait_for_text("Not likely to churn", timeout=30)

    # ---------- history ----------
    def test_history_shows_prediction_after_predict(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self._predict()
        self.wait_for_text("Not likely to churn", timeout=30)
        self.click("//button[normalize-space()='History']")
        self.wait_for_text("Prediction history", timeout=30)
        self.wait_for_text("Not likely to churn", timeout=15)

    def test_multiple_predictions_accumulate_in_history(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self._predict()
        self.wait_for_text("Not likely to churn", timeout=30)
        self._set_select("SeniorCitizen", "1")
        self._predict()
        self.wait_for_text("Likely to churn", timeout=30)
        self.click("//button[normalize-space()='History']")
        self.wait_for_text("Prediction history", timeout=30)
        self.assert_element_visible("//span[contains(text(), 'Not likely to churn')]", timeout=15)
        self.assert_element_visible("//span[contains(text(), 'Likely to churn')]", timeout=15)

    def test_delete_history_entry_removes_it(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self._predict()
        self.wait_for_text("Not likely to churn", timeout=30)
        self.click("//button[normalize-space()='History']")
        self.wait_for_text("Prediction history", timeout=30)
        self.wait_for_text("Not likely to churn", timeout=15)
        self.click("//button[normalize-space()='Delete']")
        self.wait_for_text("No predictions yet", timeout=15)

    def test_history_refresh_button_reloads(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self.click("//button[normalize-space()='History']")
        self.wait_for_text("Prediction history", timeout=30)
        self.click("//button[normalize-space()='Refresh']")
        self.wait_for_text("Prediction history", timeout=30)

    def test_history_empty_tab_shows_no_predictions(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self.click("//button[normalize-space()='History']")
        self.wait_for_text("Prediction history", timeout=30)
        self.wait_for_text("No predictions yet", timeout=15)

    # ---------- ui ----------
    def test_health_badge_shows_backend_online(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self.wait_for_text("Backend: online", timeout=15)

    def test_predict_and_history_tabs_switch(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self.click("//button[normalize-space()='History']")
        self.wait_for_text("Prediction history", timeout=30)
        self.click("//button[normalize-space()='Predict']")
        self.wait_for_element_visible("//button[normalize-space()='Predict churn']", timeout=30)

    def test_sign_out_returns_to_login_page(self):
        email = f"e2e+{uuid.uuid4().hex[:10]}@example.com"
        self._open_app()
        self._register(email)
        self._logout()
        self.wait_for_element_visible("//button[normalize-space()='Create one']", timeout=15)


if __name__ == "__main__":
    import sys
    import pytest
    sys.exit(pytest.main([__file__, "-v", "-s", *sys.argv[1:]]))
