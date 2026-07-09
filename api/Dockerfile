FROM python:3.13-slim AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --prefix=/install -r /tmp/requirements.txt

FROM python:3.13-slim

# System libraries required by WeasyPrint (Pango, Cairo, GLib, fontconfig)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgobject-2.0-0 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libcairo2 \
        libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

RUN groupadd --system appgroup \
    && useradd --system --gid appgroup appuser

WORKDIR /app
COPY . /app/
COPY entrypoint.sh /entrypoint.sh

RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

USER appuser

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
