FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Etc/UTC \
    PYENV_ROOT=/opt/pyenv \
    PATH=/opt/pyenv/bin:/opt/pyenv/shims:/root/.local/bin:${PATH}

# System dependencies and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    build-essential \
    make \
    zlib1g-dev \
    libssl-dev \
    libbz2-dev \
    libreadline-dev \
    libsqlite3-dev \
    libffi-dev \
    liblzma-dev \
    tk-dev \
    uuid-dev \
    xz-utils \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Python 3.12.4 via pyenv for exact patch version control
RUN git clone https://github.com/pyenv/pyenv.git "$PYENV_ROOT" \
    && "$PYENV_ROOT/bin/pyenv" install 3.12.4 \
    && "$PYENV_ROOT/bin/pyenv" global 3.12.4 \
    && python -m pip install --upgrade pip

# Install uv (Python package/dependency manager)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# Clone and install MCPO with dev dependencies
WORKDIR /opt
RUN git clone https://github.com/open-webui/mcpo.git
WORKDIR /opt/mcpo
RUN uv sync --dev

# Prepare application directory
WORKDIR /app/backend

# Install project Python dependencies first for better Docker layer caching
COPY requirements.txt ./
RUN if [ -f requirements.txt ]; then \
      python -m pip install --no-cache-dir -r requirements.txt; \
    fi

# Copy the rest of the application source
COPY . /app/backend

# Default working directory inside the container
WORKDIR /app/backend

# Default command shows Python version (override when running the container)
CMD ["python", "--version"]


