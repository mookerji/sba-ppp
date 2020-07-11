const MAPBOX_TOKEN =
  "pk.eyJ1IjoibWFza3Nvbi1pbnRlcm5hbCIsImEiOiJjazhxdTNjOXAwN3NsM2RwaDJkaWU1MGV4In0.91Sfq6oHaoP-kD6fV-shFA";

mapboxgl.accessToken = MAPBOX_TOKEN;

if (!mapboxgl.supported()) {
  alert("Your browser does not support Mapbox GL");
}

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/light-v10",
  center: [-122.4194, 37.7749],
  minZoom: 9,
});
const filterGroup = document.getElementById("filter-group");
const popup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false,
});

let DATA = {};

map.on("load", function () {
  loadData().then((data) => init(data));
});

map.on("click", (e) => {
  const filteredFeatures = map
    .queryRenderedFeatures(e.point)
    .filter((feature) => feature.source === "zips");
  if (filteredFeatures.length == 0) {
    return;
  }
  const zip_code = Number(filteredFeatures[0].properties.BASENAME);
  const zip_code_data = DATA.recipients[zip_code] || {};
  const total_recipients = zip_code_data.RecipientCount || "n/a";
  const min_loan = (zip_code_data.LoanMin / 10 ** 6).toFixed(2) || "n/a";
  const avg_loan_min = (zip_code_data.AvgLoanMin / 10 ** 6).toFixed(2) || "n/a";
  let description = `<strong>Zip Code</strong>: ${zip_code}<br/>`;
  description += `<strong>Total Recipients</strong>: ${total_recipients}<br/>`;
  description += `<strong>Total Minimum Loaned ($)</strong>: ${min_loan}M<br/>`;
  description += `<strong>Avg. Minimum Loaned ($)</strong>: ${avg_loan_min}M<br/>`;
  popup.setLngLat(e.lngLat).setHTML(description).addTo(map);
});

const RECIPIENTS =
  "https://raw.githubusercontent.com/mookerji/sba-ppp/master/data/zip-recipients.csv";

function parseRecipients(data) {
  return Papa.parse(data, { header: true }).data.reduce(function (m, e) {
    m[Number(e.Zip)] = {
      RecipientCount: Number(e.RecipientCount),
      LoanMin: Number(e.LoanMin),
      LoanMax: Number(e.LoanMax),
      AvgLoanMin: Number(e.AvgLoanMin),
      AvgLoanMax: Number(e.AvgLoanMax),
    };
    return m;
  }, {});
}

async function loadData() {
  const response = await fetch(RECIPIENTS);
  let recipients = await response.text();
  DATA.recipients = parseRecipients(recipients);
  return DATA;
}

async function init(data) {
  map.addSource("zips", {
    type: "vector",
    tiles: [
      "https://gis-server.data.census.gov/arcgis/rest/services/Hosted/VT_2017_860_00_PY_D1/VectorTileServer/tile/{z}/{y}/{x}.pbf",
    ],
  });
  const filter_expression = ["any"].concat(
    Object.keys(data.recipients).map((zip) => ["==", "BASENAME", zip])
  );

  map.addLayer({
    id: "zips-boundaries",
    type: "line",
    source: "zips",
    "source-layer": "ZCTA5",
    filter: filter_expression,
  });

  map.addLayer({
    id: "zip-fills",
    type: "fill",
    source: "zips",
    "source-layer": "ZCTA5",
    paint: {
      "fill-opacity": 0.05,
      "fill-color": "blue",
    },
    filter: filter_expression,
  });

  map.addLayer({
    id: "zip-ids",
    type: "symbol",
    source: "zips",
    "source-layer": "ZCTA5/label",
  });

  map.addControl(new mapboxgl.NavigationControl());
}
