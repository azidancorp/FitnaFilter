import requests
import os
import time

# Create the blocklists directory if it doesn't exist
blocklists_dir = os.path.join('src', 'blocklists')
os.makedirs(blocklists_dir, exist_ok=True)

# List of all blocklists available from Block List Project (.txt and .ip files)
blocklists = [
    # 'abuse.ip',
    'abuse.txt',
    'adobe.txt',
    'ads.txt',
    'basic.txt',
    'crypto.txt',
    'drugs.txt',
    'everything.txt',
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
    target_path = os.path.join(blocklists_dir, filename)
    url = f"{base_url}{filename}"

    print(f"Downloading {url} to {target_path}...")

    try:
        response = requests.get(url)
        if response.status_code == 200:
            with open(target_path, 'wb') as f:
                f.write(response.content)
            print(f"✓ Successfully downloaded {filename} ({len(response.content)} bytes)")
        else:
            print(f"✗ Failed to download {filename}: HTTP {response.status_code}")
    except Exception as e:
        print(f"✗ Error downloading {filename}: {str(e)}")

    # Add a short delay to be polite to the server
    time.sleep(1)

print("\nDownload complete! All blocklists have been saved to the src/blocklists directory.")
