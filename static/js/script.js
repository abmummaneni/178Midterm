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

function draw_slider(
    column,
    min,
    max,
    left_scatter_svg,
    right_scatter_svg,
    left_scatter_scale,
    right_scatter_scale,
) {
    slider = document.getElementById(column + "-slider");
    noUiSlider.create(slider, {
        start: [min, max],
        connect: false,
        tooltips: true,
        step: 1,
        range: { min: min, max: max },
    });
    slider.noUiSlider.on("change", function () {
        update(
            left_scatter_svg,
            right_scatter_svg,
            left_scatter_scale,
            right_scatter_scale,
        );
    });
}

// Function that draws the scatterplot
function draw_scatter(data, svg, scale) {
    // get scale functions
    scaleX = scale["x"];
    scaleY = scale["y"];

    // draw dots
    svg.selectAll(".dot")
        .data(data)
        .join("circle")
        .attr("class", "dot")
        .attr("cx", (d) => scaleX(d[0]))
        .attr("cy", (d) => scaleY(d[1]))
        .attr("r", 3)
        .attr("fill", "red")
        .attr("opacity", 0.8);
}

// Function that extracts the selected days and minimum/maximum values for each slider
function get_params() {
    // TODO: Discrete toggles (after they are defined on html side)

    // get min and max values from all continuous-column sliders
    var params = {};
    continuous_columns.forEach(function (column) {
        var slider = document.getElementById(column + "-slider");
        if (slider && slider.noUiSlider) {
            params[column] = slider.noUiSlider.get();
        }
    });

    return params;
}

// Function that removes the old data points and redraws the scatterplot
function update_scatter(data, svg, scale) {
    // remove old points
    svg.selectAll(".dot").remove();
    // draw new points
    draw_scatter(data, svg, scale);
}

function update(
    left_scatter_svg,
    right_scatter_svg,
    left_scatter_scale,
    right_scatter_scale,
) {
    params = get_params();
    fetch("/update", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify(params),
        cache: "no-cache",
        headers: new Headers({
            "content-type": "application/json",
        }),
    }).then(async function (response) {
        var results = JSON.parse(JSON.stringify(await response.json()));
        update_scatter(
            results["facet_left_data"],
            left_scatter_svg,
            left_scatter_scale,
        );
        update_scatter(
            results["facet_right_data"],
            right_scatter_svg,
            right_scatter_scale,
        );
    });
}
