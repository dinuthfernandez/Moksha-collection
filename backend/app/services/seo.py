"""Server-side SEO: per-route <head> tags, JSON-LD, crawlable content, sitemap, robots and llms.txt.

The storefront is a React SPA served by this FastAPI app. Search engines and AI
crawlers often do not run JavaScript, so every HTML response is enriched here
with the correct title/description/canonical/Open Graph/JSON-LD and a plain
HTML copy of the page's key content.
"""
from __future__ import annotations

import json
import re
from html import escape
from typing import Any

from ..config import get_settings
from ..database import get_supabase
from .cache import cached

BRAND = "Moksha Collections"
PHONE = "+97335521619"
EMAIL = "info@mokshacollections.com"
ADDRESS = {
    "@type": "PostalAddress",
    "streetAddress": "Shop No 55, Building 106, Sugaya Avenue, Saqiyyaah 0328",
    "addressLocality": "Manama",
    "addressCountry": "BH",
}
SOCIALS = [
    "https://www.instagram.com/_moksha_collections_",
    "https://www.facebook.com/share/1BGpC8tNvM/",
    "https://www.tiktok.com/@moksha.collections",
]
OG_IMAGE_PATH = "/assets/hero/DSC_5738.jpg.jpeg"
LOGO_PATH = "/assets/logo/logo.png"

HOME_TITLE = "Indian Dresses, Sarees & Accessories Store in Bahrain | Moksha Collections"
HOME_DESC = (
    "Moksha Collections is an Indian clothing store in Manama, Bahrain. Shop kurtis, sarees, kaftans, "
    "frocks, set mundu, pavada, dupattas, bangles, earrings and more. Online ordering and delivery across Bahrain."
)
KEYWORDS = (
    "Indian dress Bahrain, Indian clothing store Bahrain, Indian ethnic wear Bahrain, saree shop Bahrain, "
    "kurti Bahrain, Kerala dress Bahrain, set mundu Bahrain, kaftan Bahrain, Indian accessories Bahrain, "
    "bangles Bahrain, Manama boutique, online clothing store Bahrain"
)

STATIC_PAGES: dict[str, dict[str, str]] = {
    "/": {"title": HOME_TITLE, "desc": HOME_DESC, "h1": "Indian Dresses, Sarees & Accessories in Bahrain"},
    "/clothing": {
        "title": "Indian Clothing in Bahrain - Kurti, Kaftan, Frock, Set Mundu | Moksha Collections",
        "desc": "Shop Indian women's and kids' clothing in Bahrain: tops, kurtis, kaftans, frocks, 2 & 3 piece sets, "
        "pavada, set mundu, dupattas and more from Moksha Collections, Manama.",
        "h1": "Indian Clothing Store in Bahrain",
    },
    "/saree": {
        "title": "Sarees & Set Sarees in Bahrain | Buy Indian Saree Online - Moksha Collections",
        "desc": "Buy sarees and set sarees online in Bahrain. Festive, wedding and everyday Indian sarees "
        "from Moksha Collections, Manama, with delivery across Bahrain.",
        "h1": "Sarees in Bahrain",
    },
    "/accessories": {
        "title": "Indian Accessories in Bahrain - Bangles, Earrings, Necklaces | Moksha Collections",
        "desc": "Indian fashion accessories in Bahrain: bangles, glass bangles, earrings, studs, necklaces and "
        "bracelets. Shop online from Moksha Collections, Manama.",
        "h1": "Indian Accessories in Bahrain",
    },
    "/categories": {
        "title": "Shop by Category - Indian Clothing, Sarees & Accessories | Moksha Collections Bahrain",
        "desc": "Browse every Moksha Collections category: clothing, sarees and accessories for women and kids in Bahrain.",
        "h1": "Shop by Category",
    },
    "/size-charts": {
        "title": "Size Charts - Find Your Fit | Moksha Collections Bahrain",
        "desc": "Size charts for kurtis, tops, frocks, kids wear and more at Moksha Collections, Bahrain.",
        "h1": "Size Charts",
    },
    "/about-us": {
        "title": "About Us - Indian Fashion Boutique in Manama, Bahrain | Moksha Collections",
        "desc": "Moksha Collections is a Manama-based Indian fashion boutique offering curated dresses, sarees and "
        "accessories with personal concierge service on WhatsApp.",
        "h1": "About Moksha Collections",
    },
    "/contact-us": {
        "title": "Contact Us - Moksha Collections, Manama, Bahrain",
        "desc": "Visit Moksha Collections at Shop 55, Building 106, Sugaya Avenue, Saqiyyaah, Manama, or message "
        "us on WhatsApp +973 3552 1619.",
        "h1": "Contact Moksha Collections",
    },
    "/policies": {
        "title": "Return, Exchange & Privacy Policies | Moksha Collections Bahrain",
        "desc": "Return, exchange, refund, shipping and privacy policies for orders from Moksha Collections, Bahrain.",
        "h1": "Policies",
    },
}

NOINDEX_PREFIXES = (
    "/cart", "/login", "/register", "/forgot-password", "/reset-password", "/account", "/addresses",
    "/wishlist", "/orders", "/checkout", "/delivery", "/search", "/mokshacollectionadminpanel",
    "/noonecanfindthisonlyfordinuth",
)
ROOT_TYPES = ("clothing", "accessories", "saree")
TYPE_LABEL = {"clothing": "Clothing", "accessories": "Accessories", "saree": "Saree"}

FAQ = [
    ("Where is Moksha Collections located?",
     "Moksha Collections is an Indian clothing and accessories boutique at Shop No 55, Building 106, "
     "Sugaya Avenue, Saqiyyaah 0328, Manama, Kingdom of Bahrain."),
    ("What does Moksha Collections sell?",
     "Indian and Kerala-style dresses for women and kids (kurtis, tops, kaftans, frocks, 2 and 3 piece sets, "
     "pavada, set mundu, dupattas, pants), sarees and set sarees, and accessories such as bangles, "
     "glass bangles, earrings, studs, necklaces and bracelets."),
    ("Do you deliver across Bahrain?",
     "Yes. You can order online at mokshacollections.com and we deliver across the Kingdom of Bahrain."),
    ("How can I contact Moksha Collections?",
     "Message our concierge on WhatsApp at +973 3552 1619, email info@mokshacollections.com, or visit the "
     "Manama shop."),
    ("What currency are prices in?",
     "All prices are in Bahraini Dinar (BHD)."),
    ("Can I return or exchange an item?",
     "Faulty, damaged, incorrect or misdescribed items can be returned within 15 days of delivery. "
     "Change-of-mind purchases can be exchanged or credited. See the policies page for full details."),
]


def base_url() -> str:
    return get_settings().frontend_base_url.rstrip("/")


def _abs(path: str) -> str:
    return path if path.startswith("http") else f"{base_url()}{path}"


def _categories() -> list[dict[str, Any]]:
    def load():
        return (
            get_supabase().table("categories").select("name,slug,type,image_url,display_order")
            .eq("is_active", True).order("display_order").execute().data or []
        )

    return cached("seo:categories", 600, load)


def _product_rows() -> list[dict[str, Any]]:
    def load():
        rows: list[dict[str, Any]] = []
        offset = 0
        while True:
            batch = (
                get_supabase().table("products")
                .select("slug,name,created_at,last_synced_at")
                .eq("is_active", True).eq("is_primary_variant", True)
                .order("slug").range(offset, offset + 999).execute().data or []
            )
            rows.extend(batch)
            if len(batch) < 1000:
                break
            offset += 1000
        return rows

    return cached("seo:products", 900, load)


def _product(slug: str) -> dict[str, Any] | None:
    def load():
        rows = get_supabase().table("products").select("*").eq("slug", slug).limit(1).execute().data
        return rows[0] if rows else None

    return cached(f"seo:product:{slug}", 600, load)


def _title_case(slug: str) -> str:
    return " ".join(p.capitalize() for p in slug.split("-"))


def _clean(text: str | None, limit: int = 300) -> str:
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text or "")).strip()
    return text if len(text) <= limit else text[: limit - 1].rsplit(" ", 1)[0] + "…"


def _organization() -> dict[str, Any]:
    return {
        "@context": "https://schema.org",
        "@type": ["ClothingStore", "LocalBusiness"],
        "@id": f"{base_url()}/#organization",
        "name": BRAND,
        "alternateName": ["Moksha Collection", "Moksha Collections Bahrain"],
        "url": base_url() + "/",
        "logo": _abs(LOGO_PATH),
        "image": _abs(OG_IMAGE_PATH),
        "description": HOME_DESC,
        "telephone": PHONE,
        "email": EMAIL,
        "address": ADDRESS,
        "areaServed": [{"@type": "Country", "name": "Bahrain"}, {"@type": "City", "name": "Manama"}],
        "priceRange": "BHD",
        "currenciesAccepted": "BHD",
        "knowsAbout": [
            "Indian clothing", "Sarees", "Kurtis", "Kaftans", "Kerala set mundu", "Indian accessories", "Bangles",
        ],
        "sameAs": SOCIALS,
        "contactPoint": [{
            "@type": "ContactPoint", "telephone": PHONE, "email": EMAIL,
            "contactType": "customer service", "areaServed": "BH", "availableLanguage": ["English", "Malayalam", "Hindi", "Arabic"],
        }],
    }


def _website() -> dict[str, Any]:
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": f"{base_url()}/#website",
        "url": base_url() + "/",
        "name": BRAND,
        "publisher": {"@id": f"{base_url()}/#organization"},
        "inLanguage": "en",
        "potentialAction": {
            "@type": "SearchAction",
            "target": {"@type": "EntryPoint", "urlTemplate": f"{base_url()}/search?q={{search_term_string}}"},
            "query-input": "required name=search_term_string",
        },
    }


def _faq() -> dict[str, Any]:
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ
        ],
    }


def _breadcrumb(items: list[tuple[str, str]]) -> dict[str, Any]:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i, "name": name, "item": _abs(path)}
            for i, (name, path) in enumerate(items, 1)
        ],
    }


def _nav_links_html() -> str:
    links = [("Home", "/"), ("Clothing", "/clothing"), ("Saree", "/saree"), ("Accessories", "/accessories"),
             ("Shop by Category", "/categories"), ("Size Charts", "/size-charts"), ("About Us", "/about-us"),
             ("Contact Us", "/contact-us"), ("Policies", "/policies")]
    return "<nav aria-label='Main'><ul>" + "".join(
        f"<li><a href='{escape(p)}'>{escape(n)}</a></li>" for n, p in links
    ) + "</ul></nav>"


def _category_links_html(type_: str | None = None) -> str:
    cats = [c for c in _categories() if not type_ or c["type"] == type_]
    return "<ul>" + "".join(
        f"<li><a href='/{c['type']}/{escape(c['slug'])}'>{escape(c['name'])}</a></li>" for c in cats
    ) + "</ul>"


def resolve(path: str) -> dict[str, Any]:
    """Return {status, title, desc, canonical, noindex, h1, body, jsonld, og_type, image} for a URL path."""
    path = "/" + path.strip("/")
    page: dict[str, Any] = {
        "status": 200, "noindex": False, "og_type": "website", "image": _abs(OG_IMAGE_PATH),
        "canonical": _abs(path if path != "/" else "/"), "jsonld": [], "body": "",
    }

    if path.startswith(NOINDEX_PREFIXES):
        page.update(title=f"{BRAND} - Bahrain", desc=HOME_DESC, h1=BRAND, noindex=True)
        return page

    if path in STATIC_PAGES:
        meta = STATIC_PAGES[path]
        page.update(title=meta["title"], desc=meta["desc"], h1=meta["h1"])
        crumbs = [("Home", "/")] + ([(meta["h1"], path)] if path != "/" else [])
        page["jsonld"].append(_breadcrumb(crumbs))
        body = f"<h1>{escape(meta['h1'])}</h1><p>{escape(meta['desc'])}</p>"
        if path == "/":
            page["jsonld"] += [_organization(), _website(), _faq()]
            body += (
                "<p>Moksha Collections is an Indian dress and accessories store in Manama, Bahrain, with online "
                "ordering and delivery across Bahrain. Shop women's and kids' clothing, sarees and accessories.</p>"
                "<h2>Shop Indian Clothing</h2>" + _category_links_html("clothing")
                + "<h2>Shop Sarees</h2>" + _category_links_html("saree")
                + "<h2>Shop Accessories</h2>" + _category_links_html("accessories")
                + "<h2>Visit Us</h2><p>Shop No 55, Building 106, Sugaya Avenue, Saqiyyaah 0328, Manama, Bahrain. "
                "WhatsApp +973 3552 1619.</p><h2>Frequently Asked Questions</h2>"
                + "".join(f"<h3>{escape(q)}</h3><p>{escape(a)}</p>" for q, a in FAQ)
            )
        elif path in ("/clothing", "/saree", "/accessories"):
            t = path[1:]
            body += "<h2>Categories</h2>" + _category_links_html(t)
            page["jsonld"].append({
                "@context": "https://schema.org", "@type": "CollectionPage", "name": meta["h1"],
                "url": _abs(path), "isPartOf": {"@id": f"{base_url()}/#website"},
            })
        elif path == "/categories":
            for t in ROOT_TYPES:
                body += f"<h2>{TYPE_LABEL[t]}</h2>" + _category_links_html(t)
        elif path == "/contact-us":
            body += ("<p>Shop No 55, Building 106, Sugaya Avenue, Saqiyyaah 0328, Manama, Kingdom of Bahrain. "
                     f"Phone/WhatsApp {PHONE}. Email {EMAIL}.</p>")
            page["jsonld"].append(_organization())
        page["body"] = body + _nav_links_html()
        return page

    parts = path.strip("/").split("/")
    if len(parts) == 2 and parts[0] in ROOT_TYPES:
        cat = next((c for c in _categories() if c["slug"] == parts[1] and c["type"] == parts[0]), None)
        if not cat:
            page.update(status=404, noindex=True, title=f"Page not found | {BRAND}", desc=HOME_DESC, h1="Page not found")
            return page
        name = cat["name"]
        root = TYPE_LABEL[parts[0]]
        page.update(
            title=f"{name} in Bahrain - Buy Indian {name} Online | Moksha Collections",
            desc=f"Shop {name.lower()} in Bahrain at Moksha Collections, Manama. Indian {root.lower()} "
                 f"with fast delivery across Bahrain. Order online or on WhatsApp.",
            h1=f"{name} in Bahrain",
        )
        if cat.get("image_url"):
            page["image"] = _abs(cat["image_url"])
        page["jsonld"].append(_breadcrumb([("Home", "/"), (root, f"/{parts[0]}"), (name, path)]))
        page["jsonld"].append({
            "@context": "https://schema.org", "@type": "CollectionPage", "name": f"{name} - {BRAND}",
            "url": _abs(path), "isPartOf": {"@id": f"{base_url()}/#website"},
        })
        page["body"] = (f"<h1>{escape(page['h1'])}</h1><p>{escape(page['desc'])}</p>"
                        f"<h2>More {escape(root)} categories</h2>{_category_links_html(parts[0])}" + _nav_links_html())
        return page

    if len(parts) == 2 and parts[0] == "product":
        product = _product(parts[1])
        if not product or not product.get("is_active"):
            page.update(status=404, noindex=True, title=f"Page not found | {BRAND}", desc=HOME_DESC, h1="Page not found")
            return page
        name = product["name"]
        desc = _clean(product.get("description")) or f"{name} from Moksha Collections, Manama, Bahrain."
        page.update(
            title=f"{name} - Buy Online in Bahrain | Moksha Collections",
            desc=_clean(f"Buy {name} online in Bahrain. {desc}", 158),
            h1=name, og_type="product",
        )
        if product.get("image_url"):
            page["image"] = _abs(product["image_url"])
        root = product.get("category_slug") if product.get("category_slug") in ROOT_TYPES else "clothing"
        crumbs = [("Home", "/"), (TYPE_LABEL[root], f"/{root}")]
        if product.get("subcategory_slug") and product.get("subcategory_name"):
            crumbs.append((product["subcategory_name"], f"/{root}/{product['subcategory_slug']}"))
        crumbs.append((name, path))
        page["jsonld"].append(_breadcrumb(crumbs))
        in_stock = (product.get("stock_quantity") or 0) > 0
        offer = {
            "@type": "Offer", "url": _abs(path), "priceCurrency": "BHD", "price": f"{float(product.get('price') or 0):.3f}",
            "availability": "https://schema.org/InStock" if in_stock else "https://schema.org/OutOfStock",
            "itemCondition": "https://schema.org/NewCondition", "seller": {"@id": f"{base_url()}/#organization"},
        }
        item: dict[str, Any] = {
            "@context": "https://schema.org", "@type": "Product", "name": name, "description": desc,
            "sku": product.get("zoho_sku") or product.get("slug"), "brand": {"@type": "Brand", "name": product.get("brand") or "MC"},
            "category": product.get("subcategory_name") or root, "offers": offer, "url": _abs(path),
        }
        if product.get("color"):
            item["color"] = product["color"]
        if product.get("image_url"):
            item["image"] = [_abs(product["image_url"])]
        page["jsonld"].append(item)
        page["body"] = (f"<h1>{escape(name)}</h1><p>{escape(desc)}</p><p>Price: BHD {float(product.get('price') or 0):.3f}. "
                        f"{'In stock' if in_stock else 'Out of stock'}.</p>" + _nav_links_html())
        return page

    page.update(status=404, noindex=True, title=f"Page not found | {BRAND}", desc=HOME_DESC, h1="Page not found")
    return page


def render_head(page: dict[str, Any]) -> str:
    t, d, c = escape(page["title"]), escape(page["desc"], quote=True), escape(page["canonical"], quote=True)
    robots = "noindex, nofollow" if page["noindex"] else "index, follow, max-image-preview:large, max-snippet:-1"
    tags = [
        f"<title>{t}</title>",
        f'<meta name="description" content="{d}" />',
        f'<meta name="robots" content="{robots}" />',
        f'<link rel="canonical" href="{c}" />',
        f'<meta property="og:site_name" content="{BRAND}" />',
        f'<meta property="og:type" content="{page["og_type"]}" />',
        f'<meta property="og:title" content="{t}" />',
        f'<meta property="og:description" content="{d}" />',
        f'<meta property="og:url" content="{c}" />',
        f'<meta property="og:image" content="{escape(page["image"], quote=True)}" />',
        '<meta property="og:locale" content="en_US" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        f'<meta name="twitter:title" content="{t}" />',
        f'<meta name="twitter:description" content="{d}" />',
        f'<meta name="twitter:image" content="{escape(page["image"], quote=True)}" />',
        '<meta name="geo.region" content="BH-13" /><meta name="geo.placename" content="Manama" />',
        f'<meta name="keywords" content="{escape(KEYWORDS, quote=True)}" />',
        '<meta name="author" content="Moksha Collections" />',
        f'<link rel="alternate" type="text/plain" href="{base_url()}/llms.txt" title="LLM-readable summary" />',
    ]
    for block in page["jsonld"]:
        payload = json.dumps(block, ensure_ascii=False).replace("</", "<\\/")
        tags.append(f'<script type="application/ld+json">{payload}</script>')
    return "\n    ".join(tags)


_HEAD_STRIP = re.compile(r"<title>.*?</title>|<meta\s+name=\"description\"[^>]*>", re.S | re.I)


def inject(html: str, page: dict[str, Any]) -> str:
    html = _HEAD_STRIP.sub("", html)
    html = html.replace("</head>", f"    {render_head(page)}\n  </head>", 1)
    if page["body"]:
        html = html.replace('<div id="root"></div>', f'<div id="root"><div id="seo-content">{page["body"]}</div></div>', 1)
    return html


def sitemap_xml() -> str:
    urls: list[tuple[str, str, str, str | None]] = []
    for p in STATIC_PAGES:
        urls.append((p, "daily" if p == "/" else "weekly", "1.0" if p == "/" else "0.8", None))
    for c in _categories():
        urls.append((f"/{c['type']}/{c['slug']}", "daily", "0.7", None))
    for r in _product_rows():
        lastmod = (r.get("last_synced_at") or r.get("created_at") or "")[:10] or None
        urls.append((f"/product/{r['slug']}", "weekly", "0.5", lastmod))
    out = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, freq, prio, lastmod in urls:
        out.append(
            f"<url><loc>{escape(_abs(path))}</loc>" + (f"<lastmod>{lastmod}</lastmod>" if lastmod else "")
            + f"<changefreq>{freq}</changefreq><priority>{prio}</priority></url>"
        )
    out.append("</urlset>")
    return "\n".join(out)


def robots_txt() -> str:
    disallow = "\n".join(f"Disallow: {p}" for p in ("/api/", *NOINDEX_PREFIXES))
    ai_bots = ("GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-Web", "anthropic-ai", "PerplexityBot",
               "Google-Extended", "Applebot-Extended", "CCBot", "Bingbot", "Amazonbot", "cohere-ai", "Meta-ExternalAgent")
    allowed = "\n\n".join(f"User-agent: {b}\nAllow: /\n{disallow}" for b in ai_bots)
    return f"User-agent: *\nAllow: /\n{disallow}\n\n{allowed}\n\nSitemap: {base_url()}/sitemap.xml\n"


def llms_txt() -> str:
    cats = _categories()
    lines = [
        f"# {BRAND}",
        "",
        f"> {BRAND} is an Indian clothing, saree and fashion-accessories store located in Manama, Kingdom of Bahrain, "
        "with online shopping and delivery across Bahrain. Prices are in Bahraini Dinar (BHD).",
        "",
        "## Business facts",
        f"- Website: {base_url()}/",
        "- Type: Indian ethnic wear boutique and online store (women's and kids' clothing, sarees, accessories)",
        "- Address: Shop No 55, Building 106, Sugaya Avenue, Saqiyyaah 0328, Manama, Kingdom of Bahrain",
        f"- Phone / WhatsApp: {PHONE}",
        f"- Email: {EMAIL}",
        "- Instagram: https://www.instagram.com/_moksha_collections_",
        "- Facebook: https://www.facebook.com/share/1BGpC8tNvM/",
        "- TikTok: https://www.tiktok.com/@moksha.collections",
        "- Delivery area: Bahrain",
        "- Returns: faulty/damaged/incorrect items within 15 days; exchanges and credit notes for change of mind",
        "",
        "## Main sections",
    ]
    for t in ROOT_TYPES:
        lines.append(f"- [{TYPE_LABEL[t]}]({base_url()}/{t})")
    for t in ROOT_TYPES:
        lines += ["", f"## {TYPE_LABEL[t]} categories"]
        lines += [f"- [{c['name']}]({base_url()}/{t}/{c['slug']})" for c in cats if c["type"] == t]
    lines += [
        "", "## Pages",
        f"- [About us]({base_url()}/about-us)", f"- [Contact us]({base_url()}/contact-us)",
        f"- [Size charts]({base_url()}/size-charts)", f"- [Policies]({base_url()}/policies)",
        f"- [Sitemap]({base_url()}/sitemap.xml)", "", "## FAQ",
    ]
    for q, a in FAQ:
        lines += [f"- **{q}** {a}"]
    return "\n".join(lines) + "\n"
