type SeoMetadata = {
  title: string;
  description: string;
  canonical: string;
  robots?: string;
  image?: string;
};

export const SELLIFY_CANONICAL_ORIGIN = (
  import.meta.env.VITE_SELLIFY_SITE_ORIGIN || 'https://sellifyai.sale'
).replace(/\/+$/, '');

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

export function setSeoMetadata({
  title,
  description,
  canonical,
  robots = 'index, follow',
  image,
}: SeoMetadata) {
  document.title = title;
  setMeta('name', 'description', description);
  setMeta('name', 'robots', robots);
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', canonical);
  setMeta('property', 'og:type', 'website');
  setMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);

  let canonicalLink = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.rel = 'canonical';
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.href = canonical;

  if (image) {
    setMeta('property', 'og:image', image);
    setMeta('name', 'twitter:image', image);
  } else {
    document.head
      .querySelector('meta[property="og:image"]')
      ?.remove();
    document.head.querySelector('meta[name="twitter:image"]')?.remove();
  }
}