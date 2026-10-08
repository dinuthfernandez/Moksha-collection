import json
import threading
import time
from urllib import parse, request
from urllib.error import HTTPError

from ..config import get_settings


class ZohoMailClient:
    """Sends mail through Zoho Mail using a dedicated OAuth refresh token."""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        refresh_token: str,
        accounts_url: str,
        mail_api_url: str,
        from_email: str,
    ) -> None:
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token = refresh_token
        self.accounts_url = accounts_url.rstrip("/")
        self.mail_api_url = mail_api_url.rstrip("/")
        self.account_id = ""
        self.from_email = from_email
        self._access_token: str | None = None
        self._token_expires_at = 0.0
        self._token_lock = threading.Lock()

    def _read_json(self, req: request.Request, operation: str) -> dict:
        try:
            with request.urlopen(req, timeout=30) as response:
                body = response.read().decode("utf-8")
        except HTTPError as exc:
            details = exc.read().decode("utf-8", "replace") if exc.fp else ""
            raise RuntimeError(f"Zoho Mail {operation} failed with HTTP {exc.code}: {details[:500]}") from exc
        except Exception as exc:
            raise RuntimeError(f"Zoho Mail {operation} failed: {exc}") from exc

        try:
            return json.loads(body) if body else {}
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Zoho Mail returned invalid JSON during {operation}") from exc

    def _refresh_access_token(self) -> str:
        payload = parse.urlencode(
            {
                "grant_type": "refresh_token",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": self.refresh_token,
            }
        ).encode("utf-8")
        req = request.Request(
            f"{self.accounts_url}/oauth/v2/token",
            data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        data = self._read_json(req, "OAuth token refresh")
        access_token = data.get("access_token")
        if not access_token:
            raise RuntimeError(f"Zoho Mail OAuth response did not include an access token: {data.get('error', 'unknown error')}")

        self._access_token = access_token
        self._token_expires_at = time.time() + max(int(data.get("expires_in", 3600)) - 30, 30)
        return access_token

    def _get_access_token(self) -> str:
        if self._access_token and time.time() < self._token_expires_at:
            return self._access_token
        with self._token_lock:
            if not self._access_token or time.time() >= self._token_expires_at:
                return self._refresh_access_token()
            return self._access_token

    def _api_request(self, method: str, path: str, body: dict | None = None) -> dict:
        token = self._get_access_token()
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = request.Request(
            f"{self.mail_api_url}{path}",
            data=data,
            headers={
                "Authorization": f"Zoho-oauthtoken {token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method=method,
        )
        response = self._read_json(req, "API request")
        status = response.get("status")
        if isinstance(status, dict) and str(status.get("code")) not in {"200", "201"}:
            raise RuntimeError(f"Zoho Mail API rejected the request: {status.get('description', 'unknown error')}")
        return response

    def _resolve_account_id(self) -> str:
        response = self._api_request("GET", "/api/accounts")
        data = response.get("data", [])
        accounts = data if isinstance(data, list) else data.get("accounts", [])
        for account in accounts:
            addresses = [account.get("primaryEmailAddress"), account.get("mailboxAddress")]
            email_addresses = account.get("emailAddress", [])
            if isinstance(email_addresses, list):
                addresses.extend(
                    item.get("mailId") if isinstance(item, dict) else item for item in email_addresses
                )
            elif email_addresses:
                addresses.append(email_addresses)
            send_mail_details = account.get("sendMailDetails", [])
            if isinstance(send_mail_details, list):
                addresses.extend(
                    item.get("fromAddress") for item in send_mail_details if isinstance(item, dict)
                )

            if any(address and address.casefold() == self.from_email.casefold() for address in addresses) and account.get("accountId"):
                self.account_id = str(account["accountId"])
                return self.account_id

        raise RuntimeError(
            "The Zoho Mail OAuth account does not have the configured sender address as a mailbox "
            "or verified send-as address. Authorize the Mail OAuth app with the configured mailbox "
            "or configure its address as a verified sending address."
        )

    def send(self, to_email: str, subject: str, html: str, text: str | None = None) -> None:
        if not all([self.client_id, self.client_secret, self.refresh_token, self.from_email]):
            raise RuntimeError("Zoho Mail OAuth is not fully configured for the sender mailbox")

        is_html = bool(html)
        self._api_request(
            "POST",
            f"/api/accounts/{self._resolve_account_id()}/messages",
            {
                "fromAddress": self.from_email,
                "toAddress": to_email,
                "subject": subject,
                "content": html if is_html else (text or ""),
                "mailFormat": "html" if is_html else "plaintext",
                "encoding": "UTF-8",
            },
        )


_info_mail_client: ZohoMailClient | None = None
_info_mail_client_lock = threading.Lock()
_sales_mail_client: ZohoMailClient | None = None
_sales_mail_client_lock = threading.Lock()


def _get_info_mail_client() -> ZohoMailClient:
    global _info_mail_client
    if _info_mail_client is None:
        with _info_mail_client_lock:
            if _info_mail_client is None:
                settings = get_settings()
                _info_mail_client = ZohoMailClient(
                    settings.info_zoho_client_id,
                    settings.info_zoho_client_secret,
                    settings.info_zoho_refresh_token,
                    settings.info_zoho_accounts_url,
                    settings.info_zoho_mail_api_url,
                    settings.info_zoho_from_email,
                )
    return _info_mail_client


def _get_sales_mail_client() -> ZohoMailClient:
    global _sales_mail_client
    if _sales_mail_client is None:
        with _sales_mail_client_lock:
            if _sales_mail_client is None:
                settings = get_settings()
                _sales_mail_client = ZohoMailClient(
                    settings.sales_zoho_client_id,
                    settings.sales_zoho_client_secret,
                    settings.sales_zoho_refresh_token,
                    settings.sales_zoho_accounts_url,
                    settings.sales_zoho_mail_api_url,
                    settings.sales_zoho_from_email,
                )
    return _sales_mail_client


def send_info_email(to_email: str, subject: str, html: str, text: str | None = None) -> None:
    """Sends a transactional email (welcome, password reset) from info@ via Zoho Mail API."""
    _get_info_mail_client().send(to_email, subject, html, text)


def send_sales_email(to_email: str, subject: str, html: str, text: str | None = None) -> None:
    """Sends an order-lifecycle or campaign email from sales@ via Zoho Mail API."""
    _get_sales_mail_client().send(to_email, subject, html, text)


def send_campaign_email(
    to_email: str,
    subject: str,
    body: str,
    sender: str = "sales",
    first_name: str | None = None,
    cta_label: str | None = None,
    cta_url: str | None = None,
) -> None:
    """Branded marketing email sent from info@ or sales@ on the Campaigns page."""
    from .email_templates import render_campaign_email

    subject, html, text = render_campaign_email(subject, body, first_name, cta_label, cta_url)
    if sender == "info":
        send_info_email(to_email, subject, html, text)
    else:
        send_sales_email(to_email, subject, html, text)
