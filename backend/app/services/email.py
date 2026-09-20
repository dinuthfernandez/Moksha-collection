import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from ..config import get_settings


def _send(
    host: str,
    port: int,
    username: str,
    password: str,
    from_email: str,
    from_name: str,
    to_email: str,
    subject: str,
    html: str,
    text: str | None = None,
) -> None:
    if not all([host, username, password, from_email]):
        raise RuntimeError("SMTP is not configured for this mailbox")

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"{from_name} <{from_email}>"
    message["To"] = to_email
    message.attach(MIMEText(text or "", "plain", "utf-8"))
    message.attach(MIMEText(html, "html", "utf-8"))

    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=20) as server:
            server.login(username, password)
            server.sendmail(from_email, [to_email], message.as_string())
    else:
        with smtplib.SMTP(host, port, timeout=20) as server:
            server.starttls()
            server.login(username, password)
            server.sendmail(from_email, [to_email], message.as_string())


def send_info_email(to_email: str, subject: str, html: str, text: str | None = None) -> None:
    """Sends a transactional email (welcome, password reset) from info@."""
    settings = get_settings()
    _send(
        settings.info_smtp_host,
        settings.info_smtp_port,
        settings.info_smtp_username,
        settings.info_smtp_password,
        settings.info_smtp_from_email,
        settings.info_smtp_from_name,
        to_email,
        subject,
        html,
        text,
    )


def send_sales_email(to_email: str, subject: str, html: str, text: str | None = None) -> None:
    """Sends an order-lifecycle or campaign email from sales@."""
    settings = get_settings()
    _send(
        settings.sales_smtp_host,
        settings.sales_smtp_port,
        settings.sales_smtp_username,
        settings.sales_smtp_password,
        settings.sales_smtp_from_email,
        settings.sales_smtp_from_name,
        to_email,
        subject,
        html,
        text,
    )


def send_campaign_email(to_email: str, subject: str, body: str) -> None:
    """Plain-text marketing email sent from sales@ to a customer on the Campaigns page."""
    html = f"<html><body style=\"font-family:sans-serif;white-space:pre-wrap;\">{body}</body></html>"
    send_sales_email(to_email, subject, html, body)
