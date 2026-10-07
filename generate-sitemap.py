#!/usr/bin/env python3
from pathlib import Path
from urllib.parse import urljoin
import sys,datetime
if len(sys.argv)!=2 or not sys.argv[1].startswith(('http://','https://')):
    raise SystemExit('Usage: python generate-sitemap.py https://your-production-domain.example/')
base=sys.argv[1].rstrip('/')+'/'
urls=['', 'all-vehicles.html', 'services.html', 'sell-your-vehicle-sri-lanka.html', 'vehicle-sourcing-sri-lanka.html', 'vehicle-information-support.html', 'reviews.html', 'aboutus.html']
today=datetime.date.today().isoformat()
xml=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for p in urls:
    loc=urljoin(base,p)
    xml.append(f'  <url><loc>{loc}</loc><lastmod>{today}</lastmod></url>')
xml.append('</urlset>')
Path('public/sitemap.xml').write_text('\n'.join(xml)+'\n',encoding='utf-8')
print('Created sitemap.xml for',base)
