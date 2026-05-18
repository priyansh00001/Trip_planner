#!/bin/bash

# start_scrapers.sh
# Triggers the backend scrapers to run across all destinations.
# Accepts optional argument for a specific destination.
# Usage: ./start_scrapers.sh [destination_slug]

# Set the working directory to the script's location
cd "$(dirname "$0")"

# Activate virtual environment if it exists
if [ -d ".venv" ]; then
    source .venv/Scripts/activate
elif [ -d "venv" ]; then
    source venv/Scripts/activate
fi

# Run the python trigger script
if [ -z "$1" ]; then
    echo "Starting scraper for all destinations..."
    python scripts/trigger_all_scrapers.py
else
    echo "Starting scraper for destination: $1"
    python scripts/trigger_all_scrapers.py --destination "$1"
fi
