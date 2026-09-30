from your_package.first import first_function

for raw in ("  Ship-Report2  ", "ship/report", "a" * 33):
    try:
        print({"input": raw, "label": first_function(raw), "state": "accepted"})
    except (TypeError, ValueError) as error:
        print({"input": raw, "state": "rejected", "reason": str(error)})
