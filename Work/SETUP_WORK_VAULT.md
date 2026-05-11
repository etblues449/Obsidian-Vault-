# Setting up `work-vault` (encrypted private repo)

Goal: a separate private GitHub repo for sensitive work content, with files encrypted at rest using [git-crypt](https://github.com/AGWA/git-crypt). Only people holding the key file can read the contents.

This needs a **computer** — git-crypt has no phone client.

## What you'll get

```
work-vault/                              ← new private repo on GitHub
├── README.md                            ← plain text, explains setup
├── .gitattributes                       ← rule: encrypt everything in encrypted/
└── encrypted/                           ← all sensitive files go here
    └── Income Forecast/
        └── 2026-05-10 Claude Excel session - Feb to Mar 27 forecast.md
```

In GitHub's web UI the encrypted file appears as binary garbage (`GITCRYPT\0...`). Locally on any device with the key, it appears as normal markdown.

## One-time setup

### 1. Install git-crypt on your desktop

| OS | Command |
| --- | --- |
| macOS | `brew install git-crypt` |
| Ubuntu/Debian | `sudo apt install git-crypt` |
| Windows | Download from <https://github.com/AGWA/git-crypt/releases> and put `git-crypt.exe` on your PATH |

### 2. Create the empty repo on GitHub

- Go to <https://github.com/new>
- Name: `work-vault`
- Visibility: **Private**
- Don't tick "Add README" — we'll push our own
- Click **Create repository**
- Copy the SSH or HTTPS URL it shows (e.g. `git@github.com:etblues449/work-vault.git`)

### 3. Run the setup script

Paste this into a terminal on your desktop. **Replace `REPO_URL`** with the URL from step 2.

```bash
REPO_URL="git@github.com:etblues449/work-vault.git"

mkdir -p ~/work-vault && cd ~/work-vault
git init -b main
git-crypt init

# Tell git-crypt which paths to encrypt
cat > .gitattributes <<'EOF'
encrypted/** filter=git-crypt diff=git-crypt
encrypted/**/.* filter=git-crypt diff=git-crypt
.gitattributes !filter !diff
README.md !filter !diff
EOF

# Plain-text README
cat > README.md <<'EOF'
# work-vault
Private work content. Files in `encrypted/` are encrypted at rest in GitHub
via git-crypt. Unlock with: git-crypt unlock /path/to/work-vault.key
EOF

# Export the unlock key — STORE THIS SAFELY
git-crypt export-key ~/work-vault.key
echo "Key saved to ~/work-vault.key — back it up to a password manager NOW."

# Make the encrypted folder
mkdir -p encrypted

# Copy the existing anonymised transcript across
# (assuming you have the Obsidian vault cloned at ~/Obsidian-Vault-)
cp -r ~/Obsidian-Vault-/Work/Income\ Forecast encrypted/

git remote add origin "$REPO_URL"
git add -A
git commit -m "Initial commit: encrypted work content"
git push -u origin main
```

### 4. Save the key file

`~/work-vault.key` is the only thing that can decrypt the repo.

- Upload it to your password manager (1Password, Bitwarden) as a file attachment
- Optionally also keep an offline backup (USB stick in a drawer)
- **If you lose it, the encrypted files are unreadable forever — there is no recovery**

### 5. Verify

- Open <https://github.com/etblues449/work-vault> → click into `encrypted/Income Forecast/...md` → it should look like binary garbage starting with `GITCRYPT`
- Locally, `cat ~/work-vault/encrypted/Income\ Forecast/...md` should show normal markdown

If both are true, encryption works.

## Daily use

```bash
cd ~/work-vault
# edit files normally
git add -A && git commit -m "Update" && git push
```

git-crypt encrypts on commit, decrypts on checkout — automatic.

## On a second device

```bash
git clone git@github.com:etblues449/work-vault.git
cd work-vault
git-crypt unlock /path/to/work-vault.key
```

## What NOT to do

- ❌ Don't sync `~/work-vault/` to Google Drive, iCloud, Dropbox, or your phone — the unlocked working tree would defeat the encryption
- ❌ Don't email the key to yourself
- ❌ Don't commit the key to any repo
- ❌ Don't make the `work-vault` repo public — even encrypted, the file names and structure leak metadata

## Architecture summary

```
PERSONAL stuff          →  Obsidian-Vault- repo  →  Drive  →  Phone (Obsidian)
SENSITIVE WORK stuff    →  work-vault repo (encrypted)  →  Desktop only
```

The two stay separate. Anonymised summaries (like this current Income Forecast file) can live in either, but raw personal data only ever goes into `work-vault`.
