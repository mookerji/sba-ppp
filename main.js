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
  minZoom: 8,
});
const filterGroup = document.getElementById("filter-group");
const popup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false,
});

// const filterGroup = document.getElementById("filter-group");

let DATA = {};

map.on("load", function () {
  loadData().then((data) => init(data));
});

const PB_URL = "https://projects.propublica.org/coronavirus/bailouts/search?q=";

// Render a menu
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
  let description = `<strong>Zip Code</strong>: <a href="${
    PB_URL + zip_code
  }">${zip_code}</a><br/>`;
  description += `<strong>Total Recipients</strong>: ${total_recipients}<br/>`;
  description += `<strong>Total Minimum Loaned</strong>: \$${min_loan}M<br/>`;
  description += `<strong>Avg. Minimum Loaned</strong>: \$${avg_loan_min}M<br/>`;
  //
  const zip_code_recipients = DATA.top_recipients[zip_code] || [];
  let ranked = "<ul>";
  for (const zc of zip_code_recipients) {
    ranked +=
      " <li>" +
      zc.NAICSIndustry.trim() +
      ` (${zc.PctLoanMin.toFixed(2)}%)` +
      "</li>";
  }
  ranked += "</ul>";
  description += `<strong>Top Recipients</strong>: ${ranked}`;
  popup.setLngLat(e.lngLat).setHTML(description).addTo(map);
});

function addLayerSelect(layer_id, checked = true) {
  var input = document.createElement("input");
  input.type = "checkbox";
  input.id = layer_id;
  input.checked = checked;
  filterGroup.appendChild(input);

  var label = document.createElement("label");
  label.setAttribute("for", layer_id);
  label.textContent = layer_id;
  filterGroup.appendChild(label);

  input.addEventListener("change", function (e) {
    map.setLayoutProperty(
      layer_id,
      "visibility",
      e.target.checked ? "visible" : "none"
    );
  });
}

// Datasets

const RECIPIENTS =
  "https://raw.githubusercontent.com/mookerji/sba-ppp/master/data/zip-recipients.csv";

const TOP_PRECIPIENTS =
  "https://raw.githubusercontent.com/mookerji/sba-ppp/master/data/pct_loan_by_zip_code_top10.csv";

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

// Zip,NAICSIndustry,PctLoanMin

function parseTopRecipients(data) {
  return Papa.parse(data, { header: true }).data.reduce(function (m, e) {
    const item = {
      NAICSIndustry: e.NAICSIndustry,
      PctLoanMin: Number(e.PctLoanMin),
    };
    if (!m[Number(e.Zip)]) {
      m[Number(e.Zip)] = [item];
    } else {
      m[Number(e.Zip)].push(item);
    }
    return m;
  }, {});
}

async function loadData() {
  let response = await fetch(RECIPIENTS);
  let recipients = await response.text();
  DATA.recipients = parseRecipients(recipients);

  response = await fetch(TOP_PRECIPIENTS);
  recipients = await response.text();
  DATA.top_recipients = parseTopRecipients(recipients);
  return DATA;
}

// Initialize the map
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
    paint: {
      "line-width": 2,
      "line-opacity": 0.8,
    },
  });


  const loan_min_amount = Object.assign(
    {},
    ...Object.keys(data.recipients).map((zip) => ({
      [String(zip)]: data.recipients[zip].LoanMin,
    }))
  );
  const max_amount = Math.max(...Object.values(loan_min_amount).slice(1));
  const min_amount = Math.min(...Object.values(loan_min_amount).slice(1));
  const to_color = d3
    .scaleQuantize()
    .domain([min_amount, max_amount])
    .range(["#fef0d9", "#fdd49e", "#fdbb84", "#fc8d59", "#e34a33", "#b30000"]);

  const color_expression = ["match", ["get", "BASENAME"]]
    .concat(
      Object.keys(loan_min_amount)
        .map((zip) => [zip, to_color(loan_min_amount[zip]) || "#fef0d9"])
        .flat()
    )
    .concat("#fef0d9");

  map.addLayer({
    id: "zip-fills",
    type: "fill",
    source: "zips",
    "source-layer": "ZCTA5",
    paint: {
      "fill-opacity": 0.7,
      "fill-color": color_expression,
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
