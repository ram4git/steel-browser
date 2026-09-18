ARG NODE_VERSION=22.13.0

# Force amd64 platform for Google Chrome compatibility
FROM --platform=linux/amd64 node:${NODE_VERSION}-slim AS base

WORKDIR /app

ENV NODE_ENV="production" \
    PUPPETEER_CACHE_DIR=/app/.cache \
    DISPLAY=:10 \
    PATH="/usr/bin:/app/selenium/driver:${PATH}" \
    CHROME_BIN=/usr/bin/google-chrome \
    CHROME_PATH=/usr/bin/google-chrome \
    CHROME_EXECUTABLE_PATH=/usr/bin/google-chrome \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

LABEL org.opencontainers.image.source="https://github.com/steel-dev/steel-browser"

# Install dependencies
RUN rm -f /etc/apt/apt.conf.d/docker-clean; \
    echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache; \
    apt-get update -qq && \
    DEBIAN_FRONTEND=noninteractive apt-get -yq dist-upgrade && \
    apt-get install -y --no-install-recommends \
    expat \
    libxslt1.1 \
    libpam0g \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
    build-essential \
    pkg-config \
    python-is-python3 \
    xvfb

# Copy root workspace files first
COPY --link package.json package-lock.json ./

# Remove or override the prepare script to avoid husky in Docker
RUN npm pkg set scripts.prepare="echo skip husky"

COPY --link api/ ./api/

# Install dependencies for api
RUN npm ci --include=dev --workspace=api

# Install dependencies for recorder extension separately
RUN cd api/extensions/recorder && npm ci --include=dev && cd -

# Build the api package
RUN npm run build -w api

RUN cd api/extensions/recorder && \
    npm run build && \
    cd -

# Prune dev dependencies
RUN npm prune --omit=dev -w api
RUN cd api/extensions/recorder && npm prune --omit=dev && cd -

FROM base AS production
# Install dependencies
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -yq --no-install-recommends \
    wget \
    nginx \
    gnupg \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    xvfb \
    curl \
    unzip \
    default-jre \
    dbus \
    dbus-x11 \
    procps \
    x11-xserver-utils

# Install Google Chrome (amd64 only), PINNED to an exact build.
#
# Why pinned: this image used to install `google-chrome-stable` from Google's
# apt channel, i.e. whatever Chrome shipped on the day of the build. Every
# release tag rebuilds this image, so the browser changed silently under the
# backend. On 2026-09-15/18 that pulled 153.0.8010.52, in which the canvas
# app's Ctrl+Shift+K copy no longer lands on the browser clipboard (reads
# return 0 chars, no permission errors); 153.0.8010.36 from the 2026-09-16
# build works. Confirmed by A/B on production with the same backend.
#
# The exact .deb is fetched from Google's versioned pool and the installed
# version is asserted, so the build FAILS if the pin cannot be honoured
# instead of drifting to latest. Bump CHROME_VERSION deliberately, with a
# clipboard-workflow test, never as a side effect of a rebuild.
ARG CHROME_VERSION=153.0.8010.36
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    curl \
    unzip \
    gnupg \
    && CHROME_DEB="google-chrome-stable_${CHROME_VERSION}-1_amd64.deb" \
    && wget -q -O "/tmp/${CHROME_DEB}" "https://dl.google.com/linux/chrome/deb/pool/main/g/google-chrome-stable/${CHROME_DEB}" \
    # (same flags as the old `apt-get install -y google-chrome-stable`, so the
    # dependency set does not change; only the source of the .deb does)
    && DEBIAN_FRONTEND=noninteractive apt-get install -y "/tmp/${CHROME_DEB}" \
    && rm -f "/tmp/${CHROME_DEB}" \
    # Google's postinst re-adds the "stable" apt source; remove it so nothing
    # in this image can ever upgrade Chrome behind the pin.
    && rm -f /etc/apt/sources.list.d/google-chrome.list /etc/cron.daily/google-chrome \
    # Assert the pin actually took.
    && INSTALLED="$(google-chrome --version | awk '{print $3}')" \
    && echo "Chrome installed: ${INSTALLED} (pinned: ${CHROME_VERSION})" \
    && [ "${INSTALLED}" = "${CHROME_VERSION}" ] \
    # Clean up
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /var/cache/apt/*

# Install ChromeDriver to match Chrome version
RUN CHROME_VERSION=$(google-chrome --version | awk '{print $3}' | cut -d '.' -f 1) \
    && echo "Chrome version: $CHROME_VERSION" \
    && CHROMEDRIVER_VERSION=$(curl -s "https://googlechromelabs.github.io/chrome-for-testing/LATEST_RELEASE_${CHROME_VERSION}") \
    && echo "ChromeDriver version: $CHROMEDRIVER_VERSION" \
    && wget -O /tmp/chromedriver-linux64.zip "https://storage.googleapis.com/chrome-for-testing-public/${CHROMEDRIVER_VERSION}/linux64/chromedriver-linux64.zip" \
    && unzip /tmp/chromedriver-linux64.zip -d /tmp/ \
    && mv /tmp/chromedriver-linux64/chromedriver /usr/bin/chromedriver \
    && chmod +x /usr/bin/chromedriver \
    && rm -rf /tmp/chromedriver-linux64.zip /tmp/chromedriver-linux64 \
    && chromedriver --version

RUN mkdir -p /files

COPY --chmod=755 api/entrypoint.sh /app/api/entrypoint.sh

EXPOSE 3000 9223

ENV HOST_IP=localhost \
    DBUS_SESSION_BUS_ADDRESS=autolaunch:

ENTRYPOINT ["/app/api/entrypoint.sh"]

COPY --from=build /app /app
