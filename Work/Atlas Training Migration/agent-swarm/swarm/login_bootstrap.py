"""
Run ONCE, on a machine with a display. Opens a real browser, you log in to Atlas
(username -> password -> MFA), then it saves the authenticated session to
auth_state.json. The headless swarm workers reuse that session.

    python login_bootstrap.py

Re-run when the session expires. auth_state.json is a secret — never commit it.
"""
import sys
from playwright.sync_api import sync_playwright
import config


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)  # headed so you can do MFA
        ctx = browser.new_context()
        page = ctx.new_page()
        page.goto(config.ADD_RESULT_URL)
        print("\n>>> Log in fully (username, password, MFA) until you land on the")
        print(">>> Atlas employee/training page. Then press ENTER here.\n")
        try:
            input()
        except KeyboardInterrupt:
            sys.exit(1)
        # Sanity check we're actually authenticated, not on the login host.
        if "auth.atlas-hub.co.uk" in page.url:
            print("Still on the login page — not saving. Finish login and re-run.")
            browser.close()
            sys.exit(1)
        ctx.storage_state(path=config.AUTH_STATE)
        print(f"Saved session -> {config.AUTH_STATE}")
        browser.close()


if __name__ == "__main__":
    main()
