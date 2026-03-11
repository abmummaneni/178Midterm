from flask import Flask, render_template, request
import duckdb
import numpy as np
from scipy.stats import linregress
from collections import Counter

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
    spread = np.ptp(series)
    return float(spread * 0.03 if spread else 0.1)


def to_numeric_arrays(x_values, y_values):
    x = np.asarray(x_values, dtype=float)
    y = np.asarray(y_values, dtype=float)
    return x, y


def summarize_axis(values):
    return {
        "min": float(values.min()),
        "max": float(values.max()),
        "mean": float(values.mean()),
        "median": float(np.median(values)),
        "std": float(values.std()),
    }


def build_stats(x_values, y_values):
    if len(x_values) == 0 or len(y_values) == 0:
        return None

    x, y = to_numeric_arrays(x_values, y_values)
    pearson_r = 0.0 if np.all(x == x[0]) or np.all(y == y[0]) else float(np.corrcoef(x, y)[0, 1])
    return {
        "count": int(x.size),
        "x": summarize_axis(x),
        "y": summarize_axis(y),
        "pearson_r": pearson_r,
    }


def build_trendline(x_values, y_values):
    if len(x_values) < 2 or len(y_values) < 2:
        return None

    x, y = to_numeric_arrays(x_values, y_values)
    if np.all(x == x[0]):
        return None

    fit = linregress(x, y)
    x_min = x.min()
    x_max = x.max()
    return {
        "points": [
            {"x": float(x_min), "y": float(fit.intercept + fit.slope * x_min)},
            {"x": float(x_max), "y": float(fit.intercept + fit.slope * x_max)},
        ],
        "slope": float(fit.slope),
        "r2": float(fit.rvalue**2),
    }


def transform_points(x_values, y_values, mode):
    if len(x_values) == 0 or len(y_values) == 0:
        return []

    x, y = to_numeric_arrays(x_values, y_values)

    if mode == "jitter":
        jitterx = get_jitter_amount(x)
        jittery = get_jitter_amount(y)
        x = x + np.random.normal(0, jitterx, size=x.size)
        y = y + np.random.normal(0, jittery, size=y.size)
        return [{"x": float(xi), "y": float(yi), "size": 2.5} for xi, yi in zip(x, y)]

    if mode == "heatmap":
        heatmap_counts = Counter(zip(x.tolist(), y.tolist()))
        return [
            {"x": float(xi), "y": float(yi), "count": count}
            for (xi, yi), count in sorted(heatmap_counts.items())
        ]

    return [{"x": float(xi), "y": float(yi), "size": 2.5} for xi, yi in zip(x, y)]


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
    filter_ranges_results = duckdb.sql(filter_ranges_query).fetchone()
    filter_ranges = {
        column: [filter_ranges_results[index * 2], filter_ranges_results[index * 2 + 1]]
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
    query_results = duckdb.sql(facet_query).fetchall()

    facets = [
        {
            "label": str(facet_value),
            "stats": build_stats(x_values, y_values),
            "trendline": build_trendline(x_values, y_values),
            "data": transform_points(x_values, y_values, display_mode),
        }
        for facet_value, x_values, y_values in query_results
    ]

    return {"facets": facets}


if __name__ == "__main__":
    app.run(debug=True, port=8000)
