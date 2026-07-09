import requests
import time
from pathlib import Path

# Create the blocklists directory if it doesn't exist
extension_dir = Path(__file__).resolve().parent
blocklists_dir = extension_dir / 'blocklists'
blocklists_dir.mkdir(parents=True, exist_ok=True)
request_timeout_seconds = 30

# Runtime blocklists used by extension/js/content/DomainFilter.js.
blocklists = [
    # 'abuse.ip',
    'abuse.txt',
    'ads.txt',
    'crypto.txt',
    'drugs.txt',
    'facebook.txt',
    'fortnite.txt',
    'fraud.txt',
    'gambling.txt',
    'malware.txt',
    # 'malware.ip',
    'phishing.txt',
    'piracy.txt',
    'porn.txt',
    'ransomware.txt',
    'redirect.txt',
    'scam.txt',
    'smart-tv.txt',
    'tiktok.txt',
    'torrent.txt',
    'tracking.txt',
    # 'tracking.ip',
    'twitter.txt',
    'vaping.txt',
    'whatsapp.txt',
    'youtube.txt'
]

# Base URL for blocklists
base_url = 'https://blocklistproject.github.io/Lists/'

# Download each blocklist
for blocklist in blocklists:
    filename = blocklist
    target_path = blocklists_dir / filename
    url = f"{base_url}{filename}"

    print(f"Downloading {url} to {target_path}...")

    try:
        response = requests.get(url, timeout=request_timeout_seconds)
        if response.status_code == 200:
            temporary_path = target_path.with_suffix(target_path.suffix + '.tmp')
            with open(temporary_path, 'wb') as f:
                f.write(response.content)
            temporary_path.replace(target_path)
            print(f"✓ Successfully downloaded {filename} ({len(response.content)} bytes)")
        else:
            print(f"✗ Failed to download {filename}: HTTP {response.status_code}")
    except Exception as e:
        print(f"✗ Error downloading {filename}: {str(e)}")

    # Add a short delay to be polite to the server
    time.sleep(1)

print("\nDownload complete! All blocklists have been saved to the extension/blocklists directory.")
