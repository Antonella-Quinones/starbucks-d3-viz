// Starbucks Drink Nutrition Explorer
// Assumes a CSV named 'starbucks_drinkMenu_expanded.csv' is in the same folder.

const svg = d3.select("#chart");
const tooltip = d3.select("#tooltip");
const categorySelect = document.getElementById("categorySelect");
const calorieSlider = document.getElementById("calorieSlider");
const calorieValue = document.getElementById("calorieValue");
const colorBySelect = document.getElementById("colorBy");

const margin = { top: 40, right: 160, bottom: 60, left: 60 };
let width = 800;
let height = 520;

function resizeSvg() {
  const bounds = document
    .getElementById("chartContainer")
    .getBoundingClientRect();
  width = bounds.width - margin.left - margin.right;
  height = 520 - margin.top - margin.bottom;
  svg.attr("width", bounds.width).attr("height", 520);
}

resizeSvg();
window.addEventListener("resize", () => {
  resizeSvg();
  if (window._globalData) {
    updateChart(window._globalData);
  }
});

// Main group
const g = svg.append("g").attr(
  "transform",
  `translate(${margin.left},${margin.top})`
);

// Axes groups
const xAxisGroup = g.append("g").attr("class", "axis axis-x");
const yAxisGroup = g.append("g").attr("class", "axis axis-y");

// Axis labels
g.append("text")
  .attr("class", "axis-label")
  .attr("x", width / 2)
  .attr("y", height + 40)
  .attr("text-anchor", "middle")
  .text("Calories");

g.append("text")
  .attr("class", "axis-label")
  .attr("transform", "rotate(-90)")
  .attr("x", -height / 2)
  .attr("y", -40)
  .attr("text-anchor", "middle")
  .text("Sugar (g)");

// Legend group
const legendGroup = svg
  .append("g")
  .attr("class", "legend")
  .attr("transform", `translate(${margin.left + width + 20}, ${margin.top})`);

let xScale = d3.scaleLinear();
let yScale = d3.scaleLinear();
let colorScaleCategory = d3.scaleOrdinal(d3.schemeTableau10);
let colorScaleCaffeine = d3.scaleSequential(d3.interpolateYlOrRd);

function cleanRow(d) {
  // Convert to numbers safely; missing values become null
  const calories = +d["Calories"];
  const sugar = +d[" Sugars (g)"];
  const caffeine = +d["Caffeine (mg)"];
  const category = d["Beverage_category"];
  const name = d["Beverage"];
  const prep = d["Beverage_prep"];

 if (isNaN(calories) || isNaN(sugar)) {
  return null;
}

  return {
    category,
    name,
    prep,
    calories,
    sugar,
    caffeine: isNaN(caffeine) ? null : caffeine,
  };
}

// Load data
d3.csv("starbucks_drinkMenu_expanded.csv").then((raw) => {
  const cleaned = raw
    .map(cleanRow)
    .filter((d) => d !== null)
    .filter((d) => d.calories <= 600); // soft cap for scale

  window._globalData = cleaned;

  // Populate category dropdown
  const categories = Array.from(new Set(cleaned.map((d) => d.category))).sort();
  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });

  // Set color scales domains
  colorScaleCategory.domain(categories);
  const caffeineValues = cleaned
    .map((d) => d.caffeine)
    .filter((v) => v !== null);
  if (caffeineValues.length > 0) {
    colorScaleCaffeine.domain(d3.extent(caffeineValues));
  }

  // Wire up interactions
  categorySelect.addEventListener("change", () =>
    updateChart(window._globalData)
  );
  calorieSlider.addEventListener("input", () => {
    calorieValue.textContent = calorieSlider.value;
    updateChart(window._globalData);
  });
  colorBySelect.addEventListener("change", () =>
    updateChart(window._globalData)
  );

  // Initial render
  calorieValue.textContent = calorieSlider.value;
  updateChart(cleaned);
});

function updateChart(data) {
  const maxCalories = +calorieSlider.value;
  const selectedCategory = categorySelect.value;
  const colorBy = colorBySelect.value;

  let filtered = data.filter((d) => d.calories <= maxCalories);
  if (selectedCategory !== "all") {
    filtered = filtered.filter((d) => d.category === selectedCategory);
  }

  if (filtered.length === 0) {
    filtered = [];
  }

  // Update scales
  xScale
    .domain([0, d3.max(data, (d) => d.calories) || 600])
    .range([0, width])
    .nice();

  yScale
    .domain([0, d3.max(data, (d) => d.sugar) || 100])
    .range([height, 0])
    .nice();

  // Update axes
  xAxisGroup
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(8));
  yAxisGroup.call(d3.axisLeft(yScale).ticks(8));

  // Bind data
  const circles = g.selectAll("circle").data(filtered, (d) => d.name + d.prep);

  circles.exit().transition().duration(300).attr("r", 0).remove();

  const circlesEnter = circles
    .enter()
    .append("circle")
    .attr("cx", (d) => xScale(d.calories))
    .attr("cy", (d) => yScale(d.sugar))
    .attr("r", 0)
    .attr("opacity", 0.85);

  circlesEnter
    .merge(circles)
    .transition()
    .duration(400)
    .attr("cx", (d) => xScale(d.calories))
    .attr("cy", (d) => yScale(d.sugar))
    .attr("r", 5)
    .attr("fill", (d) => {
      if (colorBy === "Beverage_category") {
        return colorScaleCategory(d.category);
      }
      if (d.caffeine === null || isNaN(d.caffeine)) {
        return "#b0b0b0";
      }
      return colorScaleCaffeine(d.caffeine);
    });

  // Tooltip events
  g.selectAll("circle")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("stroke", "#111").attr("stroke-width", 1.2);
      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${d.name}</strong><br/>
           ${d.prep || ""}<br/>
           Category: ${d.category}<br/>
           Calories: ${d.calories}<br/>
           Sugar: ${d.sugar} g<br/>
           Caffeine: ${d.caffeine ?? "N/A"} mg`
        );
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", event.offsetX + 20 + "px")
        .style("top", event.offsetY + 10 + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("stroke", "none");
      tooltip.style("opacity", 0);
    });

  drawLegend(colorBy);
}

function drawLegend(colorBy) {
  legendGroup.selectAll("*").remove();

  if (colorBy === "Beverage_category") {
    legendGroup
      .append("text")
      .attr("x", 0)
      .attr("y", 0)
      .text("Color: Category")
      .style("font-weight", "600");

    const cats = colorScaleCategory.domain();
    const rowHeight = 16;

    legendGroup
      .selectAll("legend-row")
      .data(cats)
      .enter()
      .append("g")
      .attr("transform", (d, i) => `translate(0, ${10 + i * rowHeight})`)
      .each(function (d) {
        d3.select(this)
          .append("rect")
          .attr("x", 0)
          .attr("y", -10)
          .attr("width", 10)
          .attr("height", 10)
          .attr("fill", colorScaleCategory(d));

        d3.select(this)
          .append("text")
          .attr("x", 16)
          .attr("y", 0)
          .attr("dominant-baseline", "central")
          .text(d);
      });
  } else {
    legendGroup
      .append("text")
      .attr("x", 0)
      .attr("y", 0)
      .text("Color: Caffeine (mg)")
      .style("font-weight", "600");

    const gradientId = "caffeine-gradient";
    const defs = svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", gradientId)
      .attr("x1", "0%")
      .attr("x2", "100%");

    const stops = [
      { offset: "0%", value: 0 },
      { offset: "50%", value: 0.5 },
      { offset: "100%", value: 1 },
    ];

    stops.forEach((s) => {
      gradient
        .append("stop")
        .attr("offset", s.offset)
        .attr("stop-color", d3.interpolateYlOrRd(s.value));
    });

    legendGroup
      .append("rect")
      .attr("x", 0)
      .attr("y", 10)
      .attr("width", 100)
      .attr("height", 12)
      .style("fill", `url(#${gradientId})`);

    legendGroup
      .append("text")
      .attr("x", 0)
      .attr("y", 34)
      .attr("font-size", 10)
      .text("Low");

    legendGroup
      .append("text")
      .attr("x", 80)
      .attr("y", 34)
      .attr("font-size", 10)
      .attr("text-anchor", "end")
      .text("High");
  }
}
