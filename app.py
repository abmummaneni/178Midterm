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

    return render_template(
        "index.html",
        filter_ranges=filter_ranges,
    )


@app.route("/update", methods=["POST"])
def update():
    request_data = request.get_json()
    x_column = request_data["x_column"]
    y_column = request_data["y_column"]
    facet = request_data["facet"]

    # Update where clause from sliders (numerical ranges)
    continuous_predicate = " AND ".join(
        [
            f"({column} >= {request_data[column][0]} AND {column} <= {request_data[column][1]})"
            for column in continuous_columns
        ]
    )
    # Update where clause from discrete columns
    discrete_predicate = " AND ".join(
        [
            f'"{column}" IN {tuple(request_data[column])}'
            for column in discrete_columns
            if request_data.get(column)
        ]
    )

    # Combine where clause from sliders and checkboxes
    predicate = " AND ".join(
        [clause for clause in [continuous_predicate, discrete_predicate] if clause]
    )

    # TODO: Perform k means clustering and compute trendlines before sending to frontend
    facet_query = f'''
        SELECT "{facet}" AS facet_value, "{x_column}" AS x, "{y_column}" AS y
        FROM placementdata.csv
        WHERE {predicate}
    '''
    facet_results = duckdb.sql(facet_query).df()

    facet_values = facet_results["facet_value"].drop_duplicates().tolist()
    facet_a_data = (
        facet_results[facet_results["facet_value"] == facet_values[0]][
            ["x", "y"]
        ].values.tolist()
        if facet_values
        else []
    )
    facet_b_data = (
        facet_results[facet_results["facet_value"] == facet_values[1]][
            ["x", "y"]
        ].values.tolist()
        if len(facet_values) > 1
        else []
    )

    return {
        "facet_a_data": facet_a_data,
        "facet_b_data": facet_b_data,
    }


if __name__ == "__main__":
    app.run(debug=True, port=8000)
