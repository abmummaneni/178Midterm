from flask import Flask, render_template, request
import duckdb
import pandas as pd

app = Flask(__name__)
continuous_columns = [
    "CGPA",
    "Internships",
    "Projects",
    "Workshops/Certifications",
    "AptitudeTestScore",
    "SoftSkillsRating",
    "SSC_Marks",
    "HSC_Marks",
]
discrete_columns = [
    "ExtracurricularActivities",
    "PlacementTraining",
    "PlacementStatus",
]


@app.route("/")
def index():
    # Get the min and max values for each continuous column
    # so that the sliders can be initialized
    filter_ranges_query = (
        "SELECT "
        + ", ".join(
            [
                f'MIN("{column}") AS min_{index}, MAX("{column}") AS max_{index}'
                for index, column in enumerate(continuous_columns)
            ]
        )
        + " FROM placementdata.csv"
    )
    filter_ranges_results = duckdb.sql(filter_ranges_query).df().iloc[0]
    filter_ranges = {
        column: [
            filter_ranges_results[f"min_{index}"],
            filter_ranges_results[f"max_{index}"],
        ]
        for index, column in enumerate(continuous_columns)
    }
    # pick default scatterplot columns
    default_x = "CGPA"
    default_y = "AptitudeTestScore"

    # [x_min, x_max, y_min, y_max]
    scatter_ranges = [
        filter_ranges[default_x][0],
        filter_ranges[default_x][1],
        filter_ranges[default_y][0],
        filter_ranges[default_y][1],
    ]

    return render_template(
        "index.html",
        filter_ranges=filter_ranges,
        scatter_ranges=scatter_ranges,
        default_x=default_x,
        default_y=default_y,
        continuous_columns=continuous_columns,
        discrete_columns=discrete_columns,
    )


@app.route("/update", methods=["POST"])
def update():
    request_data = request.get_json()

    x_column = request_data["x_column"]
    y_column = request_data["y_column"]
    facet = request_data["facet"]

    # Continuous filters: only use columns that were actually sent
    continuous_clauses = []
    for column in continuous_columns:
        if column in request_data:
            min_val = float(request_data[column][0])
            max_val = float(request_data[column][1])
            continuous_clauses.append(
                f'("{column}" >= {min_val} AND "{column}" <= {max_val})'
            )

    # Discrete filters
    discrete_clauses = []
    for column in discrete_columns:
        if column in request_data and request_data[column]:
            values = ", ".join([f"'{value}'" for value in request_data[column]])
            discrete_clauses.append(f'"{column}" IN ({values})')

    predicate_parts = continuous_clauses + discrete_clauses
    predicate = " AND ".join(predicate_parts) if predicate_parts else "TRUE"

    facet_query = f'''
        SELECT "{facet}" AS facet_value, "{x_column}" AS x, "{y_column}" AS y
        FROM 'placementdata.csv'
        WHERE {predicate}
    '''

    facet_results = duckdb.sql(facet_query).df()

    facet_values = facet_results["facet_value"].drop_duplicates().tolist()

    facet_left_label = facet_values[0] if len(facet_values) > 0 else ""
    facet_right_label = facet_values[1] if len(facet_values) > 1 else ""

    facet_left_data = (
        facet_results[facet_results["facet_value"] == facet_left_label][["x", "y"]]
        .values.tolist()
        if facet_left_label
        else []
    )

    facet_right_data = (
        facet_results[facet_results["facet_value"] == facet_right_label][["x", "y"]]
        .values.tolist()
        if facet_right_label
        else []
    )

    return {
        "facet_left_data": facet_left_data,
        "facet_right_data": facet_right_data,
        "facet_left_label": facet_left_label,
        "facet_right_label": facet_right_label,
    }

if __name__ == "__main__":
    app.run(debug=True, port=8000)
