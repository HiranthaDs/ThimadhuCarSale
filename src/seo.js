import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useSeo({title, description, noindex = false, schema, image}) {
  const {pathname, search} = useLocation();
  const schemaJson = schema ? JSON.stringify(schema) : '';
  useEffect(() => {
    document.title = title?.includes('Thimadu') ? title : `${title || 'Your next journey'} | Thimadu Auto Traders`;
    const set = (name,content,property = false) => {
      const attribute = property ? 'property' : 'name';
      let element = document.head.querySelector(`meta[${attribute}="${name}"]`);
      if (!element) {element = document.createElement('meta');element.setAttribute(attribute,name);document.head.append(element);}
      element.content = content;
    };
    const canonical = new URL(pathname === '/index.html' ? '/' : pathname,location.origin);
    if (pathname.includes('car-details')) {const params = new URLSearchParams(search); const slug = params.get('vehicle') || params.get('car') || params.get('slug');if(slug)canonical.searchParams.set('vehicle',slug);}
    set('description',description || 'Browse cars for sale, sell your vehicle and find your next drive with Thimadu Auto Traders in Sri Lanka.');
    set('robots',noindex?'noindex,follow':'index,follow,max-image-preview:large');
    set('og:title',document.title,true); set('og:description',description || '',true); set('og:url',canonical.href,true);
    const imageUrl = image || new URL('/images/hero.webp',location.origin).href;
    set('og:image',imageUrl,true);
    set('twitter:title',document.title);set('twitter:description',description || '');set('twitter:image',imageUrl);
    let canonicalLink = document.head.querySelector('link[rel="canonical"]');
    if (!canonicalLink) { canonicalLink = document.createElement('link'); canonicalLink.rel = 'canonical'; document.head.append(canonicalLink); }
    canonicalLink.href = canonical.href;
    document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach(node=>node.href=canonical.href);
    let node = document.querySelector('#site-schema');
    if(!node){node=document.createElement('script');node.id='site-schema';node.type='application/ld+json';document.head.append(node);}
    const data = [ {'@context':'https://schema.org','@type':'AutoDealer','@id':new URL('/#dealer',location.origin).href,name:'Thimadu Auto Traders',url:location.origin,telephone:'+94771813928',image:new URL('/logo.png',location.origin).href,areaServed:'Sri Lanka',sameAs:['https://www.facebook.com/thimaducar']} ];
    const pageSchema = schemaJson ? JSON.parse(schemaJson) : null;
    const schemaEntries = pageSchema ? [pageSchema, ...(pageSchema['@graph'] || [])] : [];
    const hasBreadcrumbs = schemaEntries.some(item => [item['@type']].flat().includes('BreadcrumbList'));
    if(!hasBreadcrumbs && pathname !== '/' && pathname !== '/index.html') data.push({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:location.origin},{'@type':'ListItem',position:2,name:title || 'Thimadu',item:canonical.href}]});
    if(pageSchema)data.push(pageSchema);
    node.textContent=JSON.stringify(data);
  },[title,description,noindex,schemaJson,pathname,search,image]);
}
