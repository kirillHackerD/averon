"""Production server runner using Waitress (Windows-compatible)"""
import os
from waitress import serve
from app import app, init_db

# Initialize database
init_db()

# Get port from environment or default to 8080
port = int(os.environ.get("PORT", 5852))

print(f"Starting Averon on http://localhost:{port}")
print(f"Press Ctrl+C to stop")

# Run production server
serve(app, host="0.0.0.0", port=port, threads=4)
