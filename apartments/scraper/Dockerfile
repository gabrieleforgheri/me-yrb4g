FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt
RUN playwright install chromium

COPY run.py .

# Run the script immediately, then every 12 hours (43200 seconds)
CMD ["sh", "-c", "while true; do python run.py; sleep 43200; done"]
