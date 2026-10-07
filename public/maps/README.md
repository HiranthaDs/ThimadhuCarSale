# Sri Lanka map data

`sri-lanka.geojson` is the Sri Lanka feature (`ADM0_A3=LKA`) extracted from Natural Earth's 1:10 million country dataset. `sri-lanka.svg` preserves all 871 source vertices across the five source polygons, including offshore islands. These are geographic data, not a hand-drawn silhouette. Coordinates were rounded only after projection to two decimal places in the display SVG.

- Dataset: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_admin_0_countries.geojson
- Download: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson
- Coastline licence: public domain, https://www.naturalearthdata.com/about/terms-of-use/
- Retrieved: 2026-10-06

The SVG uses an equirectangular projection centred on longitude `80.773041`, latitude `7.876655`. Its standard parallel is `7.876655` degrees north. Display dimensions are `600 × 720`; scale is 150 display units per degree:

```
x = 300 + (longitude - 80.773041) * cos(7.876655 * PI / 180) * 150
y = 360 - (latitude - 7.876655) * 150
```

`src/sections/SriLankaNetwork.jsx` applies the same formula to city coordinates. Keeping the same view box and aspect ratio aligns the SVG coastline and HTML controls at every screen size.

City coordinates are from GeoNames, WGS84:

| City | Latitude | Longitude |
| --- | --- | --- |
| Colombo | 6.93548 | 79.84868 |
| Jaffna | 9.668446 | 80.007420 |
| Kandy | 7.29060 | 80.63360 |
| Trincomalee | 8.57780 | 81.22890 |
| Galle | 6.04610 | 80.21030 |

- GeoNames source: https://www.geonames.org/advanced-search.html?country=LK
- GeoNames licence: CC BY 4.0, https://creativecommons.org/licenses/by/4.0/
- GeoNames licence and datum information: https://www.geonames.org/about.html
- Adaptation: coordinates projected for this display; no source coordinate adjustments.

Visible attribution is included below the map. City markers are destinations for an enquiry, not branch addresses, available delivery routes, or claims of physical presence. Grid lines and marker rings are decorative map elements. The map is not a navigation map.
