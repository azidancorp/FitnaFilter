// Domain filtering data and utilities for FitnaFilter
// Shared between background and content scripts

// Contextual Quran verse mappings for different blocklist categories
const VERSE_MAPPINGS = {
    // Vice category verses
    gambling: [
        '2:219',  // "They ask you about wine and gambling..."
        '5:90' // "O you who believe! Intoxicants and gambling..."
    ],
    porn: [
        '24:30',  // "Tell the believing men to lower their gaze..."
        '24:31',  // "And tell the believing women to lower their gaze..."
        '17:32'   // "And do not approach unlawful sexual intercourse..."
    ],
    drugs: [
        '5:90',   // "O you who believe! Intoxicants and gambling..."
        '2:219'   // "They ask you about wine and gambling..."
    ],
    vaping: [
        '5:90',   // "O you who believe! Intoxicants and gambling..."
        '2:195'   // "And do not throw yourselves into destruction..."
    ],
    abuse: [
        '4:36',   // "Worship Allah and associate nothing with Him, and be kind to parents..."
        '17:23'   // "Your Lord has decreed that you worship none but Him..."
    ],
    
    // Hazard category verses
    fraud: [
        '2:188',  // "And do not consume one another's wealth unjustly..."
        '4:29'    // "O you who believe! Do not consume one another's wealth unjustly..."
    ],
    scam: [
        '2:188',  // "And do not consume one another's wealth unjustly..."
        '83:1'  // "Woe to those who give less [than due]..."
    ],
    malware: [
        '2:195',  // "And do not throw yourselves into destruction..."
        '4:29'    // "O you who believe! Do not consume one another's wealth unjustly..."
    ],
    phishing: [
        '2:42',   // "And do not mix truth with falsehood..."
        '2:188'   // "And do not consume one another's wealth unjustly..."
    ],
    ransomware: [
        '2:188',  // "And do not consume one another's wealth unjustly..."
        '4:29'    // "O you who believe! Do not consume one another's wealth unjustly..."
    ],
    
    // Distraction category verses
    youtube: [
        '103:1', // "By time, Indeed mankind is in loss..."
        '62:9'     // "O you who believe! When the call is proclaimed for Salah..."
    ],
    tiktok: [
        '103:1', // "By time, Indeed mankind is in loss..."
        '25:67'    // "And those who, when they spend, do so neither extravagantly nor sparingly..."
    ],
    facebook: [
        '49:12',   // "O you who believe! Avoid much suspicion..."
        '103:1'  // "By time, Indeed mankind is in loss..."
    ],
    twitter: [
        '49:12',   // "O you who believe! Avoid much suspicion..."
        '103:1'  // "By time, Indeed mankind is in loss..."
    ],
    fortnite: [
        '103:1', // "By time, Indeed mankind is in loss..."
        '2:195'    // "And do not throw yourselves into destruction..."
    ],
    
    // Default verses for uncategorized or general blocking
    default: [
        '2:286',   // "Allah does not burden a soul beyond that it can bear..."
        '94:5'   // "So verily, with hardship, there is relief..."
    ]
};

function getContextualRedirectUrl(blocklistName) {
    const verses = VERSE_MAPPINGS[blocklistName] || VERSE_MAPPINGS.default;
    const randomVerse = verses[Math.floor(Math.random() * verses.length)];
    return `https://quran.com/${randomVerse}`;
}

// Available blocklists
const BLOCKLISTS = {
    // Vice category (red) - always enabled
    abuse: {
        url: chrome.runtime.getURL('blocklists/abuse.txt'),
        enabled: true,
        description: 'Sites promoting abusive behavior',
        category: 'vice'
    },
    drugs: {
        url: chrome.runtime.getURL('blocklists/drugs.txt'),
        enabled: true,
        description: 'Drug-related sites',
        category: 'vice'
    },
    gambling: {
        url: chrome.runtime.getURL('blocklists/gambling.txt'),
        enabled: true,
        description: 'Gambling sites',
        category: 'vice'
    },
    porn: {
        url: chrome.runtime.getURL('blocklists/porn.txt'),
        enabled: true,
        description: 'Pornography sites',
        category: 'vice'
    },
    vaping: {
        url: chrome.runtime.getURL('blocklists/vaping.txt'),
        enabled: true,
        description: 'Vaping and e-cigarette sites',
        category: 'vice'
    },
    
    // Hazards category (orange) - toggleable
    crypto: {
        url: chrome.runtime.getURL('blocklists/crypto.txt'),
        enabled: false,
        description: 'Cryptocurrency mining domains',
        category: 'hazard'
    },
    fraud: {
        url: chrome.runtime.getURL('blocklists/fraud.txt'),
        enabled: false,
        description: 'Known fraud sites',
        category: 'hazard'
    },
    malware: {
        url: chrome.runtime.getURL('blocklists/malware.txt'),
        enabled: false,
        description: 'Known malware domains',
        category: 'hazard'
    },
    phishing: {
        url: chrome.runtime.getURL('blocklists/phishing.txt'),
        enabled: false,
        description: 'Phishing sites',
        category: 'hazard'
    },
    ransomware: {
        url: chrome.runtime.getURL('blocklists/ransomware.txt'),
        enabled: false,
        description: 'Ransomware domains',
        category: 'hazard'
    },
    redirect: {
        url: chrome.runtime.getURL('blocklists/redirect.txt'),
        enabled: false,
        description: 'URL shorteners and redirectors',
        category: 'hazard'
    },
    scam: {
        url: chrome.runtime.getURL('blocklists/scam.txt'),
        enabled: false,
        description: 'Scam sites',
        category: 'hazard'
    },
    tracking: {
        url: chrome.runtime.getURL('blocklists/tracking.txt'),
        enabled: false,
        description: 'Tracking domains',
        category: 'hazard'
    },
    
    // Distractions category (yellow) - toggleable
    ads: {
        url: chrome.runtime.getURL('blocklists/ads.txt'),
        enabled: false,
        description: 'Ad servers and trackers',
        category: 'distraction'
    },
    facebook: {
        url: chrome.runtime.getURL('blocklists/facebook.txt'),
        enabled: false,
        description: 'Facebook-related domains',
        category: 'distraction'
    },
    fortnite: {
        url: chrome.runtime.getURL('blocklists/fortnite.txt'),
        enabled: false,
        description: 'Fortnite gaming domains',
        category: 'distraction'
    },
    piracy: {
        url: chrome.runtime.getURL('blocklists/piracy.txt'),
        enabled: false,
        description: 'Piracy sites',
        category: 'distraction'
    },
    smarttv: {
        url: chrome.runtime.getURL('blocklists/smart-tv.txt'),
        enabled: false,
        description: 'Smart TV related domains',
        category: 'distraction'
    },
    tiktok: {
        url: chrome.runtime.getURL('blocklists/tiktok.txt'),
        enabled: false,
        description: 'TikTok domains',
        category: 'distraction'
    },
    torrent: {
        url: chrome.runtime.getURL('blocklists/torrent.txt'),
        enabled: false,
        description: 'Torrent sites',
        category: 'distraction'
    },
    twitter: {
        url: chrome.runtime.getURL('blocklists/twitter.txt'),
        enabled: false,
        description: 'Twitter domains',
        category: 'distraction'
    },
    whatsapp: {
        url: chrome.runtime.getURL('blocklists/whatsapp.txt'),
        enabled: false,
        description: 'WhatsApp domains',
        category: 'distraction'
    },
    youtube: {
        url: chrome.runtime.getURL('blocklists/youtube.txt'),
        enabled: false,
        description: 'YouTube domains',
        category: 'distraction'
    }
};

// This file only contains shared data and utilities
// The actual blocking logic should remain in background.js using webNavigation API