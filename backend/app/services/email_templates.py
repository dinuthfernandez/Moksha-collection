"""HTML email templates matching the Moksha Collections brand palette.

Kept table-based and inline-styled throughout for compatibility with real
inboxes (Gmail/Outlook/Zoho strip <style> blocks and external fonts), with a
Georgia/Inter fallback stack standing in for Playfair Display / Inter.
"""

from ..config import get_settings

ONYX = "#0e0a14"
WARM_WHITE = "#faf7f2"
MAGENTA = "#e10a8c"
CRYSTAL_SILVER = "#6b6570"
LINE = "#e7e2d9"


def _shell(preheader: str, body_html: str) -> str:
    settings = get_settings()
    return f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Moksha Collections</title>
  </head>
  <body style="margin:0;padding:0;background-color:{WARM_WHITE};font-family:'Inter',Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{WARM_WHITE};padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid {LINE};">
            <tr>
              <td style="background-color:{ONYX};padding:28px 32px;text-align:center;">
                <span style="font-family:Georgia,'Playfair Display',serif;font-size:26px;color:{MAGENTA};font-style:italic;">moksha</span>
                <span style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:{WARM_WHITE};letter-spacing:2px;text-transform:uppercase;display:block;margin-top:2px;">Collections</span>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px;color:#1a1420;font-size:15px;line-height:1.6;">
                {body_html}
              </td>
            </tr>
            <tr>
              <td style="background-color:{WARM_WHITE};padding:20px 32px;text-align:center;border-top:1px solid {LINE};">
                <p style="margin:0;font-size:12px;color:{CRYSTAL_SILVER};">
                  Moksha Collections &middot; Bahrain<br />
                  <a href="{settings.frontend_base_url}" style="color:{MAGENTA};text-decoration:none;">{settings.frontend_base_url.replace('https://', '').replace('http://', '')}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def _button(label: str, url: str) -> str:
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0;">
      <tr>
        <td style="border-radius:999px;background-color:{MAGENTA};">
          <a href="{url}" style="display:inline-block;padding:13px 28px;font-size:14px;color:#ffffff;text-decoration:none;font-weight:600;border-radius:999px;">{label}</a>
        </td>
      </tr>
    </table>"""


def render_welcome_email(first_name: str) -> tuple[str, str, str]:
    settings = get_settings()
    subject = "Welcome to Moksha Collections"
    body = f"""
      <h1 style="font-family:Georgia,'Playfair Display',serif;font-weight:400;font-size:22px;margin:0 0 16px;color:{ONYX};">Welcome, {first_name}.</h1>
      <p style="margin:0 0 16px;">Thank you for creating an account with Moksha Collections. Your account is ready — you can now save favourites to your wishlist, track your orders and check out faster next time.</p>
      {_button('Start Shopping', settings.frontend_base_url)}
      <p style="margin:20px 0 0;color:{CRYSTAL_SILVER};font-size:13px;">If you didn't create this account, please ignore this email.</p>
    """
    text = f"Welcome, {first_name}.\n\nThank you for creating an account with Moksha Collections. Start shopping: {settings.frontend_base_url}"
    return subject, _shell("Welcome to Moksha Collections", body), text


def render_password_reset_code_email(first_name: str, code: str, expires_minutes: int) -> tuple[str, str, str]:
    subject = "Your Moksha Collections password reset code"
    body = f"""
      <h1 style="font-family:Georgia,'Playfair Display',serif;font-weight:400;font-size:22px;margin:0 0 16px;color:{ONYX};">Reset your password</h1>
      <p style="margin:0 0 20px;">Hi {first_name}, use the code below to reset your password. It expires in {expires_minutes} minutes.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
        <tr>
          <td style="background-color:{WARM_WHITE};border:1px dashed {MAGENTA};border-radius:12px;padding:18px 34px;text-align:center;">
            <span style="font-family:Georgia,serif;font-size:32px;letter-spacing:10px;color:{ONYX};font-weight:700;">{code}</span>
          </td>
        </tr>
      </table>
      <p style="margin:0;color:{CRYSTAL_SILVER};font-size:13px;">If you didn't request a password reset, you can safely ignore this email — your password will not change.</p>
    """
    text = f"Hi {first_name}, your Moksha Collections password reset code is {code}. It expires in {expires_minutes} minutes."
    return subject, _shell("Your password reset code", body), text


def render_password_reset_done_email(first_name: str) -> tuple[str, str, str]:
    settings = get_settings()
    subject = "Your password has been reset"
    body = f"""
      <h1 style="font-family:Georgia,'Playfair Display',serif;font-weight:400;font-size:22px;margin:0 0 16px;color:{ONYX};">Password updated</h1>
      <p style="margin:0 0 16px;">Hi {first_name}, your Moksha Collections password was just reset successfully. You can now sign in with your new password.</p>
      {_button('Sign In', settings.frontend_base_url + '/login')}
      <p style="margin:20px 0 0;color:{CRYSTAL_SILVER};font-size:13px;">If you didn't make this change, please contact us immediately.</p>
    """
    text = "Your Moksha Collections password was just reset successfully. Sign in: " + settings.frontend_base_url + "/login"
    return subject, _shell("Your password has been reset", body), text


def _order_items_table(items: list[dict]) -> str:
    rows = "".join(
        f"""<tr>
          <td style="padding:10px 0;border-bottom:1px solid {LINE};font-size:14px;">{item.get('product_name') or 'Item'} &times; {item.get('quantity')}</td>
          <td style="padding:10px 0;border-bottom:1px solid {LINE};font-size:14px;text-align:right;">{float(item.get('price', 0)) * int(item.get('quantity', 1)):.3f} BHD</td>
        </tr>"""
        for item in items
    )
    return f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;">{rows}</table>"""


def render_order_placed_email(order: dict) -> tuple[str, str, str]:
    settings = get_settings()
    order_id = str(order.get("id", ""))
    subject = f"Order #{order_id[:8]} received — thank you!"
    body = f"""
      <h1 style="font-family:Georgia,'Playfair Display',serif;font-weight:400;font-size:22px;margin:0 0 16px;color:{ONYX};">Thank you for your order</h1>
      <p style="margin:0 0 16px;">Hi {order.get('customer_name', '')}, we've received your order <strong>#{order_id[:8]}</strong> and it's now pending confirmation.</p>
      {_order_items_table(order.get('items', []))}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr><td style="padding:4px 0;color:{CRYSTAL_SILVER};">Subtotal</td><td style="padding:4px 0;text-align:right;">{float(order.get('subtotal_amount', 0)):.3f} BHD</td></tr>
        {f"<tr><td style='padding:4px 0;color:{CRYSTAL_SILVER};'>Coupon ({order.get('coupon_name')})</td><td style='padding:4px 0;text-align:right;color:#16845b;'>−{float(order.get('discount_amount', 0)):.3f} BHD</td></tr>" if float(order.get('discount_amount', 0)) > 0 else ''}
        <tr><td style="padding:4px 0;color:{CRYSTAL_SILVER};">Delivery ({order.get('delivery_type', '')})</td><td style="padding:4px 0;text-align:right;">{float(order.get('delivery_charge', 0)):.3f} BHD</td></tr>
        <tr><td style="padding:8px 0;font-weight:700;border-top:1px solid {LINE};">Total</td><td style="padding:8px 0;text-align:right;font-weight:700;border-top:1px solid {LINE};">{float(order.get('total_amount', 0)):.3f} BHD</td></tr>
      </table>
      {_button('View My Orders', settings.frontend_base_url + '/orders')}
    """
    text = f"Thank you for your order #{order_id[:8]}. Total: {float(order.get('total_amount', 0)):.3f} BHD."
    return subject, _shell("Your order has been received", body), text


def render_order_completed_email(order: dict) -> tuple[str, str, str]:
    settings = get_settings()
    order_id = str(order.get("id", ""))
    subject = f"Your order #{order_id[:8]} has been delivered"
    body = f"""
      <h1 style="font-family:Georgia,'Playfair Display',serif;font-weight:400;font-size:22px;margin:0 0 16px;color:{ONYX};">Delivered!</h1>
      <p style="margin:0 0 16px;">Hi {order.get('customer_name', '')}, your order <strong>#{order_id[:8]}</strong> has been marked as delivered. We hope you love it.</p>
      {_order_items_table(order.get('items', []))}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr><td style="padding:8px 0;font-weight:700;border-top:1px solid {LINE};">Total</td><td style="padding:8px 0;text-align:right;font-weight:700;border-top:1px solid {LINE};">{float(order.get('total_amount', 0)):.3f} BHD</td></tr>
      </table>
      <p style="margin:16px 0 0;color:{CRYSTAL_SILVER};font-size:13px;">Changed your mind? You can request a return from your Orders page within the return window.</p>
      {_button('View My Orders', settings.frontend_base_url + '/orders')}
    """
    text = f"Your order #{order_id[:8]} has been delivered. Total: {float(order.get('total_amount', 0)):.3f} BHD."
    return subject, _shell("Your order has been delivered", body), text
