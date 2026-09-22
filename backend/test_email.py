#!/usr/bin/env python
"""Test email sending via Zoho Mail with app password."""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
import sys

# Load .env
env_path = Path(__file__).parent / '.env'
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

# Email config
smtp_host = os.getenv('INFO_SMTP_HOST', 'smtp.zoho.com')
smtp_port = int(os.getenv('INFO_SMTP_PORT', 465))
smtp_username = os.getenv('INFO_SMTP_USERNAME')
smtp_password = os.getenv('INFO_SMTP_PASSWORD')
from_email = os.getenv('INFO_SMTP_FROM_EMAIL')
from_name = os.getenv('INFO_SMTP_FROM_NAME', 'Moksha Collections')

to_email = 'fdodinuth@gmail.com'

print(f"Testing email configuration:")
print(f"  SMTP Host: {smtp_host}")
print(f"  SMTP Port: {smtp_port}")
print(f"  Username: {smtp_username}")
print(f"  From: {from_name} <{from_email}>")
print(f"  To: {to_email}")
print()

def try_connection(host, port, use_tls=False, use_ssl=True):
    """Try to connect with different SMTP settings."""
    print(f"\nTrying {host}:{port} (TLS={use_tls}, SSL={use_ssl})...")
    try:
        if use_ssl and port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=10)
            print("  Connected with SSL")
        else:
            server = smtplib.SMTP(host, port, timeout=10)
            print("  Connected")
            if use_tls:
                server.starttls()
                print("  TLS enabled")
        
        print(f"  Logging in as {smtp_username}...")
        server.login(smtp_username, smtp_password)
        print("  ✓ Login successful!")
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'Test Email - Moksha Collections'
        msg['From'] = f'{from_name} <{from_email}>'
        msg['To'] = to_email
        
        text = """\
Hello,

This is a test email to verify Zoho Mail SMTP configuration.

If you received this, the email delivery is working correctly!

Best regards,
Moksha Collections Team
"""
        
        html = """\
<html>
  <body>
    <p>Hello,</p>
    <p>This is a <strong>test email</strong> to verify Zoho Mail SMTP configuration.</p>
    <p>If you received this, the email delivery is working correctly!</p>
    <p>Best regards,<br>Moksha Collections Team</p>
  </body>
</html>
"""
        
        part1 = MIMEText(text, 'plain')
        part2 = MIMEText(html, 'html')
        msg.attach(part1)
        msg.attach(part2)
        
        # Send email
        print(f"  Sending email to {to_email}...")
        server.send_message(msg)
        print(f"  ✓ Email sent successfully!")
        
        server.quit()
        print("  Connection closed.")
        return True

    except smtplib.SMTPAuthenticationError as e:
        print(f"  ✗ Authentication failed: {e}")
        return False
    except smtplib.SMTPException as e:
        print(f"  ✗ SMTP error: {e}")
        return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

# Try different configurations
# Try 1: SSL on 465 (original config)
if try_connection(smtp_host, 465, use_tls=False, use_ssl=True):
    sys.exit(0)

# Try 2: TLS on 587
if try_connection(smtp_host, 587, use_tls=True, use_ssl=False):
    sys.exit(0)

print("\n✗ All connection attempts failed.")
print("\nTroubleshooting tips:")
print("  1. Verify app password is enabled in Zoho Mail settings")
print("  2. Check if 2FA is enabled (may require separate app password)")
print("  3. Ensure the email account has SMTP access enabled")
print("  4. Check firewall/antivirus isn't blocking port 465 or 587")
sys.exit(1)

