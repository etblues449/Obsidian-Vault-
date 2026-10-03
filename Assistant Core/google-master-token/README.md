# Google master token — containerised minter

A throwaway Docker container that mints a Google **master token** (`aas_et/…`)
and, optionally, a one-hour **access token** (`ya29.…`). Used by the Google
Home / Chromecast side of Home Assistant, which needs a master token because
Google publishes no ordinary OAuth flow for local device control.

Nothing is persisted: no volumes, no build-time credentials, no files written.
The token is printed to your terminal once and exists nowhere else.

## Run it

```bash
docker build -t google-master-token "Assistant Core/google-master-token"
docker run --rm -it google-master-token --username you@gmail.com
```

It prompts for the password with the input hidden. To pipe it instead:

```bash
printf '%s' 'your-app-password' \
  | docker run --rm -i google-master-token --username you@gmail.com
```

Useful flags:

| Flag | Purpose |
|---|---|
| `--access-token` | also mint the 1-hour `ya29.*` token |
| `--android-id`   | reuse a previous device id (see below) |
| `--app` / `--client-sig` / `--service` | target a different Google service |

## Use an app password

Make one at <https://myaccount.google.com/apppasswords> and use it instead of
your real password. It has the same access for this flow but is separately
revocable, and a 2FA account will reject the real password anyway
(`BadAuthentication`, which the script explains rather than just echoing).

## Reuse the Android ID

gpsoauth signs in as a device. The script generates a 16-hex id if you don't
supply one and **prints it** — save it and pass it back next time:

```bash
docker run --rm -it google-master-token \
  --username you@gmail.com --android-id 0123456789abcdef
```

A fresh id on every run looks to Google like a new device signing in each time,
which is exactly the pattern its abuse heuristics act on.

## What you are actually creating

A master token is **more dangerous than your password**:

- it never expires,
- **it survives a password change**,
- it mints access tokens for Google services on your behalf.

So: put it straight into `secrets.yaml`, an env var, or a password manager.
Never into a note, an issue, a chat, or a commit. If it leaks, revoke it at
<https://myaccount.google.com/permissions> — resetting your password will not.

This is why the Dockerfile has no `ARG`/`ENV` for credentials. Anything set
that way is baked into an image layer and readable forever via `docker history`,
which would defeat the point of using a container at all.

## Where to run it

**Not from the SSH & Web Terminal add-on**, as things stand. That add-on has
`protected: true`, so the Docker socket is not mounted into it — the `docker`
binary is present at `/usr/local/bin/docker` but has no daemon to talk to and
will fail with a connection error. Turning protection off to work around this
would hand a shell add-on full control of every container on the hub, which is
not a trade worth making for one token.

Run it on the PC or the Fold instead, then paste the token into HA. Or skip
Docker entirely:

```bash
pip install --user "gpsoauth>=1.1,<2"
python3 "Assistant Core/google-master-token/get_token.py" --username you@gmail.com
```

## Honest limits

- **The live flow is unverified from here.** This session has no Google
  credentials and no path to the account, so the happy path has only been
  exercised against a stubbed `gpsoauth` — argument handling, the access-token
  exchange, the Android-ID generation, and each error branch. Whether Google
  accepts *your* account is between you and Google.
- **The app/signature/service triple is the Google Home one.** A different
  integration wants a different triple; override the three flags rather than
  editing the defaults, and take the values from that integration's own docs.
- `gpsoauth` is pinned `>=1.1,<2` so a major release cannot silently change the
  call signatures under a script with no live-endpoint test.
