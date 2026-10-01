import json
import unittest
from unittest.mock import patch

from app.services.email import ZohoMailClient, send_info_email


class FakeResponse:
    def __init__(self, body: dict):
        self.body = json.dumps(body).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def read(self) -> bytes:
        return self.body


class ZohoMailClientTests(unittest.TestCase):
    @patch("app.services.email._get_info_mail_client")
    def test_info_transactional_email_uses_its_oauth_client(self, get_info_client):
        send_info_email("customer@example.com", "Welcome", "<p>Hello</p>", "Hello")

        get_info_client.return_value.send.assert_called_once_with(
            "customer@example.com", "Welcome", "<p>Hello</p>", "Hello"
        )

    def test_sends_using_dedicated_oauth_credentials_and_sales_account(self):
        client = ZohoMailClient(
            "mail-client-id",
            "mail-client-secret",
            "mail-refresh-token",
            "https://accounts.zoho.com",
            "https://mail.zoho.com",
            "sales@mokshacollections.com",
        )
        responses = [
            {"access_token": "access-token", "expires_in": 3600},
            {
                "status": {"code": 200},
                "data": {
                    "accounts": [
                        {
                            "accountId": "mail-account-id",
                            "emailAddress": [
                                {"mailId": "sales@mokshacollections.com", "isPrimary": True}
                            ],
                        }
                    ]
                },
            },
            {"status": {"code": 200, "description": "success"}, "data": {}},
        ]
        requests = []

        def fake_urlopen(req, timeout):
            requests.append(req)
            return FakeResponse(responses.pop(0))

        with patch("app.services.email.request.urlopen", side_effect=fake_urlopen):
            client.send("customer@example.com", "Welcome", "<p>Hello</p>", "Hello")

        self.assertEqual(len(requests), 3)
        self.assertEqual(requests[0].full_url, "https://accounts.zoho.com/oauth/v2/token")
        self.assertEqual(requests[1].full_url, "https://mail.zoho.com/api/accounts")
        self.assertEqual(
            requests[2].full_url,
            "https://mail.zoho.com/api/accounts/mail-account-id/messages",
        )
        self.assertEqual(requests[2].get_header("Authorization"), "Zoho-oauthtoken access-token")
        body = json.loads(requests[2].data)
        self.assertEqual(body["fromAddress"], "sales@mokshacollections.com")
        self.assertEqual(body["toAddress"], "customer@example.com")
        self.assertEqual(body["content"], "<p>Hello</p>")
        self.assertEqual(body["mailFormat"], "html")

    def test_refuses_to_send_when_oauth_account_does_not_have_sales_sender(self):
        client = ZohoMailClient(
            "mail-client-id",
            "mail-client-secret",
            "mail-refresh-token",
            "https://accounts.zoho.com",
            "https://mail.zoho.com",
            "sales@mokshacollections.com",
        )
        responses = [
            {"access_token": "access-token", "expires_in": 3600},
            {
                "status": {"code": 200},
                "data": {
                    "accounts": [
                        {
                            "accountId": "sales-account-id",
                            "primaryEmailAddress": "info@mokshacollections.com",
                            "emailAddress": [
                                {"mailId": "info@mokshacollections.com", "isPrimary": True}
                            ],
                            "sendMailDetails": [
                                {"fromAddress": "info@mokshacollections.com", "status": True}
                            ],
                        }
                    ]
                },
            },
        ]
        requests = []

        def fake_urlopen(req, timeout):
            requests.append(req)
            return FakeResponse(responses.pop(0))

        with patch("app.services.email.request.urlopen", side_effect=fake_urlopen):
            with self.assertRaisesRegex(RuntimeError, "does not have the configured sender address"):
                client.send("customer@example.com", "Order update", "<p>Your order was updated</p>")

        self.assertEqual(len(requests), 2)


if __name__ == "__main__":
    unittest.main()