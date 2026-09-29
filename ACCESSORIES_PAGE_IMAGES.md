# Accessories Shop by Category Images

The Accessories landing page (`/accessories`) displays category cards. Category
names use the saved accessories list when database categories are not available;
API category records and images take precedence when present.

| Image | Source / path | Recommended dimensions | Aspect ratio |
|---|---|---:|---:|
| Azhak logo | `frontend/public/assets/logo/azhak-logo.png` (already copied) | Original transparent PNG | -- |
| Category card photo | Category `image_url` in the catalog database | **800 × 1000 px** | 4:5 |
| Product photo | Product `image_url` in the catalog database | **1000 × 1250 px** | 4:5 |

A missing category image uses a labeled placeholder. Product photos are used
on the category detail pages after a visitor opens a category.
