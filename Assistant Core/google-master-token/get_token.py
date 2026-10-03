#!/usr/bin/env python3
"""
Mint a Google master token (and optionally a 1-hour access token) via gpsoauth.

WHAT A MASTER TOKEN IS — read this before running it
----------------------------------------------------
`aas_et/...`. It is the credential an Android device holds after you sign in
once, and it is materially MORE dangerous than your password:

  * it does not expire — it is valid until explicitly revoked;
  * it does NOT die when you change your password;
  * it can mint access tokens for Google services on your behalf.

So it is never written to a file by this script, never baked into the Docker
image, and never passed on a command line where it would land in shell history
or `ps`. It is printed once, to your terminal, and that is the only copy.

Put it straight into wherever it is actually needed (HA `secrets.yaml`, an env
var, a password manager) and close the terminal. If it ever leaks, revoke it at
https://myaccount.google.com/permissions — changing your password will NOT.

CREDENTIALS
-----------
Use an APP PASSWORD, not your real Google password:
https://myaccount.google.com/apppasswords

It has the same access as the real password for this flow, but it is separately
revocable and does not put your actual password through a script. Accounts with
2FA generally require one here anyway.

The password is read from stdin, or prompted for if stdin is a terminal. It is
deliberately NOT read from a command-line argument.

THE ANDROID ID
--------------
gpsoauth identifies itself as a device. Generate one and then KEEP REUSING IT:
a new id on every run looks like a new device signing in each time, which is
exactly the pattern Google's abuse heuristics act on. The script prints the id
it used — save it and pass it back via --android-id or ANDROID_ID next time.

USAGE
  python3 get_token.py                          # master token only
  python3 get_token.py --access-token           # also mint a 1-hour access token
  python3 get_token.py --android-id 0123456789abcdef
  GOOGLE_USERNAME=me@gmail.com python3 get_token.py
"""
import argparse
import os
import secrets
import sys
from getpass import getpass

try:
    import gpsoauth
except ImportError:                                        # pragma: no cover
    sys.exit("gpsoauth is not installed.  pip install gpsoauth\n"
             "(Or use the Dockerfile next to this script, which pins it.)")

# The app/signature/service triple identifies WHICH Google service the access
# token is for. These three are the Google Home / Chromecast app's, which is
# what Home Assistant's Google Home integrations use. A different integration
# needs a different triple — override with the flags rather than editing this.
DEFAULT_APP = "com.google.android.apps.chromecast.app"
DEFAULT_CLIENT_SIG = "24bb24c05e47e0aefa68a58a766179d9b613a600"
DEFAULT_SERVICE = "oauth2:https://www.google.com/accounts/OAuthLogin"

# gpsoauth returns these in an "Error" field. Left as-is they are cryptic, and
# the most common one ("BadAuthentication") is usually NOT a wrong password.
ERRORS = {
    "BadAuthentication":
        "Rejected. On a 2FA account this almost always means you used the real\n"
        "  password instead of an app password. Make one at\n"
        "  https://myaccount.google.com/apppasswords and use that.",
    "NeedsBrowser":
        "Google wants an interactive sign-in — it does not trust this attempt.\n"
        "  An app password normally clears it. If not, sign in once from a browser\n"
        "  on the same network and retry.",
    "DeviceManagementRequiredOrSyncDisabled":
        "A Workspace/organisation policy blocks programmatic sign-in on this\n"
        "  account. A personal Google account will work; this one will not.",
    "NeedsPostLoginApproval":
        "Google is holding the sign-in for approval. Check the security prompt\n"
        "  on your phone or at https://myaccount.google.com/notifications, then retry.",
    "Unknown":
        "Google returned no useful reason. Retry once; if it repeats, an app\n"
        "  password is the next thing to try.",
}


def read_password() -> str:
    """From an env var if set (and say so), else stdin, else an interactive prompt."""
    env = os.environ.get("GOOGLE_APP_PASSWORD")
    if env:
        print("note: using GOOGLE_APP_PASSWORD from the environment. Env vars are\n"
              "      visible to other processes and land in shell history — prefer\n"
              "      stdin for anything long-lived.", file=sys.stderr)
        return env
    if sys.stdin.isatty():
        return getpass("Google app password (input hidden): ")
    pw = sys.stdin.readline().rstrip("\n")
    if not pw:
        sys.exit("No password on stdin. Pipe one in, or run interactively.")
    return pw


def fail(resp: dict, what: str) -> None:
    """Report a Google rejection in terms of what to do about it, then exit."""
    err = resp.get("Error", "Unknown")
    print(f"\n{what} FAILED: {err}", file=sys.stderr)
    print("  " + ERRORS.get(err, "No guidance on record for this error code."),
          file=sys.stderr)
    if resp.get("Url"):
        print(f"  Google also returned a URL to visit: {resp['Url']}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    p = argparse.ArgumentParser(
        description="Mint a Google master token via gpsoauth. Prints, never writes.")
    p.add_argument("--username", default=os.environ.get("GOOGLE_USERNAME"),
                   help="Google account email (or set GOOGLE_USERNAME).")
    p.add_argument("--android-id", default=os.environ.get("ANDROID_ID"),
                   help="16 hex chars. Generated if omitted — then REUSE it.")
    p.add_argument("--access-token", action="store_true",
                   help="Also mint a 1-hour access token (ya29.*).")
    p.add_argument("--app", default=DEFAULT_APP)
    p.add_argument("--client-sig", default=DEFAULT_CLIENT_SIG)
    p.add_argument("--service", default=DEFAULT_SERVICE)
    args = p.parse_args()

    username = args.username
    if not username:
        if not sys.stdin.isatty():
            sys.exit("No username. Pass --username or set GOOGLE_USERNAME.")
        username = input("Google account email: ").strip()
    if not username:
        sys.exit("No username given.")

    android_id = args.android_id
    generated = False
    if not android_id:
        android_id = secrets.token_hex(8)          # 16 hex chars, as Android uses
        generated = True

    password = read_password()

    print(f"\n[*] master login as {username} (device {android_id}) ...", file=sys.stderr)
    resp = gpsoauth.perform_master_login(username, password, android_id)
    if "Token" not in resp:
        fail(resp, "Master login")
    master_token = resp["Token"]

    access_token = None
    if args.access_token:
        print("[*] exchanging for an access token ...", file=sys.stderr)
        auth = gpsoauth.perform_oauth(
            username, master_token, android_id,
            service=args.service, app=args.app, client_sig=args.client_sig)
        if "Auth" not in auth:
            fail(auth, "OAuth exchange")
        access_token = auth["Auth"]

    print("\n" + "=" * 72)
    print(f"ANDROID_ID    {android_id}")
    if generated:
        print("              ^ generated this run. SAVE IT and pass it back next time")
        print("                (--android-id / ANDROID_ID), or every run looks like a")
        print("                new device signing in to Google.")
    print(f"MASTER TOKEN  {master_token}")
    if access_token:
        print(f"ACCESS TOKEN  {access_token}")
        print("              ^ expires in about an hour; mint a new one from the")
        print("                master token whenever you need it.")
    print("=" * 72)
    print("""
The master token above never expires and survives a password change. Treat it
as more sensitive than your password:

  * put it straight into HA's secrets.yaml / an env var / a password manager
  * do NOT paste it into a chat, an issue, a note, or a commit
  * revoke at https://myaccount.google.com/permissions if it ever leaks
    — changing your Google password will NOT invalidate it

Nothing was written to disk by this script. Clear your scrollback when done.
""".rstrip(), file=sys.stderr)


if __name__ == "__main__":
    main()
