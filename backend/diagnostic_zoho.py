#!/usr/bin/env python
"""Diagnostic script to check Zoho Mail SMTP configuration."""
import os
from pathlib import Path

# Load .env
env_path = Path(__file__).parent / '.env'
config = {}
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                config[key.strip()] = value.strip()

print("=" * 60)
print("ZOHO MAIL SMTP DIAGNOSTIC CHECK")
print("=" * 60)

print("\n1. SMTP Configuration:")
for key in ['INFO_SMTP_HOST', 'INFO_SMTP_PORT', 'INFO_SMTP_USERNAME', 'INFO_SMTP_FROM_EMAIL', 'INFO_SMTP_FROM_NAME']:
    value = config.get(key, 'NOT SET')
    if 'PASSWORD' in key:
        value = '*' * len(value) if value != 'NOT SET' else value
    print(f"   {key:25} = {value}")

print("\n2. App Password Details:")
password = config.get('INFO_SMTP_PASSWORD', '')
print(f"   Length:                     {len(password)} chars")
print(f"   Has spaces:                 {'Yes' if ' ' in password else 'No'}")
print(f"   Contains special chars:     {'Yes' if any(c in password for c in '!@#$%^&*()') else 'No'}")
print(f"   First 3 chars:              {password[:3] if len(password) >= 3 else 'N/A'}")
print(f"   Last 3 chars:               {password[-3:] if len(password) >= 3 else 'N/A'}")

print("\n3. Verification Checklist:")
print("   ☐ App password is generated in Zoho Mail account")
print("   ☐ App password is enabled/active")
print("   ☐ SMTP access is enabled for this account")
print("   ☐ No 2FA blocking SMTP access")
print("   ☐ Firewall allows outbound 465/587")

print("\n4. Next Steps:")
print("   Please verify in Zoho Mail settings:")
print("   • Go to Settings → Accounts")
print("   • Check if info@mokshacollections.com can send via SMTP")
print("   • Verify app password is active")
print("   • If 2FA is enabled, ensure it's not blocking SMTP")
print("   • Try regenerating the app password and update .env")

print("\n" + "=" * 60)
