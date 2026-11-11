FROM python:3.12-slim

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		tesseract-ocr tesseract-ocr-deu \
		qpdf poppler-utils imagemagick \
		fonts-dejavu fonts-liberation \
	&& rm -rf /var/lib/apt/lists/*

# One layer per group and a shared pip cache, so a dropped download only repeats its own group.
ENV PIP_DEFAULT_TIMEOUT=120 \
	PIP_RETRIES=10 \
	PIP_DISABLE_PIP_VERSION_CHECK=1

RUN --mount=type=cache,target=/root/.cache/pip \
	pip install pandas numpy openpyxl xlsxwriter
RUN --mount=type=cache,target=/root/.cache/pip \
	pip install scipy matplotlib seaborn
RUN --mount=type=cache,target=/root/.cache/pip \
	pip install pypdf pikepdf reportlab pdfplumber python-docx docxtpl python-pptx
RUN --mount=type=cache,target=/root/.cache/pip \
	pip install pillow pytesseract opencv-python-headless

# The pod runs as uid 1000 with only /workspace and /tmp writable.
ENV HOME=/tmp \
	MPLBACKEND=Agg \
	MPLCONFIGDIR=/tmp/matplotlib \
	PYTHONUNBUFFERED=1

RUN useradd --uid 1000 --create-home sandbox
USER 1000
WORKDIR /workspace
