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
function draw_svg(container_id, margin, width, height) {
    svg = d3
        .select("#" + container_id)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style("background-color", "#dbdad7")
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    return svg;
}

function draw_xaxis(plot_name, svg, height, scale) {
    svg.append("g")
        .attr("class", plot_name + "-xaxis")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(scale).tickSize(0));
}

function draw_yaxis(plot_name, svg, scale) {
    svg.append("g")
        .attr("class", plot_name + "-yaxis")
        .call(d3.axisLeft(scale));
}

function draw_axis(plot_name, axis, svg, height, domain, range, discrete) {
    if (discrete) {
        var scale = d3.scaleBand().domain(domain).range(range).padding([0.2]);
    } else {
        var scale = d3.scaleLinear().domain(domain).range(range);
    }
    if (axis == "x") {
        draw_xaxis(plot_name, svg, height, scale);
    } else if (axis == "y") {
        draw_yaxis(plot_name, svg, scale);
    }
    return scale;
}

function draw_axis_labels(plot_name, svg, width, height, x_label, y_label) {
    // x label
    svg.append("text")
        .attr("class", plot_name + "-xlabel")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text(x_label);

    // y label
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

function draw_axes(
    plot_name,
    svg,
    width,
    height,
    domainx,
    domainy,
    x_discrete,
) {
    var x_scale = draw_axis(
        plot_name,
        "x",
        svg,
        height,
        domainx,
        [0, width],
        x_discrete,
    );
    var y_scale = draw_axis(
        plot_name,
        "y",
        svg,
        height,
        domainy,
        [height, 0],
        false,
    );
    return { x: x_scale, y: y_scale };
}

// -------------------- AXIS UPDATES --------------------

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

    const values = data.map(d => +d[index]);
    let min = d3.min(values);
    let max = d3.max(values);

    if (min === max) {
        min = min - 1;
        max = max + 1;
    }

    return [min, max];
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
    if (!slider) return;

    noUiSlider.create(slider, {
        start: [min, max],
        connect: true,
        tooltips: true,
        step: 1,
        range: { min: min, max: max },
    });

    slider.noUiSlider.on("change", function () {
        update_all();
    });
}

// Function that draws the scatterplot
function draw_scatter(data, svg, scale) {
    const scaleX = scale.x;
    const scaleY = scale.y;
    svg.selectAll(".dot")
       .data(data)
       .join("circle")
       .attr("class", "dot")
       .attr("cx", d => scaleX(+d[0]))
       .attr("cy", d => scaleY(+d[1]))
       .attr("r", 2.5)
       .attr("fill", "#1f77b4")
}

function update_scatter(plot_name, data, svg, width, height, x_label, y_label) {
    svg.selectAll(".dot").remove();

    const new_scale = make_new_scale(width, height, data);
    update_axes(plot_name, svg, height, new_scale);
    update_axis_labels(plot_name, svg, x_label, y_label);

    draw_scatter(data, svg, new_scale);

    return new_scale;
}

// Function that extracts the selected days and minimum/maximum values for each slider
// -------------------- PARAMS --------------------

function get_selected_discrete_values(column) {
    const checked = document.querySelectorAll(`input[data-column="${column}"]:checked`);
    return Array.from(checked).map(cb => cb.value);
}

function get_params() {
    const params = {};

    // dropdowns
    params["x_column"] = document.getElementById("x-select").value;
    params["y_column"] = document.getElementById("y-select").value;
    params["facet"] = document.getElementById("facet-select").value;

    // sliders
    continuous_columns.forEach(function (column) {
        const slider = document.getElementById(column + "-slider");
        if (slider && slider.noUiSlider) {
            params[column] = slider.noUiSlider.get().map(Number);
        }
    });

    // discrete filters
    params["ExtracurricularActivities"] = get_selected_discrete_values("ExtracurricularActivities");
    params["PlacementTraining"] = get_selected_discrete_values("PlacementTraining");

    return params;
}


// Function that removes the old data points and redraws the scatterplot
//function update_scatter(data, svg, scale) {
//    // remove old points
//    svg.selectAll(".dot").remove();
//    // draw new points
//    draw_scatter(data, svg, scale);
//}
function update_all() {
    update(
        window.left_scatter_svg,
        window.right_scatter_svg,
        window.plot_width,
        window.plot_height
    );
}

function update(left_scatter_svg, right_scatter_svg, width, height) {
    const params = get_params();

    fetch("/update", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify(params),
        cache: "no-cache",
        headers: new Headers({
            "content-type": "application/json",
        }),
    })
    .then(async function (response) {
        const results = await response.json();

        window.left_scatter_scale = update_scatter(
            "scatter-left",
            results["facet_left_data"],
            left_scatter_svg,
            width,
            height,
            params["x_column"],
            params["y_column"]
        );

        window.right_scatter_scale = update_scatter(
            "scatter-right",
            results["facet_right_data"],
            right_scatter_svg,
            width,
            height,
            params["x_column"],
            params["y_column"]
        );

        d3.select("#facet-left-title")
            .text(params["facet"] + ": " + (results["facet_left_label"] || ""));

        d3.select("#facet-right-title")
            .text(params["facet"] + ": " + (results["facet_right_label"] || ""));
    });
}
