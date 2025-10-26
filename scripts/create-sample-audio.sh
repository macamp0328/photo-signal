#!/bin/bash

# Simple script to create a 5-second silent MP3 for testing
# Requires ffmpeg to be installed

if ! command -v ffmpeg &> /dev/null; then
    echo "ffmpeg is not installed. Please install it to generate a sample MP3."
    echo ""
    echo "On Ubuntu/Debian: sudo apt-get install ffmpeg"
    echo "On macOS: brew install ffmpeg"
    echo ""
    echo "Alternatively, place your own MP3 file at public/audio/sample.mp3"
    exit 1
fi

mkdir -p public/audio

ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 5 -q:a 9 -acodec libmp3lame public/audio/sample.mp3 -y

echo "Created silent MP3 at public/audio/sample.mp3"
