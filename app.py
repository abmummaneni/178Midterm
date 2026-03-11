from flask import Flask, render_template, request
import duckdb
import pandas as pd
import random

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


def get_jitter_amount(series):
    series = pd.to_numeric(series)
    spread = series.max() - series.min()
    return spread * 0.01 if spread else 0.1


def transform_points(x_values, y_values, mode):
    if len(x_values) == 0 or len(y_values) == 0:
        return []

    plot_df = pd.DataFrame({"x": x_values, "y": y_values})
    plot_df["x"] = pd.to_numeric(plot_df["x"])
    plot_df["y"] = pd.to_numeric(plot_df["y"])
    jitterx = get_jitter_amount(plot_df["x"])
    jittery = get_jitter_amount(plot_df["y"])

    if mode == "jitter":
        plot_df["x"] = plot_df["x"] + pd.Series(
            [random.uniform(-jitterx, jitterx) for _ in plot_df.index],
            index=plot_df.index,
        )
        plot_df["y"] = plot_df["y"] + pd.Series(
            [random.uniform(-jittery, jittery) for _ in plot_df.index],
            index=plot_df.index,
        )
        plot_df["size"] = 2.5
        return plot_df.to_dict(orient="records")

    if mode == "heatmap":
        heatmap_df = plot_df.groupby(["x", "y"]).size().reset_index(name="count")
        return heatmap_df.to_dict(orient="records")

    plot_df["size"] = 2.5
    return plot_df.to_dict(orient="records")


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
    display_mode = request_data.get("display_mode", "scatter")

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
        if column in request_data:
            if not request_data[column]:
                # If column has no values (both yes and no are unchecked)
                # Return no data
                return {"facets": []}

            values = ", ".join([f"'{value}'" for value in request_data[column]])
            discrete_clauses.append(f'"{column}" IN ({values})')

    predicate_parts = continuous_clauses + discrete_clauses
    predicate = " AND ".join(predicate_parts) if predicate_parts else "TRUE"

    facet_query = f'''
      SELECT
          CAST("{facet}" AS VARCHAR) AS facet_value,
          LIST("{x_column}") AS x_values,
          LIST("{y_column}") AS y_values
      FROM 'placementdata.csv'
      WHERE {predicate}
      GROUP BY facet_value
      ORDER BY facet_value
  '''

    facet_results = duckdb.sql(facet_query).df()
    facets = []
    for _, facet_row in facet_results.iterrows():
        facets.append(
            {
                "label": str(facet_row["facet_value"]),
                "data": transform_points(
                    facet_row["x_values"], facet_row["y_values"], display_mode
                ),
            }
        )

    return {"facets": facets}


if __name__ == "__main__":
    app.run(debug=True, port=8000)
