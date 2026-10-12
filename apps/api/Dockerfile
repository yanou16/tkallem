# Tkallem API image. Build from the repo root (the API installs the agent package from packages/agent):
#   docker build -f apps/api/Dockerfile -t tkallem-api .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /srv
# Dependencies first (cached while only the code changes). requirements.txt points to ../../packages/agent.
COPY packages/agent/pyproject.toml packages/agent/
COPY packages/agent/tkallem_agent packages/agent/tkallem_agent
COPY apps/api/requirements.txt apps/api/
RUN cd apps/api && pip install -r requirements.txt

COPY apps/api apps/api
RUN chmod +x apps/api/start.sh && useradd --create-home --uid 10001 tkallem
USER tkallem
WORKDIR /srv/apps/api

# Azure App Service sends traffic to WEBSITES_PORT (8000).
EXPOSE 8000
CMD ["./start.sh"]
