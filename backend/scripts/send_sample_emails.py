"""One-off script to send the 3 info@ email template samples to a test inbox for review.

Usage (from backend/, with .venv active):
    python scripts/send_sample_emails.py you@example.com
"""

import sys

sys.path.insert(0, ".")

from app.services.email import send_info_email  # noqa: E402
from app.services.email_templates import (  # noqa: E402
    render_password_reset_code_email,
    render_password_reset_done_email,
    render_welcome_email,
)


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python scripts/send_sample_emails.py <recipient-email>")
        raise SystemExit(1)

    to_email = sys.argv[1]
    first_name = "Fdo"

    templates = [
        render_welcome_email(first_name),
        render_password_reset_code_email(first_name, "482913", 15),
        render_password_reset_done_email(first_name),
    ]

    for subject, html, text in templates:
        send_info_email(to_email, f"[SAMPLE] {subject}", html, text)
        print(f"Sent: {subject}")


if __name__ == "__main__":
    main()
