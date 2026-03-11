continuous_columns = [
    "CGPA",
    "Internships",
    "Projects",
    "Workshops/Certifications",
    "AptitudeTestScore",
    "SoftSkillsRating",
    "SSC_Marks",
    "HSC_Marks",
];

const PLOTS = [
    {
        id: "left",
        container: "scatter-left",
        title: "#facet-left-title",
        info: "#facet-left-info",
    },
    {
        id: "right",
        container: "scatter-right",
        title: "#facet-right-title",
        info: "#facet-right-info",
    },
];

function draw_svg(container_id, margin, width, height) {
    return d3
        .select("#" + container_id)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style("background-color", "#ffffff")
        .style("border", "1px solid gray")
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
}

function draw_axis_labels(plot_name, svg, width, height, x_label, y_label) {
    svg.append("text")
        .attr("class", plot_name + "-xlabel")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text(x_label);

    svg.append("text")
        .attr("class", plot_name + "-ylabel")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -40)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text(y_label);
}

function update_axis_labels(plot_name, svg, x_label, y_label) {
    svg.select("." + plot_name + "-xlabel").text(x_label);
    svg.select("." + plot_name + "-ylabel").text(y_label);
}

function draw_axes(plot_name, svg, width, height, domainx, domainy) {
    const x_scale = d3.scaleLinear().domain(domainx).range([0, width]);
    const y_scale = d3.scaleLinear().domain(domainy).range([height, 0]);

    svg.append("g")
        .attr("class", plot_name + "-xaxis")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x_scale).tickSize(0));

    svg.append("g")
        .attr("class", plot_name + "-yaxis")
        .call(d3.axisLeft(y_scale));

    return { x: x_scale, y: y_scale };
}

function update_axes(plot_name, svg, height, scale) {
    svg.select("." + plot_name + "-xaxis")
        .transition()
        .duration(300)
        .call(d3.axisBottom(scale.x));

    svg.select("." + plot_name + "-yaxis")
        .transition()
        .duration(300)
        .call(d3.axisLeft(scale.y));
}

function get_domain_from_data(data, index) {
    if (!data || data.length === 0) {
        return [0, 1];
    }

    const values = data.map((d) => +d[index === 0 ? "x" : "y"]);
    const min = d3.min(values);
    const max = d3.max(values);

    if (min === max) {
        return [min - 1, max + 1];
    }
    const pad = (max - min) * 0.02;
    return [min - pad, max + pad];
}

function make_new_scale(width, height, data) {
    const x_domain = get_domain_from_data(data, 0);
    const y_domain = get_domain_from_data(data, 1);

    return {
        x: d3.scaleLinear().domain(x_domain).range([0, width]),
        y: d3.scaleLinear().domain(y_domain).range([height, 0]),
    };
}

function draw_slider(column, min, max) {
    const slider = document.getElementById(column + "-slider");
    if (!slider) {
        return;
    }

    noUiSlider.create(slider, {
        start: [min, max],
        connect: true,
        tooltips: true,
        step: column === "SoftSkillsRating" ? 0.1 : 1,
        range: { min, max },
    });

    slider.noUiSlider.on("change", update_all);
}

function draw_scatter(data, svg, scale) {
    const displayMode = document.getElementById("display-mode").value;
    const colorScale =
        displayMode === "heatmap"
            ? d3
                  .scaleLinear()
                  .domain(d3.extent(data, (d) => +(d.count || 1)))
                  .range(["#cfe8ff", "#0b4f8a"])
            : null;
    svg.selectAll(".dot")
        .data(data)
        .join("circle")
        .attr("class", "dot")
        .attr("cx", (d) => scale.x(+d.x))
        .attr("cy", (d) => scale.y(+d.y))
        .attr("r", (d) =>
            displayMode === "heatmap" ? +(d.count * 0.05 + 2.5) : 3,
        )
        .attr("fill", (d) =>
            colorScale ? colorScale(+(d.count || 1)) : "#1f77b4",
        );
}

function get_trendline_tooltip() {
    return d3
        .select("body")
        .selectAll("#trendline-tooltip")
        .data([null])
        .join("div")
        .attr("id", "trendline-tooltip")
        .style("position", "absolute")
        .style("display", "none")
        .style("pointer-events", "none")
        .style("padding", "6px 8px")
        .style("background", "rgba(20, 20, 20, 0.9)")
        .style("color", "#fff")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("line-height", "1.4");
}

function draw_trendline(trendline, svg, scale) {
    svg.selectAll(".trendline, .trendline-hit").remove();
    if (!trendline || !trendline.points || trendline.points.length < 2) {
        return;
    }

    const [start, end] = trendline.points;
    const tooltip = get_trendline_tooltip();
    const confidence = Math.max(0, Math.min(1, +trendline.r2 || 0));
    const opacity = 0.1 + 0.9 * Math.sqrt(confidence);
    const tooltipText =
        `Slope: ${trendline.slope.toFixed(3)}<br>` +
        `R^2: ${trendline.r2.toFixed(3)}`;

    svg.append("line")
        .attr("class", "trendline")
        .attr("x1", scale.x(+start.x))
        .attr("y1", scale.y(+start.y))
        .attr("x2", scale.x(+end.x))
        .attr("y2", scale.y(+end.y))
        .attr("stroke", "#d1495b")
        .attr("stroke-width", 5)
        .attr("stroke-opacity", opacity);

    // Wider ghost line that's easier to hover over with mouse
    svg.append("line")
        .attr("class", "trendline-hit")
        .attr("x1", scale.x(+start.x))
        .attr("y1", scale.y(+start.y))
        .attr("x2", scale.x(+end.x))
        .attr("y2", scale.y(+end.y))
        .attr("stroke", "transparent")
        .attr("stroke-width", 10)
        .style("cursor", "pointer")
        .on("mouseenter", function (event) {
            tooltip
                .style("display", "block")
                .html(tooltipText)
                .style("left", `${event.pageX + 12}px`)
                .style("top", `${event.pageY + 12}px`);
        })
        .on("mousemove", function (event) {
            tooltip
                .style("left", `${event.pageX + 12}px`)
                .style("top", `${event.pageY + 12}px`);
        })
        .on("mouseleave", function () {
            tooltip.style("display", "none");
        });
}

function render_random_forest(result) {
    const status = d3.select("#rf-status");
    const chart = d3.select("#rf-chart");
    chart.selectAll("*").remove();

    if (!result || result.status !== "ok") {
        status.text((result && result.message) || "Random forest unavailable.");
        return;
    }

    status.text(`Trained on ${result.sample_count} filtered rows.`);

    const margin = { top: 10, right: 30, bottom: 30, left: 180 };
    const width = 1030 - margin.left - margin.right;
    const barHeight = 28;
    const height =
        result.feature_importances.length * barHeight +
        margin.top +
        margin.bottom;
    const svg = chart
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    const x = d3
        .scaleLinear()
        .domain([
            0,
            d3.max(result.feature_importances, (d) => d.importance) || 0,
        ])
        .nice()
        .range([0, width]);
    const y = d3
        .scaleBand()
        .domain(result.feature_importances.map((d) => d.feature))
        .range([0, result.feature_importances.length * barHeight])
        .padding(0.25);

    svg.append("g").call(d3.axisLeft(y).tickSize(0));
    svg.append("g")
        .attr(
            "transform",
            `translate(0,${result.feature_importances.length * barHeight})`,
        )
        .call(d3.axisBottom(x));

    svg.selectAll(".rf-bar")
        .data(result.feature_importances)
        .join("rect")
        .attr("class", "rf-bar")
        .attr("x", 0)
        .attr("y", (d) => y(d.feature))
        .attr("width", (d) => x(d.importance))
        .attr("height", y.bandwidth())
        .attr("fill", "#1f77b4");

    svg.selectAll(".rf-label")
        .data(result.feature_importances)
        .join("text")
        .attr("class", "rf-label")
        .attr("x", (d) => x(d.importance) + 8)
        .attr("y", (d) => y(d.feature) + y.bandwidth() / 2 + 4)
        .style("font-size", "12px")
        .text((d) => d.importance.toFixed(3));
}

function update_scatter(
    plot_name,
    facet,
    svg,
    width,
    height,
    x_label,
    y_label,
) {
    svg.selectAll(".dot").remove();

    const new_scale = make_new_scale(width, height, facet.data);
    update_axes(plot_name, svg, height, new_scale);
    update_axis_labels(plot_name, svg, x_label, y_label);

    draw_scatter(facet.data, svg, new_scale);
    draw_trendline(facet.trendline, svg, new_scale);

    return new_scale;
}

function get_selected_discrete_values(column) {
    const checked = document.querySelectorAll(
        `input[data-column="${column}"]:checked`,
    );
    return Array.from(checked).map((cb) => cb.value);
}

function get_params() {
    const params = {
        x_column: document.getElementById("x-select").value,
        y_column: document.getElementById("y-select").value,
        facet: document.getElementById("facet-select").value,
        display_mode: document.getElementById("display-mode").value,
    };

    continuous_columns.forEach(function (column) {
        const slider = document.getElementById(column + "-slider");
        if (slider && slider.noUiSlider) {
            params[column] = slider.noUiSlider.get().map(Number);
        }
    });

    params.ExtracurricularActivities = get_selected_discrete_values(
        "ExtracurricularActivities",
    );
    params.PlacementTraining =
        get_selected_discrete_values("PlacementTraining");

    return params;
}

function update_all() {
    update(window.plot_width, window.plot_height);
}

function train_random_forest() {
    const status = d3.select("#rf-status");
    status.text("Training random forest...");

    fetch("/random_forest", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify(get_params()),
        cache: "no-cache",
        headers: new Headers({
            "content-type": "application/json",
        }),
    }).then(async function (response) {
        render_random_forest(await response.json());
    });
}

function formatStat(value) {
    return Number.isFinite(value) ? value.toFixed(2) : "n/a";
}

function formatStatsHtml(facet, params) {
    if (!facet.stats) {
        return "<div><strong>Facet points:</strong> 0 / 0</div>";
    }

    return [
        `<div><strong>Facet points:</strong> ${facet.stats.count} / ${facet.stats.total_count}</div>`,
        `<div><strong>Pearson correlation (r):</strong> ${formatStat(facet.stats.pearson_r)}</div>`,
        `<div><strong>${params.x_column}:</strong> min ${formatStat(facet.stats.x.min)}, max ${formatStat(facet.stats.x.max)}, mean ${formatStat(facet.stats.x.mean)}, median ${formatStat(facet.stats.x.median)}, std ${formatStat(facet.stats.x.std)}</div>`,
        `<div><strong>${params.y_column}:</strong> min ${formatStat(facet.stats.y.min)}, max ${formatStat(facet.stats.y.max)}, mean ${formatStat(facet.stats.y.mean)}, median ${formatStat(facet.stats.y.median)}, std ${formatStat(facet.stats.y.std)}</div>`,
    ].join("");
}

function update_plot(plot, facet, params, width, height) {
    window[plot.id + "_scatter_scale"] = update_scatter(
        plot.container,
        facet,
        window[plot.id + "_scatter_svg"],
        width,
        height,
        params.x_column,
        params.y_column,
    );

    d3.select(plot.title).text(params.facet + ": " + facet.label);
    d3.select(plot.info).html(formatStatsHtml(facet, params));
}

function update(width, height) {
    const params = get_params();

    fetch("/update", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify(params),
        cache: "no-cache",
        headers: new Headers({
            "content-type": "application/json",
        }),
    }).then(async function (response) {
        const facets = (await response.json()).facets || [];
        PLOTS.forEach(function (plot, index) {
            update_plot(
                plot,
                facets[index] || {
                    label: "",
                    data: [],
                    trendline: null,
                    stats: null,
                },
                params,
                width,
                height,
            );
        });
    });
}
