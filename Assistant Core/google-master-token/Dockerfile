# Google master token minter — throwaway container, nothing persisted.
#
# Deliberately has NO ARG/ENV for credentials. Anything set that way is baked
# into the image and readable forever with `docker history`; the whole point of
# doing this in a container is that nothing survives the run.
#
#   docker build -t google-master-token "Assistant Core/google-master-token"
#   docker run --rm -it google-master-token
#
# Run it with --rm (no container left behind) and no -v (nothing can be written
# out). The token is printed to your terminal and exists nowhere else.

FROM python:3.12-slim

# Pinned to a major version so a surprise 2.x cannot change the call signatures
# under a script that has no tests against the live Google endpoint.
RUN pip install --no-cache-dir "gpsoauth>=1.1,<2"

WORKDIR /app
COPY get_token.py .

# Non-root: this needs no privileges at all, only outbound HTTPS.
RUN useradd --create-home --uid 10001 minter
USER minter

# -u so the prompts appear immediately rather than sitting in a buffer.
ENTRYPOINT ["python", "-u", "get_token.py"]
