FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt
RUN playwright install chromium

COPY run.py .

# Run the script immediately, then every 6 hours (21600 seconds)
CMD ["sh", "-c", "while true; do python run.py; sleep 21600; done"]
